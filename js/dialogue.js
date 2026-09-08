/* Dialogue viewer: read / run-through / role-play modes with tap-to-lookup words. */
(() => {
  const { h, jp, toast } = Canto.ui;
  const D = Canto.data, P = Canto.progress;

  // Render a line of Jyutping or characters as tappable word spans.
  Canto.views.tokenLine = (text, kind = 'jp', { cls = '' } = {}) => {
    const tokens = kind === 'jp' ? D.tokenizeJp(text) : D.tokenizeZh(text);
    const el = h('span', { class: 'wline ' + cls });
    for (const t of tokens) {
      if (t.sep || !t.vocab) { el.append(kind === 'jp' ? jp(t.text, '') : t.text); continue; }
      const v0 = t.vocab[0];
      const c = P.card(P.cardKey(v0.id, 'f'));
      const span = h('span', { class: 'w' + (c && c.reps ? ' known' : '') + (P.star(v0.id) ? ' starred' : ''), title: t.vocab.map((v) => v.en).join(' / ') });
      span.append(kind === 'jp' ? jp(t.text, '') : t.text);
      span.addEventListener('click', (e) => { e.stopPropagation(); Canto.views.wordSheet(t.vocab); });
      el.append(span);
    }
    return el;
  };

  Canto.views.dialogue = (id) => {
    const d = D.byId.dialogue[id];
    if (!d) return h('div', { class: 'empty', text: 'Dialogue not found.' });
    const u = D.unit(d.unitId);
    const wrap = h('div');
    wrap.append(h('div', { class: 'pagehead' },
      h('div', { class: 'eyebrow' }, h('a', { href: `#/unit/${u.id}/dialogues`, text: `Unit ${u.number} · ${u.title}` })),
      h('h1', { text: d.title }),
      d.setting ? h('div', { class: 'sub', text: d.setting }) : null));

    const st = { zh: true, jp: true, en: true, mode: 'read', speaker: null, revealed: new Set() };
    const speakers = [...new Set((d.lines || []).map((l) => l.speaker).filter(Boolean))];
    const controls = h('div', { class: 'dlg-controls' });
    const showChips = ['zh', 'jp', 'en'].map((k) => Canto.ui.chip({ zh: '字', jp: 'Jyutping', en: 'English' }[k], true, (on) => { st[k] = on; render(); }, 'small'));
    const modeChips = [['read', 'Read'], ['run', 'Run-through'], ['role', 'Role-play']].map(([m, label]) => Canto.ui.chip(label, m === 'read', () => { st.mode = m; st.revealed.clear(); modeChips.forEach((c) => c.classList.toggle('on', c.textContent === label)); speakerRow.hidden = m !== 'role'; render(); }, 'small'));
    const speakerRow = h('div', { class: 'row small', hidden: true }, h('span', { class: 'muted', text: 'You play:' }),
      ...speakers.map((sp) => Canto.ui.chip(sp, false, (on, c) => { st.speaker = on ? sp : null; [...speakerRow.querySelectorAll('.chip')].forEach((x) => x !== c && x.classList.remove('on')); st.revealed.clear(); render(); }, 'small')));
    controls.append(h('span', { class: 'small muted', text: 'Show' }), ...showChips, h('span', { class: 'small muted', style: { marginLeft: '8px' }, text: 'Mode' }), ...modeChips);
    wrap.append(controls, speakerRow);
    wrap.append(h('div', { class: 'small muted mb', text: 'Tap any underlined word for its meaning and a quick quiz. Run-through hides the English until you tap a line; role-play hides your own lines.' }));

    const linesEl = h('div', { class: 'card' });
    wrap.append(linesEl);

    function hiddenBox(inner, key) {
      const box = h('div', { class: 'hidden-text' }, inner);
      box.addEventListener('click', (e) => { e.stopPropagation(); st.revealed.add(key); render(); });
      return box;
    }
    function render() {
      linesEl.innerHTML = '';
      (d.lines || []).forEach((l) => {
        const mine = st.mode === 'role' && st.speaker && l.speaker === st.speaker;
        const row = h('div', { class: 'line' + (mine ? ' mine' : '') });
        row.append(h('div', { class: 'spk', text: l.speaker || '' }));
        const body = h('div');
        const canto = h('div');
        if (st.zh && l.zh) canto.append(h('div', { class: 'lzh zh' }, Canto.views.tokenLine(l.zh, 'zh')));
        if (st.jp && l.jp) canto.append(h('div', { class: 'ljp' }, Canto.views.tokenLine(l.jp, 'jp')));
        const en = st.en && l.en ? h('div', { class: 'len', text: l.en }) : null;
        if (mine && !st.revealed.has(l.id)) { body.append(en || h('div', { class: 'len muted', text: '(no English cue)' }), hiddenBox(canto, l.id), h('div', { class: 'reveal', text: 'tap to reveal your line' })); }
        else if (st.mode === 'run' && en && !st.revealed.has(l.id)) { body.append(canto, hiddenBox(en, l.id)); }
        else body.append(canto, en);
        row.append(body);
        linesEl.append(row);
      });
      if (st.mode !== 'read') {
        const all = (d.lines || []).every((l) => st.revealed.has(l.id));
        linesEl.append(h('div', { class: 'btngroup mt' },
          h('button', { class: 'btn sm', text: all ? 'Hide all again' : 'Reveal next', onClick: () => { if (all) { st.revealed.clear(); } else { const next = (d.lines || []).find((l) => !st.revealed.has(l.id) && (st.mode === 'run' || (st.speaker && l.speaker === st.speaker))); if (next) st.revealed.add(next.id); else (d.lines || []).forEach((l) => st.revealed.add(l.id)); } render(); } }),
          h('button', { class: 'btn sm ghost', text: 'Reveal all', onClick: () => { (d.lines || []).forEach((l) => st.revealed.add(l.id)); render(); } })));
      }
    }
    render();

    // Study buttons
    const vocabIds = new Set();
    for (const l of d.lines || []) for (const t of D.tokenizeJp(l.jp || '')) if (t.vocab) t.vocab.forEach((v) => vocabIds.add(v.id));
    const words = [...vocabIds].map((vid) => D.byId.vocab[vid]).filter(Boolean);
    wrap.append(h('div', { class: 'btngroup mt' },
      h('button', { class: 'btn', text: `Flashcards: ${words.length} words in this dialogue`, onClick: () => Canto.startSession(Canto.ui.shuffle(words.map((v) => ({ key: P.cardKey(v.id, 'f'), kind: 'f', id: v.id, unitId: v.unitId, v }))), { title: d.title + ' words' }) }),
      h('button', { class: 'btn', text: 'Flashcards: lines (EN → Cantonese)', onClick: () => Canto.startSession((d.lines || []).filter((l) => l.jp && l.en).map((l) => ({ key: P.cardKey(l.id, 'd'), kind: 'd', id: l.id, unitId: d.unitId, l, d })), { title: d.title + ' lines' }) })));

    if ((d.questions || []).length) {
      const q = h('div', { class: 'card mt' }, h('h2', { text: 'Questions' }), h('ol', { class: 'gbody' }, d.questions.map((x) => h('li', { text: x }))));
      const ta = h('textarea', { placeholder: 'Your answers / notes (saved on this device)', value: P.note(d.id) });
      ta.addEventListener('input', () => P.setNote(d.id, ta.value));
      q.append(h('div', { class: 'mt' }, ta));
      wrap.append(q);
    } else {
      const ta = h('textarea', { placeholder: 'Notes about this dialogue (saved on this device)' });
      ta.value = P.note(d.id);
      ta.addEventListener('input', () => P.setNote(d.id, ta.value));
      wrap.append(h('div', { class: 'card mt' }, h('h2', { text: 'Notes' }), ta));
    }
    return wrap;
  };
})();
