/* Exercises: per-unit list and per-exercise worksheet with saved answers + self-marking. */
(() => {
  const { h, jp, pill, toast } = Canto.ui;
  const D = Canto.data, P = Canto.progress;

  const TYPE_LABEL = { reorder: 'Reorder', reply: 'Reply', fill: 'Fill in', translate: 'Translate', truefalse: 'True / false', listen: 'Listen & repeat', open: 'Open' };

  Canto.views.exerciseList = (unitId) => {
    const u = D.unit(unitId);
    const el = h('div', { class: 'list' });
    if (!u.exercises.length) { el.append(h('div', { class: 'empty', text: 'No exercises in this unit.' })); return el; }
    for (const x of u.exercises) {
      const items = x.items || [];
      const done = items.filter((it) => (P.exercise(it.id) || {}).done).length;
      const right = items.filter((it) => (P.exercise(it.id) || {}).result === 'correct').length;
      el.append(h('a', { class: 'item', href: '#/exercise/' + x.id },
        h('div', { class: 't' }, h('b', { text: x.title }), h('small', { text: `${TYPE_LABEL[x.type] || x.type} · ${items.length} items` + (x.source && x.source !== (u.sources || [])[0] ? ' · ' + x.source.replace('.pdf', '') : '') }),
          h('div', { class: 'progress', style: { marginTop: '6px', width: '140px' } }, h('i', { class: done === items.length && items.length ? 'green' : '', style: { width: (items.length ? (done / items.length) * 100 : 0) + '%' } }))),
        done ? pill(`${right}/${done} right`, right === done ? 'pill-green' : '') : null,
        h('span', { class: 'arrow', text: '›' })));
    }
    return el;
  };

  Canto.views.exercise = (id) => {
    const x = D.byId.exercise[id];
    if (!x) return h('div', { class: 'empty', text: 'Exercise not found.' });
    const u = D.unit(x.unitId);
    const idx = u.exercises.indexOf(x);
    const prev = u.exercises[idx - 1], next = u.exercises[idx + 1];
    const wrap = h('div');
    wrap.append(h('div', { class: 'pagehead' },
      h('div', { class: 'eyebrow' }, h('a', { href: `#/unit/${u.id}/exercises`, text: `Unit ${u.number} · Exercises` })),
      h('h1', { text: x.title }),
      h('div', { class: 'sub' }, pill(TYPE_LABEL[x.type] || x.type), ' ', x.source ? h('span', { class: 'small muted', text: x.source }) : null),
      x.instructions ? h('p', { class: 'mt', text: x.instructions }) : null));

    let showAll = false;
    const card = h('div', { class: 'card' });
    const summary = h('div', { class: 'row between mb' });
    const list = h('div');
    card.append(summary, list);
    wrap.append(card);

    function render() {
      list.innerHTML = '';
      const items = x.items || [];
      let done = 0, right = 0;
      items.forEach((it, i) => {
        const saved = P.exercise(it.id) || { answer: '', result: null, done: false };
        if (saved.done) done++;
        if (saved.result === 'correct') right++;
        const hasKey = !!it.answer;
        const row = h('div', { class: 'xitem' + (saved.done ? ' done' : '') });
        row.append(h('div', { class: 'prompt' }, h('span', { class: 'muted small', text: (i + 1) + '. ' }), promptEl(it.prompt)));
        if (it.hint) row.append(h('div', { class: 'small muted', text: 'Hint: ' + it.hint }));
        const ta = h('textarea', { placeholder: x.type === 'listen' ? 'Optional note' : 'Your answer', style: { minHeight: '46px' } });
        ta.value = saved.answer || '';
        ta.addEventListener('input', () => P.setExercise(it.id, { answer: ta.value }));
        row.append(ta);
        const ansBox = h('div', { class: 'answer', hidden: !(showAll || saved.revealed) });
        if (hasKey) {
          ansBox.append(h('div', { class: 'row' }, h('span', { class: 'small muted', text: 'Answer' }), h('span', { class: 'small conf-' + (it.confidence || 'none'), text: it.confidence && it.confidence !== 'high' ? `(${it.confidence} confidence — not printed on the slides)` : '' })));
          ansBox.append(h('div', null, promptEl(it.answer)));
          if (it.answer_en) ansBox.append(h('div', { class: 'small muted', text: it.answer_en }));
        } else {
          ansBox.append(h('div', { class: 'small muted', text: 'No answer key for this one — check with your tutor.' }));
        }
        row.append(ansBox);
        const btns = h('div', { class: 'btngroup mt' });
        if (!(showAll || saved.revealed)) btns.append(h('button', { class: 'btn sm', text: hasKey ? 'Check' : 'Show notes', onClick: () => { P.setExercise(it.id, { revealed: true }); render(); } }));
        if (showAll || saved.revealed) {
          if (hasKey) {
            btns.append(h('button', { class: 'btn sm ' + (saved.result === 'correct' ? 'primary' : ''), text: '✓ Got it', onClick: () => { P.setExercise(it.id, { result: 'correct', done: true }); render(); } }),
              h('button', { class: 'btn sm ' + (saved.result === 'wrong' ? 'danger' : ''), text: '✗ Missed', onClick: () => { P.setExercise(it.id, { result: 'wrong', done: true }); render(); } }));
          } else {
            btns.append(h('button', { class: 'btn sm ' + (saved.done ? 'primary' : ''), text: saved.done ? 'Done' : 'Mark done', onClick: () => { P.setExercise(it.id, { done: !saved.done }); render(); } }));
          }
        }
        row.append(btns);
        list.append(row);
      });
      summary.innerHTML = '';
      summary.append(h('span', { class: 'small muted', text: `${done}/${items.length} done` + (done ? ` · ${right} right` : '') }),
        h('div', { class: 'btngroup' },
          h('button', { class: 'btn sm ghost', text: showAll ? 'Hide answers' : 'Show all answers', onClick: () => { showAll = !showAll; render(); } }),
          h('button', { class: 'btn sm ghost', text: 'Reset', onClick: async () => { if (await Canto.ui.confirmDlg('Clear your answers for this exercise?', { ok: 'Clear', danger: true })) { items.forEach((it) => { delete P.load().exercises[it.id]; }); P.save(); render(); } } })));
    }
    render();
    wrap.append(h('div', { class: 'row between mt' },
      prev ? h('a', { class: 'btn ghost', href: '#/exercise/' + prev.id, text: '‹ ' + prev.title }) : h('span'),
      next ? h('a', { class: 'btn ghost', href: '#/exercise/' + next.id, text: next.title + ' ›' }) : h('span')));
    return wrap;
  };

  // Prompts mix Jyutping and English; make Jyutping words tappable when they match vocabulary.
  function promptEl(text) {
    const s = String(text || '');
    if (/[a-z]+[1-6]/.test(s)) return Canto.views.tokenLine(s, 'jp');
    if (/[㐀-鿿]/.test(s)) return h('span', { class: 'zh' }, Canto.views.tokenLine(s, 'zh'));
    return h('span', { text: s });
  }
})();
