/* Progress store (localStorage) + spaced-repetition scheduler (SM-2 variant). */
window.Canto = window.Canto || {};

Canto.srs = (() => {
  // grade: 0 again, 1 hard, 2 good, 3 easy
  function fresh() { return { ease: 2.5, interval: 0, due: '', reps: 0, lapses: 0, last: '', state: 'new' }; }

  function schedule(card, grade, today) {
    const c = Object.assign(fresh(), card || {});
    const wasNew = c.state === 'new' || c.reps === 0;
    c.reps += 1;
    c.last = today;
    if (grade === 0) {
      c.lapses += wasNew ? 0 : 1;
      c.ease = Math.max(1.3, c.ease - 0.2);
      c.interval = 0;
      c.state = 'learning';
      c.due = today;               // stays due today; the session re-queues it
      return c;
    }
    if (wasNew || c.interval === 0) {
      c.interval = grade === 1 ? 1 : grade === 2 ? 1 : 4;
      if (grade === 3) c.ease += 0.15;
    } else {
      if (grade === 1) { c.interval = Math.max(1, Math.round(c.interval * 1.2)); c.ease = Math.max(1.3, c.ease - 0.15); }
      else if (grade === 2) { c.interval = Math.max(1, Math.round(c.interval * c.ease)); }
      else { c.interval = Math.max(2, Math.round(c.interval * c.ease * 1.3)); c.ease += 0.15; }
    }
    c.interval = Math.min(c.interval, 365);
    c.state = c.interval >= 21 ? 'mature' : 'review';
    c.due = Canto.ui.addDays(today, c.interval);
    return c;
  }

  function isDue(card, today) { return !!card && card.reps > 0 && card.due && card.due <= today; }
  function isNew(card) { return !card || !card.reps; }
  function preview(card, today) {
    // human label for what each grade would do, e.g. "1d", "4d"
    return [0, 1, 2, 3].map((g) => {
      const c = schedule(card, g, today);
      if (g === 0) return 'again';
      return c.interval + 'd';
    });
  }
  return { fresh, schedule, isDue, isNew, preview };
})();

Canto.progress = (() => {
  const KEY = 'canto.progress.v1';
  const DEFAULTS = {
    version: 1,
    cards: {},        // cardKey -> srs card
    reviews: {},      // YYYY-MM-DD -> count of grades given
    exercises: {},    // itemId -> { answer, result, done, ts }
    notes: {},        // id -> text
    sessions: { current: 1, completed: {} },
    starred: {},      // vocabId -> true
    settings: {
      theme: 'auto',
      newPerDay: 15,
      showJpOnFront: true,
      cardKinds: { f: true, r: true, g: false, d: false },
      hideTones: false,
    },
    lastStudy: null,  // remembered flashcard setup
  };
  let data = null;

  function load() {
    if (data) return data;
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULTS));
    } catch (e) { data = JSON.parse(JSON.stringify(DEFAULTS)); }
    // fill in defaults for older saves
    for (const k of Object.keys(DEFAULTS)) if (data[k] === undefined) data[k] = JSON.parse(JSON.stringify(DEFAULTS[k]));
    for (const k of Object.keys(DEFAULTS.settings)) if (data.settings[k] === undefined) data.settings[k] = DEFAULTS.settings[k];
    return data;
  }
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.warn('save failed', e); } }, 60);
  }
  function saveNow() { clearTimeout(saveTimer); try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }

  function card(key) { return load().cards[key]; }
  function setCard(key, c) { load().cards[key] = c; save(); }
  function grade(key, g) {
    const today = Canto.ui.today();
    const c = Canto.srs.schedule(card(key), g, today);
    load().cards[key] = c;
    data.reviews[today] = (data.reviews[today] || 0) + 1;
    save();
    return c;
  }
  function resetCard(key) { delete load().cards[key]; save(); }

  function streak() {
    const d = load();
    let n = 0;
    let day = Canto.ui.today();
    // today counts if studied; otherwise start from yesterday
    if (!d.reviews[day]) day = Canto.ui.addDays(day, -1);
    while (d.reviews[day]) { n++; day = Canto.ui.addDays(day, -1); }
    return n;
  }
  function reviewedToday() { return load().reviews[Canto.ui.today()] || 0; }

  function exercise(itemId) { return load().exercises[itemId] || null; }
  function setExercise(itemId, patch) {
    const d = load();
    d.exercises[itemId] = Object.assign({ answer: '', result: null, done: false }, d.exercises[itemId] || {}, patch, { ts: Date.now() });
    save();
  }
  function note(id) { return load().notes[id] || ''; }
  function setNote(id, text) { load().notes[id] = text; save(); }
  function star(id) { return !!load().starred[id]; }
  function toggleStar(id) { const d = load(); if (d.starred[id]) delete d.starred[id]; else d.starred[id] = true; save(); return !!d.starred[id]; }

  function settings() { return load().settings; }
  function setSetting(k, v) { load().settings[k] = v; save(); }

  function exportJSON() { saveNow(); return JSON.stringify(load(), null, 2); }
  function importJSON(text, { merge = true } = {}) {
    const incoming = JSON.parse(text);
    if (!incoming || typeof incoming !== 'object' || !incoming.cards) throw new Error('Not a Canto progress file');
    if (!merge) { data = incoming; saveNow(); return; }
    const d = load();
    // merge: keep whichever card was reviewed most recently
    for (const [k, c] of Object.entries(incoming.cards || {})) {
      if (!d.cards[k] || (c.last || '') > (d.cards[k].last || '')) d.cards[k] = c;
    }
    for (const [day, n] of Object.entries(incoming.reviews || {})) d.reviews[day] = Math.max(d.reviews[day] || 0, n);
    for (const [k, x] of Object.entries(incoming.exercises || {})) if (!d.exercises[k] || (x.ts || 0) > (d.exercises[k].ts || 0)) d.exercises[k] = x;
    Object.assign(d.notes, incoming.notes || {});
    Object.assign(d.starred, incoming.starred || {});
    if (incoming.sessions) { d.sessions.current = Math.max(d.sessions.current, incoming.sessions.current || 1); Object.assign(d.sessions.completed, incoming.sessions.completed || {}); }
    saveNow();
  }
  function reset() { data = JSON.parse(JSON.stringify(DEFAULTS)); saveNow(); }

  // ---- Card catalogue: everything that can be a flashcard ----
  // kinds: f = zh/jp -> en, r = en -> zh/jp, g = grammar example en -> jp, d = dialogue line en -> jp
  function cardKey(id, kind) { return id + ':' + kind; }
  function buildCards({ unitIds, sections, kinds }) {
    const out = [];
    const D = Canto.data;
    for (const u of D.units()) {
      if (unitIds && unitIds.length && !unitIds.includes(u.id)) continue;
      if (kinds.f || kinds.r) {
        for (const v of u.vocab) {
          if (sections && sections.length && !sections.includes(v.section || 'Other')) continue;
          if (kinds.f) out.push({ key: cardKey(v.id, 'f'), kind: 'f', id: v.id, unitId: u.id, v });
          if (kinds.r) out.push({ key: cardKey(v.id, 'r'), kind: 'r', id: v.id, unitId: u.id, v });
        }
      }
      if (kinds.g) for (const g of u.grammar) for (const e of g.examples || []) if (e.jp && e.en) out.push({ key: cardKey(e.id, 'g'), kind: 'g', id: e.id, unitId: u.id, e, g });
      if (kinds.d) for (const d of u.dialogues) for (const l of d.lines || []) if (l.jp && l.en) out.push({ key: cardKey(l.id, 'd'), kind: 'd', id: l.id, unitId: u.id, l, d });
    }
    return out;
  }
  function dueCount(cards) {
    const today = Canto.ui.today();
    const d = load();
    let due = 0, fresh = 0, learned = 0;
    for (const c of cards) {
      const s = d.cards[c.key];
      if (Canto.srs.isNew(s)) fresh++;
      else { learned++; if (Canto.srs.isDue(s, today)) due++; }
    }
    return { due, fresh, learned, total: cards.length };
  }
  function unitStats(unitId) {
    const cards = buildCards({ unitIds: [unitId], kinds: { f: true, r: false } });
    const d = load();
    let seen = 0, mature = 0;
    for (const c of cards) { const s = d.cards[c.key]; if (s && s.reps) { seen++; if ((s.interval || 0) >= 21) mature++; } }
    return { total: cards.length, seen, mature };
  }

  return { load, save, saveNow, card, setCard, grade, resetCard, streak, reviewedToday, exercise, setExercise, note, setNote, star, toggleStar, settings, setSetting, exportJSON, importJSON, reset, cardKey, buildCards, dueCount, unitStats };
})();
