/* App shell: Telegram setup, language, helpers, API calls, the bottom sheet and the tab bar.
   Each area (accounting.js, tasks.js) registers its views and data loader with App. */
window.App = (function () {
    'use strict';

    const tg = window.Telegram ? window.Telegram.WebApp : null;
    if (tg) {
        tg.ready();
        tg.expand();
        try {
            tg.setHeaderColor('secondary_bg_color');
            tg.setBackgroundColor('secondary_bg_color');
        } catch (e) { /* older Telegram versions */ }
    }

    // Telegram's signed login data. Kept for the session so redirects/reloads don't lose it.
    let initData = (tg && tg.initData) || '';
    try {
        if (initData) sessionStorage.setItem('tg.initData', initData);
        else initData = sessionStorage.getItem('tg.initData') || '';
    } catch (e) { /* storage unavailable */ }

    const prefs = {
        get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ } }
    };

    const user = tg && tg.initDataUnsafe ? tg.initDataUnsafe.user : null;
    const telegramLang = user && user.language_code ? (user.language_code.startsWith('ar') ? 'ar' : 'en') : 'ar';
    const VIEWS = ['tasks', 'habits', 'accounting', 'goals', 'history'];
    const state = { lang: prefs.get('dash.lang') || telegramLang, view: null };

    const strings = {
        ar: {
            appName: 'المحاسب الذكي', tabTasks: 'المهام', tabHabits: 'العادات', tabAccounting: 'الحسابات', tabGoals: 'الأهداف', tabHistory: 'السجل',
            langButton: 'EN', refresh: 'تحديث', loading: 'جاري التحميل...', retry: 'إعادة المحاولة', loadError: 'تعذر التحميل',
            privateTitle: 'هذا التطبيق خاص', privateText: 'هذا البوت مخصص لأشخاص محددين فقط.',
            save: 'حفظ', cancel: 'إلغاء', delete: 'حذف', confirmDelete: 'حذف نهائياً؟',
            sessionExpired: 'انتهت الجلسة، أغلق التطبيق وافتحه مرة أخرى.'
        },
        en: {
            appName: 'Smart Accountant', tabTasks: 'Tasks', tabHabits: 'Habits', tabAccounting: 'Accounting', tabGoals: 'Goals', tabHistory: 'History',
            langButton: 'ع', refresh: 'Refresh', loading: 'Loading...', retry: 'Try again', loadError: 'Could not load',
            privateTitle: 'This app is private', privateText: 'This bot is only for specific people.',
            save: 'Save', cancel: 'Cancel', delete: 'Delete', confirmDelete: 'Delete for good?',
            sessionExpired: 'Your session expired. Close the app and open it again.'
        }
    };

    const sections = {};
    const loaders = [];
    let loading = false;
    let loadedAt = 0;
    let isPrivate = false;
    let sheetBack = null;

    // ---------- helpers ----------
    const $ = (id) => document.getElementById(id);
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    // Keeps "17,311 EGP" or "1 USD = 55.37 EGP" in order inside Arabic sentences.
    const ltr = (text) => '⁦' + text + '⁩';
    const pad = (n) => String(n).padStart(2, '0');
    const L = () => strings[state.lang];

    function t(key, vars) {
        const text = strings[state.lang][key] ?? strings.en[key] ?? key;
        return String(text).replace(/\{(\w+)\}/g, (_, name) => (vars && vars[name] !== undefined ? vars[name] : ''));
    }
    function addStrings(ar, en) {
        Object.assign(strings.ar, ar);
        Object.assign(strings.en, en);
    }

    // Arabic month/day names with Latin digits, everywhere in the app.
    const locale = () => (state.lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US');
    const num = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
    function fmtNum(n) {
        const value = Number(n) || 0;
        return value.toLocaleString('en-US', { maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2 });
    }
    function fmtMoney(n, cur) {
        const value = Number(n) || 0;
        if (cur === 'USD') return `${value < 0 ? '-' : ''}$${fmtNum(Math.abs(value))}`;
        return `${fmtNum(value)} ${cur}`;
    }
    const compact = (n) => Number(n).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });

    function todayIso() {
        const d = new Date();
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    function addDays(iso, n) {
        const d = new Date(iso + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + n);
        return d.toISOString().slice(0, 10);
    }
    function addMonths(ym, n) {
        const [y, m] = ym.split('-').map(Number);
        const d = new Date(Date.UTC(y, m - 1 + n, 1));
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
    }
    function daysInMonth(ym) {
        const [y, m] = ym.split('-').map(Number);
        return new Date(Date.UTC(y, m, 0)).getUTCDate();
    }
    const monthRange = (ym) => ({ from: ym + '-01', to: addMonths(ym, 1) + '-01' });
    function monthName(ym, style) {
        const [y, m] = ym.split('-').map(Number);
        const options = style === 'short' ? { month: 'short' }
            : style === 'shortYear' ? { month: 'short', year: '2-digit' }
            : { month: 'long', year: 'numeric' };
        return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale(), { ...options, timeZone: 'UTC' });
    }
    function dayName(iso, options) {
        return new Date(iso + 'T12:00:00Z').toLocaleDateString(locale(), { ...(options || { weekday: 'long', day: 'numeric', month: 'long' }), timeZone: 'UTC' });
    }
    const shortDay = (iso) => dayName(iso, { day: 'numeric', month: 'short' });

    // Arabic-friendly search: fold letter variants and Arabic-Indic digits.
    function normalize(text) {
        return String(text ?? '').toLowerCase()
            .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
            .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    }

    function haptic(kind) {
        try {
            if (!tg || !tg.HapticFeedback) return;
            if (kind === 'select') tg.HapticFeedback.selectionChanged();
            else tg.HapticFeedback.notificationOccurred(kind);
        } catch (e) { /* not supported */ }
    }
    const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

    function confirmBox(message, proceed) {
        try {
            if (tg && tg.showConfirm && tg.isVersionAtLeast && tg.isVersionAtLeast('6.2')) {
                tg.showConfirm(message, proceed);
                return;
            }
        } catch (e) { /* fall back to the browser dialog */ }
        proceed(window.confirm(message));
    }
    function alertBox(message) {
        try {
            if (tg && tg.showAlert && tg.isVersionAtLeast && tg.isVersionAtLeast('6.2')) {
                tg.showAlert(message);
                return;
            }
        } catch (e) { /* fall back */ }
        window.alert(message);
    }

    // ---------- API ----------
    async function api(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData, ...body })
        });
        let json = null;
        try { json = await res.json(); } catch (e) { /* not JSON */ }
        if (res.status === 403) {
            showPrivate();
            throw Object.assign(new Error('private'), { status: 403 });
        }
        if (res.status === 401 && body.action !== 'list') throw Object.assign(new Error(t('sessionExpired')), { status: 401 });
        if (!res.ok || !json || json.error) throw Object.assign(new Error((json && json.error) || `HTTP ${res.status}`), { status: res.status });
        return json;
    }

    // ---------- bottom sheet ----------
    function openSheet(title, bodyHtml, actions) {
        $('sheetTitle').textContent = title;
        $('sheetBody').innerHTML = bodyHtml;
        $('sheetError').classList.add('hidden');
        const box = $('sheetActions');
        box.innerHTML = '';
        actions.forEach(action => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn ' + (action.style || 'secondary');
            button.textContent = action.label;
            button.addEventListener('click', action.onClick);
            box.appendChild(button);
        });
        $('sheetBackdrop').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        if (tg && tg.BackButton) {
            sheetBack = closeSheet;
            tg.BackButton.onClick(sheetBack);
            tg.BackButton.show();
        }
    }
    function closeSheet() {
        $('sheetBackdrop').classList.add('hidden');
        document.body.style.overflow = '';
        if (tg && tg.BackButton && sheetBack) {
            tg.BackButton.offClick(sheetBack);
            tg.BackButton.hide();
            sheetBack = null;
        }
    }
    function sheetError(message) {
        $('sheetError').textContent = message;
        $('sheetError').classList.remove('hidden');
    }
    const sheetBusy = (on) => document.querySelectorAll('#sheetActions button').forEach(b => { b.disabled = on; });
    const segmented = (name, options, value) =>
        `<div class="segmented" data-seg="${name}">${options.map(([v, label]) => `<button type="button" data-value="${esc(v)}" class="${v === value ? 'active' : ''}">${esc(label)}</button>`).join('')}</div>`;
    const segValue = (name) => {
        const button = document.querySelector(`[data-seg="${name}"] button.active`);
        return button ? button.dataset.value : null;
    };

    // ---------- views ----------
    function register(id, section) { sections[id] = section; }
    function addLoader(fn) { loaders.push(fn); }

    function render(id) {
        const section = sections[id || state.view];
        if (section && section.render && !isPrivate) section.render();
    }

    function showView(id) {
        if (!VIEWS.includes(id)) id = 'tasks';
        state.view = id;
        prefs.set('app.view', id);
        document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.dataset.view !== id));
        document.querySelectorAll('#tabbar button').forEach(b => {
            const on = b.dataset.view === id;
            b.classList.toggle('active', on);
            b.setAttribute('aria-current', on ? 'page' : 'false');
        });
        window.scrollTo(0, 0);
        render(id);
    }

    function setBadge(id, count) {
        const el = $('badge-' + id);
        if (!el) return;
        el.textContent = count > 9 ? '9+' : String(count);
        el.classList.toggle('hidden', !count);
    }
    const updateBadges = () => Object.values(sections).forEach(s => s.badge && s.badge());

    function showPrivate() {
        isPrivate = true;
        $('globalLoading').classList.add('hidden');
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        $('tabbar').classList.add('hidden');
        $('privateState').classList.remove('hidden');
    }

    async function loadAll() {
        if (loading) return;
        loading = true;
        $('refreshButton').classList.add('spinning');
        try {
            await Promise.all(loaders.map(load => Promise.resolve().then(load).catch(err => {
                if (!err || err.status !== 403) console.error(err);
            })));
            loadedAt = Date.now();
        } finally {
            loading = false;
            $('refreshButton').classList.remove('spinning');
        }
        if (isPrivate) return;
        updateBadges();
        if (state.view) render();
    }

    function applyLanguage() {
        const dir = state.lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = state.lang;
        document.documentElement.dir = dir;
        document.body.dir = dir;
        document.title = t('appName');
        document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
        document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
        $('whoDate').textContent = dayName(todayIso());
        Object.values(sections).forEach(s => s.applyLanguage && s.applyLanguage());
    }

    function start() {
        applyLanguage();
        const name = user ? (user.first_name || user.username || '') : '';
        $('whoName').textContent = user ? (user.username ? ltr('@' + user.username) : user.first_name) : t('appName');
        $('avatar').textContent = (name.trim().charAt(0) || '•').toUpperCase();

        document.querySelectorAll('#tabbar button').forEach(b => b.addEventListener('click', () => {
            if (b.dataset.view === state.view) return;
            haptic('select');
            showView(b.dataset.view);
        }));
        $('refreshButton').addEventListener('click', () => loadAll());
        $('langButton').addEventListener('click', () => {
            state.lang = state.lang === 'ar' ? 'en' : 'ar';
            prefs.set('dash.lang', state.lang);
            applyLanguage();
            render();
        });
        $('sheetBackdrop').addEventListener('click', e => { if (e.target === $('sheetBackdrop')) closeSheet(); });
        $('sheetBody').addEventListener('click', e => {
            const button = e.target.closest('.segmented button');
            if (!button) return;
            button.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === button));
        });
        // New entries sent to the bot show up when you come back to the app.
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && loadedAt && Date.now() - loadedAt > 30000) loadAll();
        });
        if (tg && tg.onEvent) {
            tg.onEvent('activated', () => { if (loadedAt && Date.now() - loadedAt > 30000) loadAll(); });
            tg.onEvent('themeChanged', () => render());
        }

        const wanted = new URLSearchParams(location.search).get('tab');
        loadAll().then(() => {
            $('globalLoading').classList.add('hidden');
            if (isPrivate) return;
            $('tabbar').classList.remove('hidden');
            const saved = prefs.get('app.view');
            const hasTasks = sections.tasks && sections.tasks.hasData && sections.tasks.hasData();
            showView(VIEWS.includes(wanted) ? wanted : VIEWS.includes(saved) ? saved : hasTasks ? 'tasks' : 'accounting');
        });
    }

    return {
        tg, prefs, state, user, VIEWS,
        $, esc, ltr, pad, t, L, addStrings, locale, num, fmtNum, fmtMoney, compact,
        todayIso, addDays, addMonths, daysInMonth, monthRange, monthName, dayName, shortDay, normalize,
        haptic, cssVar, confirmBox, alertBox, api,
        openSheet, closeSheet, sheetError, sheetBusy, segmented, segValue,
        register, addLoader, render, showView, setBadge, updateBadges, start
    };
})();
