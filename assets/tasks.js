/* Tasks, Habits, Goals and History tabs. Data comes from the tasks-api Edge Function, which
   verifies Telegram's signed login and only returns or changes the signed-in user's rows. */
(function (App) {
    'use strict';

    const API = 'https://ajdphdgkwycecmtlxqgv.supabase.co/functions/v1/tasks-api';
    const { $, esc, t } = App;
    const UNITS = ['pages', 'chapters', 'lessons', 'hours', 'steps'];
    const DEFAULT_UNIT = { book: 'pages', course: 'lessons', project: 'steps' };

    App.addStrings({
        doneOf: 'أنجزت {done} من {total}', left: 'متبقي {n}', allDone: 'أنجزت كل شيء 🎉', allDoneShort: 'لا شيء متبقٍ 🎉',
        noTodosTitle: 'يومك فارغ', noTodos: 'أضف مهمة بالأسفل، أو أرسل للبوت: task, ...', emptyList: 'لا توجد مهام بعد',
        completed: 'المكتملة ({n})', tomorrowTitle: 'بكرة', carried: '↪️ ×{n}',
        addPlaceholder: 'أضف مهمة...', dayToday: 'اليوم', dayTomorrow: 'بكرة',
        habitsSub: 'أنجزت {done} من {total} اليوم', habitsSubEmpty: 'ابنِ عادات يومية وتابع سلاسلك',
        habitsPaused: 'عادات متوقفة ({n})', noHabits: 'لا توجد عادات بعد. اضغط + لإضافة واحدة مثل: قراءة 20 صفحة يومياً.',
        streak: '🔥 {n}', auto: 'تلقائي', perDay: '{n} يومياً',
        goalsSub: '{active} نشطة · {done} مكتملة', paused: 'متوقفة ({n})', finished: 'مكتملة ({n})',
        noGoals: 'لا توجد أهداف نشطة. اضغط + لبدء كتاب أو كورس أو مشروع.',
        pace: 'بمعدل {rate} {unit} يومياً · تنتهي حوالي {date}', hours: '⏱️ {n} ساعة', cost: '💰 {amount}', logButton: '+ تقدم',
        historySub: 'إنجازك على مدار الأسابيع', weekTitle: 'آخر 7 أيام', heatTitle: 'المهام المنجزة يومياً', weeksTitle: 'الأسابيع الأخيرة',
        statTasks: 'مهام منجزة', statHabits: 'العادات', statHours: 'ساعات', statSpent: 'المصروفات', statEarned: 'الدخل', statProgress: '{unit}',
        less: 'أقل', more: 'أكثر', weekLine: '{from} – {to}', todosDone: '✅ {done}/{total} مهام', hoursLine: '⏱️ {n} ساعة',
        habitsLine: '🔁 العادات {pct}%', spentLine: '💸 {amount}', nothing: 'لا يوجد نشاط',
        editTodo: 'تعديل المهمة', taskTitle: 'المهمة', date: 'التاريخ',
        newGoalTitle: 'هدف جديد', kind: 'النوع', name: 'الاسم', total: 'الإجمالي (اختياري)', unit: 'الوحدة', create: 'إضافة',
        logTitle: 'سجّل تقدمك', amount: 'الكمية', modeAdd: 'أضف', modeSet: 'وصلت إلى', hoursField: 'ساعات (اختياري)', log: 'سجّل',
        historyTitle: 'السجل', editGoal: 'تعديل', pause: 'إيقاف', resume: 'استئناف', markDone: 'اكتمل', reopen: 'إعادة فتح',
        newHabitTitle: 'عادة جديدة', target: 'الهدف اليومي (اختياري)', none: 'بدون', editHabit: 'تعديل العادة',
        required: 'اكتب الاسم أولاً', needAmount: 'اكتب الكمية أو الساعات',
        kinds: { book: 'كتاب', course: 'كورس', project: 'مشروع' },
        icons: { book: '📚', course: '🎓', project: '🛠️' },
        units: { pages: 'صفحة', chapters: 'فصل', lessons: 'درس', hours: 'ساعة', steps: 'خطوة' }
    }, {
        doneOf: '{done} of {total} done', left: '{n} left', allDone: 'All done 🎉', allDoneShort: 'Nothing left 🎉',
        noTodosTitle: 'Your day is clear', noTodos: 'Add a task below, or send the bot: task, ...', emptyList: 'No tasks yet',
        completed: 'Completed ({n})', tomorrowTitle: 'Tomorrow', carried: '↪️ ×{n}',
        addPlaceholder: 'Add a task...', dayToday: 'Today', dayTomorrow: 'Tomorrow',
        habitsSub: '{done} of {total} done today', habitsSubEmpty: 'Build daily habits and keep your streaks',
        habitsPaused: 'Paused habits ({n})', noHabits: 'No habits yet. Tap + to add one, like reading 20 pages a day.',
        streak: '🔥 {n}', auto: 'auto', perDay: '{n} a day',
        goalsSub: '{active} active · {done} finished', paused: 'Paused ({n})', finished: 'Finished ({n})',
        noGoals: 'No active goals. Tap + to start a book, a course or a project.',
        pace: '{rate} {unit} a day · done around {date}', hours: '⏱️ {n} h', cost: '💰 {amount}', logButton: '+ Log',
        historySub: 'Your progress over the weeks', weekTitle: 'Last 7 days', heatTitle: 'Tasks done per day', weeksTitle: 'Recent weeks',
        statTasks: 'tasks done', statHabits: 'habits', statHours: 'hours', statSpent: 'spent', statEarned: 'earned', statProgress: '{unit}',
        less: 'Less', more: 'More', weekLine: '{from} – {to}', todosDone: '✅ {done}/{total} tasks', hoursLine: '⏱️ {n} h',
        habitsLine: '🔁 Habits {pct}%', spentLine: '💸 {amount}', nothing: 'No activity',
        editTodo: 'Edit task', taskTitle: 'Task', date: 'Date',
        newGoalTitle: 'New goal', kind: 'Type', name: 'Name', total: 'Total (optional)', unit: 'Unit', create: 'Add',
        logTitle: 'Log progress', amount: 'Amount', modeAdd: 'Add', modeSet: 'Reached', hoursField: 'Hours (optional)', log: 'Log',
        historyTitle: 'History', editGoal: 'Edit', pause: 'Pause', resume: 'Resume', markDone: 'Finished', reopen: 'Reopen',
        newHabitTitle: 'New habit', target: 'Daily target (optional)', none: 'None', editHabit: 'Edit habit',
        required: 'Enter a name first', needAmount: 'Enter an amount or hours',
        kinds: { book: 'Book', course: 'Course', project: 'Project' },
        icons: { book: '📚', course: '🎓', project: '🛠️' },
        units: { pages: 'pages', chapters: 'chapters', lessons: 'lessons', hours: 'hours', steps: 'steps' }
    });

    let data = null;
    let status = 'loading';
    let errorMessage = '';
    let newTodoDay = 0;

    const unitName = (u) => (u ? App.L().units[u] || u : '');
    const byId = (a, b) => a.id - b.id;

    // ---------- data ----------
    async function load() {
        try {
            data = await App.api(API, { action: 'list' });
            status = 'ready';
        } catch (err) {
            if (err.status === 403) throw err;
            status = 'error';
            errorMessage = err.message;
        }
    }

    async function refresh() {
        await load();
        App.updateBadges();
        App.render();
    }

    async function mutate(body, onError) {
        try {
            await App.api(API, body);
            App.haptic('success');
        } catch (err) {
            App.haptic('error');
            if (onError) onError(err);
            else App.alertBox(err.message);
            return false;
        }
        await refresh();
        return true;
    }

    async function sheetMutate(body) {
        App.sheetBusy(true);
        const ok = await mutate(body, err => { App.sheetError(err.message); App.sheetBusy(false); });
        if (ok) App.closeSheet();
    }

    // ---------- shared calculations ----------
    const logsFor = (goalId) => data.logs.filter(l => l.goal_id === goalId);
    function habitDoneOn(habit, day) {
        if (data.checks.some(c => c.habit_id === habit.id && c.date === day)) return { done: true, auto: false };
        if (!habit.target || !habit.unit) return { done: false, auto: false };
        const dayLogs = data.logs.filter(l => l.date === day);
        let amount;
        if (habit.unit === 'hours') amount = dayLogs.reduce((s, l) => s + Number(l.hours), 0);
        else {
            const ids = new Set(data.goals.filter(g => g.unit === habit.unit).map(g => g.id));
            amount = dayLogs.filter(l => ids.has(l.goal_id)).reduce((s, l) => s + Number(l.amount), 0);
        }
        return { done: amount >= habit.target, auto: amount >= habit.target };
    }
    function streakOf(habit) {
        let day = habitDoneOn(habit, data.today).done ? data.today : App.addDays(data.today, -1);
        let n = 0;
        while (n < 365 && habitDoneOn(habit, day).done) { n++; day = App.addDays(day, -1); }
        return n;
    }

    // Shows the error card for a tasks view; returns true if the view can render.
    function ready(view) {
        const box = $(view + 'Error');
        const ok = status === 'ready';
        if (box) {
            box.classList.toggle('hidden', ok || status === 'loading');
            if (status === 'error') {
                box.innerHTML = `<div class="card"><div class="state-icon">⚠️</div><div>${esc(t('loadError'))}</div><div class="hint">${esc(errorMessage)}</div><button class="btn primary" type="button" data-retry>${esc(t('retry'))}</button></div>`;
            }
        }
        return ok;
    }

    // ---------- Tasks ----------
    function todoHtml(todo) {
        const on = todo.status === 'done';
        return `
            <div class="item${on ? ' done' : ''}">
                <button class="check${on ? ' on' : ''}" type="button" data-toggle="${todo.id}" aria-label="done">${on ? '✓' : ''}</button>
                <div class="item-title" data-edit-todo="${todo.id}">${esc(todo.title)}</div>
                ${todo.status === 'open' && todo.carried > 0 ? `<span class="tag">${esc(t('carried', { n: todo.carried }))}</span>` : ''}
            </div>`;
    }

    function renderTasks() {
        $('tasksContent').classList.toggle('hidden', !ready('tasks'));
        if (status !== 'ready') return;
        const today = data.today;
        const list = data.todos.filter(x => x.date === today).sort(byId);
        const open = list.filter(x => x.status !== 'done');
        const done = list.filter(x => x.status === 'done');
        const pct = list.length ? Math.round((done.length / list.length) * 100) : 0;
        $('ringFg').setAttribute('stroke-dasharray', `${pct} 100`);
        $('ringLabel').textContent = list.length ? `${pct}%` : '—';
        $('heroTitle').textContent = list.length ? t('doneOf', { done: done.length, total: list.length }) : t('noTodosTitle');
        $('heroSub').textContent = !list.length ? t('noTodos') : open.length ? t('left', { n: open.length }) : t('allDone');
        $('openList').innerHTML = open.length ? open.map(todoHtml).join('') : `<div class="empty">${esc(list.length ? t('allDoneShort') : t('emptyList'))}</div>`;
        $('doneLabel').textContent = t('completed', { n: done.length });
        $('doneLabel').classList.toggle('hidden', !done.length);
        $('doneCard').classList.toggle('hidden', !done.length);
        $('doneList').innerHTML = done.map(todoHtml).join('');
        const next = data.todos.filter(x => x.date === App.addDays(today, 1)).sort(byId);
        $('tomorrowLabel').classList.toggle('hidden', !next.length);
        $('tomorrowCard').classList.toggle('hidden', !next.length);
        $('tomorrowList').innerHTML = next.map(todoHtml).join('');
        document.querySelectorAll('#dayChips .chip').forEach(c => c.classList.toggle('active', Number(c.dataset.day) === newTodoDay));
    }

    function editTodo(todo) {
        App.openSheet(t('editTodo'), `
            <div class="field"><label>${esc(t('taskTitle'))}</label><input id="fTitle" type="text" maxlength="300" value="${esc(todo.title)}"></div>
            <div class="field"><label>${esc(t('date'))}</label><input id="fDate" type="date" dir="ltr" value="${esc(todo.date)}"></div>`, [
            { label: t('delete'), style: 'danger', onClick: () => App.confirmBox(t('confirmDelete'), ok => ok && sheetMutate({ action: 'todo_delete', id: todo.id })) },
            { label: t('cancel'), onClick: App.closeSheet },
            { label: t('save'), style: 'primary', onClick: () => {
                const title = $('fTitle').value.trim();
                if (!title) return App.sheetError(t('required'));
                sheetMutate({ action: 'todo_update', id: todo.id, changes: { title, date: $('fDate').value || todo.date } });
            } }
        ]);
    }

    // ---------- Habits ----------
    function habitHtml(habit) {
        const today = habitDoneOn(habit, data.today);
        const days = Array.from({ length: 30 }, (_, i) => App.addDays(data.today, i - 29));
        const grid = days.map(d => `<span class="${habitDoneOn(habit, d).done ? 'on' : ''}${d === data.today ? ' today' : ''}" title="${d}"></span>`).join('');
        const target = habit.target ? t('perDay', { n: `${App.num(habit.target)} ${unitName(habit.unit)}` }) : '';
        const streak = streakOf(habit);
        const sub = [target, today.auto ? t('auto') : ''].filter(Boolean).join(' · ');
        return `
            <div class="card">
                <div class="habit-row">
                    <button class="check${today.done ? ' on' : ''}" type="button" data-habit-check="${habit.id}" ${today.auto || !habit.active ? 'disabled' : ''} aria-label="done today">${today.done ? '✓' : ''}</button>
                    <div class="habit-main" data-edit-habit="${habit.id}">
                        <div class="habit-title">${esc(habit.title)}</div>
                        ${sub ? `<div class="hint">${esc(sub)}</div>` : ''}
                    </div>
                    ${streak ? `<div class="streak">${esc(t('streak', { n: streak }))}</div>` : ''}
                </div>
                ${habit.active ? `<div class="grid30">${grid}</div>` : ''}
            </div>`;
    }

    function renderHabits() {
        if (!ready('habits')) return;
        const active = data.habits.filter(h => h.active);
        const paused = data.habits.filter(h => !h.active);
        const doneToday = active.filter(h => habitDoneOn(h, data.today).done).length;
        $('habitsSub').textContent = active.length ? t('habitsSub', { done: doneToday, total: active.length }) : t('habitsSubEmpty');
        $('habitList').innerHTML = active.length ? active.map(habitHtml).join('') : `<div class="card empty">${esc(t('noHabits'))}</div>`;
        $('habitsPausedBox').classList.toggle('hidden', !paused.length);
        $('habitsPausedSummary').textContent = t('habitsPaused', { n: paused.length });
        $('habitsPaused').innerHTML = paused.map(habitHtml).join('');
    }

    function unitOptions(selected, allowNone) {
        return (allowNone ? [`<option value="">${esc(t('none'))}</option>`] : [])
            .concat(UNITS.map(u => `<option value="${u}" ${u === selected ? 'selected' : ''}>${esc(unitName(u))}</option>`)).join('');
    }

    function habitForm(habit) {
        return `
            <div class="field"><label>${esc(t('name'))}</label><input id="fTitle" type="text" maxlength="200" value="${esc(habit ? habit.title : '')}"></div>
            <div class="row2">
                <div class="field"><label>${esc(t('target'))}</label><input id="fTarget" type="number" inputmode="decimal" min="1" dir="ltr" value="${habit && habit.target ? habit.target : ''}"></div>
                <div class="field"><label>${esc(t('unit'))}</label><select id="fUnit">${unitOptions(habit ? habit.unit : '', true)}</select></div>
            </div>`;
    }

    function newHabit() {
        App.openSheet(t('newHabitTitle'), habitForm(null), [
            { label: t('cancel'), onClick: App.closeSheet },
            { label: t('create'), style: 'primary', onClick: () => {
                const title = $('fTitle').value.trim();
                if (!title) return App.sheetError(t('required'));
                sheetMutate({ action: 'habit_create', title, target: $('fTarget').value || null, unit: $('fUnit').value || null });
            } }
        ]);
    }

    function editHabit(habit) {
        App.openSheet(t('editHabit'), habitForm(habit), [
            { label: t('delete'), style: 'danger', onClick: () => App.confirmBox(t('confirmDelete'), ok => ok && sheetMutate({ action: 'habit_delete', id: habit.id })) },
            { label: habit.active ? t('pause') : t('resume'), onClick: () => sheetMutate({ action: 'habit_update', id: habit.id, changes: { active: !habit.active } }) },
            { label: t('save'), style: 'primary', onClick: () => {
                const title = $('fTitle').value.trim();
                if (!title) return App.sheetError(t('required'));
                sheetMutate({ action: 'habit_update', id: habit.id, changes: { title, target: $('fTarget').value || null, unit: $('fUnit').value || null } });
            } }
        ]);
    }

    // ---------- Goals ----------
    function goalHtml(goal) {
        const s = goal.stats || {};
        const icons = App.L().icons;
        const progress = goal.total
            ? `${App.num(s.progress)}/${App.num(goal.total)} ${unitName(goal.unit)}`
            : `${App.num(s.progress)} ${unitName(goal.unit)}`;
        const meta = [];
        if (s.eta && goal.status === 'active') meta.push(t('pace', { rate: App.num(Math.round(s.perDay * 10) / 10), unit: unitName(goal.unit), date: App.shortDay(s.eta) }));
        if (s.hours && goal.unit !== 'hours') meta.push(t('hours', { n: App.num(s.hours) }));
        if (goal.cost) meta.push(t('cost', { amount: App.ltr(`${App.num(goal.cost.amount)} ${goal.cost.currency}`) }));
        return `
            <div class="card goal" data-goal="${goal.id}">
                <div class="goal-head">
                    <div class="goal-icon ${esc(goal.kind)}">${icons[goal.kind] || '🎯'}</div>
                    <div class="goal-name">
                        <div class="goal-title">${esc(goal.title)}</div>
                        <div class="goal-kind">${esc(App.L().kinds[goal.kind] || goal.kind)}</div>
                    </div>
                    ${goal.status === 'active' ? `<button class="log-btn" type="button" data-log-goal="${goal.id}">${esc(t('logButton'))}</button>` : ''}
                </div>
                <div class="progress-line"><span class="num">${esc(progress)}</span>${goal.total ? `<span class="pct">${Math.round(s.pct || 0)}%</span>` : ''}</div>
                ${goal.total ? `<div class="bar"><div style="width:${Math.min(100, s.pct || 0)}%"></div></div>` : ''}
                ${meta.length ? `<div class="goal-meta">${meta.map(m => `<span>${esc(m)}</span>`).join('')}</div>` : ''}
            </div>`;
    }

    function renderGoals() {
        if (!ready('goals')) return;
        const active = data.goals.filter(g => g.status === 'active');
        const paused = data.goals.filter(g => g.status === 'paused');
        const done = data.goals.filter(g => g.status === 'done').sort((a, b) => String(b.finished_on).localeCompare(String(a.finished_on)));
        $('goalsSub').textContent = t('goalsSub', { active: active.length, done: done.length });
        $('goalsActive').innerHTML = active.length ? active.map(goalHtml).join('') : `<div class="card empty">${esc(t('noGoals'))}</div>`;
        $('pausedBox').classList.toggle('hidden', !paused.length);
        $('pausedSummary').textContent = t('paused', { n: paused.length });
        $('goalsPaused').innerHTML = paused.map(goalHtml).join('');
        $('doneBox').classList.toggle('hidden', !done.length);
        $('doneSummary').textContent = t('finished', { n: done.length });
        $('goalsDone').innerHTML = done.map(goalHtml).join('');
    }

    function newGoal() {
        const icons = App.L().icons;
        App.openSheet(t('newGoalTitle'), `
            <div class="field"><label>${esc(t('kind'))}</label>${App.segmented('kind', ['book', 'course', 'project'].map(k => [k, `${icons[k]} ${App.L().kinds[k]}`]), 'book')}</div>
            <div class="field"><label>${esc(t('name'))}</label><input id="fTitle" type="text" maxlength="200"></div>
            <div class="row2">
                <div class="field"><label>${esc(t('total'))}</label><input id="fTotal" type="number" inputmode="decimal" min="1" dir="ltr"></div>
                <div class="field"><label>${esc(t('unit'))}</label><select id="fUnit">${unitOptions('pages')}</select></div>
            </div>`, [
            { label: t('cancel'), onClick: App.closeSheet },
            { label: t('create'), style: 'primary', onClick: () => {
                const title = $('fTitle').value.trim();
                if (!title) return App.sheetError(t('required'));
                sheetMutate({ action: 'goal_create', kind: App.segValue('kind'), title, total: $('fTotal').value || null, unit: $('fUnit').value });
            } }
        ]);
        document.querySelectorAll('[data-seg="kind"] button').forEach(b => b.addEventListener('click', () => { $('fUnit').value = DEFAULT_UNIT[b.dataset.value]; }));
    }

    function openGoal(goal, focusLog) {
        const s = goal.stats || {};
        const logs = logsFor(goal.id).slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 15);
        const history = logs.map(l => `
            <div class="log-row">
                <span>${esc(App.shortDay(l.date))}</span>
                <span class="num">${l.amount ? `${l.amount > 0 ? '+' : ''}${App.num(l.amount)} ${esc(unitName(goal.unit))}` : ''}${l.hours ? ` ⏱️ ${App.num(l.hours)}` : ''}</span>
                <button type="button" data-del-log="${l.id}" aria-label="undo">↩️</button>
            </div>`).join('');
        const statusAction = goal.status === 'active'
            ? { label: t('pause'), onClick: () => sheetMutate({ action: 'goal_update', id: goal.id, changes: { status: 'paused' } }) }
            : { label: goal.status === 'paused' ? t('resume') : t('reopen'), onClick: () => sheetMutate({ action: 'goal_update', id: goal.id, changes: { status: 'active' } }) };
        const progress = goal.total ? `${App.num(s.progress)}/${App.num(goal.total)} ${unitName(goal.unit)} · ${Math.round(s.pct || 0)}%` : `${App.num(s.progress)} ${unitName(goal.unit)}`;
        App.openSheet(`${App.L().icons[goal.kind]} ${goal.title}`, `
            <div class="hint num">${esc(progress)}</div>
            ${goal.total ? `<div class="bar"><div style="width:${Math.min(100, s.pct || 0)}%"></div></div>` : ''}
            <div class="divider"></div>
            <h4>${esc(t('logTitle'))}</h4>
            ${App.segmented('mode', [['add', t('modeAdd')], ['set', t('modeSet')]], 'add')}
            <div class="row2" style="margin-top:10px">
                <div class="field"><label>${esc(t('amount'))} (${esc(unitName(goal.unit))})</label><input id="fAmount" type="number" inputmode="decimal" dir="ltr"></div>
                <div class="field"><label>${esc(t('hoursField'))}</label><input id="fHours" type="number" inputmode="decimal" min="0" step="0.25" dir="ltr"></div>
            </div>
            <button class="btn primary" type="button" id="logButton" style="width:100%">${esc(t('log'))}</button>
            ${history ? `<div class="divider"></div><h4>${esc(t('historyTitle'))}</h4>${history}` : ''}
            <div class="divider"></div>
            <h4>${esc(t('editGoal'))}</h4>
            <div class="field"><label>${esc(t('name'))}</label><input id="fTitle" type="text" maxlength="200" value="${esc(goal.title)}"></div>
            <div class="row2">
                <div class="field"><label>${esc(t('total'))}</label><input id="fTotal" type="number" inputmode="decimal" min="1" dir="ltr" value="${goal.total ?? ''}"></div>
                <div class="field"><label>${esc(t('unit'))}</label><select id="fUnit">${unitOptions(goal.unit)}</select></div>
            </div>`, [
            { label: t('delete'), style: 'danger', onClick: () => App.confirmBox(t('confirmDelete'), ok => ok && sheetMutate({ action: 'goal_delete', id: goal.id })) },
            statusAction,
            ...(goal.status !== 'done' ? [{ label: t('markDone'), onClick: () => sheetMutate({ action: 'goal_update', id: goal.id, changes: { status: 'done' } }) }] : []),
            { label: t('save'), style: 'primary', onClick: () => {
                const title = $('fTitle').value.trim();
                if (!title) return App.sheetError(t('required'));
                sheetMutate({ action: 'goal_update', id: goal.id, changes: { title, total: $('fTotal').value || null, unit: $('fUnit').value } });
            } }
        ]);
        $('logButton').addEventListener('click', () => {
            const amount = $('fAmount').value;
            const hours = $('fHours').value;
            if (!amount && !hours) return App.sheetError(t('needAmount'));
            sheetMutate({ action: 'goal_log', id: goal.id, amount: amount === '' ? null : Number(amount), mode: App.segValue('mode'), hours: hours === '' ? null : Number(hours) });
        });
        $('sheetBody').querySelectorAll('[data-del-log]').forEach(b => b.addEventListener('click', () =>
            App.confirmBox(t('confirmDelete'), ok => ok && sheetMutate({ action: 'log_delete', id: Number(b.dataset.delLog) }))));
        if (focusLog) setTimeout(() => $('fAmount').focus(), 60);
    }

    // ---------- History ----------
    function weekSummary(from, to) {
        const todos = data.todos.filter(x => x.date >= from && x.date <= to);
        const done = todos.filter(x => x.status === 'done').length;
        const logs = data.logs.filter(l => l.date >= from && l.date <= to);
        const perUnit = {};
        logs.forEach(l => {
            const goal = data.goals.find(g => g.id === l.goal_id);
            if (goal && goal.unit !== 'hours' && l.amount > 0) perUnit[goal.unit] = (perUnit[goal.unit] || 0) + Number(l.amount);
        });
        const hours = logs.reduce((s, l) => s + Number(l.hours), 0);
        const habits = data.habits.filter(h => h.active);
        let habitDays = 0;
        habits.forEach(h => { for (let d = from; d <= to; d = App.addDays(d, 1)) if (habitDoneOn(h, d).done) habitDays++; });
        const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
        const habitPct = habits.length ? Math.round((habitDays / (habits.length * days)) * 100) : null;
        const money = App.accounting ? App.accounting.totalsBetween(from, to) : null;
        return { todos: todos.length, done, perUnit, hours, habitPct, money };
    }

    function renderHistory() {
        if (!ready('history')) return;
        const today = data.today;
        const week = weekSummary(App.addDays(today, -6), today);
        const stats = [
            [`${week.done}/${week.todos}`, t('statTasks')],
            [week.habitPct === null ? '—' : `${week.habitPct}%`, t('statHabits')],
            ...Object.entries(week.perUnit).sort((a, b) => b[1] - a[1]).slice(0, 1).map(([u, v]) => [`+${App.num(v)}`, unitName(u)]),
            [App.num(week.hours), t('statHours')],
            ...(week.money ? [[App.fmtMoney(week.money.spent, week.money.cur), t('statSpent')], [App.fmtMoney(week.money.earned, week.money.cur), t('statEarned')]] : [])
        ].slice(0, 6);
        $('weekStats').innerHTML = stats.map(([value, label]) => `<div class="stat"><div class="stat-value">${esc(value)}</div><div class="stat-label">${esc(label)}</div></div>`).join('');

        // Heatmap: 12 weeks, Saturday to Friday columns.
        const doneByDay = {};
        data.todos.filter(x => x.status === 'done').forEach(x => { doneByDay[x.date] = (doneByDay[x.date] || 0) + 1; });
        const dow = new Date(today + 'T12:00:00Z').getUTCDay();
        const start = App.addDays(today, -((dow + 1) % 7) - 7 * 11);
        const cells = [];
        for (let i = 0; i < 84; i++) {
            const day = App.addDays(start, i);
            const n = doneByDay[day] || 0;
            const level = n === 0 ? '' : n <= 2 ? 'l1' : n <= 4 ? 'l2' : n <= 6 ? 'l3' : 'l4';
            cells.push(`<span class="${day > today ? 'future' : level}" title="${day}: ${n}"></span>`);
        }
        $('heatmap').innerHTML = cells.join('');
        $('legend').innerHTML = `${esc(t('less'))} <i style="background:var(--soft)"></i><i style="background:#bbf7d0"></i><i style="background:#4ade80"></i><i style="background:#16a34a"></i><i style="background:#14532d"></i> ${esc(t('more'))}`;

        const rows = [];
        for (let w = 0; w < 4; w++) {
            const to = App.addDays(today, -7 * w);
            const from = App.addDays(to, -6);
            const s = weekSummary(from, to);
            const parts = [];
            if (s.todos) parts.push(t('todosDone', { done: s.done, total: s.todos }));
            Object.entries(s.perUnit).forEach(([u, v]) => parts.push(`+${App.num(v)} ${unitName(u)}`));
            if (s.hours) parts.push(t('hoursLine', { n: App.num(s.hours) }));
            if (s.habitPct !== null) parts.push(t('habitsLine', { pct: s.habitPct }));
            if (s.money && s.money.spent) parts.push(t('spentLine', { amount: App.ltr(App.fmtMoney(s.money.spent, s.money.cur)) }));
            rows.push(`<div class="week-row"><b>${esc(t('weekLine', { from: App.shortDay(from), to: App.shortDay(to) }))}</b><div>${esc(parts.join(' · ') || t('nothing'))}</div></div>`);
        }
        $('weeks').innerHTML = rows.join('');
    }

    // ---------- events ----------
    function bind() {
        document.addEventListener('click', e => {
            if (e.target.closest('[data-retry]') && e.target.closest('.view-error') && !e.target.closest('#accError')) {
                status = 'loading';
                refresh();
                return;
            }
            if (!data || e.target.closest('#sheetBackdrop')) return;
            const el = e.target.closest('[data-toggle],[data-edit-todo],[data-goal],[data-log-goal],[data-habit-check],[data-edit-habit]');
            if (!el) return;
            if (el.dataset.toggle) {
                const todo = data.todos.find(x => x.id === Number(el.dataset.toggle));
                if (!todo) return;
                const next = todo.status === 'done' ? 'open' : 'done';
                todo.status = next; // show it right away
                App.haptic('select');
                App.render();
                App.updateBadges();
                mutate({ action: 'todo_update', id: todo.id, changes: { status: next } }, err => { App.alertBox(err.message); refresh(); });
            } else if (el.dataset.editTodo) {
                const todo = data.todos.find(x => x.id === Number(el.dataset.editTodo));
                if (todo) editTodo(todo);
            } else if (el.dataset.logGoal) {
                e.stopPropagation();
                const goal = data.goals.find(g => g.id === Number(el.dataset.logGoal));
                if (goal) openGoal(goal, true);
            } else if (el.dataset.goal) {
                const goal = data.goals.find(g => g.id === Number(el.dataset.goal));
                if (goal) openGoal(goal, false);
            } else if (el.dataset.habitCheck) {
                const habit = data.habits.find(h => h.id === Number(el.dataset.habitCheck));
                if (!habit) return;
                App.haptic('select');
                mutate({ action: 'habit_check', id: habit.id, date: data.today, done: !habitDoneOn(habit, data.today).done });
            } else if (el.dataset.editHabit) {
                const habit = data.habits.find(h => h.id === Number(el.dataset.editHabit));
                if (habit) editHabit(habit);
            }
        });
        $('addTodoForm').addEventListener('submit', async e => {
            e.preventDefault();
            const title = $('newTodo').value.trim();
            if (!title || !data) return;
            $('newTodo').value = '';
            await mutate({ action: 'todo_add', title, date: App.addDays(data.today, newTodoDay) }, err => { $('newTodo').value = title; App.alertBox(err.message); });
        });
        $('dayChips').addEventListener('click', e => {
            const chip = e.target.closest('.chip');
            if (!chip) return;
            newTodoDay = Number(chip.dataset.day);
            document.querySelectorAll('#dayChips .chip').forEach(c => c.classList.toggle('active', c === chip));
        });
        $('newGoalButton').addEventListener('click', newGoal);
        $('newHabitButton').addEventListener('click', newHabit);
    }

    App.addLoader(load);
    const badgeTasks = () => {
        if (status !== 'ready') return;
        App.setBadge('tasks', data.todos.filter(x => x.date === data.today && x.status === 'open').length);
        App.setBadge('habits', data.habits.filter(h => h.active && !habitDoneOn(h, data.today).done).length);
    };
    App.register('tasks', { render: renderTasks, badge: badgeTasks, hasData: () => status === 'ready' && (data.todos.length + data.goals.length + data.habits.length) > 0 });
    App.register('habits', { render: renderHabits });
    App.register('goals', { render: renderGoals });
    App.register('history', { render: renderHistory });

    document.addEventListener('DOMContentLoaded', bind);
    if (document.readyState !== 'loading') bind();
})(window.App);
