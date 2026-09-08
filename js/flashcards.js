/* Flashcards: setup, session (SRS), quick quiz + word sheet used by dialogues/grammar/dictionary. */
(() => {
  const { h, jp, pill, toast, sheet, shuffle, today } = Canto.ui;
  const D = Canto.data, P = Canto.progress, S = Canto.srs;

  const KIND_LABEL = { f: 'Word → meaning', r: 'Meaning → word', g: 'Grammar examples', d: 'Dialogue lines' };
  const MODES = [['mixed', 'Due + new', 'Cards due today first, then new cards up to your daily limit'], ['due', 'Due only', 'Just what the schedule says'], ['new', 'New only', 'Cards you have never seen'], ['cram', 'Cram', 'Everything in scope, shuffled']];

  // ---------- Setup ----------
  Canto.views.study = (query = {}) => {
    const saved = P.load().lastStudy || {};
    const unitIds = query.unit ? [query.unit] : (saved.unitIds || D.units().map((u) => u.id));
    const kinds = query.kinds ? Object.fromEntries(['f', 'r', 'g', 'd'].map((k) => [k, query.kinds.split(',').includes(k)])) : (saved.kinds || P.settings().cardKinds);
    let mode = query.mode || saved.mode || 'mixed';
    let sections = saved.sections || [];
    let limit = saved.limit || P.settings().newPerDay;
    const state = { unitIds: [...unitIds], kinds: { ...kinds }, sections: [...sections], mode, limit };
    if (query.unit) state.sections = [];

    const wrap = h('div', { class: 'fc-wrap' });
    wrap.append(h('div', { class: 'pagehead' }, h('h1', { text: 'Flashcards' }), h('div', { class: 'sub', text: 'Pick a scope. Grades feed the schedule, so daily review stays honest.' })));

    // Units
    const unitChips = h('div', { class: 'chips' });
    const unitSec = h('div', { class: 'setup-section' }, h('div', { class: 'row between' }, h('h3', { text: 'Units' }), h('div', { class: 'btngroup' }, h('button', { class: 'btn sm ghost', text: 'All', onClick: () => setUnits(D.units().map((u) => u.id)) }), h('button', { class: 'btn sm ghost', text: 'None', onClick: () => setUnits([]) }))), unitChips);
    function setUnits(ids) { state.unitIds = ids; renderUnits(); renderSections(); update(); }
    function renderUnits() {
      unitChips.innerHTML = '';
      for (const u of D.units()) unitChips.append(Canto.ui.chip(`${u.number} · ${u.title}`, state.unitIds.includes(u.id), (on) => { state.unitIds = on ? [...state.unitIds, u.id] : state.unitIds.filter((x) => x !== u.id); renderSections(); update(); }));
    }
    // Sections
    const secChips = h('div', { class: 'chips' });
    const secSec = h('div', { class: 'setup-section' }, h('h3', { text: 'Sections' }), h('div', { class: 'small muted mb', text: 'Leave all off to include every section.' }), secChips);
    function renderSections() {
      secChips.innerHTML = '';
      const secs = D.sections(state.unitIds);
      state.sections = state.sections.filter((s) => secs.includes(s));
      for (const s of secs) secChips.append(Canto.ui.chip(s, state.sections.includes(s), (on) => { state.sections = on ? [...state.sections, s] : state.sections.filter((x) => x !== s); update(); }, 'small'));
    }
    // Kinds
    const kindChips = h('div', { class: 'chips' });
    for (const k of ['f', 'r', 'g', 'd']) kindChips.append(Canto.ui.chip(KIND_LABEL[k], state.kinds[k], (on) => { state.kinds[k] = on; update(); }));
    const kindSec = h('div', { class: 'setup-section' }, h('h3', { text: 'Card types' }), kindChips);
    // Mode
    const modeChips = h('div', { class: 'chips' });
    const modeDesc = h('div', { class: 'small muted', style: { marginTop: '6px' } });
    for (const [m, label] of MODES) modeChips.append(Canto.ui.chip(label, state.mode === m, () => { state.mode = m; [...modeChips.children].forEach((c) => c.classList.toggle('on', c.textContent === label)); update(); }));
    const limitInput = h('input', { type: 'number', min: 1, max: 500, value: state.limit, style: { width: '90px' }, onInput: (e) => { state.limit = Math.max(1, +e.target.value || 1); update(); } });
    const modeSec = h('div', { class: 'setup-section' }, h('h3', { text: 'Mode' }), modeChips, modeDesc, h('div', { class: 'row mt' }, h('span', { class: 'small muted', text: 'New cards limit' }), limitInput));

    const summary = h('div', { class: 'card' });
    const startBtn = h('button', { class: 'btn primary block', text: 'Start' });
    function update() {
      const cards = P.buildCards({ unitIds: state.unitIds, sections: state.sections, kinds: state.kinds });
      const c = P.dueCount(cards);
      modeDesc.textContent = MODES.find((m) => m[0] === state.mode)[2];
      const n = plannedCount(cards, state);
      summary.innerHTML = '';
      summary.append(h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(4, 1fr)' } },
        h('div', { class: 'stat' }, h('b', { text: String(c.total) }), h('span', { text: 'in scope' })),
        h('div', { class: 'stat' }, h('b', { text: String(c.due) }), h('span', { text: 'due' })),
        h('div', { class: 'stat' }, h('b', { text: String(c.fresh) }), h('span', { text: 'new' })),
        h('div', { class: 'stat' }, h('b', { text: String(n) }), h('span', { text: 'this session' }))));
      startBtn.disabled = n === 0;
      startBtn.textContent = n ? `Start · ${n} cards` : 'Nothing to study with this scope';
    }
    startBtn.addEventListener('click', () => {
      P.load().lastStudy = { unitIds: state.unitIds, kinds: state.kinds, sections: state.sections, mode: state.mode, limit: state.limit }; P.save();
      const cards = P.buildCards({ unitIds: state.unitIds, sections: state.sections, kinds: state.kinds });
      Canto.startSession(buildQueue(cards, state), { title: sessionTitle(state) });
    });
    renderUnits(); renderSections(); update();
    wrap.append(unitSec, secSec, kindSec, modeSec, summary, h('div', { class: 'mt' }, startBtn));
    if (query.go === '1') setTimeout(() => startBtn.disabled || startBtn.click(), 0);
    return wrap;
  };

  function sessionTitle(state) {
    const us = state.unitIds.length === D.units().length ? 'All units' : state.unitIds.map((id) => 'U' + (D.unit(id) || {}).number).join(' ');
    return `${MODES.find((m) => m[0] === state.mode)[1]} · ${us}`;
  }

  function split(cards) {
    const t = today(); const p = P.load();
    const due = [], fresh = [];
    for (const c of cards) { const s = p.cards[c.key]; if (S.isNew(s)) fresh.push(c); else if (S.isDue(s, t)) due.push(c); }
    due.sort((a, b) => ((p.cards[a.key] || {}).due || '').localeCompare((p.cards[b.key] || {}).due || ''));
    return { due, fresh };
  }
  function plannedCount(cards, state) {
    const { due, fresh } = split(cards);
    if (state.mode === 'cram') return cards.length;
    if (state.mode === 'due') return due.length;
    if (state.mode === 'new') return Math.min(fresh.length, state.limit);
    return due.length + Math.min(fresh.length, state.limit);
  }
  function buildQueue(cards, state) {
    const { due, fresh } = split(cards);
    if (state.mode === 'cram') return shuffle([...cards]);
    if (state.mode === 'due') return due;
    // keep vocab order for new cards (slides order = pedagogical order) but interleave a little
    const news = fresh.slice(0, state.limit);
    if (state.mode === 'new') return news;
    return [...due, ...news];
  }

  Canto.views.review = () => {
    const kinds = P.settings().cardKinds;
    const cards = P.buildCards({ unitIds: null, kinds });
    const { due, fresh } = split(cards);
    if (!due.length && !fresh.length) return h('div', { class: 'empty' }, 'Nothing due right now. ', h('a', { href: '#/study', text: 'Start a custom session' }), '.');
    const queue = [...due, ...(due.length ? [] : fresh.slice(0, P.settings().newPerDay))];
    setTimeout(() => Canto.startSession(queue, { title: due.length ? 'Daily review' : 'New cards' }), 0);
    return h('div', { class: 'loading', text: 'Starting…' });
  };

  // ---------- Card faces ----------
  function faces(card, { showJpOnFront = P.settings().showJpOnFront } = {}) {
    const front = h('div'), back = h('div', { class: 'back' });
    // Canto.ui.append skips null/false children; native append would print "null".
    front.append = (...c) => Canto.ui.append(front, c);
    back.append = (...c) => Canto.ui.append(back, c);
    const long = (s) => (s || '').length > 10;
    if (card.kind === 'f') {
      front.append(h('div', { class: 'zh' + (long(card.v.zh) ? ' long' : ''), text: card.v.zh || '' }));
      if (!card.v.zh || showJpOnFront) front.append(h('div', { class: 'jp' }, jp(card.v.jp)));
      back.append(!showJpOnFront && card.v.zh ? h('div', { class: 'jp' }, jp(card.v.jp)) : null, h('div', { class: 'en' + (long(card.v.en) ? ' long' : ''), text: card.v.en }), card.v.notes ? h('div', { class: 'notes', text: card.v.notes }) : null);
    } else if (card.kind === 'r') {
      front.append(h('div', { class: 'en' + (long(card.v.en) ? ' long' : ''), text: card.v.en }), card.v.pos ? h('div', { class: 'small muted', text: card.v.pos }) : null);
      back.append(h('div', { class: 'zh' + (long(card.v.zh) ? ' long' : ''), text: card.v.zh || '' }), h('div', { class: 'jp' }, jp(card.v.jp)), card.v.notes ? h('div', { class: 'notes', text: card.v.notes }) : null);
    } else if (card.kind === 'g') {
      front.append(h('div', { class: 'small muted mb', text: card.g.title }), h('div', { class: 'en long', text: card.e.en }));
      back.append(h('div', { class: 'jp' }, jp(card.e.jp)), card.e.zh ? h('div', { class: 'zh long', text: card.e.zh }) : null, card.e.lit ? h('div', { class: 'lit', text: 'lit. ' + card.e.lit }) : null);
    } else if (card.kind === 'd') {
      front.append(h('div', { class: 'small muted mb', text: `${card.d.title} · ${card.l.speaker || ''}` }), h('div', { class: 'en long', text: card.l.en }));
      back.append(h('div', { class: 'jp' }, jp(card.l.jp)), card.l.zh ? h('div', { class: 'zh long', text: card.l.zh }) : null);
    }
    return { front, back };
  }
  Canto.cardFaces = faces;

  // ---------- Session ----------
  Canto.session = null;
  Canto.startSession = (queue, { title = 'Study', affectSchedule = true } = {}) => {
    Canto.session = { queue: [...queue], i: 0, done: 0, title, affectSchedule, grades: [0, 0, 0, 0], total: queue.length, again: 0 };
    location.hash = '#/study/session';
  };

  Canto.views.session = () => {
    const s = Canto.session;
    if (!s || !s.queue.length) { setTimeout(() => (location.hash = '#/study'), 0); return h('div', { class: 'loading', text: '…' }); }
    const wrap = h('div', { class: 'fc-wrap' });
    const bar = h('div', { class: 'progress' }, h('i'));
    const counter = h('span');
    wrap.append(h('div', { class: 'fc-top' }, h('a', { href: '#/study', class: 'btn sm ghost', text: '✕' }), h('span', { text: s.title }), bar, counter));
    const cardHost = h('div');
    wrap.append(cardHost);
    let flipped = false;

    function renderCard() {
      cardHost.innerHTML = '';
      if (s.i >= s.queue.length) return renderSummary();
      const card = s.queue[s.i];
      const { front, back } = faces(card);
      const u = D.unit(card.unitId);
      const starOn = card.v ? P.star(card.v.id) : false;
      const star = card.v ? h('span', { class: 'star ' + (starOn ? 'on' : ''), text: '★', onClick: (e) => { e.stopPropagation(); star.classList.toggle('on', P.toggleStar(card.v.id)); } }) : null;
      const fc = h('div', { class: 'fc' }, h('span', { class: 'kind', text: KIND_LABEL[card.kind] }), h('span', { class: 'unitref', text: u ? 'Unit ' + u.number : '' }), front, star, h('div', { class: 'hint', text: 'tap or press space to flip' }));
      flipped = false;
      const grades = h('div', { class: 'fc-grades' });
      const flipBtn = h('button', { class: 'btn block fc-flip', text: 'Show answer' });
      const flip = () => {
        if (flipped) return; flipped = true;
        fc.append(back); fc.querySelector('.hint').remove();
        flipBtn.remove();
        const prev = S.preview(P.card(card.key), today());
        const labels = [['Again', prev[0]], ['Hard', prev[1]], ['Good', prev[2]], ['Easy', prev[3]]];
        labels.forEach(([label, sub], g) => grades.append(h('button', { class: 'g' + g, onClick: () => grade(g) }, label, h('small', { text: sub + ' · ' + (g + 1) }))));
        cardHost.append(grades);
      };
      fc.addEventListener('click', flip); flipBtn.addEventListener('click', flip);
      cardHost.append(fc, flipBtn);
      counter.textContent = `${s.done} / ${s.total}`;
      bar.firstChild.style.width = Math.round((s.done / s.total) * 100) + '%';
      wrap._flip = flip; wrap._grade = grade;
      function grade(g) {
        if (s.affectSchedule) P.grade(card.key, g);
        s.grades[g]++;
        if (g === 0) { // re-queue a few cards later
          s.again++;
          const pos = Math.min(s.queue.length, s.i + 1 + Math.min(4, s.queue.length - s.i - 1));
          s.queue.splice(pos, 0, card);
          if (!card._requeued) { card._requeued = true; }
        } else s.done++;
        s.i++;
        renderCard();
      }
    }
    function renderSummary() {
      updateDuePill();
      const [a, hd, g, e] = s.grades;
      cardHost.append(h('div', { class: 'card center' },
        h('div', { class: 'eyebrow', text: 'Session complete' }),
        h('h2', { text: `${s.total} cards` }),
        h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(4, 1fr)' } },
          h('div', { class: 'stat' }, h('b', { style: { color: 'var(--red)' }, text: String(a) }), h('span', { text: 'again' })),
          h('div', { class: 'stat' }, h('b', { style: { color: 'var(--amber)' }, text: String(hd) }), h('span', { text: 'hard' })),
          h('div', { class: 'stat' }, h('b', { style: { color: 'var(--green)' }, text: String(g) }), h('span', { text: 'good' })),
          h('div', { class: 'stat' }, h('b', { style: { color: 'var(--sky)' }, text: String(e) }), h('span', { text: 'easy' }))),
        h('div', { class: 'btngroup mt', style: { justifyContent: 'center' } },
          h('a', { class: 'btn primary', href: '#/study', text: 'Another session' }),
          h('a', { class: 'btn', href: '#/', text: 'Home' }))));
      counter.textContent = `${s.total} / ${s.total}`; bar.firstChild.style.width = '100%';
      Canto.session = null;
    }
    renderCard();
    wrap._keys = (e) => {
      if (e.target && e.target.matches && e.target.matches('input, textarea, select')) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); wrap._flip && wrap._flip(); }
      else if (/^[1-4]$/.test(e.key) && flipped) wrap._grade(+e.key - 1);
    };
    document.addEventListener('keydown', wrap._keys);
    wrap._cleanup = () => document.removeEventListener('keydown', wrap._keys);
    return wrap;
  };

  function updateDuePill() { Canto.updateDuePill && Canto.updateDuePill(); }

  // ---------- Word sheet (lookup) + quick quiz ----------
  Canto.views.wordSheet = (vocabs, { fromLine } = {}) => {
    const body = h('div');
    for (const v of vocabs) {
      const u = D.unit(v.unitId);
      const c = P.card(P.cardKey(v.id, 'f'));
      const star = h('span', { class: 'star ' + (P.star(v.id) ? 'on' : ''), text: '★', onClick: () => star.classList.toggle('on', P.toggleStar(v.id)) });
      body.append(h('div', { class: 'def' },
        h('div', { class: 'row between' }, h('span', { class: 'zh', text: v.zh || '—' }), star),
        h('div', { class: 'jp' }, jp(v.jp)),
        h('div', { class: 'en', text: v.en }),
        v.notes ? h('div', { class: 'small muted', text: v.notes }) : null,
        h('div', { class: 'row mt' },
          u ? h('a', { class: 'pill', href: `#/unit/${u.id}/vocab`, text: `Unit ${u.number}` + (v.section ? ' · ' + v.section : '') }) : null,
          c && c.reps ? pill(`next ${c.due}`, c.due <= today() ? 'pill-due' : '') : pill('new'),
          h('span', { class: 'grow' }),
          h('button', { class: 'btn sm', text: 'Quiz me', onClick: () => { sh.close(); Canto.views.quickQuiz(v); } }),
          h('button', { class: 'btn sm ghost', text: 'Due now', onClick: () => { const cur = P.card(P.cardKey(v.id, 'f')) || S.fresh(); if (cur.reps) { cur.due = today(); P.setCard(P.cardKey(v.id, 'f'), cur); } toast('Added to today\'s review'); updateDuePill(); } }))));
    }
    const sh = sheet(body);
    return sh;
  };

  Canto.views.quickQuiz = (v, kind = 'f') => {
    const card = { key: P.cardKey(v.id, kind), kind, id: v.id, unitId: v.unitId, v };
    const { front, back } = faces(card);
    const fc = h('div', { class: 'fc', style: { minHeight: '220px', cursor: 'pointer' } }, h('span', { class: 'kind', text: 'Quick quiz' }), front, h('div', { class: 'hint', text: 'think of the answer, then tap' }));
    const grades = h('div', { class: 'fc-grades' });
    let flipped = false;
    fc.addEventListener('click', () => {
      if (flipped) return; flipped = true;
      fc.append(back); fc.querySelector('.hint').remove();
      const prev = S.preview(P.card(card.key), today());
      [['Again', prev[0]], ['Hard', prev[1]], ['Good', prev[2]], ['Easy', prev[3]]].forEach(([label, sub], g) => grades.append(h('button', { class: 'g' + g, onClick: () => { P.grade(card.key, g); toast(g ? `Next review in ${sub}` : 'Will come back today'); sh.close(); updateDuePill(); } }, label, h('small', { text: sub }))));
    });
    const sh = sheet(h('div', null, fc, grades));
  };
})();
