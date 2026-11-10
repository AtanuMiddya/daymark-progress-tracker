(() => {
  'use strict';

  const KEY = 'daymark-v1';
  const categories = [
    { id: 'study', label: 'Study / deep work', emoji: '▤' },
    { id: 'movement', label: 'Movement / workout', emoji: '↗' },
    { id: 'nutrition', label: 'Nutrition', emoji: '◉' },
    { id: 'sleep', label: 'Sleep & recovery', emoji: '☾' },
    { id: 'discipline', label: 'Focus & discipline', emoji: '✳' },
  ];
  const habits = [
    { id: 'wake', label: 'Started on time', emoji: '☀' },
    { id: 'stretch', label: 'Walk or stretch', emoji: '↗' },
    { id: 'study', label: 'Focused study', emoji: '▤' },
    { id: 'revision', label: 'Revision / practice', emoji: '⟳' },
    { id: 'movement', label: 'Workout / movement', emoji: '⌁' },
    { id: 'water', label: 'Drank enough water', emoji: '◌' },
    { id: 'noJunk', label: 'Ate with intention', emoji: '♡' },
    { id: 'windDown', label: 'Wound down on time', emoji: '☾' },
  ];
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const longWeekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let today = dateKey(new Date());
  let state = loadState();
  let currentView = 'today';
  let selectedDate = today;
  let toastTimer = 0;
  let reminderTimeout = 0;
  let deferredInstall = null;
  const main = document.getElementById('main-content');

  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  function parseDate(key) { const [year, month, day] = key.split('-').map(Number); return new Date(year, month - 1, day, 12); }
  function shiftDate(key, amount) { const date = parseDate(key); date.setDate(date.getDate() + amount); return dateKey(date); }
  function dayDiff(from, to) { const a = from.split('-').map(Number); const b = to.split('-').map(Number); return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000); }
  function formatDate(key, options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) { return parseDate(key).toLocaleDateString(undefined, options); }
  function defaultState() { return { version: 1, programStart: today, prefs: { reminderTime: '21:00', reminderEnabled: false }, entries: {} }; }
  function loadState() {
    try { const parsed = JSON.parse(localStorage.getItem(KEY)); if (parsed && parsed.entries && parsed.prefs) return parsed; } catch (_) { /* Start fresh if saved data is unreadable. */ }
    return defaultState();
  }
  function saveState() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function entryFor(key = selectedDate) {
    if (!state.entries[key]) state.entries[key] = { priorities: ['', '', ''], priorityDone: [false, false, false], ratings: {}, habits: {}, water: 0, reflection: { win: '', improve: '' }, studies: [], uploaded: false };
    const entry = state.entries[key];
    if (!Array.isArray(entry.priorities)) entry.priorities = ['', '', ''];
    if (!Array.isArray(entry.priorityDone)) entry.priorityDone = [false, false, false];
    if (!entry.ratings || typeof entry.ratings !== 'object') entry.ratings = {};
    if (!entry.habits || typeof entry.habits !== 'object') entry.habits = {};
    if (!entry.reflection) entry.reflection = { win: '', improve: '' };
    if (!Array.isArray(entry.studies)) entry.studies = [];
    return entry;
  }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function scoreOf(entry) {
    const values = categories.map(({ id }) => Number.isFinite(Number(entry.ratings[id])) && entry.ratings[id] !== undefined && entry.ratings[id] !== null && entry.ratings[id] !== '' ? Math.max(0, Math.min(10, Number(entry.ratings[id]))) : null).filter((value) => value !== null);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null;
  }
  function scoreLabel(score) { if (score === null) return 'Ready when you are'; if (score >= 8) return 'A strong, steady day'; if (score >= 6) return 'Good progress today'; if (score >= 4) return 'A little progress counts'; return 'A fresh start is always yours'; }
  function currentWeek(key = selectedDate) {
    const date = parseDate(key); const mondayOffset = (date.getDay() + 6) % 7; const start = shiftDate(key, -mondayOffset);
    return Array.from({ length: 7 }, (_, index) => shiftDate(start, index));
  }
  function allScores(keys) { return keys.map((key) => ({ key, score: state.entries[key] ? scoreOf(state.entries[key]) : null })).filter((item) => item.score !== null); }
  function average(items) { return items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length * 10) / 10 : null; }
  function weekAverage(key = selectedDate) { return average(allScores(currentWeek(key))); }
  function habitCount(entry) { return habits.filter(({ id }) => entry.habits[id]).length + (Number(entry.water) >= 6 ? 1 : 0); }
  function streak() { let count = 0; let cursor = state.entries[today] && scoreOf(state.entries[today]) !== null ? today : shiftDate(today, -1); while (state.entries[cursor] && scoreOf(state.entries[cursor]) !== null) { count += 1; cursor = shiftDate(cursor, -1); } return count; }
  function cycleDay(key) { return Math.max(1, Math.min(365, dayDiff(state.programStart || today, key) + 1)); }
  function setActiveNav() {
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.view === currentView));
    document.getElementById('breadcrumb-view').textContent = currentView === 'today' ? 'Today' : currentView === 'week' ? 'This week' : '365 days';
    document.getElementById('today-nav-date').textContent = parseDate(today).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function render() { setActiveNav(); if (currentView === 'week') renderWeek(); else if (currentView === 'year') renderYear(); else renderToday(); }
  function renderToday() {
    const entry = entryFor(selectedDate); saveState();
    const overall = scoreOf(entry); const currentWeekKeys = currentWeek(selectedDate); const avg = weekAverage(selectedDate);
    const checked = habitCount(entry); const completedPriorities = entry.priorityDone.filter(Boolean).length;
    const progress = Math.round(checked / (habits.length + 1) * 100);
    main.innerHTML = `
      <div class="page-heading">
        <div><div class="eyebrow">${selectedDate === today ? 'YOUR DAY, YOUR PACE' : 'LOOKING BACK'}</div><h1>${selectedDate === today ? 'Today, made yours.' : esc(formatDate(selectedDate, { month: 'long', day: 'numeric' }))}</h1><p>Choose what matters, notice your progress, and keep moving forward.</p></div>
        <div class="date-control"><button class="date-step" data-date-shift="-1" aria-label="Previous day">‹</button><label class="date-display"><span>${esc(formatDate(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' }))}</span><input type="date" id="date-picker" aria-label="Choose date" value="${selectedDate}" max="${today}" /></label><button class="date-step" data-date-shift="1" aria-label="Next day" ${selectedDate >= today ? 'disabled' : ''}>›</button></div>
      </div>

      <section class="hero-card" aria-label="Daily progress score">
        <div class="hero-copy"><div class="hero-topline"><span class="spark">✳</span><span>${selectedDate === today ? 'A LITTLE BETTER, EVERY DAY' : 'YOUR PROGRESS, IN PERSPECTIVE'}</span></div><h2>${selectedDate === today ? 'Make room for a <em>good day.</em>' : 'Every day adds to <em>your story.</em>'}</h2><p>${esc(formatDate(selectedDate))} · ${selectedDate === today ? 'One thoughtful choice is enough to get started.' : 'Your past effort still counts. Take a moment to reflect.'}</p><div class="hero-meta"><span><strong>${checked}/${habits.length + 1}</strong> routines</span><span><strong>${completedPriorities}/3</strong> priorities</span><span><strong>${streak()}</strong> day streak</span></div></div>
        <div class="score-wrap"><div class="score-ring" style="--score-angle:${overall === null ? 0 : (overall / 10) * 360}deg"><div class="score-ring-inner"><span class="score-number" data-overall-score>${overall === null ? '—' : overall}</span><span class="score-denom">out of 10</span></div></div><div class="score-caption">TODAY'S SCORE</div></div>
      </section>

      <div class="section-heading"><div class="section-title"><span class="section-mark">✳</span> A few things to focus on</div><span class="section-subtle">Keep it simple. Keep it yours.</span></div>
      <div class="dashboard-grid">
        <section class="card priorities-card"><div class="card-head"><div><div class="card-title">Today's top 3</div><div class="card-caption">A short list makes a focused day.</div></div><span class="card-icon icon-mint">✓</span></div><div class="priorities-list">${entry.priorities.map((text, index) => `<label class="priority-row ${entry.priorityDone[index] ? 'done' : ''}"><span class="priority-index">0${index + 1}</span><input class="priority-input" data-priority="${index}" placeholder="Add a priority" value="${esc(text)}" aria-label="Priority ${index + 1}" /><input class="check-box" type="checkbox" data-priority-done="${index}" aria-label="Complete priority ${index + 1}" ${entry.priorityDone[index] ? 'checked' : ''} /></label>`).join('')}</div></section>
        <section class="card purpose-card"><div class="card-head"><div><div class="card-title">Why this matters</div><div class="card-caption">Your reasons are worth remembering.</div></div><span class="card-icon icon-orange">♡</span></div><div class="purpose-list"><div class="purpose-item"><span class="purpose-icon">↗</span>Build a career I'm proud of</div><div class="purpose-item"><span class="purpose-icon">◎</span>Create financial freedom</div><div class="purpose-item"><span class="purpose-icon">✳</span>Feel strong and healthy</div></div><div class="purpose-foot">Small steps still move you forward.</div></section>
        <section class="card weekly-mini-card"><div class="card-head"><div><div class="card-title">Your week so far</div><div class="card-caption">A rhythm, not a race.</div></div><button class="quiet-button" data-view="week">See week ↗</button></div><div class="mini-bars">${currentWeekKeys.map((key) => { const score = state.entries[key] ? scoreOf(state.entries[key]) : null; const height = score === null ? 4 : Math.max(7, score * 5.5); return `<div class="mini-day"><div class="mini-bar-track"><div class="mini-bar ${key === selectedDate ? 'is-today' : ''}" style="height:${height}px"></div></div><span class="mini-bar-label">${weekdays[parseDate(key).getDay()][0]}</span></div>`; }).join('')}</div><div class="mini-week-footer"><span>Average score</span><strong>${avg === null ? '—' : `${avg} / 10`}</strong></div></section>
        <section class="card ratings-card"><div class="card-head"><div><div class="card-title">Rate the parts that mattered</div><div class="card-caption">Your daily score is the average of the ratings you enter.</div></div><span class="card-icon icon-violet">◎</span></div><div class="rating-list">${categories.map(({ id, label, emoji }) => { const value = entry.ratings[id] === undefined ? 0 : Number(entry.ratings[id]); return `<label class="rating-row"><span class="rating-name"><span class="rating-emoji">${emoji}</span>${label}</span><input type="range" min="0" max="10" step="1" value="${value}" class="rating-slider" style="--fill:${value * 10}%" data-rating="${id}" aria-label="${label} score" /><span class="rating-value"><span data-rating-value="${id}">${value}</span><small>/10</small></span></label>`; }).join('')}</div><div class="ratings-total"><span data-score-caption>${esc(scoreLabel(overall))}</span><strong><span data-rating-total>${overall === null ? '—' : overall}</span> <small>/ 10</small></strong></div></section>
        <section class="card habits-card"><div class="card-head"><div><div class="card-title">Little habits, real momentum</div><div class="card-caption">Check in with the things that help you feel good.</div></div><span class="card-icon icon-blue">✳</span></div><div class="habit-list">${habits.map(({ id, label, emoji }) => `<label class="habit-row ${entry.habits[id] ? 'is-done' : ''}"><span class="habit-emoji">${emoji}</span><span>${label}</span><span class="habit-spacer"></span><input type="checkbox" class="check-box" data-habit="${id}" aria-label="${label}" ${entry.habits[id] ? 'checked' : ''} /></label>`).join('')}</div><div class="habit-progress"><div class="habit-track"><span style="width:${progress}%"></span></div><span class="habit-count">${Math.floor(checked)} of ${habits.length + 1} complete</span></div><div class="water-row"><div class="water-label">Water goal<small>${entry.water || 0} of 6 glasses</small></div><div class="water-glasses" aria-label="Water intake">${Array.from({ length: 6 }, (_, index) => `<button class="water-glass ${index < entry.water ? 'is-full' : ''}" data-water="${index + 1}" aria-label="Log ${index + 1} glasses" style="--water-fill:${index < entry.water ? 78 : 0}%"></button>`).join('')}</div></div></section>
        <section class="card reflection-card"><div class="card-head"><div><div class="card-title">A moment to reflect</div><div class="card-caption">A sentence or two is more than enough.</div></div><span class="card-icon icon-violet">✎</span></div><div class="reflection-grid"><div class="reflection-field"><label for="reflection-win">What went well today?</label><textarea id="reflection-win" data-reflection="win" placeholder="Give yourself credit for…">${esc(entry.reflection.win)}</textarea></div><div class="reflection-field"><label for="reflection-improve">What would make tomorrow easier?</label><textarea id="reflection-improve" data-reflection="improve" placeholder="One thing I can try…">${esc(entry.reflection.improve)}</textarea></div></div></section>
        <section class="card checkin-card"><div class="card-head"><div><div class="card-title">Your daily check-in</div><div class="card-caption">Capture a note, photo, or small win.</div></div><span class="card-icon icon-mint">↑</span></div><div class="checkin-body"><div class="checkin-badge">↥</div><div class="checkin-copy"><strong>Keep a record of showing up.</strong><span>Attach a photo or file as a personal progress record. Attachments stay in this browser.</span></div></div><div id="attachments" class="attachment-list"></div><div class="checkin-actions"><button class="secondary-button" id="add-attachment">＋ Add a file</button><button class="primary-button" id="submit-checkin">${entry.uploaded ? 'Update check-in' : 'Save today’s check-in'} →</button><button class="quiet-button" id="whatsapp-draft">WhatsApp draft ↗</button></div>${entry.uploaded ? `<div class="checkin-complete">✓ Check-in saved for ${esc(formatDate(selectedDate, { month: 'short', day: 'numeric' }))}</div>` : ''}<div class="reminder-banner"><p><strong>Want a nudge later?</strong> Turn on a browser reminder in your 365-day settings. WhatsApp messages need a connected sender account.</p><button data-view="year">Reminder settings ↗</button></div></section>
      </div>`;
    renderAttachments(selectedDate);
  }

  function renderWeek() {
    const days = currentWeek(selectedDate); const scores = allScores(days); const avg = average(scores); const best = scores.reduce((max, item) => max === null || item.score > max.score ? item : max, null);
    const routinesDone = days.reduce((sum, key) => sum + (state.entries[key] ? habitCount(state.entries[key]) : 0), 0);
    const scoredDays = scores.length;
    const entry = entryFor(selectedDate);
    const review = state.weekReview || {};
    main.innerHTML = `<div class="page-heading"><div><div class="eyebrow">ZOOM OUT, THEN KEEP GOING</div><h1>Your week, in view.</h1><p>Notice what worked and carry it into the next seven days.</p></div><div class="date-control"><button class="date-step" data-date-shift="-7" aria-label="Previous week">‹</button><label class="date-display"><span>${esc(formatDate(days[0], { month: 'short', day: 'numeric' }))} – ${esc(formatDate(days[6], { month: 'short', day: 'numeric', year: 'numeric' }))}</span><input type="date" id="date-picker" aria-label="Choose a date in this week" value="${selectedDate}" max="${today}" /></label><button class="date-step" data-date-shift="7" aria-label="Next week" ${shiftDate(selectedDate, 7) > today ? 'disabled' : ''}>›</button></div></div>
      <div class="week-summary-grid"><div class="stat-card"><div class="stat-label">Weekly score</div><div class="stat-value">${avg === null ? '—' : avg}<small>/ 10</small></div><div class="stat-note">Average across ${scoredDays} scored ${scoredDays === 1 ? 'day' : 'days'}</div></div><div class="stat-card"><div class="stat-label">Days checked in</div><div class="stat-value">${scoredDays}<small>/ 7 days</small></div><div class="stat-note">A little consistency goes a long way</div></div><div class="stat-card"><div class="stat-label">Routines completed</div><div class="stat-value">${Math.floor(routinesDone)}<small>this week</small></div><div class="stat-note">Small actions add up</div></div><div class="stat-card"><div class="stat-label">Best day</div><div class="stat-value">${best ? best.score : '—'}<small>${best ? esc(weekdays[parseDate(best.key).getDay()]) : 'not scored yet'}</small></div><div class="stat-note">Your high point this week</div></div></div>
      <div class="dashboard-grid"><section class="card week-chart-card"><div class="card-head"><div><div class="card-title">Daily score</div><div class="card-caption">Your personal 0–10 score, one day at a time.</div></div><span class="card-icon icon-mint">▦</span></div><div class="week-chart">${days.map((key) => { const score = state.entries[key] ? scoreOf(state.entries[key]) : null; return `<div class="chart-column"><span class="chart-value">${score === null ? '' : score}</span><div class="chart-track"><div class="chart-bar ${key === today ? 'today' : ''}" style="--bar-height:${score === null ? 0 : score * 10}%"></div></div><span class="chart-day">${weekdays[parseDate(key).getDay()]}</span></div>`; }).join('')}</div><div class="chart-legend"><span>Score out of 10</span><strong>Weekly average ${avg === null ? '—' : `${avg} / 10`}</strong></div></section>
      <section class="card weekly-habits-card"><div class="card-head"><div><div class="card-title">Your routines</div><div class="card-caption">The small things that made the week.</div></div><span class="card-icon icon-blue">✳</span></div><div class="weekly-habit-table"><span class="habit-table-head"></span>${days.map((key) => `<span class="habit-table-head">${weekdays[parseDate(key).getDay()][0]}</span>`).join('')}${habits.slice(0, 6).map(({ id, label }) => `<span class="habit-table-name">${label}</span>${days.map((key) => `<span class="week-dot ${state.entries[key]?.habits[id] ? 'done' : ''}" title="${esc(weekdays[parseDate(key).getDay()])}: ${state.entries[key]?.habits[id] ? 'done' : 'not checked'}">${state.entries[key]?.habits[id] ? '✓' : ''}</span>`).join('')}`).join('')}</div><div class="review-highlight">${avg === null ? 'Rate a few areas on your daily page to begin your weekly picture.' : `<strong>${avg >= 7 ? 'You showed up with real consistency.' : 'You’re building your rhythm.'}</strong> ${scoredDays} of 7 days have a score so far.`}</div></section>
      <section class="card week-reflection"><div class="card-head"><div><div class="card-title">Your weekly reflection</div><div class="card-caption">No perfect answers. Just what you’re noticing.</div></div><span class="card-icon icon-violet">✎</span></div><div class="reflection-grid"><div class="reflection-field"><label for="week-win">What are you proud of?</label><textarea id="week-win" data-week-review="win" placeholder="One thing I handled well…">${esc(review.win)}</textarea></div><div class="reflection-field"><label for="week-learned">What did this week teach you?</label><textarea id="week-learned" data-week-review="learned" placeholder="I learned that…">${esc(review.learned)}</textarea></div><div class="reflection-field"><label for="week-next">One intention for next week</label><textarea id="week-next" data-week-review="next" placeholder="Next week, I’ll make time for…">${esc(review.next)}</textarea></div></div></section></div>`;
  }

  function renderYear() {
    const start = state.programStart || today; const end = shiftDate(start, 364); const todayNumber = cycleDay(today); const allDays = Array.from({ length: 365 }, (_, index) => shiftDate(start, index));
    const scores = allScores(allDays); const avg = average(scores); const loggedDays = scores.length; const thisWeekAverage = weekAverage(today);
    const monthStats = [...new Set(allDays.map((key) => key.slice(0, 7)))].map((monthKey) => { const monthDays = allDays.filter((key) => key.startsWith(monthKey)); const monthScores = allScores(monthDays); const [year, month] = monthKey.split('-').map(Number); return { monthKey, label: new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), score: average(monthScores), count: monthScores.length }; });
    const categoryStats = categories.map((category) => { const values = allDays.map((key) => state.entries[key]?.ratings?.[category.id]).filter((value) => value !== undefined && value !== null && value !== '').map(Number); return { ...category, average: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null }; });
    const firstWeekday = (parseDate(start).getDay() + 6) % 7;
    const gridDays = Array.from({ length: firstWeekday }, () => null).concat(allDays);
    const weekColumns = Math.ceil(gridDays.length / 7);
    const monthLabels = [];
    for (let week = 0; week < weekColumns; week += 1) { const date = gridDays.slice(week * 7, week * 7 + 7).find(Boolean); const prev = week > 0 ? gridDays.slice((week - 1) * 7, (week - 1) * 7 + 7).find(Boolean) : null; if (date && (!prev || parseDate(prev).getMonth() !== parseDate(date).getMonth())) monthLabels.push(`<span class="month-label" style="grid-column:${week + 2}">${parseDate(date).toLocaleDateString(undefined, { month: 'short' })}</span>`); }
    const calendarCells = gridDays.map((key, index) => { const col = Math.floor(index / 7) + 2; const row = (index % 7) + 2; if (!key) return ''; const score = state.entries[key] ? scoreOf(state.entries[key]) : null; const level = score === null ? 0 : score >= 9 ? 4 : score >= 7 ? 3 : score >= 5 ? 2 : 1; const isFuture = key > today; return `<button class="calendar-day level-${level} ${key === selectedDate ? 'is-selected' : ''} ${isFuture ? 'is-future' : ''}" style="grid-column:${col};grid-row:${row}" data-calendar-date="${key}" aria-label="${esc(formatDate(key))}: ${score === null ? 'not scored' : `score ${score} out of 10`}" title="${esc(formatDate(key, { month: 'short', day: 'numeric' }))}${score === null ? '' : ` · ${score}/10`}" ${isFuture ? 'disabled' : ''}></button>`; }).join('');
    const elapsed = Math.max(0, Math.min(365, dayDiff(start, today) + 1));
    main.innerHTML = `<div class="page-heading"><div><div class="eyebrow">A FULL YEAR, ONE DAY AT A TIME</div><h1>Look how far you can go.</h1><p>A wider view of the habits and effort you’re building.</p></div></div>
      <section class="year-hero"><div><div class="hero-topline"><span class="spark">✳</span><span>YOUR PERSONAL 365-DAY JOURNEY</span></div><h2>Keep showing up.</h2><p>${esc(formatDate(start, { month: 'long', day: 'numeric', year: 'numeric' }))} – ${esc(formatDate(end, { month: 'long', day: 'numeric', year: 'numeric' }))}</p></div><div class="year-progress"><div class="year-progress-top"><span>Day ${Math.max(1, Math.min(365, elapsed))} of 365</span><strong>${Math.round(elapsed / 365 * 100)}% complete</strong></div><div class="year-progress-track"><span style="width:${elapsed / 365 * 100}%"></span></div></div></section>
      <div class="year-kpi-grid"><div class="stat-card"><div class="stat-label">Average score</div><div class="stat-value">${avg === null ? '—' : avg}<small>/ 10</small></div><div class="stat-note">Across ${loggedDays} scored ${loggedDays === 1 ? 'day' : 'days'}</div></div><div class="stat-card"><div class="stat-label">Days checked in</div><div class="stat-value">${loggedDays}<small>/ 365</small></div><div class="stat-note">Your effort, recorded</div></div><div class="stat-card"><div class="stat-label">Current streak</div><div class="stat-value">${streak()}<small>days</small></div><div class="stat-note">One day at a time</div></div><div class="stat-card"><div class="stat-label">This week</div><div class="stat-value">${thisWeekAverage === null ? '—' : thisWeekAverage}<small>/ 10</small></div><div class="stat-note">Average daily score</div></div></div>
      <div class="dashboard-grid"><section class="card year-calendar-card" style="grid-column:span 12"><div class="card-head"><div><div class="card-title">Your 365-day map</div><div class="card-caption">Choose a day to open your daily check-in. The view begins on your first day.</div></div><span class="card-icon icon-mint">▤</span></div><div class="calendar-scroll"><div class="calendar-grid" style="grid-template-columns:30px repeat(${weekColumns},14px)"><span class="weekday-label" style="grid-row:3">M</span><span class="weekday-label" style="grid-row:5">W</span><span class="weekday-label" style="grid-row:7">F</span>${monthLabels.join('')}${calendarCells}</div></div><div class="calendar-legend"><span>Less</span><span class="calendar-day"></span><span class="calendar-day level-1"></span><span class="calendar-day level-2"></span><span class="calendar-day level-3"></span><span class="calendar-day level-4"></span><span>More</span></div></section>
      <div class="year-lower-grid" style="grid-column:span 12"><section class="card"><div class="card-head"><div><div class="card-title">Month by month</div><div class="card-caption">A steady view of your average score.</div></div><span class="card-icon icon-orange">↗</span></div><div class="month-list">${monthStats.map(({ label, score }) => `<div class="month-row"><span class="month-name">${label}</span><div class="month-track"><span style="width:${score === null ? 0 : score * 10}%"></span></div><span class="month-score">${score === null ? '—' : score}</span></div>`).join('')}</div>${loggedDays ? '' : '<div class="empty-note">Your monthly picture will fill in as you add daily scores.</div>'}</section><section class="card"><div class="card-head"><div><div class="card-title">Where you’re growing</div><div class="card-caption">Average score in each area.</div></div><span class="card-icon icon-blue">◎</span></div><div class="year-category-list">${categoryStats.map(({ id, label, average: value }) => `<div class="year-category"><span>${label.replace(' / ', ' + ')}</span><div class="category-track"><span style="width:${value === null ? 0 : value * 10}%"></span></div><strong class="category-score">${value === null ? '—' : value}</strong></div>`).join('')}</div>${loggedDays ? '' : '<div class="empty-note">Rate your day to see your personal trends here.</div>'}</section></div>
      <section class="card data-settings"><div class="card-head"><div><div class="card-title">Reminders & your data</div><div class="card-caption">Set a gentle nudge and keep a backup of your progress.</div></div><span class="card-icon icon-violet">⚙</span></div><div class="data-row"><div><strong>Daily browser reminder</strong><small>Shows a notification while this site is open on this device. Browser notifications need permission.</small></div><div class="data-actions"><input class="select-time" type="time" id="reminder-time" value="${esc(state.prefs.reminderTime || '21:00')}" aria-label="Reminder time"/><input type="checkbox" class="inline-toggle" id="reminder-toggle" aria-label="Enable browser reminder" ${state.prefs.reminderEnabled ? 'checked' : ''}/></div></div><div class="data-row"><div><strong>WhatsApp upload nudge</strong><small>Automatic messages need a WhatsApp Business sender and a secure server connection. This site can prepare a personal reminder message now.</small></div><div class="data-actions"><button class="secondary-button" id="whatsapp-settings">Open WhatsApp draft ↗</button></div></div><div class="data-row"><div><strong>Keep your records</strong><small>Entries save in this browser. Export a backup to move your tracker between devices.</small></div><div class="data-actions"><button class="secondary-button" id="year-export">Export backup ↓</button><button class="secondary-button" id="year-import">Import backup ↑</button></div></div><div class="storage-note"><span>ⓘ</span><span><strong>Private by default.</strong> Your notes, ratings, and attachments stay on this device. The public website does not sync data between devices until a secure sign-in and cloud database are connected.</span></div><div class="data-row"><div><strong>Start a new 365-day journey</strong><small>Your existing records stay in this browser. A new journey resets the day counter.</small></div><div class="data-actions"><button class="secondary-button" id="restart-year">Start today as Day 1</button></div></div></section></div>`;
  }

  function dbPromise() { return new Promise((resolve, reject) => { const request = indexedDB.open('daymark-attachments-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
  async function renderAttachments(key) {
    const box = document.getElementById('attachments'); if (!box || !('indexedDB' in window)) return;
    try { const db = await dbPromise(); const tx = db.transaction('files', 'readonly'); const req = tx.objectStore('files').getAll(); req.onsuccess = () => { if (!document.getElementById('attachments')) return; const files = req.result.filter((file) => file.day === key); box.innerHTML = files.map((file) => `<div class="attachment-chip"><span title="${esc(file.name)}">${esc(file.name)}</span><button data-remove-file="${esc(file.id)}" aria-label="Remove ${esc(file.name)}">×</button></div>`).join(''); }; } catch (_) { box.innerHTML = '<span class="section-subtle">File storage is unavailable in this browser.</span>'; }
  }
  async function addFiles(files) {
    if (!files.length) return;
    const tooLarge = files.filter((file) => file.size > 8 * 1024 * 1024);
    if (tooLarge.length) { showToast('Files must be under 8 MB each.'); return; }
    try { const db = await dbPromise(); const tx = db.transaction('files', 'readwrite'); const store = tx.objectStore('files'); files.forEach((file) => store.add({ id: `${selectedDate}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, day: selectedDate, name: file.name, type: file.type, size: file.size, blob: file })); tx.oncomplete = () => { renderAttachments(selectedDate); showToast('File added to your check-in.'); }; tx.onerror = () => showToast('Could not save this file on the device.'); } catch (_) { showToast('File storage is unavailable in this browser.'); }
  }
  async function removeFile(id) { try { const db = await dbPromise(); const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').delete(id); tx.oncomplete = () => renderAttachments(selectedDate); } catch (_) { showToast('Could not remove this file.'); } }

  function exportData() {
    const payload = { product: 'Daymark', exportedAt: new Date().toISOString(), ...state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `daymark-backup-${today}.json`; link.click(); URL.revokeObjectURL(url); showToast('Backup downloaded. Keep it somewhere safe.');
  }
  async function importData(file) {
    try { const incoming = JSON.parse(await file.text()); if (!incoming || typeof incoming.entries !== 'object') throw new Error('This is not a Daymark backup.'); const merged = { ...state.entries, ...incoming.entries }; state.entries = merged; if (incoming.programStart) state.programStart = incoming.programStart; if (incoming.prefs) state.prefs = { ...state.prefs, ...incoming.prefs }; saveState(); render(); showToast('Your backup is ready.'); } catch (_) { showToast('That file could not be read as a Daymark backup.'); }
  }
  function whatsappDraft() {
    const message = `Time for my Daymark upload and check-in ✳\n\nHow did today go? I’ll rate my focus, movement, food, sleep, and discipline, attach a progress note or photo, then save my progress.\n\nDay ${cycleDay(selectedDate)} of 365 · ${formatDate(selectedDate, { month: 'short', day: 'numeric' })}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }
  function showToast(message) { const toast = document.getElementById('toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600); }
  async function enableReminder() {
    if (!('Notification' in window)) { showToast('This browser does not support notifications.'); return false; }
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') { state.prefs.reminderEnabled = false; saveState(); render(); showToast('Browser notifications are turned off.'); return false; }
    state.prefs.reminderEnabled = true; saveState(); render(); scheduleReminder(); showToast('Daily browser reminder enabled on this device.'); return true;
  }
  function scheduleReminder() {
    window.clearTimeout(reminderTimeout); reminderTimeout = 0;
    if (!state.prefs.reminderEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    const [hours, minutes] = (state.prefs.reminderTime || '21:00').split(':').map(Number); const now = new Date(); const target = new Date(); target.setHours(hours, minutes, 0, 0);
    const remind = () => { if (document.visibilityState === 'visible') showToast('A little nudge: take a minute for today’s check-in.'); else { const notice = new Notification('Your Daymark check-in', { body: 'Take a minute to log today’s progress.', icon: './icon.svg' }); notice.onclick = () => { window.focus(); currentView = 'today'; render(); }; } state.prefs.lastNotifiedDate = today; saveState(); };
    if (target <= now) { if (!state.entries[today]?.uploaded && state.prefs.lastNotifiedDate !== today) remind(); target.setDate(target.getDate() + 1); }
    reminderTimeout = window.setTimeout(() => { if (!state.entries[today]?.uploaded && state.prefs.lastNotifiedDate !== today) remind(); scheduleReminder(); }, Math.max(1000, target.getTime() - now.getTime()));
  }
  function updateScoreDisplay(entry) {
    const score = scoreOf(entry); const number = document.querySelector('[data-overall-score]'); const total = document.querySelector('[data-rating-total]'); const caption = document.querySelector('[data-score-caption]'); const ring = document.querySelector('.score-ring');
    if (number) number.textContent = score === null ? '—' : score;
    if (total) total.textContent = score === null ? '—' : score;
    if (caption) caption.textContent = scoreLabel(score);
    if (ring) ring.style.setProperty('--score-angle', `${score === null ? 0 : score / 10 * 360}deg`);
  }
  function bindMainEvents() {
    main.addEventListener('click', async (event) => {
      const viewButton = event.target.closest('[data-view]'); if (viewButton) { currentView = viewButton.dataset.view; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const shift = event.target.closest('[data-date-shift]'); if (shift) { const candidate = shiftDate(selectedDate, Number(shift.dataset.dateShift)); if (candidate <= today) { selectedDate = candidate; render(); } return; }
      const water = event.target.closest('[data-water]'); if (water) { entryFor().water = Number(water.dataset.water); saveState(); render(); return; }
      const calendarDay = event.target.closest('[data-calendar-date]'); if (calendarDay) { selectedDate = calendarDay.dataset.calendarDate; currentView = 'today'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      if (event.target.closest('#add-attachment')) { document.getElementById('attachment-picker').click(); return; }
      if (event.target.closest('#submit-checkin')) { entryFor().uploaded = true; saveState(); render(); showToast('Your daily check-in is saved.'); return; }
      if (event.target.closest('#whatsapp-draft') || event.target.closest('#whatsapp-settings')) { whatsappDraft(); return; }
      const remove = event.target.closest('[data-remove-file]'); if (remove) { removeFile(remove.dataset.removeFile); return; }
      if (event.target.closest('#year-export')) { exportData(); return; }
      if (event.target.closest('#year-import')) { document.getElementById('import-picker').click(); return; }
      if (event.target.closest('#restart-year')) { state.programStart = today; saveState(); render(); showToast('Today is now Day 1 of your journey.'); return; }
    });
    main.addEventListener('input', async (event) => {
      const entry = entryFor(); const priority = event.target.closest('[data-priority]');
      if (priority) { entry.priorities[Number(priority.dataset.priority)] = priority.value; saveState(); return; }
      const rating = event.target.closest('[data-rating]');
      if (rating) { entry.ratings[rating.dataset.rating] = Number(rating.value); saveState(); const value = document.querySelector(`[data-rating-value="${rating.dataset.rating}"]`); if (value) value.textContent = rating.value; rating.style.setProperty('--fill', `${Number(rating.value) * 10}%`); updateScoreDisplay(entry); return; }
      const reflection = event.target.closest('[data-reflection]');
      if (reflection) { entry.reflection[reflection.dataset.reflection] = reflection.value; saveState(); return; }
      const weekReflection = event.target.closest('[data-week-review]');
      if (weekReflection) { if (!state.weekReview) state.weekReview = {}; state.weekReview[weekReflection.dataset.weekReview] = weekReflection.value; saveState(); return; }
    });
    main.addEventListener('change', async (event) => {
      if (event.target.id === 'date-picker') { if (event.target.value && event.target.value <= today) { selectedDate = event.target.value; render(); } return; }
      const priorityCheck = event.target.closest('[data-priority-done]'); if (priorityCheck) { const index = Number(priorityCheck.dataset.priorityDone); const entry = entryFor(); entry.priorityDone[index] = priorityCheck.checked; saveState(); render(); return; }
      const habit = event.target.closest('[data-habit]'); if (habit) { const entry = entryFor(); entry.habits[habit.dataset.habit] = habit.checked; saveState(); render(); return; }
      if (event.target.id === 'reminder-time') { state.prefs.reminderTime = event.target.value || '21:00'; saveState(); scheduleReminder(); showToast('Reminder time saved.'); return; }
      if (event.target.id === 'reminder-toggle') { if (event.target.checked) await enableReminder(); else { state.prefs.reminderEnabled = false; saveState(); render(); showToast('Daily browser reminder turned off.'); } }
    });
  }
  function refreshLocalDate() { const nextToday = dateKey(new Date()); if (nextToday !== today) { today = nextToday; render(); } }
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => { currentView = button.dataset.view; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  document.getElementById('export-button').addEventListener('click', exportData);
  document.getElementById('attachment-picker').addEventListener('change', (event) => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; });
  document.getElementById('import-picker').addEventListener('change', (event) => { const file = event.target.files?.[0]; if (file) importData(file); event.target.value = ''; });
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstall = event; const button = document.getElementById('install-button'); button.hidden = false; });
  document.getElementById('install-button').addEventListener('click', async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; document.getElementById('install-button').hidden = true; });
  document.getElementById('footer-year').textContent = new Date().getFullYear();
  bindMainEvents(); render(); scheduleReminder(); window.setInterval(refreshLocalDate, 60000);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();

