/* Course content: loads data/index.json + unit files, builds lookup indices and the word tokenizer. */
window.Canto = window.Canto || {};

Canto.data = (() => {
  const state = { index: null, units: {}, order: [], syllabus: null, loaded: false };
  const byId = { vocab: {}, grammar: {}, example: {}, dialogue: {}, line: {}, exercise: {}, item: {}, note: {} };
  const byJp = new Map();   // normalised jyutping -> [vocab]
  const byZh = new Map();   // normalised characters -> [vocab]
  let maxJpLen = 1, maxZhLen = 1;

  const PUNCT = /[，。？！、：；,.?!:;"“”‘’()（）\[\]【】…]/g;

  function normJp(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' ');
  }
  function normZh(s) { return String(s || '').replace(PUNCT, '').replace(/\s+/g, '').trim(); }

  // Vocabulary entries can list variants: "ze1/zek1", "bin1 cyu3, bin1 dou6", "zan1 (hai6)", "taai3 … laa3 …"
  function jpVariants(jp) {
    const out = new Set();
    const base = String(jp || '');
    const noParen = base.replace(/[（(][^)）]*[)）]/g, ' ');
    const withParen = base.replace(/[（()）]/g, ' ');
    for (const s of [noParen, withParen]) {
      for (const part of s.split(/[\/,;]|…/)) {
        const n = normJp(part);
        if (n) out.add(n);
      }
    }
    if (base.includes('…')) {
      // slot patterns: also index the whole thing joined so "taai3 laa3" doesn't need to match
      const n = normJp(base.replace(/…/g, ' '));
      if (n) out.add(n);
    }
    return [...out];
  }
  function zhVariants(zh) {
    const out = new Set();
    const base = String(zh || '');
    for (const s of [base.replace(/[（(][^)）]*[)）]/g, ''), base.replace(/[（()）]/g, '')]) {
      for (const part of s.split(/[\/,，;；]|…/)) {
        const n = normZh(part);
        if (n) out.add(n);
      }
    }
    return [...out];
  }

  function indexVocab(v) {
    for (const k of jpVariants(v.jp)) {
      if (!byJp.has(k)) byJp.set(k, []);
      byJp.get(k).push(v);
      maxJpLen = Math.max(maxJpLen, k.split(' ').length);
    }
    for (const k of zhVariants(v.zh)) {
      if (!byZh.has(k)) byZh.set(k, []);
      byZh.get(k).push(v);
      maxZhLen = Math.max(maxZhLen, k.length);
    }
  }

  async function fetchJson(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(path + ': ' + res.status);
    return res.json();
  }

  async function load() {
    if (state.loaded) return state;
    const index = await fetchJson('./data/index.json');
    state.index = index;
    const results = await Promise.allSettled(index.units.map((u) => fetchJson('./data/' + u.file)));
    results.forEach((r, i) => {
      const meta = index.units[i];
      if (r.status !== 'fulfilled') { console.warn('unit missing', meta.id, r.reason); return; }
      const u = r.value;
      u.number = u.number ?? meta.number;
      u.title = u.title || meta.title;
      for (const k of ['vocab', 'dialogues', 'grammar', 'exercises', 'notes', 'goals', 'sources']) u[k] = u[k] || [];
      state.units[u.id] = u;
      state.order.push(u.id);
      for (const v of u.vocab) { v.unitId = u.id; byId.vocab[v.id] = v; indexVocab(v); }
      for (const d of u.dialogues) {
        d.unitId = u.id; byId.dialogue[d.id] = d;
        (d.lines || []).forEach((l, i) => { l.unitId = u.id; l.dialogueId = d.id; l.n = i + 1; byId.line[l.id] = l; });
      }
      for (const g of u.grammar) {
        g.unitId = u.id; byId.grammar[g.id] = g;
        (g.examples || []).forEach((e) => { e.unitId = u.id; e.grammarId = g.id; byId.example[e.id] = e; });
      }
      for (const x of u.exercises) {
        x.unitId = u.id; byId.exercise[x.id] = x;
        (x.items || []).forEach((it) => { it.unitId = u.id; it.exerciseId = x.id; byId.item[it.id] = it; });
      }
      for (const n of u.notes) { n.unitId = u.id; byId.note[n.id] = n; }
    });
    try { state.syllabus = await fetchJson('./data/' + (index.syllabus || 'syllabus.json')); } catch (e) { state.syllabus = null; }
    state.loaded = true;
    return state;
  }

  function unit(id) { return state.units[id]; }
  function units() { return state.order.map((id) => state.units[id]); }
  function allVocab() { return units().flatMap((u) => u.vocab); }
  function sections(unitIds) {
    const s = new Set();
    for (const u of units()) if (!unitIds || unitIds.includes(u.id)) for (const v of u.vocab) s.add(v.section || 'Other');
    return [...s];
  }

  // ---- Tokenizers ----
  // Split a Jyutping line into tokens, greedily matching vocabulary (longest first).
  function tokenizeJp(line) {
    const parts = String(line || '').match(/[A-Za-z]+[1-6]?|[^A-Za-z]+/g) || [];
    const out = [];
    let i = 0;
    while (i < parts.length) {
      const p = parts[i];
      if (!/^[A-Za-z]/.test(p)) { out.push({ text: p, sep: true }); i++; continue; }
      let matched = null, span = 0;
      for (let n = Math.min(maxJpLen, 6); n >= 1; n--) {
        const syls = [];
        let j = i, count = 0;
        while (j < parts.length && count < n) {
          if (/^[A-Za-z]/.test(parts[j])) { syls.push(parts[j].toLowerCase()); count++; }
          else if (!/^\s+$/.test(parts[j])) break; // only whitespace can sit inside a multi-syllable word
          j++;
        }
        if (count < n) continue;
        const key = syls.join(' ');
        if (byJp.has(key)) { matched = byJp.get(key); span = j - i; break; }
      }
      if (matched) {
        out.push({ text: parts.slice(i, i + span).join(''), vocab: matched });
        i += span;
      } else {
        out.push({ text: p, vocab: null });
        i++;
      }
    }
    return out;
  }

  function tokenizeZh(line) {
    const s = String(line || '');
    const out = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (PUNCT.test(ch) || /\s/.test(ch)) { PUNCT.lastIndex = 0; out.push({ text: ch, sep: true }); i++; continue; }
      PUNCT.lastIndex = 0;
      let matched = null, span = 0;
      for (let n = Math.min(maxZhLen, 8); n >= 1; n--) {
        const key = s.slice(i, i + n);
        if (key.length === n && byZh.has(key)) { matched = byZh.get(key); span = n; break; }
      }
      if (matched) { out.push({ text: s.slice(i, i + span), vocab: matched }); i += span; }
      else { out.push({ text: ch, vocab: null }); i++; }
    }
    return out;
  }

  function lookupJp(text) { return byJp.get(normJp(text)) || []; }
  function lookupZh(text) { return byZh.get(normZh(text)) || []; }

  // Free-text search across characters, jyutping (tone digits optional) and English.
  function search(q, { unitIds } = {}) {
    q = String(q || '').trim();
    if (!q) return [];
    const ql = q.toLowerCase();
    const qJpNoTone = ql.replace(/[1-6]/g, '');
    const hasTone = /[1-6]/.test(ql);
    const results = [];
    for (const v of allVocab()) {
      if (unitIds && !unitIds.includes(v.unitId)) continue;
      let score = 0;
      const jp = (v.jp || '').toLowerCase();
      const jpNoTone = jp.replace(/[1-6]/g, '');
      if (v.zh && v.zh.includes(q)) score = 100 - (v.zh.length - q.length);
      else if (jp === ql) score = 95;
      else if (hasTone ? jp.includes(ql) : jpNoTone.includes(qJpNoTone)) score = 80 - Math.min(20, jp.length - ql.length);
      else if ((v.en || '').toLowerCase().includes(ql)) score = 60 - Math.min(20, Math.abs(v.en.length - q.length) / 3);
      if (score > 0) results.push({ v, score });
    }
    return results.sort((a, b) => b.score - a.score).map((r) => r.v);
  }

  return { state, load, unit, units, allVocab, sections, byId, tokenizeJp, tokenizeZh, lookupJp, lookupZh, search, normJp, normZh };
})();
