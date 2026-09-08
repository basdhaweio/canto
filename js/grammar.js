/* Grammar: unit list with tag filter, entry detail with examples and review mode. */
(() => {
  const { h, jp, pill } = Canto.ui;
  const D = Canto.data, P = Canto.progress;

  Canto.views.grammarList = (unitId) => {
    const u = D.unit(unitId);
    const el = h('div');
    if (!u.grammar.length) { el.append(h('div', { class: 'empty', text: 'No grammar notes in this unit.' })); return el; }
    const tags = [...new Set(u.grammar.flatMap((g) => g.tags || []))];
    let filter = null;
    const list = h('div', { class: 'list' });
    const render = () => {
      list.innerHTML = '';
      for (const g of u.grammar) {
        if (filter && !(g.tags || []).includes(filter)) continue;
        list.append(h('a', { class: 'item', href: '#/grammar/' + g.id },
          h('div', { class: 't' }, h('b', { text: g.title }), h('small', { text: g.summary || '' }), (g.tags || []).length ? h('div', { class: 'small' }, (g.tags || []).map((t) => h('span', { class: 'tag', text: '#' + t + ' ' }))) : null),
          h('span', { class: 'pill', text: `${(g.examples || []).length} ex` }), h('span', { class: 'arrow', text: '›' })));
      }
    };
    if (tags.length > 1) {
      const chips = h('div', { class: 'chips mb' }, Canto.ui.chip('All', true, null, 'small'), ...tags.map((t) => Canto.ui.chip('#' + t, false, null, 'small')));
      chips.addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; [...chips.children].forEach((x) => x.classList.toggle('on', x === c)); filter = c.textContent === 'All' ? null : c.textContent.slice(1); render(); });
      el.append(chips);
    }
    const allEx = u.grammar.flatMap((g) => (g.examples || []).filter((e) => e.jp && e.en).map((e) => ({ key: P.cardKey(e.id, 'g'), kind: 'g', id: e.id, unitId: u.id, e, g })));
    el.append(h('div', { class: 'row between mb' }, h('span', { class: 'small muted', text: `${u.grammar.length} topics · ${allEx.length} examples` }), allEx.length ? h('button', { class: 'btn sm', text: 'Review all examples', onClick: () => Canto.startSession(Canto.ui.shuffle(allEx), { title: `Unit ${u.number} grammar` }) }) : null));
    render();
    el.append(list);
    return el;
  };

  Canto.views.grammar = (id) => {
    const g = D.byId.grammar[id];
    if (!g) return h('div', { class: 'empty', text: 'Grammar entry not found.' });
    const u = D.unit(g.unitId);
    const idx = u.grammar.indexOf(g);
    const prev = u.grammar[idx - 1], next = u.grammar[idx + 1];
    const wrap = h('div');
    wrap.append(h('div', { class: 'pagehead' },
      h('div', { class: 'eyebrow' }, h('a', { href: `#/unit/${u.id}/grammar`, text: `Unit ${u.number} · Grammar` })),
      h('h1', { text: g.title }),
      g.summary ? h('div', { class: 'sub', text: g.summary }) : null,
      (g.tags || []).length ? h('div', { class: 'small' }, g.tags.map((t) => h('span', { class: 'tag', text: '#' + t + ' ' }))) : null));

    if (g.body) {
      const paras = String(g.body).split('\n').map((s) => s.trim()).filter(Boolean);
      wrap.append(h('div', { class: 'card' }, h('ul', { class: 'gbody' }, paras.map((p) => h('li', null, p.replace(/^[•\-–]\s*/, ''))))));
    }

    const exs = g.examples || [];
    if (exs.length) {
      const st = { en: true, canto: true };
      const box = h('div', { class: 'card mt' });
      const head = h('div', { class: 'row between mb' }, h('h2', { text: 'Examples' }),
        h('div', { class: 'chips' },
          Canto.ui.chip('Cantonese', true, (on) => { st.canto = on; render(); }, 'small'),
          Canto.ui.chip('English', true, (on) => { st.en = on; render(); }, 'small')));
      const list = h('div');
      const revealed = new Set();
      function render() {
        list.innerHTML = '';
        for (const e of exs) {
          const row = h('div', { class: 'ex' });
          const cantoEl = h('div');
          if (e.jp) cantoEl.append(h('div', { class: 'ejp' }, Canto.views.tokenLine(e.jp, 'jp')));
          if (e.zh) cantoEl.append(h('div', { class: 'ezh zh' }, Canto.views.tokenLine(e.zh, 'zh')));
          const enEl = h('div');
          if (e.en) enEl.append(h('div', { class: 'een', text: e.en }));
          if (e.lit) enEl.append(h('div', { class: 'elit', text: 'lit. ' + e.lit }));
          const hide = (el, key) => { const b = h('div', { class: 'hidden-text', style: { color: 'transparent', background: 'var(--bg3)', borderRadius: '6px', cursor: 'pointer' } }, el); b.addEventListener('click', (ev) => { ev.stopPropagation(); revealed.add(key); render(); }); return b; };
          row.append(st.canto || revealed.has(e.id + 'c') ? cantoEl : hide(cantoEl, e.id + 'c'));
          row.append(st.en || revealed.has(e.id + 'e') ? enEl : hide(enEl, e.id + 'e'));
          list.append(row);
        }
      }
      render();
      const cards = exs.filter((e) => e.jp && e.en).map((e) => ({ key: P.cardKey(e.id, 'g'), kind: 'g', id: e.id, unitId: u.id, e, g }));
      box.append(head, h('div', { class: 'small muted mb', text: 'Hide a column to test yourself; tap a hidden row to reveal it. Underlined words open a lookup.' }), list,
        cards.length ? h('div', { class: 'btngroup mt' }, h('button', { class: 'btn', text: `Review these ${cards.length} examples as cards`, onClick: () => Canto.startSession(Canto.ui.shuffle(cards), { title: g.title }) })) : null);
      wrap.append(box);
    }

    const ta = h('textarea', { placeholder: 'Your notes on this point (saved on this device)' });
    ta.value = P.note(g.id);
    ta.addEventListener('input', () => P.setNote(g.id, ta.value));
    wrap.append(h('div', { class: 'card mt' }, h('h3', { text: 'Notes' }), ta));

    wrap.append(h('div', { class: 'row between mt' },
      prev ? h('a', { class: 'btn ghost', href: '#/grammar/' + prev.id, text: '‹ ' + prev.title }) : h('span'),
      next ? h('a', { class: 'btn ghost', href: '#/grammar/' + next.id, text: next.title + ' ›' }) : h('span')));
    return wrap;
  };
})();
