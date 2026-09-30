/* Quiz: the app checks your answer and picks the grade (right/close/wrong + speed), instead of you rating yourself.
   Grades feed the same schedule as the flashcards; every answer is also counted per card so trouble words surface. */
(() => {
  const { h, jp, pill, toast, shuffle, today } = Canto.ui;
  const D = Canto.data, P = Canto.progress, S = Canto.srs;

  const TYPES = [
    ['f', 'Meaning of a word', 'See the Cantonese, pick the English'],
    ['r', 'Say the word', 'See the English, give the Cantonese'],
    ['p', 'Particles & endings', 'Fill the gap in a course sentence'],
    ['n', 'Numbers', 'See the numeral, give the Cantonese'],
  ];
  const STYLES = [['mix', 'Mix'], ['mc', 'Multiple choice'], ['type', 'Type Jyutping']];
  const MODES = [
    ['mixed', 'Due + new', 'Due cards first, then new ones up to the question count'],
    ['due', 'Due only', 'Only what the schedule says is due'],
    ['all', 'Everything', 'Any card in scope, shuffled (still updates the schedule)'],
    ['practice', 'Practice', 'Any card in scope; nothing is scheduled, answers still counted'],
  ];
  // Grading ignores time on purpose: the quiz is often left open while doing something else.
  const GRADE = ['Again', 'Hard', 'Good', 'Easy'];

  // ---------- Stats ----------
  function stats() { const d = P.load(); d.quiz = d.quiz || {}; return d.quiz; }
  function record(key, result) {
    const s = stats();
    const r = s[key] || (s[key] = { r: 0, w: 0, c: 0, last: '' });
    if (result === 'right') r.r++; else if (result === 'close') r.c++; else r.w++;
    r.last = today();
    P.save();
  }
  function trouble(limit = 12) {
    const s = stats();
    const rows = [];
    for (const [key, r] of Object.entries(s)) {
      const misses = r.w + r.c * 0.5;
      if (misses < 1) continue;
      const [id] = key.split(':');
      const v = D.byId.vocab[id];
      if (!v || !v.deck) continue;
      rows.push({ key, v, r, misses, acc: r.r / (r.r + r.w + r.c) });
    }
    return rows.sort((a, b) => b.misses - a.misses || a.acc - b.acc).slice(0, limit);
  }
  Canto.quizStats = { stats, trouble };

  // ---------- Answer checking ----------
  const SYL = /[a-z]+[1-6]?/g;
  function variants(jpText) {
    const base = String(jpText || '').toLowerCase().replace(/…/g, ' ');
    const out = new Set();
    for (const s of [base.replace(/[（(][^)）]*[)）]/g, ' '), base.replace(/[（()）]/g, ' ')]) {
      for (const part of s.split(/[\/,;]/)) {
        const syl = part.match(SYL);
        if (syl && syl.length) out.add(syl.join(' '));
      }
    }
    return [...out];
  }
  // Typed Jyutping: exact syllables = right; right letters but tones off/missing = close.
  function checkTyped(input, answerJp) {
    const typed = (String(input || '').toLowerCase().match(SYL) || []).join(' ');
    if (!typed) return 'wrong';
    const vs = variants(answerJp);
    vs.push(vs.join(' '));   // typing every listed form is fine too
    if (vs.includes(typed)) return 'right';
    const strip = (s) => s.replace(/[1-6]/g, '');
    if (vs.some((v) => strip(v) === strip(typed))) return 'close';
    return 'wrong';
  }
  function autoGrade(result) {
    if (result === 'wrong') return 0;
    if (result === 'close') return 1;
    return 2;
  }
  Canto.quizCheck = { checkTyped, autoGrade, variants };

  // ---------- Question building ----------
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9㐀-鿿]+/g, ' ').trim();
  function distractors(card, pool, n, sameKey) {
    const seen = new Set([sameKey(card.v)]);
    const sameUnit = shuffle(pool.filter((v) => v.unitId === card.v.unitId));
    const rest = shuffle(pool.filter((v) => v.unitId !== card.v.unitId));
    const out = [];
    for (const v of [...sameUnit, ...rest]) {
      const k = sameKey(v);
      if (!k || seen.has(k) || v.id === card.v.id) continue;
      seen.add(k); out.push(v);
      if (out.length >= n) break;
    }
    return out;
  }
  const pools = {};
  function pool(deck) { return pools[deck] || (pools[deck] = D.allVocab().filter((v) => v.deck === deck)); }

  // Blank the particle/ending out of a course sentence.
  function blankOut(e, v) {
    const keys = variants(v.jp).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      const re = new RegExp('(^|[^a-z0-9])(' + k.split(' ').join('\\s+') + ')(?![a-z0-9])', 'gi');
      const matches = [...String(e.jp).matchAll(re)];
      if (!matches.length) continue;
      const m = v.fn === 'ending' ? matches[0] : matches[matches.length - 1];
      const at = m.index + m[1].length;
      const jpBlank = e.jp.slice(0, at) + '＿＿' + e.jp.slice(at + m[2].length);
      let zhBlank = '';
      const zhKey = String(v.zh || '').replace(/[…?？]/g, '');
      if (e.zh && zhKey && e.zh.includes(zhKey)) {
        const i = v.fn === 'ending' ? e.zh.indexOf(zhKey) : e.zh.lastIndexOf(zhKey);
        zhBlank = e.zh.slice(0, i) + '＿＿' + e.zh.slice(i + zhKey.length);
      }
      return { jp: jpBlank, zh: zhBlank, en: e.en };
    }
    return null;
  }

  function makeQuestion(card, style) {
    const v = card.v;
    const canType = card.kind === 'r' || card.kind === 'n';
    const st = style === 'mix' ? (canType && Math.random() < 0.5 ? 'type' : 'mc') : style === 'type' && canType ? 'type' : 'mc';
    const q = { card, style: st, answerJp: v.jp };
    if (card.kind === 'f') {
      q.ask = 'What does this mean?';
      q.prompt = [v.zh ? h('div', { class: 'qzh zh', text: v.zh }) : null, h('div', { class: 'qjp' }, jp(v.jp))];
      const ds = distractors(card, pool('vocab'), 3, (x) => norm(x.en));
      q.options = shuffle([v, ...ds]).map((x) => ({ v: x, label: [h('span', { text: x.en })] }));
    } else if (card.kind === 'r') {
      q.ask = 'How do you say this in Cantonese?';
      q.prompt = [h('div', { class: 'qen', text: v.en }), v.pos ? h('div', { class: 'small muted', text: v.pos }) : null];
      if (st === 'mc') {
        const ds = distractors(card, pool('vocab'), 3, (x) => norm(x.jp));
        q.options = shuffle([v, ...ds]).map((x) => ({ v: x, label: [x.zh ? h('span', { class: 'zh', text: x.zh + ' ' }) : null, jp(x.jp)] }));
      }
    } else if (card.kind === 'n') {
      const numeral = /^\d+$/.test(v.en);
      q.ask = numeral ? 'Say this number in Cantonese' : 'Which word is this?';
      q.prompt = [h('div', { class: numeral ? 'qzh' : 'qen', text: v.en })];
      if (st === 'mc') {
        const ds = distractors(card, pool('numbers'), 3, (x) => norm(x.jp));
        q.options = shuffle([v, ...ds]).map((x) => ({ v: x, label: [h('span', { class: 'zh', text: x.zh + ' ' }), jp(x.jp)] }));
      }
    } else if (card.kind === 'p') {
      const ex = D.examplesFor(v, 4).map((e) => blankOut(e, v)).filter(Boolean);
      const same = pool('particles').filter((x) => x.fn === v.fn);
      if (ex.length) {
        const e = ex[Math.floor(Math.random() * ex.length)];
        q.ask = v.fn === 'ending' ? 'Which ending fills the gap?' : 'Which particle fills the gap?';
        q.prompt = [h('div', { class: 'qsent' }, jp(e.jp)), e.zh ? h('div', { class: 'qsentzh zh', text: e.zh }) : null, h('div', { class: 'small muted', text: e.en })];
        const ds = distractors(card, same.length >= 4 ? same : pool('particles'), 3, (x) => norm(x.jp));
        q.options = shuffle([v, ...ds]).map((x) => ({ v: x, label: [x.zh ? h('span', { class: 'zh', text: x.zh.replace(/…/g, '') + ' ' }) : null, jp(x.jp.replace(/…\s*/g, ''))] }));
      } else {
        q.ask = 'What does this do?';
        q.prompt = [v.zh ? h('div', { class: 'qzh zh', text: v.zh }) : null, h('div', { class: 'qjp' }, jp(v.jp))];
        const ds = distractors(card, pool('particles'), 3, (x) => norm(x.en));
        q.options = shuffle([v, ...ds]).map((x) => ({ v: x, label: [h('span', { text: x.en })] }));
      }
      q.style = 'mc';
    }
    if (q.options && q.options.length < 2) { q.options = null; q.style = 'type'; }
    if (!q.options) q.style = 'type';
    return q;
  }

  // ---------- Setup ----------
  function cardUnits() { return D.units().filter((u) => D.hasCards(u.id)); }
  Canto.views.quiz = (query = {}) => {
    const saved = P.load().lastQuiz || {};
    const st = {
      unitIds: (query.unit ? [query.unit] : saved.unitIds || cardUnits().map((u) => u.id)).filter((id) => D.hasCards(id)),
      sets: query.unit ? (query.sets ? query.sets.split(',') : []) : saved.sets || [],
      kinds: query.kinds ? Object.fromEntries(TYPES.map(([k]) => [k, query.kinds.split(',').includes(k)])) : saved.kinds || { f: true, r: true, p: true, n: false },
      style: saved.style || 'mix',
      mode: query.mode || saved.mode || 'mixed',
      count: saved.count || 20,
    };
    const wrap = h('div', { class: 'fc-wrap' });
    wrap.append(h('div', { class: 'pagehead' }, h('h1', { text: 'Quiz' }),
      h('div', { class: 'sub', text: 'The app checks each answer and grades it for you: right = Good, a near miss (tones off) = Hard, wrong = the word resets and comes back. How long you take is not counted. Tap "I guessed" if you got lucky.' })));

    const unitChips = h('div', { class: 'chips' });
    const setChips = h('div', { class: 'chips' });
    const renderUnits = () => { unitChips.innerHTML = ''; for (const u of cardUnits()) unitChips.append(Canto.ui.chip(`${u.number} · ${u.title}`, st.unitIds.includes(u.id), (on) => { st.unitIds = on ? [...st.unitIds, u.id] : st.unitIds.filter((x) => x !== u.id); renderSets(); update(); })); };
    const renderSets = () => { setChips.innerHTML = ''; const secs = D.sections(st.unitIds); st.sets = st.sets.filter((s) => secs.includes(s)); for (const s of secs) setChips.append(Canto.ui.chip(s, st.sets.includes(s), (on) => { st.sets = on ? [...st.sets, s] : st.sets.filter((x) => x !== s); update(); }, 'small')); };
    const typeChips = h('div', { class: 'chips' }, TYPES.map(([k, label]) => Canto.ui.chip(label, !!st.kinds[k], (on) => { st.kinds[k] = on; update(); })));
    const typeDesc = h('div', { class: 'small muted', style: { marginTop: '6px' }, text: TYPES.map(([, l, d]) => `${l}: ${d}`).join(' · ') });
    const styleChips = h('div', { class: 'chips' });
    STYLES.forEach(([k, label]) => styleChips.append(Canto.ui.chip(label, st.style === k, () => { st.style = k; [...styleChips.children].forEach((c) => c.classList.toggle('on', c.textContent === label)); })));
    const modeChips = h('div', { class: 'chips' });
    const modeDesc = h('div', { class: 'small muted', style: { marginTop: '6px' } });
    MODES.forEach(([k, label]) => modeChips.append(Canto.ui.chip(label, st.mode === k, () => { st.mode = k; [...modeChips.children].forEach((c) => c.classList.toggle('on', c.textContent === label)); update(); })));
    const countIn = h('input', { type: 'number', min: 5, max: 200, value: st.count, style: { width: '90px' }, onInput: (e) => { st.count = Math.max(1, +e.target.value || 1); update(); } });
    const summary = h('div', { class: 'small muted mt' });
    const start = h('button', { class: 'btn primary block', text: 'Start quiz' });

    const sec = (title, ...kids) => h('div', { class: 'setup-section' }, h('h3', { text: title }), ...kids);
    function scope() { return P.buildCards({ unitIds: st.unitIds, sections: st.sets, kinds: { f: st.kinds.f, r: st.kinds.r, p: st.kinds.p, n: st.kinds.n } }); }
    function update() {
      modeDesc.textContent = MODES.find((m) => m[0] === st.mode)[2];
      const q = buildQueue(scope(), st.mode, st.count);
      summary.textContent = `${q.length} question${q.length === 1 ? '' : 's'} ready` + (st.mode === 'practice' ? ' · practice (no scheduling)' : '');
      start.disabled = !q.length;
      start.textContent = q.length ? `Start · ${q.length} questions` : 'Nothing to quiz with this scope';
    }
    start.addEventListener('click', () => {
      P.load().lastQuiz = { unitIds: st.unitIds, sets: st.sets, kinds: st.kinds, style: st.style, mode: st.mode, count: st.count }; P.save();
      startQuiz(buildQueue(scope(), st.mode, st.count), { style: st.style, practice: st.mode === 'practice', title: MODES.find((m) => m[0] === st.mode)[1] });
    });
    renderUnits(); renderSets(); update();
    wrap.append(
      sec('Units', unitChips),
      sec('Sets', h('div', { class: 'small muted mb', text: 'Leave both off for whole units.' }), setChips),
      sec('Question types', typeChips, typeDesc),
      sec('Answer style', styleChips, h('div', { class: 'small muted', style: { marginTop: '6px' }, text: 'Typing applies to "Say the word" and Numbers; tone digits count (zou2 san4). Right letters with wrong tones is a near miss.' })),
      sec('Which cards', modeChips, modeDesc, h('div', { class: 'row mt' }, h('span', { class: 'small muted', text: 'Questions' }), countIn)),
      summary, h('div', { class: 'mt' }, start));

    // Trouble words
    const tr = trouble();
    const trBox = h('div', { class: 'card mt' }, h('div', { class: 'row between' }, h('h2', { text: 'Trouble words' }),
      tr.length ? h('button', { class: 'btn sm', text: `Quiz these ${tr.length}`, onClick: () => startQuiz(shuffle(tr.map((t) => cardFromKey(t.key)).filter(Boolean)), { style: st.style, title: 'Trouble words' }) }) : null));
    if (!tr.length) trBox.append(h('div', { class: 'small muted', text: 'Words you miss in quizzes will collect here.' }));
    for (const t of tr) {
      trBox.append(h('div', { class: 'unitrow clickable', style: { cursor: 'pointer' }, onClick: () => Canto.views.wordSheet([t.v]) },
        h('div', { class: 't' }, h('div', null, t.v.zh ? h('span', { class: 'zh', text: t.v.zh + ' ' }) : null, jp(t.v.jp)), h('div', { class: 'small muted', text: t.v.en })),
        h('div', { class: 'right small' }, h('div', { style: { color: 'var(--red)' }, text: `missed ${t.r.w}${t.r.c ? ` · close ${t.r.c}` : ''}` }), h('div', { class: 'muted', text: `right ${t.r.r}` }))));
    }
    wrap.append(trBox);
    return wrap;
  };

  function cardFromKey(key) {
    const [id, kind] = key.split(':');
    const v = D.byId.vocab[id];
    if (!v) return null;
    const c = P.cardFor(v);
    if (!c) return null;
    if (kind === 'r' && c.kind === 'f') return { key, kind: 'r', id, unitId: v.unitId, v };
    return c.kind === kind ? c : null;
  }

  function buildQueue(cards, mode, count) {
    const t = today(), p = P.load();
    if (mode === 'all' || mode === 'practice') return shuffle([...cards]).slice(0, count);
    const due = [], fresh = [];
    for (const c of cards) { const s = p.cards[c.key]; if (S.isNew(s)) fresh.push(c); else if (S.isDue(s, t)) due.push(c); }
    if (mode === 'due') return shuffle(due).slice(0, count);
    return [...shuffle(due), ...Canto.orderNew(fresh)].slice(0, count);
  }

  // ---------- Run ----------
  Canto.quiz = null;
  function startQuiz(queue, { style = 'mix', practice = false, title = 'Quiz' } = {}) {
    if (!queue.length) { toast('Nothing to quiz'); return; }
    Canto.quiz = { queue: [...queue], i: 0, style, practice, title, total: queue.length, answered: 0, firstTry: 0, results: [], requeued: new Set() };
    // Already on the quiz page (e.g. 'Retry the missed')? The hash won't change, so redraw explicitly.
    if (location.hash === '#/quiz/run') window.dispatchEvent(new HashChangeEvent('hashchange'));
    else location.hash = '#/quiz/run';
  }
  Canto.startQuiz = startQuiz;

  Canto.views.quizRun = () => {
    const z = Canto.quiz;
    if (!z) { setTimeout(() => (location.hash = '#/quiz'), 0); return h('div', { class: 'loading', text: '…' }); }
    const wrap = h('div', { class: 'fc-wrap' });
    const bar = h('div', { class: 'progress' }, h('i'));
    const counter = h('span');
    wrap.append(h('div', { class: 'fc-top' }, h('a', { href: '#/quiz', class: 'btn sm ghost', text: '✕' }), h('span', { text: z.title + (z.practice ? ' · practice' : '') }), bar, counter));
    const host = h('div');
    wrap.append(host);
    let onKey = null;

    function next() {
      host.innerHTML = '';
      counter.textContent = `${z.answered} / ${z.total}`;
      bar.firstChild.style.width = Math.round((z.answered / z.total) * 100) + '%';
      if (z.i >= z.queue.length) return summary();
      const card = z.queue[z.i];
      const q = makeQuestion(card, z.style);
      const u = D.unit(card.unitId);
      const box = h('div', { class: 'fc quiz' }, h('span', { class: 'kind', text: q.ask }), h('span', { class: 'unitref', text: u ? `Unit ${u.number}` + (card.v.section && /^Set /.test(card.v.section) ? ' · ' + card.v.section : '') : '' }), ...q.prompt);
      host.append(box);
      const feedback = h('div');
      let done = false;
      const finish = (result, chosenEl) => {
        if (done) return; done = true;
        const prev = P.card(card.key);
        const before = prev ? Object.assign({}, prev) : null;
        const firstTime = !z.requeued.has(card.key);
        // A retry after a miss in this quiz tops out at Good, so the word comes back tomorrow.
        let g = autoGrade(result);
        record(card.key, result);
        if (firstTime) { z.results.push({ card, result }); if (result === 'right') z.firstTry++; }
        let applied = false;
        const apply = (grade) => {
          if (z.practice) return;
          if (applied) { if (before) P.setCard(card.key, Object.assign({}, before)); else P.resetCard(card.key); }
          P.grade(card.key, grade); applied = true;
        };
        apply(g);
        if (result !== 'right' && !z.requeued.has(card.key)) {   // ask it again a few questions later
          z.requeued.add(card.key);
          z.queue.splice(Math.min(z.queue.length, z.i + 4), 0, card);
        } else z.answered++;
        const verdict = result === 'right' ? '✓ Right' : result === 'close' ? '≈ Close — check the tones' : '✗ Not quite';
        const color = result === 'right' ? 'var(--green)' : result === 'close' ? 'var(--amber)' : 'var(--red)';
        const gradeLine = h('span', { class: 'small muted' });
        const setGradeLine = () => { gradeLine.textContent = z.practice ? 'practice, not scheduled' : `${GRADE[g]}` + (g ? ` · next in ${P.card(card.key).interval}d` : ' · back later today'); };
        setGradeLine();
        const answer = h('div', { class: 'qanswer' },
          card.v.zh ? h('span', { class: 'zh', text: card.v.zh + '  ' }) : null, jp(card.v.jp), h('div', { class: 'small', text: card.v.en }),
          card.v.notes ? h('div', { class: 'small muted', text: card.v.notes }) : null);
        const guessed = result === 'right' && !z.practice ? h('button', { class: 'btn sm ghost', text: 'I guessed', onClick: (e) => { g = 1; apply(1); setGradeLine(); e.target.remove(); } }) : null;
        const nextBtn = h('button', { class: 'btn primary block mt', text: z.i + 1 >= z.queue.length ? 'Finish' : 'Next ›', onClick: () => { z.i++; next(); } });
        feedback.append(h('div', { class: 'card mt' }, h('div', { class: 'row between' }, h('b', { style: { color }, text: verdict }), h('span', null, gradeLine, ' ', guessed)), answer), nextBtn);
        if (chosenEl) chosenEl.classList.add(result === 'right' ? 'ok' : 'bad');
        host.querySelectorAll('.qopt').forEach((b) => { b.disabled = true; if (b._v === card.v) b.classList.add('ok'); });
        const inp = host.querySelector('input.qtype'); if (inp) inp.disabled = true;
        setTimeout(() => nextBtn.focus(), 0);
      };
      if (q.style === 'mc') {
        const opts = h('div', { class: 'qopts' });
        q.options.forEach((o, i) => {
          const b = h('button', { class: 'qopt', onClick: () => finish(o.v === card.v ? 'right' : 'wrong', b) }, h('span', { class: 'qn', text: String(i + 1) }), ...o.label);
          b._v = o.v;
          opts.append(b);
        });
        host.append(opts);
        onKey = (e) => { if (!done && /^[1-4]$/.test(e.key) && opts.children[+e.key - 1]) opts.children[+e.key - 1].click(); else if (done && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); host.querySelector('.btn.primary').click(); } };
      } else {
        const inp = h('input', { type: 'text', class: 'qtype', placeholder: 'Type Jyutping with tone numbers, e.g. zou2 san4', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
        const go = h('button', { class: 'btn primary', text: 'Check' });
        const submit = () => { if (!done && inp.value.trim()) finish(checkTyped(inp.value, q.answerJp)); };
        go.addEventListener('click', submit);
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!done) submit(); else host.querySelector('.btn.primary.block').click(); } });
        const skip = h('button', { class: 'btn ghost', text: "Don't know", onClick: () => finish('wrong') });
        host.append(h('div', { class: 'row mt' }, h('div', { class: 'grow' }, inp), go, skip));
        setTimeout(() => inp.focus(), 0);
        onKey = (e) => { if (done && e.target !== inp && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); host.querySelector('.btn.primary.block').click(); } };
      }
      host.append(feedback);
    }

    function summary() {
      Canto.updateDuePill && Canto.updateDuePill();
      const n = z.results.length;
      const missed = z.results.filter((r) => r.result !== 'right');
      const pct = n ? Math.round((z.firstTry / n) * 100) : 0;
      const box = h('div', { class: 'card center' },
        h('div', { class: 'eyebrow', text: 'Quiz complete' }),
        h('h2', { text: `${z.firstTry} / ${n} right first time · ${pct}%` }),
        z.practice ? h('div', { class: 'small muted', text: 'Practice mode: your schedule was not changed.' }) : h('div', { class: 'small muted', text: 'Your answers set when each word comes back.' }));
      host.append(box);
      if (missed.length) {
        const list = h('div', { class: 'card mt' }, h('h3', { text: 'To look at again' }));
        for (const m of missed) list.append(h('div', { class: 'unitrow', style: { cursor: 'pointer' }, onClick: () => Canto.views.wordSheet([m.card.v]) },
          h('div', { class: 't' }, h('div', null, m.card.v.zh ? h('span', { class: 'zh', text: m.card.v.zh + ' ' }) : null, jp(m.card.v.jp)), h('div', { class: 'small muted', text: m.card.v.en })),
          pill(m.result === 'close' ? 'close' : 'missed', m.result === 'close' ? 'pill-amber' : 'pill-red')));
        host.append(list);
      }
      host.append(h('div', { class: 'btngroup mt', style: { justifyContent: 'center' } },
        missed.length ? h('button', { class: 'btn primary', text: `Retry the ${missed.length} missed (practice)`, onClick: () => startQuiz(shuffle(missed.map((m) => m.card)), { style: z.style, practice: true, title: 'Retry' }) }) : null,
        h('a', { class: 'btn', href: '#/quiz', text: 'New quiz' }),
        h('a', { class: 'btn ghost', href: '#/', text: 'Home' })));
      counter.textContent = `${z.total} / ${z.total}`; bar.firstChild.style.width = '100%';
      Canto.quiz = null;
      onKey = null;
    }

    next();
    const keys = (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.tagName === 'BUTTON') return;
      if (onKey) onKey(e);
    };
    document.addEventListener('keydown', keys);
    wrap._cleanup = () => document.removeEventListener('keydown', keys);
    return wrap;
  };
})();
