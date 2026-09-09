/* App shell: router, home, dictionary, sessions, settings, boot. */
(() => {
  const { h, jp, pill, toast } = Canto.ui;
  const D = Canto.data, P = Canto.progress, S = Canto.srs;
  const APP_VERSION = '0.1.0';

  // ---------- Router ----------
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const seg = path.split('/').filter(Boolean);
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    return { seg, query };
  }
  let currentView = null;
  function render() {
    const { seg, query } = parseHash();
    const view = document.getElementById('view');
    if (currentView && currentView._cleanup) currentView._cleanup();
    let el, nav = seg[0] || 'home';
    try {
      switch (seg[0]) {
        case undefined: case '': el = Canto.views.home(); nav = 'home'; break;
        case 'units': el = Canto.views.units(); break;
        case 'unit': el = Canto.views.unit(seg[1], seg[2]); nav = 'units'; break;
        case 'dialogue': el = Canto.views.dialogue(seg[1]); nav = 'units'; break;
        case 'grammar': el = Canto.views.grammar(seg[1]); nav = 'units'; break;
        case 'exercise': el = Canto.views.exercise(seg[1]); nav = 'units'; break;
        case 'study': el = seg[1] === 'session' ? Canto.views.session() : Canto.views.study(query); break;
        case 'review': el = Canto.views.review(); nav = 'study'; break;
        case 'dictionary': el = Canto.views.dictionary(query); break;
        case 'sessions': el = Canto.views.sessions(); break;
        case 'settings': el = Canto.views.settings(); break;
        default: el = h('div', { class: 'empty', text: 'Page not found.' });
      }
    } catch (e) {
      console.error(e);
      el = h('div', { class: 'empty' }, 'Something went wrong rendering this page. ', h('code', { text: e.message }));
    }
    view.innerHTML = '';
    view.append(el);
    currentView = el;
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
    window.scrollTo(0, 0);
    Canto.updateDuePill();
  }

  Canto.updateDuePill = () => {
    const pillEl = document.getElementById('due-pill');
    const cards = P.buildCards({ unitIds: null, kinds: P.settings().cardKinds });
    const { due } = P.dueCount(cards);
    pillEl.hidden = !due;
    pillEl.textContent = due + ' due';
    pillEl.onclick = () => (location.hash = '#/review');
    pillEl.style.cursor = 'pointer';
  };

  // ---------- Home ----------
  Canto.views.home = () => {
    const cards = P.buildCards({ unitIds: null, kinds: P.settings().cardKinds });
    const c = P.dueCount(cards);
    const streak = P.streak();
    const todayN = P.reviewedToday();
    const wrap = h('div');
    const hour = new Date().getHours();
    const greet = hour < 12 ? '早晨' : hour < 18 ? '午安' : '晚上好';
    const hero = h('div', { class: 'hero' },
      h('div', { class: 'eyebrow', text: greet + ' · ' + new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) }),
      h('h1', { text: c.due ? `${c.due} cards due` : todayN ? 'All caught up' : 'Nothing due yet' }),
      h('div', { class: 'muted', text: c.due ? 'Daily review keeps the schedule honest.' : c.fresh ? `${c.fresh} new cards waiting whenever you want them.` : 'Add card types in Settings to study more.' }),
      h('div', { class: 'btngroup mt' },
        c.due ? h('a', { class: 'btn primary', href: '#/review', text: `Review ${c.due} due` }) : c.fresh ? h('a', { class: 'btn primary', href: '#/review', text: `Learn ${Math.min(c.fresh, P.settings().newPerDay)} new` }) : null,
        h('a', { class: 'btn', href: '#/study', text: 'Custom session' })),
      h('div', { class: 'grid mt', style: { gridTemplateColumns: 'repeat(4, 1fr)' } },
        h('div', { class: 'stat' }, h('b', { text: String(streak) }), h('span', { text: streak === 1 ? 'day streak' : 'day streak' })),
        h('div', { class: 'stat' }, h('b', { text: String(todayN) }), h('span', { text: 'reviews today' })),
        h('div', { class: 'stat' }, h('b', { text: String(c.learned) }), h('span', { text: 'cards learned' })),
        h('div', { class: 'stat' }, h('b', { text: String(c.fresh) }), h('span', { text: 'unseen' }))));
    wrap.append(hero);

    // Next session
    const syl = D.state.syllabus;
    if (syl) {
      const cur = P.load().sessions.current || 1;
      const s = syl.sessions.find((x) => x.n === cur) || syl.sessions[0];
      const u = s.unit ? D.unit(s.unit) : null;
      const when = nextSessionDate(syl);
      wrap.append(h('div', { class: 'card mt' },
        h('div', { class: 'row between' }, h('div', null, h('div', { class: 'eyebrow', text: `Next session · #${s.n} · ${when.label}` }), h('h2', { text: s.title })), h('a', { class: 'btn sm', href: '#/sessions', text: 'All sessions' })),
        h('div', { class: 'muted small', text: (s.topics || []).join(' · ') + (s.episode ? ` · watch episode ${s.episode}` : '') }),
        when.overdue ? h('div', { class: 'small', style: { color: 'var(--amber)', marginTop: '4px' } }, 'That date has passed — mark it done in ', h('a', { href: '#/sessions', text: 'Sessions' }), ' to move on.') : null,
        h('div', { class: 'btngroup mt' },
          u ? h('a', { class: 'btn', href: '#/unit/' + u.id, text: `Open Unit ${u.number}` }) : null,
          u ? h('a', { class: 'btn', href: `#/study?unit=${u.id}&mode=mixed&go=1`, text: 'Prep flashcards' }) : null,
          s.questions && s.questions.length ? h('a', { class: 'btn ghost', href: '#/sessions', text: `Episode ${s.episode} questions` }) : null)));
    }

    // Quick links
    wrap.append(h('div', { class: 'quick' },
      h('a', { href: '#/units' }, h('b', { text: 'Units' }), h('small', { text: `${D.units().length} units` })),
      h('a', { href: '#/dictionary' }, h('b', { text: 'Dictionary' }), h('small', { text: `${D.allVocab().length} words` })),
      h('a', { href: '#/dictionary?starred=1' }, h('b', { text: 'Starred words' }), h('small', { text: `${Object.keys(P.load().starred).length} starred` })),
      h('a', { href: '#/study?kinds=g&mode=mixed' }, h('b', { text: 'Grammar drill' }), h('small', { text: 'example sentences' }))));

    // Unit progress
    const prog = h('div', { class: 'card mt' }, h('h2', { text: 'Progress by unit' }));
    for (const u of D.units()) {
      const st = P.unitStats(u.id);
      const uc = P.dueCount(P.buildCards({ unitIds: [u.id], kinds: P.settings().cardKinds }));
      prog.append(h('a', { class: 'unitrow', href: '#/unit/' + u.id, style: { color: 'inherit' } },
        h('div', { class: 'n', text: String(u.number) }),
        h('div', { class: 't' }, h('div', { text: u.title }), h('div', { class: 'small muted', text: `${st.seen}/${st.total} words seen · ${st.mature} mature` + (uc.due ? ` · ${uc.due} due` : '') })),
        h('div', { class: 'progress' }, h('i', { class: st.total && st.mature === st.total ? 'green' : '', style: { width: (st.total ? (st.seen / st.total) * 100 : 0) + '%' } }))));
    }
    wrap.append(prog);
    return wrap;
  };

  // Next session date: the date set in Sessions if any, otherwise the next occurrence of the syllabus weekday.
  function nextSessionDate(syl) {
    const today = Canto.ui.today();
    let date = P.load().sessions.nextDate || '';
    if (!date) {
      const d = new Date(today + 'T00:00:00');
      const wd = syl.weekday ?? 1;
      let add = (wd - d.getDay() + 7) % 7;
      if (add === 0 && new Date().getHours() >= 20) add = 7;
      date = Canto.ui.addDays(today, add);
    }
    const days = Math.round((new Date(date + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
    const pretty = new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const rel = days < 0 ? `${-days} day${days === -1 ? '' : 's'} ago` : days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
    return { date, days, overdue: days < 0, label: `${pretty} · ${rel}` + (syl.time_local ? ` · ${syl.time_local.replace(/^(\d\d):(\d\d)$/, (m, hh, mm) => ((+hh % 12) || 12) + (mm !== '00' ? ':' + mm : '') + (+hh >= 12 ? 'pm' : 'am'))}` : '') };
  }
  Canto.nextSessionDate = nextSessionDate;

  // ---------- Dictionary ----------
  Canto.views.dictionary = (query = {}) => {
    const wrap = h('div');
    wrap.append(h('div', { class: 'pagehead' }, h('h1', { text: 'Dictionary' }), h('div', { class: 'sub', text: 'Every word from the course. Search characters, Jyutping (tones optional) or English.' })));
    const input = h('input', { type: 'search', placeholder: 'e.g. 早晨, zou2 san4, zousan, morning', autocomplete: 'off' });
    let starredOnly = query.starred === '1';
    const starChip = Canto.ui.chip('★ Starred only', starredOnly, (on) => { starredOnly = on; run(); }, 'small');
    const unitSel = h('select', { style: { width: 'auto' } }, h('option', { value: '', text: 'All units' }), ...D.units().map((u) => h('option', { value: u.id, text: `Unit ${u.number} · ${u.title}` })));
    unitSel.addEventListener('change', run);
    wrap.append(h('div', { class: 'stack mb' }, input, h('div', { class: 'row' }, starChip, unitSel)));
    const results = h('div');
    const count = h('div', { class: 'small muted mb' });
    wrap.append(count, results);
    function run() {
      const q = input.value.trim();
      const unitIds = unitSel.value ? [unitSel.value] : null;
      let list = q ? D.search(q, { unitIds }) : D.allVocab().filter((v) => !unitIds || unitIds.includes(v.unitId));
      if (starredOnly) list = list.filter((v) => P.star(v.id));
      const shown = list.slice(0, 200);
      count.textContent = list.length ? `${list.length} result${list.length === 1 ? '' : 's'}` + (list.length > 200 ? ' (showing 200)' : '') : (q ? 'No matches' : '');
      results.innerHTML = '';
      const table = h('table', { class: 'table' });
      const tb = h('tbody');
      for (const v of shown) {
        const u = D.unit(v.unitId);
        tb.append(h('tr', { class: 'clickable', onClick: () => Canto.views.wordSheet([v]) },
          h('td', { class: 'zh', text: v.zh }), h('td', null, jp(v.jp)), h('td', null, v.en, v.notes ? h('div', { class: 'small muted', text: v.notes }) : null),
          h('td', { class: 'right small muted', text: u ? 'U' + u.number : '' })));
      }
      table.append(tb);
      results.append(h('div', { style: { overflowX: 'auto' } }, table));
      if (list.length) results.append(h('div', { class: 'btngroup mt' }, h('button', { class: 'btn sm', text: `Flashcards for these ${Math.min(list.length, 200)}`, onClick: () => Canto.startSession(Canto.ui.shuffle(shown.map((v) => ({ key: P.cardKey(v.id, 'f'), kind: 'f', id: v.id, unitId: v.unitId, v }))), { title: q ? `Search: ${q}` : 'Dictionary' }) })));
    }
    let t; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 120); });
    run();
    setTimeout(() => { if (window.innerWidth > 760) input.focus(); }, 0);
    return wrap;
  };

  // ---------- Sessions (syllabus) ----------
  Canto.views.sessions = () => {
    const syl = D.state.syllabus;
    const wrap = h('div');
    if (!syl) return h('div', { class: 'empty', text: 'No syllabus loaded.' });
    const cur = () => P.load().sessions.current || 1;
    wrap.append(h('div', { class: 'pagehead' }, h('h1', { text: 'Sessions' }),
      h('div', { class: 'sub' }, `${syl.tutor} · usually ${syl.schedule} · `, h('a', { href: syl.meeting_link, target: '_blank', rel: 'noopener', text: 'Meeting link' })),
      h('div', { class: 'small muted mt', text: `Homework series: ${syl.series.title} (${syl.series.year}, ${syl.series.episodes} episodes) — ${syl.series.where}. ${syl.series.notes}` })));
    // Next-session picker: which session, and on what date (the syllabus weekday is only a default).
    const nextBox = h('div', { class: 'card mb' });
    function renderNext() {
      nextBox.innerHTML = '';
      const s = syl.sessions.find((x) => x.n === cur()) || syl.sessions[0];
      const when = nextSessionDate(syl);
      const dateIn = h('input', { type: 'date', value: when.date, style: { width: 'auto' } });
      dateIn.addEventListener('change', () => { P.load().sessions.nextDate = dateIn.value; P.save(); renderNext(); });
      nextBox.append(
        h('div', { class: 'eyebrow', text: 'Next session' }),
        h('div', { class: 'row between' },
          h('div', null, h('h2', { text: `#${s.n} · ${s.title}` }), h('div', { class: 'small muted', text: when.label })),
          h('div', { class: 'row' }, h('span', { class: 'small muted', text: 'Date' }), dateIn)),
        h('div', { class: 'small muted mt', text: 'Use "Set as next" on any session below to change which one is coming up; "Mark done" on the next session advances to the following one a week later.' }));
    }
    function setNext(n, dateStr) {
      const p = P.load();
      p.sessions.current = n;
      for (const s of syl.sessions) if (s.n < n) p.sessions.completed[s.n] = true;
      if (dateStr !== undefined) p.sessions.nextDate = dateStr;
      P.save();
    }
    wrap.append(nextBox);
    const list = h('div', { class: 'stack' });
    function render() {
      renderNext();
      list.innerHTML = '';
      for (const s of syl.sessions) {
        const done = !!P.load().sessions.completed[s.n];
        const isCur = s.n === cur();
        const u = s.unit ? D.unit(s.unit) : null;
        const card = h('div', { class: 'card', style: isCur ? { borderColor: 'var(--accent)' } : done ? { opacity: 0.7 } : null });
        card.append(h('div', { class: 'row between' },
          h('div', null, h('div', { class: 'eyebrow', text: `Session ${s.n}` + (isCur ? ' · next' : done ? ' · done' : '') }), h('h2', { text: s.title })),
          h('div', { class: 'btngroup' },
            u ? h('a', { class: 'btn sm', href: '#/unit/' + u.id, text: `Unit ${u.number}` }) : null,
            h('button', { class: 'btn sm ' + (done ? '' : 'ghost'), text: done ? 'Undo done' : 'Mark done', onClick: () => {
              const p = P.load();
              if (done) { delete p.sessions.completed[s.n]; P.save(); render(); return; }
              p.sessions.completed[s.n] = true;
              if (isCur) { const when = nextSessionDate(syl); setNext(s.n + 1, Canto.ui.addDays(when.date, 7)); }
              else if (s.n >= p.sessions.current) setNext(s.n + 1, undefined);
              P.save(); render();
            } }),
            !isCur ? h('button', { class: 'btn sm ghost', text: 'Set as next', onClick: () => { setNext(s.n, ''); render(); } }) : null)));
        card.append(h('div', { class: 'muted small', text: (s.topics || []).join(' · ') }));
        if (s.questions && s.questions.length) {
          const qs = h('div', { class: 'mt' }, h('div', { class: 'eyebrow', text: `Episode ${s.episode} questions` }));
          s.questions.forEach((q, i) => {
            const key = `session-${s.n}-q${i + 1}`;
            const ta = h('textarea', { placeholder: 'Your answer', style: { minHeight: '40px' } });
            ta.value = P.note(key);
            ta.addEventListener('input', () => P.setNote(key, ta.value));
            qs.append(h('div', { class: 'mt' }, h('div', { class: 'small', text: `${i + 1}. ${q}` }), ta));
          });
          card.append(qs);
        }
        list.append(card);
      }
    }
    render();
    wrap.append(list);
    return wrap;
  };

  // ---------- Settings ----------
  Canto.views.settings = () => {
    const st = P.settings();
    const wrap = h('div');
    wrap.append(h('div', { class: 'pagehead' }, h('h1', { text: 'Settings' })));

    const themeSel = h('select', null, ...[['auto', 'Match system'], ['dark', 'Dark'], ['light', 'Light']].map(([v, t]) => h('option', { value: v, text: t, selected: st.theme === v })));
    themeSel.addEventListener('change', () => { P.setSetting('theme', themeSel.value); applyTheme(); });
    const newPerDay = h('input', { type: 'number', min: 1, max: 200, value: st.newPerDay });
    newPerDay.addEventListener('change', () => P.setSetting('newPerDay', Math.max(1, +newPerDay.value || 1)));
    const jpFront = h('input', { type: 'checkbox', checked: st.showJpOnFront });
    jpFront.addEventListener('change', () => P.setSetting('showJpOnFront', jpFront.checked));
    const kinds = h('div', { class: 'chips' });
    for (const [k, label] of [['f', 'Word → meaning'], ['r', 'Meaning → word'], ['g', 'Grammar examples'], ['d', 'Dialogue lines']]) {
      kinds.append(Canto.ui.chip(label, !!st.cardKinds[k], (on) => { st.cardKinds[k] = on; P.setSetting('cardKinds', st.cardKinds); Canto.updateDuePill(); }));
    }
    wrap.append(h('div', { class: 'card' }, h('h2', { text: 'Study' }),
      h('label', { class: 'field' }, h('span', { text: 'Theme' }), themeSel),
      h('label', { class: 'field' }, h('span', { text: 'New cards per day (daily review)' }), newPerDay),
      h('label', { class: 'toggle mb' }, jpFront, ' Show Jyutping on the front of character cards'),
      h('div', { class: 'field' }, h('span', { class: 'small muted', text: 'Card types counted in daily review and the due badge' }), kinds)));

    // Data
    const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files[0]; if (!f) return;
      try { P.importJSON(await f.text(), { merge: true }); toast('Progress merged'); render(); } catch (e) { toast('Import failed: ' + e.message, 3000); }
    });
    const cardsN = Object.keys(P.load().cards).length;
    wrap.append(h('div', { class: 'card mt' }, h('h2', { text: 'Your progress' }),
      h('p', { class: 'small muted', text: `Stored only in this browser (${cardsN} cards scheduled, ${Object.keys(P.load().exercises).length} exercise answers, ${Object.keys(P.load().notes).length} notes). Export to move it to another device or keep a backup; importing merges by most-recent.` }),
      h('div', { class: 'btngroup mt' },
        h('button', { class: 'btn', text: 'Export progress', onClick: () => downloadText('canto-progress-' + Canto.ui.today() + '.json', P.exportJSON()) }),
        h('button', { class: 'btn', text: 'Import (merge)', onClick: () => fileIn.click() }),
        h('button', { class: 'btn danger', text: 'Reset everything', onClick: async () => { if (await Canto.ui.confirmDlg('Delete all progress, answers and notes on this device?', { ok: 'Delete', danger: true })) { P.reset(); toast('Progress cleared'); render(); } } }),
        fileIn)));

    // Content / app
    const idx = D.state.index || {};
    wrap.append(h('div', { class: 'card mt' }, h('h2', { text: 'Content & app' }),
      h('p', { class: 'small muted', text: `Canto ${APP_VERSION} · content v${idx.version || '?'} · ${D.units().length} units, ${D.allVocab().length} words. New units appear after the course PDFs are transcribed and pushed (see docs/INGEST.md in the repo).` }),
      h('div', { class: 'btngroup mt' },
        h('button', { class: 'btn', text: 'Refresh content', onClick: async () => { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage('clear-cache'); const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); location.reload(); } }),
        Canto.installPrompt ? h('button', { class: 'btn primary', text: 'Install app', onClick: async () => { Canto.installPrompt.prompt(); } }) : null),
      h('div', { class: 'divider' }),
      h('h3', { text: 'Coming later' }),
      h('ul', { class: 'gbody small muted' },
        h('li', { text: 'Phone notifications for daily reviews and session prep.' }),
        h('li', { text: 'AI: fresh example sentences for any grammar point, explanations for any word in context, and automatic PDF ingestion.' }),
        h('li', { text: 'Cross-device sync without manual export.' }))));
    return wrap;
  };

  function downloadText(name, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
  }

  // ---------- Theme ----------
  function applyTheme() {
    const t = P.settings().theme;
    const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = dark ? '#0f1318' : '#f6f4ef';
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  // ---------- Boot ----------
  async function boot() {
    P.load();
    applyTheme();
    try {
      await D.load();
    } catch (e) {
      document.getElementById('view').innerHTML = '';
      document.getElementById('view').append(h('div', { class: 'empty' }, 'Could not load course data. ', h('code', { text: e.message })));
      return;
    }
    window.addEventListener('hashchange', render);
    render();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('./sw.js').then((reg) => reg.update().catch(() => {})).catch((e) => console.warn('sw', e));
      // When a new worker takes over, reload once so the page runs the new code immediately
      // (unless a flashcard session is in progress; then apply it on the next launch).
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded || !hadController) return;
        reloaded = true;
        if (Canto.session) { toast('Update ready — it applies next time you open the app', 3500); return; }
        location.reload();
      });
    }
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); Canto.installPrompt = e; });
  }
  boot();
})();
