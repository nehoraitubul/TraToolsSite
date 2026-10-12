// TraToolsSite – סנכרון בין מכשירים. שומר את ה-localStorage של שלושת הדפים בגיליון Google (Apps Script, אותו URL של המעקב).
// הסיסמה לא יוצאת מהדפדפן: המפתח בשרת הוא SHA-256 של (שם משתמש + סיסמה).
(function () {
  const URL = (window.TRACK_URL || '').trim();
  const KEYS = ['tt-cp-v2', 'tt-sim-state-v1', 'cropOrder.v2', 'tt-transfers-v1'];
  const META = 'tt-sync-meta';
  let meta = { user: '', key: '', ts: {}, sig: {}, pending: [], last: 0 };
  try { const m = JSON.parse(localStorage.getItem(META) || 'null'); if (m && m.key) meta = Object.assign(meta, m); } catch (e) {}
  const saveMeta = () => { try { localStorage.setItem(META, JSON.stringify(meta)); } catch (e) {} };
  let status = { state: meta.key ? 'idle' : 'off', text: '', stale: false };
  let timer = null, inflight = false, booted = false; const early = new Set(), serverHas = new Set();   // שינויים לפני המשיכה הראשונה לא מקבלים חותמת זמן

  // ---- SHA-256 (קטן, בלי תלות ב-crypto.subtle כדי שיעבוד גם מקובץ מקומי)
  function sha256(str) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const bytes = new TextEncoder().encode(str); const l = bytes.length; const bl = l * 8;
    const n = (((l + 9) + 63) >> 6) << 6; const buf = new Uint8Array(n); buf.set(bytes); buf[l] = 0x80;
    const dv = new DataView(buf.buffer); dv.setUint32(n - 4, bl >>> 0); dv.setUint32(n - 8, Math.floor(bl / 4294967296));
    let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]; const W = new Uint32Array(64);
    const rotr = (x, k) => (x >>> k) | (x << (32 - k));
    for (let i = 0; i < n; i += 64) {
      for (let t = 0; t < 16; t++) W[t] = dv.getUint32(i + t * 4);
      for (let t = 16; t < 64; t++) { const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3), s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10); W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0; }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) { const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[t] + W[t]) >>> 0, S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) >>> 0; h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0; }
      H = H.map((v, k) => (v + [a, b, c, d, e, f, g, h][k]) >>> 0);
    }
    return H.map(v => v.toString(16).padStart(8, '0')).join('');
  }
  const sig = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36) + s.length; };

  // ---- שרת
  async function call(body) {
    if (!URL) throw new Error('no url');
    const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    const t = await r.text(); return JSON.parse(t);
  }
  function localItems(keys) { const items = {}; for (const k of keys) { const v = localStorage.getItem(k); if (v != null) items[k] = { ts: meta.ts[k] || 0, data: v }; } return items; }
  function applyServer(items, adopt) {   // מחיל פריטים שהשרת חדש בהם; מחזיר כמה הוחלו
    let n = 0;
    for (const k of KEYS) {
      const it = items && items[k]; if (!it || !it.data) continue;
      const lts = meta.ts[k] || 0;
      if (adopt || it.ts > lts) { if (localStorage.getItem(k) !== it.data) n++; localStorage.setItem(k, it.data); meta.ts[k] = it.ts; meta.sig[k] = sig(it.data); meta.pending = meta.pending.filter(x => x !== k); }
    }
    return n;
  }
  async function pull(adopt) {
    const res = await call({ op: 'get', key: meta.key });
    serverHas.clear(); for (const k in (res.items || {})) if (res.items[k] && res.items[k].data) serverHas.add(k);
    const n = applyServer(res.items, adopt);
    // מה שיש רק אצלנו (או חדש יותר אצלנו) – לדחוף
    for (const k of KEYS) {
      const v = localStorage.getItem(k); if (v == null) continue;
      const sts = res.items && res.items[k] ? (res.items[k].ts || 0) : 0, lts = meta.ts[k] || 0;
      if (adopt && sts) continue;                       // בכניסה החשבון קובע
      if (!sts || lts > sts) { if (!lts) meta.ts[k] = Date.now(); if (!meta.pending.includes(k)) meta.pending.push(k); }
    }
    saveMeta(); return n;
  }
  async function push() {
    if (inflight || !meta.key || !meta.pending.length) return;
    inflight = true; setStatus('saving');
    try {
      const keys = meta.pending.slice(); const items = localItems(keys);
      const res = await call({ op: 'put', key: meta.key, items });
      if (!res || !res.ok) throw new Error('bad');
      for (const k of keys) { if (!(res.newer && res.newer[k])) { meta.pending = meta.pending.filter(x => x !== k); meta.sig[k] = sig(items[k].data); } }
      if (res.newer && applyServer(res.newer) > 0) { status.stale = true; }
      meta.last = Date.now(); saveMeta(); setStatus('ok');
    } catch (e) { setStatus('error'); }
    finally { inflight = false; if (meta.pending.length && status.state !== 'error') schedule(); }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(push, 1500); }
  function boot() { booted = true; for (const k of early) if (!serverHas.has(k)) touch(k); early.clear(); }

  // ---- API לדפים
  function touch(key) {
    if (!meta.key || !KEYS.includes(key)) return;
    if (!booted) { early.add(key); return; }   // לפני שידענו מה יש בשרת: אם לשרת יש את המפתח – הוא קובע
    const v = localStorage.getItem(key); if (v == null) return;
    if (meta.sig[key] === sig(v)) return;   // לא השתנה באמת
    meta.ts[key] = Date.now(); if (!meta.pending.includes(key)) meta.pending.push(key); saveMeta(); setStatus('pending'); schedule();
  }
  async function login(user, pass) {
    user = (user || '').trim(); if (!user || !pass) throw new Error('חסר שם משתמש או סיסמה');
    const key = sha256('tt1:' + user.toLowerCase() + ':' + pass);
    meta = { user, key, ts: {}, sig: {}, pending: [], last: 0 }; saveMeta(); setStatus('saving');
    const n = await pull(true);   // כניסה = מאמצים את מצב החשבון; מה שאין בחשבון עולה מכאן
    boot(); await push(); meta.last = Date.now(); saveMeta(); setStatus('ok');
    if (n > 0) reloadSoon();
  }
  function logout() { localStorage.removeItem(META); meta = { user: '', key: '', ts: {}, sig: {}, pending: [], last: 0 }; setStatus('off'); }
  function reloadSoon() { try { sessionStorage.setItem('tt-sync-reload', String(Date.now())); } catch (e) {} location.reload(); }
  function canReload() { try { const t = +sessionStorage.getItem('tt-sync-reload') || 0; return Date.now() - t > 3000; } catch (e) { return true; } }

  // ---- סרגל
  const fmt = t => t ? new Date(t).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';
  function setStatus(s) { status.state = s; render(); }
  function render() {
    const el = document.getElementById('syncbar'); if (!el) return;
    if (!meta.key) {
      el.innerHTML = `<button type="button" class="syncbtn" id="syncOpen" title="שם משתמש וסיסמה – אותו מצב בטלפון ובמחשב">⇄ סנכרון בין מכשירים</button><form id="syncForm" class="syncform hidden"><input id="syncUser" placeholder="שם משתמש" autocomplete="username" dir="auto"><input id="syncPass" type="password" placeholder="סיסמה" autocomplete="current-password"><button type="submit">כניסה</button><span class="note" id="syncErr"></span><span class="note">אין הרשמה: כניסה ראשונה יוצרת את המשתמש. אין שחזור סיסמה.</span></form>`;
      el.querySelector('#syncOpen').addEventListener('click', () => { el.querySelector('#syncForm').classList.toggle('hidden'); el.querySelector('#syncUser').focus(); });
      el.querySelector('#syncForm').addEventListener('submit', async ev => { ev.preventDefault(); const err = el.querySelector('#syncErr'); err.textContent = 'מתחבר...'; try { await login(el.querySelector('#syncUser').value, el.querySelector('#syncPass').value); } catch (e) { err.textContent = 'לא הצלחתי להתחבר: ' + (e.message || e); setStatus('off'); } });
      return;
    }
    const map = { idle: '', saving: '⟳ שומר...', pending: '⟳', ok: '✓ ' + fmt(meta.last), error: '⚠ לא נשמר – ינסה שוב' };
    el.innerHTML = `<span class="syncstate ${status.state}">👤 ${meta.user.replace(/[<>&]/g, '')} <b>${map[status.state] || ''}</b></span>${status.stale ? `<button type="button" class="syncbtn warn" id="syncReload">עודכן ממכשיר אחר – רענן</button>` : ''}<button type="button" class="syncbtn" id="syncOut" title="יציאה (הנתונים נשארים במכשיר)">יציאה</button>`;
    const r = el.querySelector('#syncReload'); if (r) r.addEventListener('click', reloadSoon);
    el.querySelector('#syncOut').addEventListener('click', () => { if (meta.pending.length) push(); logout(); });
  }
  function css() {
    const s = document.createElement('style');
    s.textContent = `#syncbar{margin-inline-start:auto;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.85rem}#syncbar .syncbtn{font:inherit;font-size:.85rem;padding:5px 10px;border-radius:8px;border:1px solid var(--line,#ccc);background:var(--surface,#fff);color:inherit;cursor:pointer}#syncbar .syncbtn.warn{border-color:var(--warn,#a3332a);color:var(--warn,#a3332a);font-weight:700}#syncbar .syncform{display:flex;flex-wrap:wrap;gap:6px;align-items:center;width:100%}#syncbar .syncform input{font:inherit;font-size:.9rem;padding:5px 8px;border-radius:6px;border:1px solid var(--line,#ccc);background:var(--bg,#fff);color:inherit;width:9em}#syncbar .syncform button{font:inherit;padding:5px 10px;border-radius:8px;border:1px solid var(--accent,#2f5d9a);background:var(--accent,#2f5d9a);color:#fff;cursor:pointer}#syncbar .syncstate.error b{color:var(--warn,#a3332a)}#syncbar .syncstate.ok b{color:#2b7a3b}#syncbar .hidden{display:none!important}#syncbar .note{font-size:.78rem;color:var(--muted,#666)}`;
    document.head.appendChild(s);
  }

  async function start() {
    css(); render();
    if (!meta.key) return;
    try {
      setStatus('saving');
      const n = await pull(false); boot();
      if (n > 0 && canReload()) { reloadSoon(); return; }
      if (n > 0) status.stale = true;
      if (meta.pending.length) await push(); else { setStatus('ok'); }
    } catch (e) { boot(); setStatus('error'); }
  }
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !meta.key || inflight) return;
    try { const n = await pull(false); if (n > 0) { if (!meta.pending.length && canReload()) reloadSoon(); else { status.stale = true; render(); } } if (meta.pending.length) push(); } catch (e) {}
  });
  window.addEventListener('pagehide', () => {
    if (!meta.key || !meta.pending.length || !URL) return;
    try { navigator.sendBeacon(URL, new Blob([JSON.stringify({ op: 'put', key: meta.key, items: localItems(meta.pending) })], { type: 'text/plain;charset=utf-8' })); } catch (e) {}
  });
  window.TSync = { touch, login, logout, pull: () => pull(false), push, keys: KEYS, get user() { return meta.user; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
