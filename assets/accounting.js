/* Accounting tab. Data comes from the dashboard-api Edge Function, which verifies Telegram's
   signed login and only returns or changes the signed-in user's transactions. */
(function (App) {
    'use strict';

    const API = 'https://ajdphdgkwycecmtlxqgv.supabase.co/functions/v1/dashboard-api';
    const { $, esc, ltr, t } = App;
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4', '#84cc16', '#f97316', '#14b8a6', '#a855f7', '#eab308'];
    const EXTRA_CURRENCIES = ['EGP', 'USD', 'SAR', 'EUR', 'AED', 'GBP'];
    const PAGE_SIZE = 50;

    App.addStrings({
        emptyText: 'لا توجد مصروفات بعد', emptyHint: 'أرسل أول مصروف للبوت، مثل: 150 بنزين',
        labelMonth: 'الشهر', labelCategory: 'الفئة', labelCurrency: 'العملة',
        allMonths: 'كل الشهور', allCategories: 'كل الفئات', showIn: 'الكل بـ {cur}', only: '{cur} فقط',
        expenses: 'المصروفات', income: 'الدخل', net: 'الصافي', count: 'المعاملات',
        categorySpend: 'مصروفات الفئة', share: 'من كل المصروفات', avgPerTx: 'متوسط المعاملة',
        vsMonth: 'عن {month}', vsMonthPartial: 'عن نفس الفترة من {month}',
        fxNote: 'تحويل العملات بأسعار {date}: {pairs}', fxApprox: 'تقريبية',
        comparisonTitle: 'الدخل مقابل المصروفات', incomeLabel: '💰 الدخل', expenseLabel: '💸 المصروفات', balanceText: 'الرصيد',
        dailyTitle: 'الإنفاق اليومي — {month}', monthlyTitle: 'الإنفاق الشهري', categoryTrendTitle: 'الإنفاق الشهري: {category}',
        avgDay: 'متوسط يومي', maxDay: 'أعلى يوم', spendDays: 'أيام بها إنفاق', zeroDays: 'أيام بدون إنفاق',
        avgMonth: 'متوسط شهري', maxMonth: 'أعلى شهر', minMonth: 'أقل شهر', monthsCount: 'عدد الشهور',
        monthsWithSpend: 'شهور بها إنفاق', vsAverage: '{month} مقارنة بالمتوسط',
        categoryChartTitle: 'الإنفاق حسب الفئة', categoryHint: 'اضغط على فئة لعرض تفاصيلها',
        incomeVsExpensesTitle: 'الدخل والمصروفات شهرياً', transactionsTitle: 'المعاملات',
        searchPlaceholder: '🔍 ابحث: وصف، متجر، مبلغ...', editHint: 'اضغط على أي معاملة لتعديلها أو حذفها',
        showMore: 'عرض المزيد ({n})', noMatches: 'لا توجد معاملات مطابقة', of: 'من',
        editTitle: 'تعديل المعاملة', amount: 'المبلغ', currency: 'العملة', type: 'النوع', category: 'الفئة', date: 'التاريخ',
        description: 'الوصف', store: 'المتجر', invalidAmount: 'أدخل مبلغاً أكبر من صفر',
        types: { Expense: 'مصروف', Income: 'دخل', Transfer: 'تحويل' }
    }, {
        emptyText: 'No expenses yet', emptyHint: 'Send your first expense to the bot, e.g. 150 fuel',
        labelMonth: 'Month', labelCategory: 'Category', labelCurrency: 'Currency',
        allMonths: 'All months', allCategories: 'All categories', showIn: 'All in {cur}', only: '{cur} only',
        expenses: 'Expenses', income: 'Income', net: 'Net', count: 'Transactions',
        categorySpend: 'Category spending', share: 'Of all spending', avgPerTx: 'Average',
        vsMonth: 'vs {month}', vsMonthPartial: 'vs same days of {month}',
        fxNote: 'Converted at rates from {date}: {pairs}', fxApprox: 'approximate',
        comparisonTitle: 'Income vs Expenses', incomeLabel: '💰 Income', expenseLabel: '💸 Expenses', balanceText: 'Balance',
        dailyTitle: 'Daily spending — {month}', monthlyTitle: 'Monthly spending', categoryTrendTitle: 'Monthly spending: {category}',
        avgDay: 'Daily average', maxDay: 'Highest day', spendDays: 'Days with spending', zeroDays: 'No-spend days',
        avgMonth: 'Monthly average', maxMonth: 'Highest month', minMonth: 'Lowest month', monthsCount: 'Months',
        monthsWithSpend: 'Months with spending', vsAverage: '{month} vs average',
        categoryChartTitle: 'Spending by category', categoryHint: 'Tap a category to see its details',
        incomeVsExpensesTitle: 'Income and expenses by month', transactionsTitle: 'Transactions',
        searchPlaceholder: '🔍 Search: description, store, amount...', editHint: 'Tap any transaction to edit or delete it',
        showMore: 'Show more ({n})', noMatches: 'No matching transactions', of: 'of',
        editTitle: 'Edit transaction', amount: 'Amount', currency: 'Currency', type: 'Type', category: 'Category', date: 'Date',
        description: 'Description', store: 'Store', invalidAmount: 'Enter an amount greater than zero',
        types: { Expense: 'Expense', Income: 'Income', Transfer: 'Transfer' }
    });

    const acc = {
        currencyChoice: App.prefs.get('dash.currency') || '',
        month: null,
        category: 'all',
        search: '',
        listLimit: PAGE_SIZE
    };
    let data = { items: [], rates: {}, categories: [], fxDate: '' };
    let status = 'loading';
    let errorMessage = '';
    let periodItems = [];
    const charts = {};

    // ---------- currency ----------
    function currenciesByUse() {
        const counts = {};
        data.items.forEach(tx => { counts[tx.currency] = (counts[tx.currency] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([cur]) => cur);
    }
    const unit = () => acc.currencyChoice.split(':')[1];
    const onlyMode = () => acc.currencyChoice.startsWith('only:');
    function convert(amount, from, to) {
        if (from === to) return amount;
        const a = data.rates[from];
        const b = data.rates[to];
        return a && b ? (amount / a) * b : 0;
    }
    const val = (tx) => convert(tx.amount, tx.currency, unit());
    const total = (list) => list.reduce((sum, tx) => sum + val(tx), 0);
    const ofType = (list, type) => list.filter(tx => tx.type === type);
    const inRange = (tx, from, to) => tx.date >= from && tx.date < to;
    const matchesCurrency = (tx) => !onlyMode() || tx.currency === unit();
    const matchesCategory = (tx) => acc.category === 'all' || tx.category === acc.category;

    function currencyOptions() {
        const used = currenciesByUse();
        const options = [...new Set([...used, 'USD'])].map(cur => ['all:' + cur, t('showIn', { cur })]);
        if (used.length > 1) used.forEach(cur => options.push(['only:' + cur, t('only', { cur })]));
        return { options, used };
    }
    function ensureCurrency() {
        const { options, used } = currencyOptions();
        if (!options.some(([value]) => value === acc.currencyChoice)) acc.currencyChoice = 'all:' + (used[0] || 'EGP');
        return options;
    }

    // ---------- data ----------
    async function load() {
        try {
            const res = await App.api(API, { action: 'list' });
            data = {
                items: [...(res.rawExpenses || []), ...(res.rawIncome || []), ...(res.rawTransfers || [])],
                rates: res.rates || {},
                categories: res.categories || [],
                fxDate: res.fxDate || ''
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

    function populateFilters() {
        const currentYm = App.todayIso().slice(0, 7);
        const months = [...new Set([currentYm, ...data.items.map(tx => tx.date.slice(0, 7))])].sort().reverse();
        if (!acc.month || (acc.month !== 'all' && !months.includes(acc.month))) acc.month = currentYm;
        fillSelect($('monthFilter'), [['all', t('allMonths')], ...months.map(m => [m, App.monthName(m)])], acc.month);
        const categories = [...new Set(ofType(data.items, 'Expense').map(tx => tx.category))].sort();
        if (acc.category !== 'all' && !categories.includes(acc.category)) acc.category = 'all';
        fillSelect($('categoryFilter'), [['all', t('allCategories')], ...categories.map(c => [c, c])], acc.category);
        fillSelect($('currencyFilter'), ensureCurrency(), acc.currencyChoice);
    }

    // ---------- rendering ----------
    function render() {
        $('accError').classList.toggle('hidden', status !== 'error');
        $('accEmpty').classList.toggle('hidden', status !== 'empty');
        $('accContent').classList.toggle('hidden', status !== 'ready');
        if (status === 'error') {
            $('accError').innerHTML = `<div class="card"><div class="state-icon">⚠️</div><div>${esc(t('loadError'))}</div><div class="hint">${esc(errorMessage)}</div><button class="btn primary" type="button" data-retry>${esc(t('retry'))}</button></div>`;
        }
        if (status !== 'ready') {
            $('accSub').textContent = '';
            return;
        }
        applyChartTheme();
        populateFilters();
        $('accSub').textContent = acc.month === 'all' ? t('allMonths') : App.monthName(acc.month);

        const catMode = acc.category !== 'all';
        const pool = data.items.filter(tx => matchesCurrency(tx) && matchesCategory(tx));
        const range = acc.month === 'all' ? null : App.monthRange(acc.month);
        periodItems = range ? pool.filter(tx => inRange(tx, range.from, range.to)) : pool;

        renderKpis(pool, catMode);
        renderFxNote();
        $('comparisonCard').classList.toggle('hidden', catMode);
        $('categoryCard').classList.toggle('hidden', catMode);
        $('monthlyCard').classList.toggle('hidden', catMode);
        if (!catMode) {
            renderComparison();
            renderCategories();
            renderMonthly(pool);
        }
        renderTrend(pool, catMode);
        renderList();
    }

    // For the current month, compare with the same days of last month.
    function comparisonPeriod() {
        if (acc.month === 'all') return null;
        const prev = App.addMonths(acc.month, -1);
        const today = App.todayIso();
        if (acc.month !== today.slice(0, 7)) return { ...App.monthRange(prev), label: t('vsMonth', { month: App.monthName(prev, 'short') }) };
        const day = Math.min(Number(today.slice(8, 10)), App.daysInMonth(prev));
        return { from: prev + '-01', to: App.addDays(`${prev}-${App.pad(day)}`, 1), label: t('vsMonthPartial', { month: App.monthName(prev, 'short') }) };
    }

    function deltaHtml(current, previous, goodWhenUp, period, asMoney) {
        if (!period) return '';
        const label = esc(period.label);
        if (asMoney) {
            const diff = current - previous;
            if (Math.abs(diff) < 0.005) return `= ${label}`;
            const cls = (diff > 0) === goodWhenUp ? 'good' : 'bad';
            return `<span class="${cls}">${esc(ltr(`${diff > 0 ? '▲' : '▼'} ${App.fmtMoney(Math.abs(diff), unit())}`))}</span> ${label}`;
        }
        if (!previous) return '';
        const pct = ((current - previous) / Math.abs(previous)) * 100;
        if (Math.abs(pct) < 0.5) return `= ${label}`;
        const cls = goodWhenUp === null ? '' : ((pct > 0) === goodWhenUp ? 'good' : 'bad');
        return `<span class="${cls}">${esc(ltr(`${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%`))}</span> ${label}`;
    }

    function renderKpis(pool, catMode) {
        const cur = unit();
        const period = comparisonPeriod();
        const prevItems = period ? pool.filter(tx => inRange(tx, period.from, period.to)) : [];
        const expenses = ofType(periodItems, 'Expense');
        const income = ofType(periodItems, 'Income');
        const prevExpenses = ofType(prevItems, 'Expense');
        const prevIncome = ofType(prevItems, 'Income');
        const spent = total(expenses);
        let cards;
        if (!catMode) {
            const earned = total(income);
            const net = earned - spent;
            cards = [
                { icon: '💸', label: t('expenses'), value: App.fmtMoney(spent, cur), delta: deltaHtml(spent, total(prevExpenses), false, period) },
                { icon: '💰', label: t('income'), value: App.fmtMoney(earned, cur), delta: deltaHtml(earned, total(prevIncome), true, period) },
                { icon: '📊', label: t('net'), value: App.fmtMoney(net, cur), color: net >= 0 ? 'var(--income)' : 'var(--expense)',
                  delta: deltaHtml(net, total(prevIncome) - total(prevExpenses), true, period, true) },
                { icon: '🧾', label: t('count'), value: App.fmtNum(periodItems.length), delta: deltaHtml(periodItems.length, prevItems.length, null, period) }
            ];
        } else {
            const range = acc.month === 'all' ? null : App.monthRange(acc.month);
            const allSpending = total(data.items.filter(tx => tx.type === 'Expense' && matchesCurrency(tx) && (!range || inRange(tx, range.from, range.to))));
            const share = allSpending ? (spent / allSpending) * 100 : 0;
            cards = [
                { icon: '💸', label: t('categorySpend'), value: App.fmtMoney(spent, cur), delta: deltaHtml(spent, total(prevExpenses), false, period) },
                { icon: '🥧', label: t('share'), value: share.toFixed(share < 10 ? 1 : 0) + '%' },
                { icon: '🧾', label: t('count'), value: App.fmtNum(expenses.length), delta: deltaHtml(expenses.length, prevExpenses.length, null, period) },
                { icon: '🧮', label: t('avgPerTx'), value: expenses.length ? App.fmtMoney(spent / expenses.length, cur) : '—' }
            ];
        }
        cards.forEach((card, i) => {
            $('kpiIcon' + i).textContent = card.icon;
            $('kpiLabel' + i).textContent = card.label;
            $('kpiValue' + i).textContent = card.value;
            $('kpiValue' + i).style.color = card.color || '';
            $('kpiDelta' + i).innerHTML = card.delta || '';
        });
    }

    function renderFxNote() {
        const note = $('fxNote');
        const cur = unit();
        const others = onlyMode() ? [] : [...new Set(periodItems.map(tx => tx.currency))].filter(c => c !== cur && data.rates[c]);
        if (!others.length || !data.rates[cur]) {
            note.classList.add('hidden');
            return;
        }
        const pairs = others.map(c => {
            const rate = convert(1, c, cur);
            return rate >= 1 ? `1 ${c} = ${App.fmtNum(rate)} ${cur}` : `1 ${cur} = ${App.fmtNum(convert(1, cur, c))} ${c}`;
        }).join(' · ');
        const parsed = data.fxDate && data.fxDate !== 'fallback' ? new Date(data.fxDate) : null;
        const date = parsed && !isNaN(parsed) ? parsed.toLocaleDateString(App.locale(), { day: 'numeric', month: 'short' }) : t('fxApprox');
        note.textContent = '💱 ' + t('fxNote', { date, pairs: ltr(pairs) });
        note.classList.remove('hidden');
    }

    function renderComparison() {
        const cur = unit();
        const spent = total(ofType(periodItems, 'Expense'));
        const earned = total(ofType(periodItems, 'Income'));
        const max = Math.max(spent, earned, 1);
        const incomePct = Math.round((earned / max) * 100);
        const expensePct = Math.round((spent / max) * 100);
        $('incomeBarAmount').textContent = App.fmtMoney(earned, cur);
        $('expenseBarAmount').textContent = App.fmtMoney(spent, cur);
        $('incomeBar').style.width = Math.max(incomePct, 2) + '%';
        $('incomeBar').textContent = incomePct >= 12 ? incomePct + '%' : '';
        $('expenseBar').style.width = Math.max(expensePct, 2) + '%';
        $('expenseBar').textContent = expensePct >= 12 ? expensePct + '%' : '';
        const net = earned - spent;
        $('balance').className = 'balance ' + (net >= 0 ? 'positive' : 'negative');
        $('balanceValue').textContent = App.fmtMoney(net, cur);
    }

    function applyChartTheme() {
        if (!window.Chart) return;
        Chart.defaults.color = App.cssVar('--tg-theme-hint-color', '#8b95a7');
        Chart.defaults.borderColor = 'rgba(128, 128, 128, 0.15)';
        Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    }

    function drawChart(key, canvasId, config) {
        if (charts[key]) charts[key].destroy();
        charts[key] = null;
        if (!window.Chart) return;
        charts[key] = new Chart($(canvasId).getContext('2d'), config);
    }

    function barOptions(cur, extra) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 250 },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${App.fmtMoney(ctx.parsed.y, cur)}` } }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 6 } },
                y: { beginAtZero: true, ticks: { callback: value => App.compact(value) } }
            },
            ...(extra || {})
        };
    }

    function monthSpan(pool) {
        const currentYm = App.todayIso().slice(0, 7);
        const yms = pool.map(tx => tx.date.slice(0, 7));
        const first = yms.length ? yms.reduce((a, b) => (a < b ? a : b)) : currentYm;
        const last = [currentYm, ...yms].reduce((a, b) => (a > b ? a : b));
        const end = acc.month === 'all' ? last : acc.month;
        const start = acc.month === 'all' ? (first < end ? first : end) : App.addMonths(end, -11);
        const months = [];
        for (let m = start; m <= end; m = App.addMonths(m, 1)) months.push(m);
        return months.slice(-36);
    }

    function renderTrend(pool, catMode) {
        const cur = unit();
        const expenses = ofType(pool, 'Expense');
        const today = App.todayIso();
        const currentYm = today.slice(0, 7);
        let labels;
        let values;
        let highlight = -1;
        let stats;

        if (!catMode && acc.month !== 'all') {
            const ym = acc.month;
            const monthExpenses = expenses.filter(tx => tx.date.startsWith(ym));
            const lastDataDay = monthExpenses.reduce((max, tx) => Math.max(max, Number(tx.date.slice(8, 10))), 0);
            const days = ym === currentYm ? Math.max(Number(today.slice(8, 10)), lastDataDay) : App.daysInMonth(ym);
            values = new Array(days).fill(0);
            monthExpenses.forEach(tx => { values[Number(tx.date.slice(8, 10)) - 1] += val(tx); });
            labels = values.map((_, i) => String(i + 1));
            const spent = values.reduce((a, b) => a + b, 0);
            const spendDays = values.filter(v => v > 0).length;
            const maxValue = Math.max(0, ...values);
            $('trendTitle').textContent = t('dailyTitle', { month: App.monthName(ym) });
            stats = [
                [t('avgDay'), App.fmtMoney(days ? spent / days : 0, cur)],
                [t('maxDay'), maxValue ? App.fmtMoney(maxValue, cur) : '—', maxValue ? App.shortDay(`${ym}-${App.pad(values.indexOf(maxValue) + 1)}`) : ''],
                [t('spendDays'), `${spendDays}/${days}`],
                [t('zeroDays'), String(days - spendDays)]
            ];
        } else {
            const months = monthSpan(pool);
            values = months.map(m => total(expenses.filter(tx => tx.date.startsWith(m))));
            const spansYears = months.length && months[0].slice(0, 4) !== months[months.length - 1].slice(0, 4);
            labels = months.map(m => App.monthName(m, spansYears ? 'shortYear' : 'short'));
            highlight = acc.month === 'all' ? -1 : months.indexOf(acc.month);
            // Averages use complete months only (the current month is still running).
            const complete = months.map((m, i) => [m, values[i]]).filter(([m]) => m < currentYm);
            const basis = complete.length ? complete : months.map((m, i) => [m, values[i]]);
            const average = basis.reduce((sum, [, v]) => sum + v, 0) / (basis.length || 1);
            const maxIndex = values.indexOf(Math.max(0, ...values));
            const lowest = basis.reduce((low, entry) => (low === null || entry[1] < low[1] ? entry : low), null);
            $('trendTitle').textContent = catMode ? t('categoryTrendTitle', { category: acc.category }) : t('monthlyTitle');
            if (!catMode) {
                stats = [
                    [t('avgMonth'), App.fmtMoney(average, cur)],
                    [t('maxMonth'), App.fmtMoney(values[maxIndex] || 0, cur), months[maxIndex] ? App.monthName(months[maxIndex]) : ''],
                    [t('minMonth'), lowest ? App.fmtMoney(lowest[1], cur) : '—', lowest ? App.monthName(lowest[0]) : ''],
                    [t('monthsCount'), String(months.length)]
                ];
            } else {
                const selected = highlight >= 0 ? values[highlight] : null;
                const vsAverage = selected !== null && average > 0 ? ((selected - average) / average) * 100 : null;
                stats = [
                    [t('avgMonth'), App.fmtMoney(average, cur)],
                    [t('maxMonth'), App.fmtMoney(values[maxIndex] || 0, cur), months[maxIndex] ? App.monthName(months[maxIndex]) : ''],
                    [t('monthsWithSpend'), `${values.filter(v => v > 0).length}/${months.length}`],
                    [t('vsAverage', { month: highlight >= 0 ? App.monthName(months[highlight], 'short') : '' }),
                     vsAverage === null ? '—' : `${vsAverage > 0 ? '▲' : '▼'} ${Math.abs(vsAverage).toFixed(0)}%`]
                ];
            }
        }

        const colors = values.map((_, i) => (highlight < 0 || i === highlight ? '#3b82f6' : 'rgba(59, 130, 246, 0.35)'));
        drawChart('trend', 'trendChart', {
            type: 'bar',
            data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 5, maxBarThickness: 24 }] },
            options: barOptions(cur)
        });
        $('trendStats').innerHTML = stats.map(([label, value, sub]) => `
            <div class="stat">
                <div class="stat-value">${esc(value)}</div>
                <div class="stat-label">${esc(label)}</div>
                ${sub ? `<div class="stat-sub">${esc(sub)}</div>` : ''}
            </div>`).join('');
    }

    function selectCategory(category) {
        acc.category = category;
        acc.listLimit = PAGE_SIZE;
        App.haptic('select');
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderCategories() {
        const cur = unit();
        const sums = {};
        ofType(periodItems, 'Expense').forEach(tx => { sums[tx.category] = (sums[tx.category] || 0) + val(tx); });
        const sorted = Object.entries(sums).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
        const sum = sorted.reduce((s, [, v]) => s + v, 0) || 1;
        drawChart('category', 'categoryChart', {
            type: 'doughnut',
            data: {
                labels: sorted.map(([c]) => c),
                datasets: [{ data: sorted.map(([, v]) => v), backgroundColor: sorted.map((_, i) => COLORS[i % COLORS.length]), borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                animation: { duration: 250 },
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${App.fmtMoney(ctx.parsed, cur)}` } } },
                onClick: (_, elements) => { if (elements.length) selectCategory(sorted[elements[0].index][0]); }
            }
        });
        $('categoryList').innerHTML = sorted.map(([category, value], i) => `
            <div class="category-item" data-category="${esc(category)}" role="button" tabindex="0">
                <span class="category-color" style="background:${COLORS[i % COLORS.length]}"></span>
                <span class="category-name">${esc(category)}</span>
                <span class="category-amount">${esc(App.fmtMoney(value, cur))}</span>
                <span class="category-pct">${((value / sum) * 100).toFixed(1)}%</span>
            </div>`).join('');
    }

    function renderMonthly(pool) {
        const cur = unit();
        const months = monthSpan(pool).slice(-12);
        const spansYears = months.length && months[0].slice(0, 4) !== months[months.length - 1].slice(0, 4);
        const sumFor = (type, m) => total(pool.filter(tx => tx.type === type && tx.date.startsWith(m)));
        drawChart('monthly', 'monthlyChart', {
            type: 'bar',
            data: {
                labels: months.map(m => App.monthName(m, spansYears ? 'shortYear' : 'short')),
                datasets: [
                    { label: t('income'), data: months.map(m => sumFor('Income', m)), backgroundColor: '#12b76a', borderRadius: 5, maxBarThickness: 16 },
                    { label: t('expenses'), data: months.map(m => sumFor('Expense', m)), backgroundColor: '#f04438', borderRadius: 5, maxBarThickness: 16 }
                ]
            },
            options: barOptions(cur, {
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } },
                    tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${App.fmtMoney(ctx.parsed.y, cur)}` } }
                }
            })
        });
    }

    function txHtml(tx) {
        const isIncome = tx.type === 'Income';
        const isTransfer = tx.type === 'Transfer';
        const icon = isIncome ? '💰' : isTransfer ? '🔁' : '💸';
        const sub = [tx.category, tx.store].filter(Boolean).join(' · ');
        return `
            <div class="tx" data-id="${tx.id}" role="button" tabindex="0">
                <div class="tx-icon ${isIncome ? 'income' : isTransfer ? 'transfer' : ''}">${icon}</div>
                <div class="tx-main">
                    <div class="tx-title">${esc(tx.description || tx.category)}</div>
                    <div class="tx-sub">${esc(sub)}</div>
                </div>
                <div class="tx-amount">
                    <div class="tx-value ${isIncome ? 'income' : ''}">${esc((isIncome ? '+' : '') + App.fmtNum(tx.amount))}</div>
                    <div class="tx-cur">${esc(tx.currency)}</div>
                </div>
            </div>`;
    }

    function renderList() {
        const query = App.normalize(acc.search.trim());
        let list = periodItems;
        if (query) list = list.filter(tx => App.normalize(`${tx.description} ${tx.store} ${tx.category} ${tx.raw} ${tx.amount} ${tx.date}`).includes(query));
        list = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
        const daySpend = {};
        ofType(list, 'Expense').forEach(tx => { daySpend[tx.date] = (daySpend[tx.date] || 0) + val(tx); });
        const shown = list.slice(0, acc.listLimit);
        let html = '';
        let currentDay = null;
        shown.forEach(tx => {
            if (tx.date !== currentDay) {
                currentDay = tx.date;
                const spent = daySpend[tx.date];
                html += `<div class="day-header"><span>${esc(App.dayName(tx.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><span class="day-total">${spent ? '− ' + esc(App.fmtMoney(spent, unit())) : ''}</span></div>`;
            }
            html += txHtml(tx);
        });
        $('transactionList').innerHTML = html || `<div class="empty">${esc(t('noMatches'))}</div>`;
        $('filterStatus').textContent = `${App.fmtNum(list.length)} ${t('of')} ${App.fmtNum(data.items.length)}`;
        const remaining = list.length - shown.length;
        $('moreButton').classList.toggle('hidden', remaining <= 0);
        $('moreButton').textContent = t('showMore', { n: App.fmtNum(Math.min(remaining, PAGE_SIZE)) + (remaining > PAGE_SIZE ? ' / ' + App.fmtNum(remaining) : '') });
    }

    // ---------- edit sheet ----------
    function openEdit(tx) {
        const sourceIcon = { csv_import: '📄 ', text: '💬 ' }[tx.source] || ''; // photo/voice text already starts with 📷/🎤
        const currencies = [...new Set([tx.currency, ...currenciesByUse(), ...EXTRA_CURRENCIES])];
        const categories = [...new Set([tx.category, ...data.categories])];
        const option = (value, selected) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(value)}</option>`;
        App.openSheet(t('editTitle'), `
            ${tx.raw ? `<div class="raw">${esc(sourceIcon + tx.raw)}</div>` : ''}
            <div class="row2 wide-first">
                <div class="field"><label>${esc(t('amount'))}</label><input id="eAmount" type="number" inputmode="decimal" step="0.01" min="0.01" dir="ltr" value="${tx.amount}"></div>
                <div class="field"><label>${esc(t('currency'))}</label><select id="eCurrency">${currencies.map(c => option(c, tx.currency)).join('')}</select></div>
            </div>
            <div class="field"><label>${esc(t('type'))}</label>${App.segmented('etype', ['Expense', 'Income', 'Transfer'].map(x => [x, App.L().types[x]]), tx.type)}</div>
            <div class="field"><label>${esc(t('category'))}</label><select id="eCategory">${categories.map(c => option(c, tx.category)).join('')}</select></div>
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
    function bind() {
        $('monthFilter').addEventListener('change', e => { acc.month = e.target.value; acc.listLimit = PAGE_SIZE; App.haptic('select'); render(); });
        $('categoryFilter').addEventListener('change', e => { acc.category = e.target.value; acc.listLimit = PAGE_SIZE; App.haptic('select'); render(); });
        $('currencyFilter').addEventListener('change', e => {
            acc.currencyChoice = e.target.value;
            App.prefs.set('dash.currency', acc.currencyChoice);
            acc.listLimit = PAGE_SIZE;
            App.haptic('select');
            render();
        });
        $('searchInput').addEventListener('input', e => { acc.search = e.target.value; acc.listLimit = PAGE_SIZE; renderList(); });
        $('moreButton').addEventListener('click', () => { acc.listLimit += PAGE_SIZE; renderList(); });
        $('transactionList').addEventListener('click', e => {
            const row = e.target.closest('.tx');
            const tx = row && data.items.find(x => x.id === Number(row.dataset.id));
            if (tx) openEdit(tx);
        });
        $('categoryList').addEventListener('click', e => {
            const item = e.target.closest('.category-item');
            if (item) selectCategory(item.dataset.category);
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
            return { spent: total(ofType(items, 'Expense')), earned: total(ofType(items, 'Income')), cur: unit() };
        }
    };

    document.addEventListener('DOMContentLoaded', bind);
    if (document.readyState !== 'loading') bind();
})(window.App);
