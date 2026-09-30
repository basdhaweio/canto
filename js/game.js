/* Game layer (same model as Forge): XP, levels, titles, streak with freezes, daily & weekly quests,
   unit epics, stats, achievements. Everything is derived from what's stored (activity log, card states,
   exercises, dialogue practice, sessions) so it backfills from history and never double-counts.
   `seen` only remembers what has already been celebrated. */
window.Canto = window.Canto || {};

Canto.game = (() => {
  const { h, today, addDays } = Canto.ui;
  const D = () => Canto.data, P = () => Canto.progress;

  // ---------- Tuning ----------
  const XP = { grade: 2, learn: 5, quizRight: 4, quizClose: 2, quizWrong: 1, tone: 2, exercise: 5, dialogue: 15, lesson: 50, daily: 20, perfectDay: 40, weekly: 60, perfectWeek: 120 };
  const TITLES = [
    [1, 'Newcomer', '新手'], [5, 'Tourist', '游客'], [10, 'Neighbour', '街坊'], [15, 'Regular', '熟客'], [20, 'Local', '本地人'],
    [25, 'Chatterbox', '吹水佬'], [30, 'Storyteller', '讲古佬'], [40, 'Scholar', '学者'], [50, 'Master', '师傅'], [65, 'Legend', '传奇'], [80, 'Mythic', '神级'],
  ];
  const DEFAULT_GOALS = { reviews: 20, learn: 10, quiz: 15 };

  function titleFor(L) { let t = TITLES[0]; for (const x of TITLES) if (L >= x[0]) t = x; return { en: t[1], zh: t[2] }; }
  function levelInfo(xp) {
    const L = Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1, cur = 100 * (L - 1) ** 2, next = 100 * L ** 2;
    return { level: L, xp, cur, next, into: xp - cur, need: next - cur, pct: (xp - cur) / (next - cur), title: titleFor(L) };
  }
  // Stats: level = floor(sqrt(points / per)) + 1
  function statLevel(points, per) {
    const L = Math.floor(Math.sqrt(Math.max(0, points) / per)) + 1, cur = per * (L - 1) ** 2, next = per * L ** 2;
    return { level: L, pct: (points - cur) / (next - cur) };
  }
  function goals() { return Object.assign({}, DEFAULT_GOALS, (P().settings().goals || {})); }
  function weekStart(d) { const dt = new Date(d + 'T00:00:00'); const wd = (dt.getDay() + 6) % 7; return addDays(d, -wd); } // Monday

  // ---------- Hooks (called by progress/quiz/dialogue) ----------
  function day(date) {
    const p = P().load();
    p.activity = p.activity || {};
    return p.activity[date] || (p.activity[date] = { g: {}, learned: 0, q: { r: 0, w: 0, c: 0 }, tone: 0, clear: false });
  }
  function onGrade(key, wasNew) {
    const d = day(today()), kind = key.split(':')[1] || 'f';
    d.g[kind] = (d.g[kind] || 0) + 1;
    if (wasNew) d.learned++;
    if (!d.clear) {
      const C = P().dueCount(P().buildCards({ unitIds: null, kinds: P().settings().cardKinds }));
      if (C.due === 0) d.clear = true;
    }
  }
  function onQuizAnswer(result, typedExact) {
    const d = day(today());
    d.q[result === 'right' ? 'r' : result === 'close' ? 'c' : 'w']++;
    if (typedExact) d.tone++;
  }
  function onQuizRun(run) {
    const p = P().load();
    p.quizRuns = p.quizRuns || [];
    p.quizRuns.push(Object.assign({ date: today() }, run));
    if (p.quizRuns.length > 400) p.quizRuns.splice(0, p.quizRuns.length - 400);
    P().save();
  }
  function onDialoguePractised(id) {
    const p = P().load();
    p.dlg = p.dlg || {};
    const list = p.dlg[id] || (p.dlg[id] = []);
    if (!list.includes(today())) { list.push(today()); P().save(); return true; }
    return false;
  }

  // ---------- Compute ----------
  function compute() {
    const p = P().load(), t = today(), G = goals();
    const act = p.activity || {};
    const days = {};
    const dayRec = (d) => days[d] || (days[d] = { date: d, graded: 0, learned: 0, qr: 0, qw: 0, qc: 0, tone: 0, ex: 0, exRight: 0, dlg: 0, lesson: 0, clear: false, xp: 0 });

    let legacyGraded = 0;
    for (const [d, n] of Object.entries(p.reviews || {})) {
      if (act[d]) continue;                        // days logged since the game started carry full detail
      dayRec(d).graded += n; legacyGraded += n;
    }
    let loggedLearned = 0;
    for (const [d, a] of Object.entries(act)) {
      const r = dayRec(d);
      r.graded += Object.values(a.g || {}).reduce((x, y) => x + y, 0);
      r.learned += a.learned || 0; loggedLearned += a.learned || 0;
      r.qr += (a.q && a.q.r) || 0; r.qw += (a.q && a.q.w) || 0; r.qc += (a.q && a.q.c) || 0;
      r.tone += a.tone || 0; r.clear = !!a.clear;
    }
    let exDone = 0, exRight = 0;
    for (const x of Object.values(p.exercises || {})) {
      if (!x.done) continue;
      exDone++; if (x.result === 'correct') exRight++;
      const d = x.doneAt || dateOf(x.ts);
      if (d) { const r = dayRec(d); r.ex++; if (x.result === 'correct') r.exRight++; }
    }
    let dlgRuns = 0;
    const dlgIds = new Set();
    for (const [id, list] of Object.entries(p.dlg || {})) for (const d of list) { dayRec(d).dlg++; dlgRuns++; dlgIds.add(id); }
    let lessons = 0;
    for (const v of Object.values((p.sessions && p.sessions.completed) || {})) if (typeof v === 'string') { dayRec(v).lesson++; lessons++; }

    // Cards: learned, mature, stat points
    const allCards = P().buildCards({ unitIds: null, kinds: { f: true, r: true, p: true, n: true, g: true, d: true } });
    const byKind = { f: [], r: [], p: [], n: [], g: [], d: [] };
    for (const c of allCards) byKind[c.kind].push(c);
    const strength = (c) => { const s = p.cards[c.key]; return s && s.reps ? 5 + Math.min(s.interval || 0, 90) : 0; };
    const learnedOf = (list) => list.filter((c) => (p.cards[c.key] || {}).reps).length;
    const matureOf = (list) => list.filter((c) => ((p.cards[c.key] || {}).interval || 0) >= 21).length;
    const learnedTotal = ['f', 'r', 'p', 'n', 'g', 'd'].reduce((a, k) => a + learnedOf(byKind[k]), 0);
    const legacyLearned = Math.max(0, learnedTotal - loggedLearned);
    const vocabWords = D().allVocab().filter((v) => v.deck === 'vocab');
    const wordsMet = vocabWords.filter((v) => (p.cards[v.id + ':f'] || {}).reps || (p.cards[v.id + ':r'] || {}).reps).length;

    // Daily quests + XP per day
    const due0 = P().dueCount(P().buildCards({ unitIds: null, kinds: P().settings().cardKinds }));
    const noNewLeft = due0.fresh === 0;
    function dailyQuests(r, isToday) {
      const quiz = r.qr + r.qw + r.qc;
      const list = [
        { id: 'reviews', icon: '📇', label: `Review ${G.reviews} cards`, value: r.graded, goal: G.reviews },
        { id: 'learn', icon: '🌱', label: `Learn ${G.learn} new words`, value: r.learned, goal: G.learn, auto: isToday && noNewLeft },
        { id: 'quiz', icon: '✅', label: `Answer ${G.quiz} quiz questions`, value: quiz, goal: G.quiz },
        { id: 'clear', icon: '🧹', label: 'Clear your due cards', value: r.clear || (isToday && due0.due === 0 && r.graded > 0) ? 1 : 0, goal: 1 },
      ];
      for (const q of list) q.met = q.auto || q.value >= q.goal;
      return list;
    }
    let questXP = 0, perfectDays = 0;
    for (const r of Object.values(days)) {
      r.xp = r.graded * XP.grade + r.learned * XP.learn + r.qr * XP.quizRight + r.qc * XP.quizClose + r.qw * XP.quizWrong
        + r.tone * XP.tone + r.ex * XP.exercise + r.dlg * XP.dialogue + r.lesson * XP.lesson;
      r.quests = dailyQuests(r, r.date === t);
      const met = r.quests.filter((q) => q.met).length;
      r.xp += met * XP.daily; questXP += met * XP.daily;
      r.perfect = met === r.quests.length;
      if (r.perfect) { r.xp += XP.perfectDay; questXP += XP.perfectDay; perfectDays++; }
      r.active = r.graded + r.qr + r.qw + r.qc >= 10 || r.ex >= 3 || r.dlg >= 1 || r.lesson >= 1;
    }
    const todayRec = dayRec(t);
    if (!todayRec.quests) { todayRec.quests = dailyQuests(todayRec, true); todayRec.xp = 0; todayRec.perfect = false; todayRec.active = false; }

    // Streak with freezes (Forge rules)
    const activeDates = Object.keys(days).filter((d) => days[d].active && d <= t).sort();
    const streak = { current: 0, best: 0, freezes: 0, comebacks: 0, frozen: new Set(), activeToday: !!days[t].active };
    if (activeDates.length) {
      let cur = 0, earn = 0, gap = 0, fr = 0;
      for (let d = activeDates[0]; d <= t; d = addDays(d, 1)) {
        if (days[d] && days[d].active) {
          if (gap >= 4) streak.comebacks++;
          gap = 0; cur++; earn++;
          if (earn >= 7) { earn = 0; if (fr < 2) fr++; }
        } else if (d !== t) {
          gap++;
          if (fr > 0 && cur > 0) { fr--; streak.frozen.add(d); } else { cur = 0; earn = 0; }
        }
        streak.best = Math.max(streak.best, cur);
      }
      streak.current = cur; streak.freezes = fr;
    }

    // Weekly quests (Monday–Sunday)
    const weeks = {};
    const firstDate = Object.keys(days).sort()[0] || t;
    let weekXP = 0, perfectWeeks = 0;
    for (let ws = weekStart(firstDate); ws <= t; ws = addDays(ws, 7)) {
      const dates = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
      const sum = (f) => dates.reduce((a, d) => a + (days[d] ? f(days[d]) : 0), 0);
      const qAns = sum((r) => r.qr + r.qw + r.qc), qRight = sum((r) => r.qr);
      const list = [
        { id: 'days', icon: '📅', label: 'Study 5 days', value: dates.filter((d) => days[d] && days[d].active).length, goal: 5 },
        { id: 'quiz', icon: '🎯', label: 'Answer 60 quiz questions, 80% right', value: qAns >= 60 && qRight / qAns >= 0.8 ? 60 : Math.min(59, qAns), goal: 60, note: qAns ? `${Math.round((qRight / qAns) * 100)}% right` : '' },
        { id: 'dialogue', icon: '💬', label: 'Practise 2 dialogues', value: sum((r) => r.dlg), goal: 2 },
        { id: 'exercise', icon: '✍️', label: 'Do 10 exercise items', value: sum((r) => r.ex), goal: 10 },
        { id: 'lesson', icon: '🎓', label: 'Have your lesson', value: sum((r) => r.lesson), goal: 1 },
      ];
      for (const q of list) q.met = q.value >= q.goal;
      const met = list.filter((q) => q.met).length;
      const closed = addDays(ws, 6) < t;
      const perfect = met === list.length;
      weekXP += met * XP.weekly + (perfect ? XP.perfectWeek : 0);
      if (perfect) perfectWeeks++;
      weeks[ws] = { ws, list, met, perfect, closed };
    }

    // Unit epics
    const runs = p.quizRuns || [];
    const epics = [];
    for (const u of D().units()) {
      if (!D().hasCards(u.id)) continue;
      const inUnit = (c) => c.unitId === u.id;
      const set = (s) => byKind.f.filter((c) => inUnit(c) && c.v.section === s);
      const steps = [];
      const add = (key, label, value, goal, xp) => steps.push({ key: u.id + ':' + key, label, value, goal, xp, done: goal > 0 && value >= goal });
      for (const s of ['Set 1', 'Set 2']) { const cs = set(s); if (cs.length) add(s, `Meet every ${s} word`, cs.filter((c) => (p.cards[c.key] || {}).reps || (p.cards[c.id + ':r'] || {}).reps).length, cs.length, 50); }
      const parts = byKind.p.filter(inUnit);
      if (parts.length) add('particles', 'Meet its particles & endings', learnedOf(parts), parts.length, 30);
      const nums = byKind.n.filter(inUnit);
      if (nums.length) add('numbers', 'Meet the numbers 0–100', learnedOf(nums), nums.length, 40);
      if (u.dialogues.length) add('dialogues', 'Practise every dialogue (run-through or role-play)', u.dialogues.filter((d) => (p.dlg || {})[d.id]).length, u.dialogues.length, 40);
      const items = u.exercises.flatMap((x) => x.items || []);
      if (items.length) add('exercises', 'Finish every exercise', items.filter((it) => (p.exercises[it.id] || {}).done).length, items.length, 60);
      const aced = runs.some((r) => r.units && r.units.length === 1 && r.units[0] === u.id && r.n >= 20 && r.first / r.n >= 0.9);
      add('quiz', 'Ace a quiz on this unit (20+ questions, 90% right first time)', aced ? 1 : 0, 1, 80);
      const words = byKind.f.filter(inUnit);
      add('mature', 'Make it stick: 80% of its words mature (3+ weeks)', matureOf(words), Math.ceil(words.length * 0.8), 150);
      const n = steps.filter((s) => s.done).length;
      epics.push({ id: u.id, icon: '📘', name: `Unit ${u.number} · ${u.title}`, steps, n, complete: n === steps.length });
    }
    const epicXP = epics.reduce((a, e) => a + e.steps.filter((s) => s.done).reduce((b, s) => b + s.xp, 0), 0);

    // Stats
    const pts = (list) => list.reduce((a, c) => a + strength(c), 0);
    const perFor = (size) => Math.max(1, size * 0.26);
    const vocabList = [...byKind.f, ...byKind.r];
    const toneTotal = Object.values(days).reduce((a, r) => a + r.tone, 0);
    const stats = {
      vocab: Object.assign({ id: 'vocab', icon: '📇', name: 'Vocabulary', zh: '词汇', desc: 'Word cards learned and how well they stick' }, statLevel(pts(vocabList), perFor(vocabList.length))),
      particles: Object.assign({ id: 'particles', icon: '🧩', name: 'Particles', zh: '助词', desc: 'Particles & endings deck' }, statLevel(pts(byKind.p), perFor(byKind.p.length))),
      numbers: Object.assign({ id: 'numbers', icon: '🔢', name: 'Numbers', zh: '数字', desc: 'Numbers deck' }, statLevel(pts(byKind.n), perFor(byKind.n.length))),
      tones: Object.assign({ id: 'tones', icon: '🎵', name: 'Tones', zh: '声调', desc: 'Typed quiz answers with every tone right' }, statLevel(toneTotal, 2)),
      dialogue: Object.assign({ id: 'dialogue', icon: '💬', name: 'Dialogue', zh: '对话', desc: 'Dialogue run-throughs and line cards' }, statLevel(dlgRuns * 10 + pts(byKind.d), 10)),
      grammar: Object.assign({ id: 'grammar', icon: '✍️', name: 'Grammar', zh: '语法', desc: 'Exercises and grammar-example cards' }, statLevel(exDone * 5 + pts(byKind.g), 10)),
    };

    // Totals for achievements
    const totalGraded = Object.values(days).reduce((a, r) => a + r.graded, 0);
    const quizAns = Object.values(days).reduce((a, r) => a + r.qr + r.qw + r.qc, 0);
    const perfectQuizzes = runs.filter((r) => r.n >= 10 && r.first === r.n).length;
    const bestRun = runs.reduce((a, r) => Math.max(a, r.best || 0), 0);
    const homework = ((D().state.syllabus || {}).sessions || []).filter((s) => (s.questions || []).length && s.questions.every((_, i) => (p.notes[`session-${s.n}-q${i + 1}`] || '').trim())).length;
    const lessonsDone = Object.keys((p.sessions && p.sessions.completed) || {}).length;
    const allParticles = byKind.p.length && learnedOf(byKind.p) === byKind.p.length;
    const allNumbers = byKind.n.length && learnedOf(byKind.n) === byKind.n.length;
    const allDialogues = D().units().flatMap((u) => u.dialogues).filter((d) => D().hasCards(d.unitId));
    const T = { totalGraded, learnedTotal, wordsMet, wordsTotal: vocabWords.length, mature: matureOf(vocabList), quizAns, perfectQuizzes, bestRun, toneTotal, exDone, exRight, dlgRuns, dlgIds: dlgIds.size, lessons: lessonsDone, homework, perfectWeeks, perfectDays, streakBest: streak.best, comebacks: streak.comebacks, epicsDone: epics.filter((e) => e.complete).length };

    const A = [];
    const ach = (id, icon, name, desc, value, gte, xp) => A.push({ id, icon, name, desc, value, gte, xp, unlocked: value >= gte, pct: Math.min(1, value / gte) });
    ach('first', '🌟', 'First card', 'Grade your first card', totalGraded, 1, 10);
    ach('rev100', '📇', 'Card sharp', 'Review 100 cards', totalGraded, 100, 25);
    ach('rev500', '🗂️', 'Deck hand', 'Review 500 cards', totalGraded, 500, 50);
    ach('rev1000', '🃏', 'Thousand cuts', 'Review 1,000 cards', totalGraded, 1000, 100);
    ach('rev2500', '🏯', 'Card tower', 'Review 2,500 cards', totalGraded, 2500, 150);
    ach('rev5000', '🐉', 'Dragon hoard', 'Review 5,000 cards', totalGraded, 5000, 250);
    ach('learn50', '🌱', 'Sprout', 'Meet 50 words', wordsMet, 50, 25);
    ach('learn150', '🌿', 'Growing', 'Meet 150 words', wordsMet, 150, 60);
    ach('learnAll', '🌳', 'Full canopy', 'Meet every vocabulary word in the course so far', wordsMet, Math.max(1, vocabWords.length), 200);
    ach('mature50', '🪴', 'Roots', '50 word cards mature (3+ weeks between reviews)', T.mature, 50, 60);
    ach('mature250', '🎋', 'Deep roots', '250 word cards mature', T.mature, 250, 150);
    ach('streak3', '🔥', 'Kindling', '3-day streak', streak.best, 3, 20);
    ach('streak7', '🔥', 'On fire', '7-day streak', streak.best, 7, 40);
    ach('streak14', '🌋', 'Two weeks strong', '14-day streak', streak.best, 14, 70);
    ach('streak30', '☄️', 'Month of Cantonese', '30-day streak', streak.best, 30, 150);
    ach('streak100', '🏮', 'Hundred days', '100-day streak', streak.best, 100, 400);
    ach('quiz100', '✅', 'Quiz regular', 'Answer 100 quiz questions', quizAns, 100, 30);
    ach('quiz1000', '🎯', 'Sharpshooter', 'Answer 1,000 quiz questions', quizAns, 1000, 150);
    ach('perfectQuiz', '💯', 'Flawless', 'Get every question right first time in a quiz of 10+', perfectQuizzes, 1, 50);
    ach('run25', '⚡', 'Unbroken', '25 right answers in a row in one quiz', bestRun, 25, 60);
    ach('tone25', '🎵', 'Tone deaf? Not you', 'Type 25 answers with every tone right', toneTotal, 25, 40);
    ach('tone200', '🎼', 'Six-tone virtuoso', 'Type 200 answers with every tone right', toneTotal, 200, 150);
    ach('particles', '🧩', 'Particle collector', 'Meet every particle & ending', allParticles ? 1 : 0, 1, 80);
    ach('numbers', '🔢', 'Counting in Cantonese', 'Meet every number card', allNumbers ? 1 : 0, 1, 60);
    ach('ex25', '✍️', 'Homework habit', 'Finish 25 exercise items', exDone, 25, 40);
    ach('ex150', '📚', 'Workbook warrior', 'Finish 150 exercise items', exDone, 150, 120);
    ach('dlg1', '💬', 'First words', 'Practise a dialogue', dlgIds.size, 1, 20);
    ach('dlgAll', '🎭', 'Full cast', 'Practise every dialogue', dlgIds.size, Math.max(1, allDialogues.length), 150);
    ach('lesson5', '🎓', 'Show up', 'Mark 5 lessons done', lessonsDone, 5, 50);
    ach('homework', '📺', 'Couch scholar', 'Answer every episode question for 3 sessions', homework, 3, 60);
    ach('perfectDay', '☀️', 'Perfect day', 'Complete every daily quest', perfectDays, 1, 30);
    ach('perfectWeek', '🌟', 'Perfect week', 'Complete every weekly quest', perfectWeeks, 1, 100);
    ach('epic1', '📘', 'Unit conquered', 'Complete a unit epic quest', T.epicsDone, 1, 200);
    ach('comeback', '🔄', 'Comeback', 'Come back after 4+ days away', streak.comebacks, 1, 30);
    const achXP = A.filter((a) => a.unlocked).reduce((s, a) => s + a.xp, 0);

    const dayXP = Object.values(days).reduce((a, r) => a + r.xp, 0);
    const legacyXP = legacyLearned * XP.learn;
    const total = dayXP + legacyXP + weekXP + epicXP + achXP;
    const src = { study: dayXP - questXP, quests: questXP + weekXP, epics: epicXP, achievements: achXP, earlier: legacyXP };
    return { total, level: levelInfo(total), days, today: days[t], streak, weeks, thisWeek: weeks[weekStart(t)], epics, stats, achievements: A, T, src, goals: G, legacyGraded };
  }
  function dateOf(ts) { if (!ts) return null; const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  // ---------- Celebrations ----------
  function confetti(n = 110) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = h('canvas', { class: 'confetti' });
    const dpr = window.devicePixelRatio || 1;
    const W = (c.width = window.innerWidth * dpr), H = (c.height = window.innerHeight * dpr);
    document.body.append(c);
    const ctx = c.getContext('2d');
    const cols = ['#c8974a', '#e0b93b', '#48bb78', '#4fc3f7', '#b794f4', '#fc8181', '#ffffff'];
    const ps = Array.from({ length: n }, () => ({ x: W / 2 + (Math.random() - 0.5) * W * 0.25, y: H * 0.42, vx: (Math.random() - 0.5) * W * 0.018, vy: -Math.random() * H * 0.022 - H * 0.006, r: (Math.random() * 5 + 4) * dpr, c: cols[(Math.random() * cols.length) | 0], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3 }));
    const t0 = performance.now();
    (function frame(tm) {
      const el = tm - t0;
      ctx.clearRect(0, 0, W, H);
      for (const q of ps) { q.x += q.vx; q.y += q.vy; q.vy += H * 0.0006; q.vx *= 0.99; q.a += q.va; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a); ctx.globalAlpha = Math.max(0, 1 - el / 2200); ctx.fillStyle = q.c; ctx.fillRect(-q.r / 2, -q.r / 3, q.r, q.r * 0.66); ctx.restore(); }
      if (el < 2200) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }
  const celebQ = [];
  let celebOpen = false;
  function celebrate(o) { celebQ.push(o); if (!celebOpen) nextCeleb(); }
  function nextCeleb() {
    const o = celebQ.shift();
    if (!o) { celebOpen = false; return; }
    celebOpen = true;
    if (!o.quiet) confetti();
    try { if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate([30, 50, 80]); } catch (e) {}
    const back = h('div', { class: 'celeb-back' });
    const close = () => { back.remove(); document.removeEventListener('keydown', key, true); setTimeout(nextCeleb, 180); };
    const key = (e) => { if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); close(); } else e.stopPropagation(); };
    document.addEventListener('keydown', key, true);
    back.append(h('div', { class: 'celeb' },
      h('div', { class: 'celeb-icon', text: o.icon || '🏆' }),
      o.eyebrow ? h('div', { class: 'eyebrow', text: o.eyebrow }) : null,
      h('h2', { text: o.title }),
      o.zh ? h('div', { class: 'celeb-zh zh', text: o.zh }) : null,
      o.sub ? h('p', { class: 'muted', text: o.sub }) : null,
      o.xp ? h('div', { class: 'celeb-xp', text: '+' + o.xp + ' XP' }) : null,
      h('button', { class: 'btn primary block', text: o.ok || '好嘢! Nice', onClick: close })));
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    document.body.append(back);
  }

  // Celebrate anything new since last time. Held back while a flashcard session or quiz is running.
  function afterChange() {
    if (Canto.session || Canto.quiz) return;
    const p = P().load();
    const C = compute();
    const seen = p.seen || (p.seen = {});
    seen.ach = seen.ach || {}; seen.steps = seen.steps || {}; seen.days = seen.days || {}; seen.weeks = seen.weeks || {}; seen.q = seen.q || {}; seen.stats = seen.stats || {};
    const t = today();
    if (!seen.init) {
      seen.init = t; seen.level = C.level.level;
      for (const a of C.achievements) if (a.unlocked) seen.ach[a.id] = t;
      for (const e of C.epics) for (const s of e.steps) if (s.done) seen.steps[s.key] = t;
      for (const [d, r] of Object.entries(C.days)) { if (r.perfect) seen.days[d] = 1; for (const q of r.quests || []) if (q.met) seen.q[d + ':' + q.id] = 1; }
      for (const [ws, W] of Object.entries(C.weeks)) { if (W.perfect) seen.weeks[ws] = 1; for (const q of W.list) if (q.met) seen.q[ws + ':w:' + q.id] = 1; }
      for (const s of Object.values(C.stats)) seen.stats[s.id] = s.level;
      P().save();
      const got = C.achievements.filter((a) => a.unlocked).length;
      celebrate({ icon: '🏮', eyebrow: 'Your Cantonese journey', title: `Level ${C.level.level} · ${C.level.title.en}`, zh: C.level.title.zh, sub: `Your study so far is already counted: ${C.total.toLocaleString()} XP` + (got ? `, ${got} achievement${got === 1 ? '' : 's'}` : '') + (C.streak.current ? `, a ${C.streak.current}-day streak` : '') + '. Keep going and the numbers climb.' });
      return;
    }
    let dirty = false;
    if (C.level.level > (seen.level || 1)) {
      const newTitle = titleFor(C.level.level).en !== titleFor(seen.level || 1).en;
      celebrate({ icon: '⚡', eyebrow: 'Level up', title: `Level ${C.level.level}`, zh: newTitle ? C.level.title.zh : '', sub: newTitle ? `New title: ${C.level.title.en}` : `${(C.level.need - C.level.into).toLocaleString()} XP to level ${C.level.level + 1}.` });
      seen.level = C.level.level; dirty = true;
    }
    for (const a of C.achievements) if (a.unlocked && !seen.ach[a.id]) { seen.ach[a.id] = t; dirty = true; celebrate({ icon: a.icon, eyebrow: 'Achievement unlocked', title: a.name, sub: a.desc, xp: a.xp }); }
    for (const e of C.epics) {
      const fresh = e.steps.filter((s) => s.done && !seen.steps[s.key]);
      if (!fresh.length) continue;
      fresh.forEach((s) => { seen.steps[s.key] = t; });
      dirty = true;
      if (e.complete) celebrate({ icon: '🏆', eyebrow: 'Unit epic complete', title: e.name, sub: 'Every step done.', xp: fresh.reduce((a, s) => a + s.xp, 0) });
      else for (const s of fresh) celebrate({ icon: e.icon, eyebrow: e.name, title: s.label, xp: s.xp, quiet: true });
    }
    const r = C.today;
    for (const q of r.quests) if (q.met && !seen.q[t + ':' + q.id]) { seen.q[t + ':' + q.id] = 1; dirty = true; Canto.ui.toast(`${q.icon} Daily quest: ${q.label}  +${XP.daily} XP`, 2600); }
    if (r.perfect && !seen.days[t]) { seen.days[t] = 1; dirty = true; celebrate({ icon: '☀️', eyebrow: 'Today', title: 'Perfect day', sub: 'Every daily quest done.', xp: XP.perfectDay }); }
    const W = C.thisWeek;
    if (W) {
      for (const q of W.list) if (q.met && !seen.q[W.ws + ':w:' + q.id]) { seen.q[W.ws + ':w:' + q.id] = 1; dirty = true; Canto.ui.toast(`${q.icon} Weekly quest: ${q.label}  +${XP.weekly} XP`, 2800); }
      if (W.perfect && !seen.weeks[W.ws]) { seen.weeks[W.ws] = 1; dirty = true; celebrate({ icon: '🌟', eyebrow: 'This week', title: 'Perfect week', sub: 'Every weekly quest done.', xp: XP.perfectWeek }); }
    }
    for (const s of Object.values(C.stats)) if ((seen.stats[s.id] || 1) < s.level) { if (seen.stats[s.id]) Canto.ui.toast(`${s.icon} ${s.name} → level ${s.level}`, 2600); seen.stats[s.id] = s.level; dirty = true; }
    if (dirty) P().save();
    chrome(C);
  }

  // Level chip in the top bar.
  function chrome(C) {
    const el = document.getElementById('lvl-chip');
    if (!el) return;
    C = C || compute();
    el.hidden = false;
    el.textContent = `Lv ${C.level.level}` + (C.streak.current ? ` · 🔥${C.streak.current}` : '');
    el.title = `${C.level.title.en} · ${C.level.into.toLocaleString()} / ${C.level.need.toLocaleString()} XP to level ${C.level.level + 1}`;
  }

  // levels: {date: 0..4 | 'fr'}
  function heatmap(levels, weeks = 18) {
    const t = today(), start = addDays(weekStart(t), -7 * (weeks - 1));
    const g = h('div', { class: 'heat' });
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(start, i), lv = levels[d];
      g.append(h('i', { class: (lv === 'fr' ? 'fr' : lv ? 'l' + lv : '') + (d > t ? ' fut' : '') + (d === t ? ' today' : ''), title: d }));
    }
    return g;
  }

  return { XP, TITLES, compute, afterChange, chrome, celebrate, confetti, heatmap, levelInfo, titleFor, goals, weekStart, onGrade, onQuizAnswer, onQuizRun, onDialoguePractised, DEFAULT_GOALS };
})();
