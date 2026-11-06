/* Accounting tab. Data comes from the dashboard-api Edge Function, which verifies Telegram's
   signed login and only returns or changes the signed-in user's transactions. */
(function (App) {
    'use strict';

    const API = 'https://ajdphdgkwycecmtlxqgv.supabase.co/functions/v1/dashboard-api';
    const { $, esc, t } = App;
    const PAGE_SIZE = 50;
    const ACCENT = '#14b8a6';
    const EXTRA_CURRENCIES = ['EGP', 'USD', 'SAR', 'EUR', 'AED', 'GBP'];

    // icon, colour and Arabic name for each category (the stored names are English)
    const CATEGORIES = {
        'Food & Groceries': ['🛒', '#22c55e', 'طعام وبقالة'],
        'Dining & Cafes': ['☕', '#f97316', 'مطاعم وكافيهات'],
        'Transportation': ['🚗', '#3b82f6', 'مواصلات'],
        'Shopping & Personal': ['🛍️', '#ec4899', 'تسوق ومشتريات'],
        'Housing & Utilities': ['🏠', '#8b5cf6', 'السكن والفواتير'],
        'Internet & Mobile': ['📶', '#06b6d4', 'إنترنت وموبايل'],
        'Health & Fitness': ['💪', '#ef4444', 'صحة ورياضة'],
        'Entertainment & Social': ['🎉', '#eab308', 'ترفيه وخروجات'],
        'Education & Work Tools': ['📚', '#14b8a6', 'تعليم وأدوات عمل'],
        'Subscriptions & Digital Services': ['💻', '#6366f1', 'اشتراكات رقمية'],
        'Financial Transactions': ['🏦', '#10b981', 'معاملات مالية'],
        'Fees & Charges': ['🧾', '#64748b', 'رسوم وغرامات'],
        'Miscellaneous': ['📦', '#94a3b8', 'متنوع']
    };
    const catInfo = (c) => CATEGORIES[c] || ['📦', '#94a3b8', c];
    const catName = (c) => (App.state.lang === 'ar' ? catInfo(c)[2] : c);

    App.addStrings({
        emptyText: 'لا توجد مصروفات بعد', emptyHint: 'أرسل أول مصروف للبوت، مثل: 150 بنزين',
        spent: 'المصروفات', income: 'الدخل', net: 'الصافي', allMonths: 'كل الشهور',
        txCount: 'المعاملات', ofSpending: 'من المصروفات',
        byCategory: 'حسب الفئة', noSpending: 'لا توجد مصروفات في هذه الفترة',
        dailySpending: 'الإنفاق اليومي', monthlySpending: 'الإنفاق الشهري',
        avgDay: 'متوسط اليوم', maxDay: 'أعلى يوم', avgMonth: 'متوسط الشهر', maxMonth: 'أعلى شهر',
        transactionsTitle: 'المعاملات', searchPlaceholder: '🔍 ابحث...', noMatches: 'لا توجد معاملات', showMore: 'عرض المزيد',
        prevMonth: 'الشهر السابق', nextMonth: 'الشهر التالي', month: 'الشهر', currency: 'العملة',
        editTitle: 'تعديل المعاملة', amount: 'المبلغ', type: 'النوع', category: 'الفئة', date: 'التاريخ',
        description: 'الوصف', store: 'المتجر', invalidAmount: 'أدخل مبلغاً أكبر من صفر',
        types: { Expense: 'مصروف', Income: 'دخل', Transfer: 'تحويل' }
    }, {
        emptyText: 'No expenses yet', emptyHint: 'Send your first expense to the bot, e.g. 150 fuel',
        spent: 'Spent', income: 'Income', net: 'Net', allMonths: 'All months',
        txCount: 'Transactions', ofSpending: 'Of spending',
        byCategory: 'By category', noSpending: 'No spending in this period',
        dailySpending: 'Daily spending', monthlySpending: 'Monthly spending',
        avgDay: 'Daily average', maxDay: 'Highest day', avgMonth: 'Monthly average', maxMonth: 'Highest month',
        transactionsTitle: 'Transactions', searchPlaceholder: '🔍 Search...', noMatches: 'No transactions', showMore: 'Show more',
        prevMonth: 'Previous month', nextMonth: 'Next month', month: 'Month', currency: 'Currency',
        editTitle: 'Edit transaction', amount: 'Amount', type: 'Type', category: 'Category', date: 'Date',
        description: 'Description', store: 'Store', invalidAmount: 'Enter an amount greater than zero',
        types: { Expense: 'Expense', Income: 'Income', Transfer: 'Transfer' }
    });

    // Older versions saved "all:EGP" / "only:USD"; keep just the currency.
    const savedCurrency = (App.prefs.get('dash.currency') || '').split(':').pop();
    const acc = { currency: savedCurrency, month: null, category: 'all', search: '', listLimit: PAGE_SIZE };
    let data = { items: [], rates: {}, categories: [] };
    let status = 'loading';
    let errorMessage = '';
    let periodItems = [];
    let months = [];
    let chart = null;

    // ---------- money ----------
    function currenciesByUse() {
        const counts = {};
        data.items.forEach(tx => { counts[tx.currency] = (counts[tx.currency] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([cur]) => cur);
    }
    function currencyOptions() { return [...new Set([...currenciesByUse(), 'USD'])]; }
    function ensureCurrency() {
        const options = currencyOptions();
        if (!options.includes(acc.currency)) acc.currency = options[0] || 'EGP';
    }
    function convert(amount, from, to) {
        if (from === to) return amount;
        const a = data.rates[from];
        const b = data.rates[to];
        return a && b ? (amount / a) * b : 0;
    }
    const val = (tx) => convert(tx.amount, tx.currency, acc.currency);
    const total = (list) => list.reduce((sum, tx) => sum + val(tx), 0);
    const ofType = (list, type) => list.filter(tx => tx.type === type);
    const money = (n) => App.fmtMoney(n, acc.currency);

    // ---------- data ----------
    async function load() {
        try {
            const res = await App.api(API, { action: 'list' });
            data = {
                items: [...(res.rawExpenses || []), ...(res.rawIncome || []), ...(res.rawTransfers || [])],
                rates: res.rates || {},
                categories: res.categories || []
            };
            status = data.items.length ? 'ready' : 'empty';
            ensureCurrency();
        } catch (err) {
            if (err.status === 403) throw err;
            status = 'error';
            errorMessage = err.message;
        }
    }

    function fillSelect(select, options, value) {
        select.innerHTML = '';
        options.forEach(([optionValue, label]) => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = label;
            select.appendChild(option);
        });
        select.value = value;
    }

    function populatePeriod() {
        const currentYm = App.todayIso().slice(0, 7);
        months = [...new Set([currentYm, ...data.items.map(tx => tx.date.slice(0, 7))])].sort();
        if (!acc.month || (acc.month !== 'all' && !months.includes(acc.month))) acc.month = currentYm;
        fillSelect($('monthFilter'), [...[...months].reverse().map(m => [m, App.monthName(m)]), ['all', t('allMonths')]], acc.month);
        const index = months.indexOf(acc.month);
        $('prevMonth').disabled = acc.month === 'all' || index <= 0;
        $('nextMonth').disabled = acc.month === 'all' || index >= months.length - 1;
        ensureCurrency();
        fillSelect($('currencyFilter'), currencyOptions().map(c => [c, c]), acc.currency);
    }

    // ---------- rendering ----------
    function render() {
        $('accError').classList.toggle('hidden', status !== 'error');
        $('accEmpty').classList.toggle('hidden', status !== 'empty');
        $('accContent').classList.toggle('hidden', status !== 'ready');
        if (status === 'error') {
            $('accError').innerHTML = `<div class="card"><div class="state-icon">⚠️</div><div>${esc(t('loadError'))}</div><div class="hint">${esc(errorMessage)}</div><button class="btn primary" type="button" data-retry>${esc(t('retry'))}</button></div>`;
        }
        if (status !== 'ready') return;
        populatePeriod();

        const catMode = acc.category !== 'all';
        const pool = data.items.filter(tx => !catMode || tx.category === acc.category);
        const range = acc.month === 'all' ? null : App.monthRange(acc.month);
        periodItems = range ? pool.filter(tx => tx.date >= range.from && tx.date < range.to) : pool;

        const chip = $('categoryChip');
        chip.classList.toggle('hidden', !catMode);
        if (catMode) {
            chip.style.setProperty('--c', catInfo(acc.category)[1]);
            $('categoryChipLabel').textContent = `${catInfo(acc.category)[0]} ${catName(acc.category)}`;
        }
        renderHero(catMode);
        $('categoryCard').classList.toggle('hidden', catMode);
        if (!catMode) renderCategories();
        renderChart(pool, catMode);
        renderList();
    }

    function renderHero(catMode) {
        const expenses = ofType(periodItems, 'Expense');
        const spent = total(expenses);
        $('heroSpent').textContent = money(spent);
        if (!catMode) {
            const earned = total(ofType(periodItems, 'Income'));
            const net = earned - spent;
            $('heroMoneyLabel').textContent = t('spent');
            $('heroPill1Label').textContent = t('income');
            $('heroPill1').textContent = money(earned);
            $('heroPill2Label').textContent = t('net');
            $('heroPill2').textContent = (net >= 0 ? '+' : '−') + money(Math.abs(net));
        } else {
            const range = acc.month === 'all' ? null : App.monthRange(acc.month);
            const allSpent = total(data.items.filter(tx => tx.type === 'Expense' && (!range || (tx.date >= range.from && tx.date < range.to))));
            $('heroMoneyLabel').textContent = `${catInfo(acc.category)[0]} ${catName(acc.category)}`;
            $('heroPill1Label').textContent = t('txCount');
            $('heroPill1').textContent = App.fmtNum(expenses.length);
            $('heroPill2Label').textContent = t('ofSpending');
            $('heroPill2').textContent = allSpent ? `${Math.round((spent / allSpent) * 100)}%` : '—';
        }
    }

    function renderCategories() {
        const sums = {};
        ofType(periodItems, 'Expense').forEach(tx => { sums[tx.category] = (sums[tx.category] || 0) + val(tx); });
        const sorted = Object.entries(sums).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
        const sum = sorted.reduce((s, [, v]) => s + v, 0);
        $('categoryList').innerHTML = sorted.length ? sorted.map(([category, value]) => {
            const [icon, color] = catInfo(category);
            return `
                <div class="cat-row" data-category="${esc(category)}" role="button" tabindex="0" style="--c:${color}">
                    <div class="cat-icon">${icon}</div>
                    <div class="cat-body">
                        <div class="cat-top"><span>${esc(catName(category))}</span><span class="cat-amount">${esc(money(value))}</span></div>
                        <div class="cat-bar"><i style="width:${Math.max(2, (value / sum) * 100)}%"></i></div>
                    </div>
                </div>`;
        }).join('') : `<div class="empty">${esc(t('noSpending'))}</div>`;
    }

    function renderChart(pool, catMode) {
        const expenses = ofType(pool, 'Expense');
        const currentYm = App.todayIso().slice(0, 7);
        const color = catMode ? catInfo(acc.category)[1] : ACCENT;
        let labels;
        let values;
        let stats;
        let highlight = -1;

        if (!catMode && acc.month !== 'all') {
            const ym = acc.month;
            const inMonth = expenses.filter(tx => tx.date.startsWith(ym));
            const lastDay = inMonth.reduce((max, tx) => Math.max(max, Number(tx.date.slice(8, 10))), 0);
            const days = ym === currentYm ? Math.max(Number(App.todayIso().slice(8, 10)), lastDay) : App.daysInMonth(ym);
            values = new Array(days).fill(0);
            inMonth.forEach(tx => { values[Number(tx.date.slice(8, 10)) - 1] += val(tx); });
            labels = values.map((_, i) => String(i + 1));
            const maxValue = Math.max(0, ...values);
            $('trendTitle').textContent = t('dailySpending');
            stats = [
                [t('avgDay'), money(values.reduce((a, b) => a + b, 0) / (days || 1))],
                [t('maxDay'), maxValue ? `${money(maxValue)}` : '—']
            ];
        } else {
            const yms = expenses.map(tx => tx.date.slice(0, 7));
            const end = acc.month === 'all' ? [currentYm, ...yms].reduce((a, b) => (a > b ? a : b)) : acc.month;
            let start = acc.month === 'all' ? (yms.length ? yms.reduce((a, b) => (a < b ? a : b)) : end) : App.addMonths(end, -11);
            if (start > end) start = end;
            const span = [];
            for (let m = start; m <= end; m = App.addMonths(m, 1)) span.push(m);
            const shown = span.slice(-24);
            values = shown.map(m => total(expenses.filter(tx => tx.date.startsWith(m))));
            const spansYears = shown[0].slice(0, 4) !== shown[shown.length - 1].slice(0, 4);
            labels = shown.map(m => App.monthName(m, spansYears ? 'shortYear' : 'short'));
            highlight = acc.month === 'all' ? -1 : shown.indexOf(acc.month);
            const complete = values.filter((_, i) => shown[i] < currentYm);
            const basis = complete.length ? complete : values;
            const maxIndex = values.indexOf(Math.max(0, ...values));
            $('trendTitle').textContent = t('monthlySpending');
            stats = [
                [t('avgMonth'), money(basis.reduce((a, b) => a + b, 0) / (basis.length || 1))],
                [t('maxMonth'), values[maxIndex] ? `${money(values[maxIndex])} · ${App.monthName(shown[maxIndex], 'short')}` : '—']
            ];
        }

        if (chart) chart.destroy();
        chart = null;
        if (window.Chart) {
            Chart.defaults.color = App.cssVar('--tg-theme-hint-color', '#8b95a7');
            Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
            chart = new Chart($('trendChart').getContext('2d'), {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        data: values,
                        backgroundColor: values.map((_, i) => (highlight < 0 || i === highlight ? color : color + '55')),
                        borderRadius: 6,
                        maxBarThickness: 22
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 250 },
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => money(ctx.parsed.y) } } },
                    scales: {
                        x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 8 } },
                        y: { beginAtZero: true, border: { display: false }, grid: { color: 'rgba(128,128,128,0.12)' }, ticks: { maxTicksLimit: 4, callback: v => App.compact(v) } }
                    }
                }
            });
        }
        $('trendStats').innerHTML = stats.map(([label, value]) => `<div class="mini-stat"><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join('');
    }

    function txHtml(tx) {
        const [icon, color] = catInfo(tx.category);
        const kind = tx.type === 'Income' ? 'income' : tx.type === 'Transfer' ? 'transfer' : '';
        const sub = [catName(tx.category), tx.store].filter(Boolean).join(' · ');
        return `
            <div class="tx" data-id="${tx.id}" role="button" tabindex="0" style="--c:${color}">
                <div class="tx-icon">${icon}</div>
                <div class="tx-main">
                    <div class="tx-title">${esc(tx.description || catName(tx.category))}</div>
                    <div class="tx-sub">${esc(sub)}</div>
                </div>
                <div class="tx-amount">
                    <div class="tx-value ${kind}">${esc((kind === 'income' ? '+' : '') + App.fmtNum(tx.amount))}</div>
                    <div class="tx-cur">${esc(tx.currency)}</div>
                </div>
            </div>`;
    }

    function renderList() {
        const query = App.normalize(acc.search.trim());
        let list = periodItems;
        if (query) {
            list = list.filter(tx => App.normalize(`${tx.description} ${tx.store} ${tx.category} ${catName(tx.category)} ${tx.raw} ${tx.amount}`).includes(query));
        }
        list = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
        const daySpend = {};
        ofType(list, 'Expense').forEach(tx => { daySpend[tx.date] = (daySpend[tx.date] || 0) + val(tx); });
        const shown = list.slice(0, acc.listLimit);
        let html = '';
        let day = null;
        shown.forEach(tx => {
            if (tx.date !== day) {
                day = tx.date;
                html += `<div class="day-header"><span>${esc(App.dayName(day, { weekday: 'long', day: 'numeric', month: 'short' }))}</span><span class="day-total">${daySpend[day] ? esc(money(daySpend[day])) : ''}</span></div>`;
            }
            html += txHtml(tx);
        });
        $('transactionList').innerHTML = html || `<div class="empty">${esc(t('noMatches'))}</div>`;
        const remaining = list.length - shown.length;
        $('moreButton').classList.toggle('hidden', remaining <= 0);
        $('moreButton').textContent = `${t('showMore')} (${App.fmtNum(remaining)})`;
    }

    // ---------- edit sheet ----------
    function openEdit(tx) {
        const sourceIcon = { csv_import: '📄 ', text: '💬 ' }[tx.source] || ''; // photo/voice text already starts with 📷/🎤
        const currencies = [...new Set([tx.currency, ...currenciesByUse(), ...EXTRA_CURRENCIES])];
        const categories = [...new Set([tx.category, ...data.categories])];
        App.openSheet(t('editTitle'), `
            ${tx.raw ? `<div class="raw">${esc(sourceIcon + tx.raw)}</div>` : ''}
            <div class="row2 wide-first">
                <div class="field"><label>${esc(t('amount'))}</label><input id="eAmount" type="number" inputmode="decimal" step="0.01" min="0.01" dir="ltr" value="${tx.amount}"></div>
                <div class="field"><label>${esc(t('currency'))}</label><select id="eCurrency">${currencies.map(c => `<option value="${esc(c)}" ${c === tx.currency ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
            </div>
            <div class="field"><label>${esc(t('type'))}</label>${App.segmented('etype', ['Expense', 'Income', 'Transfer'].map(x => [x, App.L().types[x]]), tx.type)}</div>
            <div class="field"><label>${esc(t('category'))}</label><select id="eCategory">${categories.map(c => `<option value="${esc(c)}" ${c === tx.category ? 'selected' : ''}>${esc(catInfo(c)[0] + ' ' + catName(c))}</option>`).join('')}</select></div>
            <div class="field"><label>${esc(t('date'))}</label><input id="eDate" type="date" dir="ltr" value="${esc(tx.date)}"></div>
            <div class="field"><label>${esc(t('description'))}</label><input id="eDescription" type="text" maxlength="300" value="${esc(tx.description)}"></div>
            <div class="field"><label>${esc(t('store'))}</label><input id="eStore" type="text" maxlength="120" value="${esc(tx.store)}"></div>`, [
            { label: t('delete'), style: 'danger', onClick: () => App.confirmBox(t('confirmDelete'), ok => ok && remove(tx)) },
            { label: t('cancel'), onClick: App.closeSheet },
            { label: t('save'), style: 'primary', onClick: () => save(tx) }
        ]);
    }

    async function save(tx) {
        const amount = Number($('eAmount').value);
        if (!(amount > 0)) return App.sheetError(t('invalidAmount'));
        const changes = {};
        if (amount !== tx.amount) changes.amount = amount;
        if ($('eCurrency').value !== tx.currency) changes.currency = $('eCurrency').value;
        if (App.segValue('etype') !== tx.type) changes.type = App.segValue('etype');
        if ($('eCategory').value !== tx.category) changes.category = $('eCategory').value;
        if ($('eDate').value && $('eDate').value !== tx.date) changes.date = $('eDate').value;
        if ($('eDescription').value.trim() !== (tx.description || '')) changes.description = $('eDescription').value.trim();
        if ($('eStore').value.trim() !== (tx.store || '')) changes.store = $('eStore').value.trim();
        if (!Object.keys(changes).length) return App.closeSheet();
        App.sheetBusy(true);
        try {
            const res = await App.api(API, { action: 'update', id: tx.id, changes });
            const index = data.items.findIndex(x => x.id === tx.id);
            if (index >= 0) data.items[index] = res.item;
            App.haptic('success');
            App.closeSheet();
            render();
        } catch (err) {
            App.haptic('error');
            App.sheetError(err.message);
            App.sheetBusy(false);
        }
    }

    async function remove(tx) {
        App.sheetBusy(true);
        try {
            await App.api(API, { action: 'delete', id: tx.id });
            data.items = data.items.filter(x => x.id !== tx.id);
            if (!data.items.length) status = 'empty';
            App.haptic('success');
            App.closeSheet();
            render();
        } catch (err) {
            App.haptic('error');
            App.sheetError(err.message);
            App.sheetBusy(false);
        }
    }

    // ---------- events ----------
    function stepMonth(direction) {
        const index = months.indexOf(acc.month);
        const next = months[index + direction];
        if (!next) return;
        acc.month = next;
        acc.listLimit = PAGE_SIZE;
        App.haptic('select');
        render();
    }

    function bind() {
        $('prevMonth').addEventListener('click', () => stepMonth(-1));
        $('nextMonth').addEventListener('click', () => stepMonth(1));
        $('monthFilter').addEventListener('change', e => { acc.month = e.target.value; acc.listLimit = PAGE_SIZE; App.haptic('select'); render(); });
        $('currencyFilter').addEventListener('change', e => {
            acc.currency = e.target.value;
            App.prefs.set('dash.currency', acc.currency);
            App.haptic('select');
            render();
        });
        $('clearCategory').addEventListener('click', () => { acc.category = 'all'; acc.listLimit = PAGE_SIZE; App.haptic('select'); render(); });
        $('searchInput').addEventListener('input', e => { acc.search = e.target.value; acc.listLimit = PAGE_SIZE; renderList(); });
        $('moreButton').addEventListener('click', () => { acc.listLimit += PAGE_SIZE; renderList(); });
        $('transactionList').addEventListener('click', e => {
            const row = e.target.closest('.tx');
            const tx = row && data.items.find(x => x.id === Number(row.dataset.id));
            if (tx) openEdit(tx);
        });
        $('categoryList').addEventListener('click', e => {
            const row = e.target.closest('.cat-row');
            if (!row) return;
            acc.category = row.dataset.category;
            acc.listLimit = PAGE_SIZE;
            App.haptic('select');
            render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        $('accError').addEventListener('click', async e => {
            if (!e.target.closest('[data-retry]')) return;
            status = 'loading';
            await load();
            render();
        });
    }

    App.addLoader(load);
    App.register('accounting', { render, applyLanguage: () => { if (status === 'ready' && App.state.view === 'accounting') render(); } });

    /** Money spent and earned between two dates (inclusive), in the currency the Accounting tab shows. */
    App.accounting = {
        totalsBetween(from, to) {
            if (status !== 'ready') return null;
            ensureCurrency();
            const items = data.items.filter(tx => tx.date >= from && tx.date <= to);
            return { spent: total(ofType(items, 'Expense')), earned: total(ofType(items, 'Income')), cur: acc.currency };
        }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
    else bind();
})(window.App);
