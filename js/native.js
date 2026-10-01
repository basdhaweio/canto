/* The Android app (android/): Canto running in the app's WebView, where window.CantoAndroid exists. Here the page
   hands the home-screen widget a deck (due cards first, then new ones) and a summary after every change, takes the
   grades made on the widget and schedules them, saves exports through the app (a WebView can't download a file) and
   tells the app its theme. In a browser none of this does anything. */
window.Canto = window.Canto || {};

Canto.native = (() => {
  const bridge = () => window.CantoAndroid || null;
  const on = () => !!bridge();
  const D = () => Canto.data, P = () => Canto.progress;

  // A shuffle that stays the same for the whole day, so the deck (and the widget's place in it) doesn't jump around
  // every time the page re-renders.
  function hash(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
  const daySort = (list, day) => list.map((c) => [hash(c.key + day), c]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

  function text(c) {
    const v = c.v;
    if (c.kind === 'n') return { f1: v.en, f2: 'say it in Cantonese', b1: v.zh || '', b2: v.jp };
    if (c.kind === 'r') return { f1: v.en, f2: '', b1: (v.zh ? v.zh + '  ' : '') + v.jp, b2: v.notes || '' };
    if (c.kind === 'g') return { f1: c.e.en, f2: c.g.title, b1: c.e.jp, b2: c.e.zh || '' };
    if (c.kind === 'd') return { f1: c.l.en, f2: c.d.title, b1: c.l.jp, b2: c.l.zh || '' };
    return { f1: v.zh || v.jp, f2: v.zh ? v.jp : '', b1: v.en, b2: v.notes || '' };   // word → meaning, particles
  }
  const KIND = { f: '', r: 'say it', p: 'particle', n: 'number', g: 'grammar', d: 'dialogue' };

  // What the widget draws (CantoWidget.kt).
  function deck() {
    const today = Canto.ui.today(), p = P().load();
    const cards = P().buildCards({ unitIds: null, kinds: P().settings().cardKinds });
    const due = [], fresh = [];
    for (const c of cards) { const s = p.cards[c.key]; if (Canto.srs.isNew(s)) fresh.push(c); else if (Canto.srs.isDue(s, today)) due.push(c); }
    const learnedToday = ((p.activity || {})[today] || {}).learned || 0;
    const newLeft = Math.max(0, P().settings().newPerDay - learnedToday);
    // New cards: word → meaning before meaning → word, so a reverse card never gives its own answer away.
    const rank = { f: 0, p: 1, n: 1, r: 2, g: 3, d: 4 };
    const news = daySort(fresh, today).sort((a, b) => rank[a.kind] - rank[b.kind]).slice(0, newLeft);
    const list = [...daySort(due, today).slice(0, 60), ...news];
    const C = Canto.game.compute();
    return {
      v: 1, date: today, at: Date.now(),
      streak: C.streak.current, freezes: C.streak.freezes,
      level: C.level.level, title: C.level.title.en, pct: Math.round(C.level.pct * 1000) / 1000,
      due: due.length,
      cards: list.map((c) => {
        const u = D().unit(c.unitId);
        const set = c.v && /^Set /.test(c.v.section || '') ? ' · ' + c.v.section : '';
        return Object.assign({ k: c.key, tag: (u ? 'Unit ' + u.number : '') + set + (KIND[c.kind] ? ' · ' + KIND[c.kind] : '') }, text(c));
      }),
    };
  }

  // Sent a moment after things settle, and only when something on the widget would change.
  let timer = null, lastSig = '';
  function push(now) {
    if (!on() || !D().state.loaded) return;
    clearTimeout(timer);
    const send = () => {
      try {
        const s = deck(), sig = JSON.stringify(Object.assign({}, s, { at: 0 }));
        if (sig === lastSig) return;
        lastSig = sig;
        bridge().widget(JSON.stringify(s));
      } catch (e) { console.warn('widget', e); }
    };
    if (now) send(); else timer = setTimeout(send, 800);
  }

  // Grades made on the widget, each scheduled on the day it was made.
  function pull() {
    if (!on() || !D().state.loaded) return 0;
    let list = [];
    try { list = JSON.parse(bridge().takePending() || '[]'); } catch (e) { list = []; }
    let n = 0;
    for (const x of list) {
      if (!x || !x.k || x.g === undefined) continue;
      const id = String(x.k).split(':')[0];
      if (!D().byId.vocab[id] && !D().byId.example[id] && !D().byId.line[id]) continue;
      P().gradeAt(x.k, Math.max(0, Math.min(3, +x.g)), x.d || Canto.ui.today());
      n++;
    }
    if (n) {
      P().saveNow();
      Canto.ui.toast(`Saved ${n} grade${n === 1 ? '' : 's'} from the widget`, 2600);
      if (!Canto.session && !Canto.quiz) window.dispatchEvent(new HashChangeEvent('hashchange'));   // redraw counts
    }
    push(true);
    return n;
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) push(true); else pull(); });

  function saveFile(name, text) {
    if (!on()) return false;
    try { bridge().saveFile(name, text); return true; } catch (e) { return false; }
  }
  function theme(dark) { if (on()) try { bridge().theme(!!dark); } catch (e) {} }

  return { on, deck, push, pull, saveFile, theme };
})();
