/* Tiny DOM helpers shared by every view. */
window.Canto = window.Canto || {};
Canto.views = Canto.views || {};

Canto.ui = (() => {
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  let toastTimer;
  function toast(msg, ms = 1800) {
    const root = document.getElementById('toast-root');
    const t = h('div', { class: 'toast', text: msg });
    root.append(t);
    setTimeout(() => t.remove(), ms);
  }

  function sheet(content, { onClose } = {}) {
    const root = document.getElementById('sheet-root');
    const box = h('div', { class: 'sheet' }, h('div', { class: 'handle' }), content);
    const back = h('div', { class: 'sheet-back' }, box);
    const close = () => { back.remove(); document.removeEventListener('keydown', esc1); onClose && onClose(); };
    const esc1 = (e) => { if (e.key === 'Escape') close(); };
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    document.addEventListener('keydown', esc1);
    root.append(back);
    return { close, el: box };
  }

  function confirmDlg(message, { ok = 'OK', danger = false } = {}) {
    return new Promise((resolve) => {
      const s = sheet(h('div', { class: 'stack' },
        h('p', { text: message }),
        h('div', { class: 'btngroup' },
          h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onClick: () => { s.close(); resolve(true); } }, ok),
          h('button', { class: 'btn ghost', onClick: () => { s.close(); resolve(false); } }, 'Cancel'))
      ), { onClose: () => resolve(false) });
    });
  }

  function chip(label, on, onToggle, extra = '') {
    const c = h('button', { class: 'chip ' + (on ? 'on ' : '') + extra, type: 'button', text: label });
    c.addEventListener('click', () => { c.classList.toggle('on'); onToggle && onToggle(c.classList.contains('on'), c); });
    return c;
  }

  function pill(text, kind = '') { return h('span', { class: 'pill ' + kind, text }); }

  // Render Jyutping with tone digits de-emphasised
  function jp(text, cls = 'jp') {
    const el = h('span', { class: cls });
    const re = /([a-zA-Z]+)([1-6])/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) el.append(text.slice(last, m.index));
      el.append(m[1], h('span', { class: 'tone', text: m[2] }));
      last = re.lastIndex;
    }
    if (last < text.length) el.append(text.slice(last));
    return el;
  }

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  return { h, append, esc, toast, sheet, confirmDlg, chip, pill, jp, today, addDays, shuffle };
})();
