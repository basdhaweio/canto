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
    // Flashcard decks (tutor's rule): only words from each unit's Vocabulary slides are word cards;
    // particles and verb endings get their own deck; Unit 0 and grammar-slide words are dictionary-only.
    for (const u of units()) for (const v of u.vocab) v.deck = deckOf(v, u);
    // Lookups list course words before Unit 0 drill words.
    const rank = (v) => (state.units[v.unitId].number === 0 ? 1 : 0);
    for (const m of [byJp, byZh]) for (const list of m.values()) list.sort((a, b) => rank(a) - rank(b));
    state.loaded = true;
    return state;
  }

  const VOCAB_SLIDE = /^(set|dialogue|vocabulary)/i;
  function deckOf(v, u) {
    if (!u.number) return null;
    if (v.fn) return 'particles';
    if (v.section === 'Numbers') return 'numbers';
    return VOCAB_SLIDE.test(v.section || '') ? 'vocab' : null;
  }

  // Example sentences for a particle/ending card: grammar examples and dialogue lines that use it,
  // preferring the grammar point that teaches it, then the same unit.
  const exCache = {};
  function examplesFor(v, n = 2) {
    if (exCache[v.id]) return exCache[v.id];
    const keys = jpVariants(v.jp);
    const esc = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Sentence-final particles only count at the end of a sentence; otherwise homophones creep in
    // (gaa3 the particle vs gaa3 the classifier for vehicles). Possessive ge3 and endings sit mid-sentence.
    const finalOnly = v.fn === 'particle' && !/possess/i.test(v.en);
    // Verb endings follow a verb, so they never start the sentence (keeps sing4 "become" apart from sing4 jat6 "always").
    const lead = v.fn === 'ending' ? ' ' : '(^| )';
    const res = keys.map((k) => new RegExp(lead + esc(k) + (finalOnly ? '$' : '( |$)')));
    const keySyl = new Set(keys.flatMap((k) => k.split(' ')));
    const hit = (jp) => {
      const s = normJp(jp);
      if (s.split(' ').every((t) => keySyl.has(t))) return false;   // the bare word itself, not an example
      // "Final" means the end of any sentence in the line, not only the end of the line.
      const parts = finalOnly ? String(jp).split(/[?.!？。！]+/).map(normJp).filter(Boolean) : [s];
      return parts.some((p) => res.some((r) => r.test(p)));
    };
    // Sources, best first: examples on the grammar slide that teaches it, then lines from the unit's own
    // dialogues. Other slides and other units' dialogues are only a last resort (homophones like
    // gu1 ze1 "aunt" or sing4 jat6 "always" would otherwise creep in).
    let cands = [];
    for (const u of units()) {
      if (!u.number) continue;
      const same = u.id === v.unitId;
      for (const g of u.grammar) {
        const about = [g.title, ...(g.tags || [])].join(' ').toLowerCase();
        const body = ' ' + normJp(g.body || '') + ' ';
        // A slide teaches the word if its title/tags name it, or (same unit only) its explanation does.
        const teaches = keys.some((k) => about.includes(k)) ? 2 : same && keys.some((k) => body.includes(' ' + k + ' ')) ? 1 : 0;
        for (const e of g.examples || []) if (e.jp && e.en && hit(e.jp)) cands.push({ e, score: teaches ? 10 + teaches + (same ? 1 : 0) : 0 });
      }
      for (const d of u.dialogues) for (const l of d.lines || []) if (l.jp && l.en && hit(l.jp)) cands.push({ e: l, score: same ? 5 : 0 });
    }
    if (cands.some((c) => c.score > 0)) cands = cands.filter((c) => c.score > 0);
    cands.sort((a, b) => b.score - a.score);
    const seen = new Set(), out = [];
    for (const c of cands) { const k = normJp(c.e.jp); if (seen.has(k)) continue; seen.add(k); out.push(c.e); if (out.length >= n) break; }
    return (exCache[v.id] = out);
  }

  function unit(id) { return state.units[id]; }
  function units() { return state.order.map((id) => state.units[id]); }
  function allVocab() { return units().flatMap((u) => u.vocab); }
  // Sections that contain word cards (used by the flashcard setup filter).
  function sections(unitIds) {
    const s = new Set();
    for (const u of units()) if (!unitIds || unitIds.includes(u.id)) for (const v of u.vocab) if (v.deck === 'vocab') s.add(v.section || 'Other');
    return [...s];
  }
  function hasCards(unitId) { return (state.units[unitId] || { vocab: [] }).vocab.some((v) => v.deck); }

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

  return { state, load, unit, units, allVocab, sections, hasCards, examplesFor, byId, tokenizeJp, tokenizeZh, lookupJp, lookupZh, search, normJp, normZh };
})();
