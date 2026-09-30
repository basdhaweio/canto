/* Journey: the character sheet — level, title, streak, quests, unit epics, stats, achievements, activity. */
(() => {
  const { h, pill } = Canto.ui;
  const G = Canto.game;

  const bar = (pct, cls = '') => h('div', { class: 'progress ' + cls }, h('i', { style: { width: Math.round(Math.min(1, Math.max(0, pct)) * 100) + '%' } }));

  function questRow(q, xp) {
    return h('div', { class: 'qrow' + (q.met ? ' met' : '') },
      h('span', { class: 'qi', text: q.icon }),
      h('div', { class: 't' }, h('div', { text: q.label }), q.met ? null : bar(q.value / q.goal), q.note ? h('div', { class: 'tiny muted', text: q.note }) : null),
      h('span', { class: 'qv' }, q.met ? h('span', { class: 'tick', text: '✓' }) : h('span', { class: 'small muted', text: `${Math.min(q.value, q.goal)}/${q.goal}` }), h('span', { class: 'px', text: '+' + xp })));
  }

  // Compact card used on the home screen too.
  Canto.views.questsCard = (C, { title = "Today's quests", full = false } = {}) => {
    const box = h('div', { class: 'card' });
    const met = C.today.quests.filter((q) => q.met).length;
    box.append(h('div', { class: 'row between' }, h('h2', { text: title }), h('span', { class: 'small muted', text: `${met}/${C.today.quests.length}` + (C.today.perfect ? ' · perfect day ☀️' : ` · all four +${G.XP.perfectDay} bonus`) })));
    for (const q of C.today.quests) box.append(questRow(q, G.XP.daily));
    if (full && C.thisWeek) {
      box.append(h('div', { class: 'row between mt' }, h('h3', { text: 'This week' }), h('span', { class: 'small muted', text: `${C.thisWeek.met}/${C.thisWeek.list.length}` + (C.thisWeek.perfect ? ' · perfect week 🌟' : ` · all five +${G.XP.perfectWeek}`) })));
      for (const q of C.thisWeek.list) box.append(questRow(q, G.XP.weekly));
    }
    return box;
  };

  Canto.views.levelStrip = (C) => h('a', { class: 'lvlstrip', href: '#/journey' },
    h('div', { class: 'lvl-badge sm' }, h('small', { text: 'Lv' }), h('b', { text: String(C.level.level) })),
    h('div', { class: 'grow' },
      h('div', { class: 'row between small' }, h('span', null, h('b', { text: C.level.title.en }), ' ', h('span', { class: 'zh muted', text: C.level.title.zh })), h('span', { class: 'muted', text: `${C.level.into.toLocaleString()} / ${C.level.need.toLocaleString()} XP` })),
      h('div', { class: 'xpbar' }, h('i', { style: { width: C.level.pct * 100 + '%' } }))),
    h('div', { class: 'streakbox', title: 'Day streak' }, h('b', { text: '🔥 ' + C.streak.current }), h('small', { text: C.streak.freezes ? '❄️'.repeat(C.streak.freezes) : 'streak' })));

  Canto.views.journey = () => {
    const C = G.compute();
    const L = C.level;
    const wrap = h('div');

    wrap.append(h('div', { class: 'hero' }, h('div', { class: 'charsheet' },
      h('div', { class: 'lvl-badge' }, h('small', { text: 'Level' }), h('b', { text: String(L.level) })),
      h('div', null,
        h('div', { class: 'eyebrow' }, L.title.en + ' · ', h('span', { class: 'zh', text: L.title.zh })),
        h('h1', { text: 'Your Cantonese journey' }),
        h('div', { class: 'xpbar mt' }, h('i', { style: { width: L.pct * 100 + '%' } })),
        h('div', { class: 'row between small muted', style: { marginTop: '6px' } }, h('span', { text: `${L.into.toLocaleString()} / ${L.need.toLocaleString()} XP to level ${L.level + 1}` }), h('span', { text: `${C.total.toLocaleString()} total` })))),
      h('div', { class: 'grid mt', style: { gridTemplateColumns: 'repeat(3, 1fr)' } },
        h('div', { class: 'stat' }, h('b', { text: '🔥 ' + C.streak.current }), h('span', { text: 'day streak' })),
        h('div', { class: 'stat' }, h('b', { text: String(C.streak.best) }), h('span', { text: 'best streak' })),
        h('div', { class: 'stat' }, h('b', { text: C.streak.freezes ? '❄️'.repeat(C.streak.freezes) : '0' }), h('span', { text: 'freezes' }))),
      h('div', { class: 'tiny muted center', text: 'A day counts once you review or answer 10 cards, do 3 exercise items, practise a dialogue or have your lesson. Every 7 active days banks a freeze (max 2); a missed day spends one instead of breaking the streak.' })));

    wrap.append(h('div', { class: 'mt' }, Canto.views.questsCard(C, { full: true })));

    // Stats
    const stats = h('div', { class: 'card' });
    for (const s of Object.values(C.stats)) stats.append(h('div', { class: 'statrow' },
      h('span', { class: 'ic', text: s.icon }), h('div', { class: 'nm' }, s.name, ' ', h('span', { class: 'zh muted small', text: s.zh }), h('small', { text: s.desc })), bar(s.pct), h('span', { class: 'lv', text: 'Lv ' + s.level })));
    wrap.append(h('div', { class: 'section-title' }, h('h2', { text: 'Stats' }), h('span', { class: 'small muted', text: 'grow as cards mature' })), stats);

    // Unit epics
    const epics = h('div', { class: 'stack' });
    for (const e of C.epics) {
      const d = h('details', { class: 'quest card' + (e.complete ? ' complete' : '') });
      d.append(h('summary', null, h('span', { class: 'qi', text: e.complete ? '🏆' : e.icon }),
        h('div', { class: 't' }, h('b', { text: e.name }), h('div', { class: 'row small muted', style: { flexWrap: 'nowrap' } }, h('span', { text: e.complete ? 'Complete' : `${e.n} / ${e.steps.length} steps` }), h('div', { class: 'grow' }, bar(e.n / e.steps.length, 'green'))))));
      const body = h('div', { class: 'steps' });
      for (const s of e.steps) body.append(h('div', { class: 'qrow' + (s.done ? ' met' : '') },
        h('span', { class: 'qi', text: s.done ? '✓' : '·' }),
        h('div', { class: 't' }, h('div', { text: s.label }), s.done ? null : bar(s.value / s.goal)),
        h('span', { class: 'qv' }, s.done ? null : h('span', { class: 'small muted', text: `${Math.min(s.value, s.goal)}/${s.goal}` }), h('span', { class: 'px', text: '+' + s.xp }))));
      body.append(h('div', { class: 'btngroup mt' }, h('a', { class: 'btn sm', href: '#/unit/' + e.id, text: 'Open unit' }), h('a', { class: 'btn sm ghost', href: `#/quiz?unit=${e.id}`, text: 'Quiz this unit' })));
      d.append(body);
      epics.append(d);
    }
    wrap.append(h('div', { class: 'section-title' }, h('h2', { text: 'Unit epics' }), h('span', { class: 'small muted', text: `${C.epics.filter((e) => e.complete).length} / ${C.epics.length} complete` })), epics);

    // Achievements
    const got = C.achievements.filter((a) => a.unlocked).length;
    const seen = (Canto.progress.load().seen || {}).ach || {};
    const grid = h('div', { class: 'achs' });
    for (const a of C.achievements.slice().sort((x, y) => (y.unlocked - x.unlocked) || (y.pct - x.pct))) {
      grid.append(h('div', { class: 'ach ' + (a.unlocked ? 'got' : 'locked'), onClick: () => Canto.ui.sheet(h('div', { class: 'center' },
        h('div', { style: { fontSize: '3.2rem' }, text: a.icon }), h('h2', { text: a.name }), h('p', { class: 'muted', text: a.desc }),
        h('p', { class: 'mt', text: a.unlocked ? `Unlocked${seen[a.id] ? ' ' + seen[a.id] : ''} · +${a.xp} XP` : `${Math.min(a.value, a.gte).toLocaleString()} / ${a.gte.toLocaleString()} · +${a.xp} XP when unlocked` }))) },
        h('div', { class: 'ai', text: a.icon }), h('b', { text: a.name }), a.unlocked ? null : bar(a.pct)));
    }
    wrap.append(h('div', { class: 'section-title' }, h('h2', { text: 'Achievements' }), h('span', { class: 'small muted', text: `${got} / ${C.achievements.length}` })), grid);

    // Activity heatmap
    const levels = {};
    for (const [d, r] of Object.entries(C.days)) if (r.active) levels[d] = r.xp >= 400 ? 4 : r.xp >= 200 ? 3 : r.xp >= 80 ? 2 : 1;
    for (const d of C.streak.frozen) levels[d] = 'fr';
    wrap.append(h('div', { class: 'section-title' }, h('h2', { text: 'Activity' }), h('span', { class: 'small muted', text: 'last 18 weeks · blue = freeze used' })), h('div', { class: 'card' }, G.heatmap(levels, 18)));

    // Lifetime
    const T = C.T;
    const tt = (v, l) => h('div', { class: 'tt' }, h('b', { text: Number(v).toLocaleString() }), h('span', { text: l }));
    wrap.append(h('div', { class: 'section-title' }, h('h2', { text: 'Lifetime' }), h('span', { class: 'small muted', text: 'numbers only go up' })),
      h('div', { class: 'totals' }, tt(T.totalGraded, 'cards reviewed'), tt(T.wordsMet, `of ${T.wordsTotal} words met`), tt(T.mature, 'word cards mature'), tt(T.quizAns, 'quiz answers'),
        tt(T.toneTotal, 'answers with perfect tones'), tt(T.exDone, 'exercise items'), tt(T.dlgRuns, 'dialogue run-throughs'), tt(T.lessons, 'lessons'), tt(T.perfectDays, 'perfect days')));

    // XP sources
    const src = C.src;
    const rows = [['Studying (cards, quizzes, exercises, dialogues, lessons)', src.study], ['Daily & weekly quests', src.quests], ['Unit epic steps', src.epics], ['Achievements', src.achievements], ['Words learned before the game started', src.earlier]].filter(([, v]) => v);
    wrap.append(h('details', { class: 'card mt' }, h('summary', { text: 'Where your XP comes from' }),
      h('div', { class: 'mt' }, rows.map(([l, v]) => h('div', { class: 'row between small', style: { padding: '3px 0' } }, h('span', { text: l }), h('b', { text: v.toLocaleString() })))),
      h('div', { class: 'tiny muted mt', text: `Each card graded +${G.XP.grade}, each new word +${G.XP.learn}, quiz answers +${G.XP.quizRight} right / +${G.XP.quizClose} close / +${G.XP.quizWrong} for trying, perfect tones +${G.XP.tone}, exercise item +${G.XP.exercise}, dialogue run-through +${G.XP.dialogue}, lesson +${G.XP.lesson}. Level n needs 100 × (n−1)² XP, so early levels come fast and later ones take steady practice.` })));
    return wrap;
  };
})();
