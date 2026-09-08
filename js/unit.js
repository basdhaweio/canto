/* Unit list + unit detail (overview, vocab, dialogues, grammar, exercises, notes). */
(() => {
  const { h, pill, jp } = Canto.ui;
  const D = Canto.data, P = Canto.progress;

  Canto.views.units = () => {
    const wrap = h('div');
    wrap.append(h('div', { class: 'pagehead' }, h('h1', { text: 'Units' }), h('div', { class: 'sub', text: (D.state.index && D.state.index.course) || '' })));
    const list = h('div', { class: 'list' });
    for (const u of D.units()) {
      const st = P.unitStats(u.id);
      const pct = st.total ? Math.round((st.seen / st.total) * 100) : 0;
      list.append(h('a', { class: 'item', href: '#/unit/' + u.id },
        h('div', { class: 'n', style: { width: '38px', height: '38px', borderRadius: '10px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'var(--accent)' } }, String(u.number)),
        h('div', { class: 't' },
          h('b', { text: u.title }),
          h('small', { text: `${u.vocab.length} words · ${u.dialogues.length} dialogues · ${u.grammar.length} grammar · ${u.exercises.length} exercises` }),
          h('div', { class: 'progress', style: { marginTop: '6px' } }, h('i', { style: { width: pct + '%' } }))),
        h('span', { class: 'arrow', text: '›' })));
    }
    wrap.append(list);
    return wrap;
  };

  const TABS = [['overview', 'Overview'], ['vocab', 'Vocabulary'], ['dialogues', 'Dialogues'], ['grammar', 'Grammar'], ['exercises', 'Exercises'], ['notes', 'Notes']];

  Canto.views.unit = (id, tab = 'overview') => {
    const u = D.unit(id);
    if (!u) return h('div', { class: 'empty', text: 'Unit not found (not transcribed yet?).' });
    const wrap = h('div');
    wrap.append(h('div', { class: 'pagehead' },
      h('div', { class: 'eyebrow', text: 'Unit ' + u.number }),
      h('h1', { text: u.title }),
      h('div', { class: 'sub small', text: (u.sources || []).join(' · ') })));
    const tabs = h('div', { class: 'tabs' });
    for (const [key, label] of TABS) {
      if (key === 'notes' && !u.notes.length) continue;
      if (key === 'dialogues' && !u.dialogues.length) continue;
      tabs.append(h('a', { href: `#/unit/${u.id}/${key}`, class: key === tab ? 'active' : '', text: label }));
    }
    wrap.append(tabs);
    const body = { overview, vocab, dialogues, grammar, exercises, notes }[tab] || overview;
    wrap.append(body(u));
    return wrap;
  };

  function overview(u) {
    const st = P.unitStats(u.id);
    const cards = P.buildCards({ unitIds: [u.id], kinds: P.settings().cardKinds });
    const dc = P.dueCount(cards);
    const el = h('div', { class: 'stack' });
    if (u.goals.length) el.append(h('div', { class: 'card' }, h('h2', { text: 'In this unit' }), h('ul', { class: 'gbody' }, u.goals.map((g) => h('li', { text: g })))));
    el.append(h('div', { class: 'card' },
      h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } },
        h('div', { class: 'stat' }, h('b', { text: String(dc.due) }), h('span', { text: 'due' })),
        h('div', { class: 'stat' }, h('b', { text: String(dc.fresh) }), h('span', { text: 'new' })),
        h('div', { class: 'stat' }, h('b', { text: st.total ? Math.round((st.seen / st.total) * 100) + '%' : '–' }), h('span', { text: 'seen' }))),
      h('div', { class: 'btngroup mt' },
        h('a', { class: 'btn primary', href: `#/study?unit=${u.id}&mode=mixed&go=1`, text: dc.due ? `Review ${dc.due} due` : 'Study this unit' }),
        h('a', { class: 'btn', href: `#/study?unit=${u.id}`, text: 'Custom session' }))));
    const quick = h('div', { class: 'grid' });
    for (const d of u.dialogues) quick.append(h('a', { class: 'card clickable', href: '#/dialogue/' + d.id }, h('div', { class: 'eyebrow', text: 'Dialogue' }), h('b', { text: d.title }), h('div', { class: 'small muted', text: d.setting || '' })));
    for (const x of u.exercises) {
      const done = (x.items || []).filter((it) => (P.exercise(it.id) || {}).done).length;
      quick.append(h('a', { class: 'card clickable', href: '#/exercise/' + x.id }, h('div', { class: 'eyebrow', text: 'Exercise' }), h('b', { text: x.title }), h('div', { class: 'small muted', text: `${done}/${(x.items || []).length} done` })));
    }
    el.append(quick);
    return el;
  }

  function vocab(u) {
    const el = h('div');
    const sections = [...new Set(u.vocab.map((v) => v.section || 'Other'))];
    let filter = null;
    const chips = h('div', { class: 'chips mb' });
    const table = h('table', { class: 'table' });
    const render = () => {
      table.innerHTML = '';
      table.append(h('thead', null, h('tr', null, h('th', { text: '字' }), h('th', { text: 'Jyutping' }), h('th', { text: 'English' }), h('th'))));
      const tb = h('tbody');
      for (const v of u.vocab) {
        if (filter && (v.section || 'Other') !== filter) continue;
        const c = P.card(P.cardKey(v.id, 'f'));
        const star = h('span', { class: 'star ' + (P.star(v.id) ? 'on' : ''), text: '★', onClick: (e) => { e.stopPropagation(); star.classList.toggle('on', P.toggleStar(v.id)); } });
        tb.append(h('tr', { class: 'clickable', onClick: () => Canto.views.wordSheet([v]) },
          h('td', { class: 'zh', text: v.zh }),
          h('td', null, jp(v.jp)),
          h('td', null, v.en, v.notes ? h('div', { class: 'small muted', text: v.notes }) : null),
          h('td', { class: 'right' }, c && c.reps ? pill(c.interval >= 21 ? 'mature' : 'learning', c.interval >= 21 ? 'pill-green' : 'pill-amber') : null, ' ', star)));
      }
      table.append(tb);
    };
    if (sections.length > 1) {
      chips.append(Canto.ui.chip('All', true, null));
      for (const s of sections) chips.append(Canto.ui.chip(s, false, null));
      chips.addEventListener('click', (e) => {
        const c = e.target.closest('.chip'); if (!c) return;
        [...chips.children].forEach((x) => x.classList.toggle('on', x === c));
        filter = c.textContent === 'All' ? null : c.textContent;
        render();
      });
      el.append(chips);
    }
    el.append(h('div', { class: 'row between mb' },
      h('span', { class: 'muted small', text: `${u.vocab.length} words · tap a row for details` }),
      h('a', { class: 'btn sm', href: `#/study?unit=${u.id}&kinds=f&mode=cram&go=1`, text: 'Cram all' })));
    render();
    el.append(h('div', { style: { overflowX: 'auto' } }, table));
    return el;
  }

  function dialogues(u) {
    const el = h('div', { class: 'list' });
    for (const d of u.dialogues) el.append(h('a', { class: 'item', href: '#/dialogue/' + d.id }, h('div', { class: 't' }, h('b', { text: d.title }), h('small', { text: (d.setting || '') + ` · ${(d.lines || []).length} lines` })), h('span', { class: 'arrow', text: '›' })));
    if (!u.dialogues.length) el.append(h('div', { class: 'empty', text: 'No dialogues in this unit.' }));
    return el;
  }

  function grammar(u) { return Canto.views.grammarList(u.id); }
  function exercises(u) { return Canto.views.exerciseList(u.id); }

  function notes(u) {
    const el = h('div', { class: 'stack' });
    for (const n of u.notes) el.append(h('div', { class: 'card' }, h('h2', { text: n.title }), h('div', { class: 'gbody' }, ...String(n.body || '').split('\n').map((p) => h('p', { style: { margin: '4px 0' } }, p)))));
    if (!u.notes.length) el.append(h('div', { class: 'empty', text: 'No notes.' }));
    return el;
  }
})();
