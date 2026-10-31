// TraToolsSite – header.js: פרסר (TImport), קישור לתוסף, סרגל האתר. נטען בכל הדפים לפני sync.js
// Travian paste importer: recognises pasted page HTML / text and extracts the village state.
// Plain script (no modules) so it can be inlined in the tool page and tested in Node.
(function (root) {
  const GID = { 1: 'woodcutter', 2: 'claypit', 3: 'ironmine', 4: 'cropland', 5: 'sawmill', 6: 'brickyard', 7: 'iron_foundry', 8: 'grain_mill', 9: 'bakery',
    10: 'warehouse', 11: 'granary', 12: 'smithy', 13: 'smithy', 14: 'tournament_square', 15: 'main_building', 16: 'rally_point', 17: 'marketplace', 18: 'embassy',
    19: 'barracks', 20: 'stable', 21: 'workshop', 22: 'academy', 23: 'cranny', 24: 'town_hall', 25: 'residence', 26: 'palace', 27: 'treasury', 28: 'trade_office',
    29: 'great_barracks', 30: 'great_stable', 31: 'city_wall', 32: 'earth_wall', 33: 'palisade', 34: 'stonemason', 35: 'brewery', 36: 'trapper', 37: 'hero_mansion',
    38: 'great_warehouse', 39: 'great_granary', 40: 'world_wonder', 41: 'horse_drinking_trough', 42: 'stone_wall', 43: 'makeshift_wall', 44: 'command_center', 45: 'waterworks', 46: 'hospital' };
  const TRIBE = { 1: 'romans', 2: 'teutons', 3: 'gauls', 6: 'egyptians', 7: 'huns' };
  // Hebrew building names as the game prints them (dorf2 data-name / queue), mapped to DB keys
  const HE = { 'מבנה מרכזי': 'main_building', 'בניין מרכזי': 'main_building', 'מחסן': 'warehouse', 'אסם': 'granary', 'שוק': 'marketplace', 'שגרירות': 'embassy',
    'מגורי חיילים': 'barracks', 'קסרקטין': 'barracks', 'אורווה': 'stable', 'סדנה': 'workshop', 'אקדמיה': 'academy', 'נפחייה': 'smithy', 'בניין העיריה': 'town_hall', 'עירייה': 'town_hall',
    'מגורים מלכותיים': 'residence', 'ארמון': 'palace', 'נקודת מפגש': 'rally_point', 'נקיק': 'cranny', 'חומת העיר': 'city_wall', 'חומה': 'city_wall', 'סוללת עפר': 'earth_wall', 'גדר': 'palisade',
    'טחנת דגן': 'grain_mill', 'טחנת קמח': 'grain_mill', 'מנסרה': 'sawmill', 'מפעל לבנים': 'brickyard', 'מפעל ברזל': 'iron_foundry', 'יציקת ברזל': 'iron_foundry', 'מאפייה': 'bakery',
    'אחוזת הגיבור': 'hero_mansion', 'מלכודות': 'trapper', 'סתת': 'stonemason', 'משרד סחר': 'trade_office', 'כיכר טורנירים': 'tournament_square', 'בית חולים': 'hospital', 'מגדל שמירה': 'watchtower',
    'יער': 'woodcutter', 'חוטב עצים': 'woodcutter', 'בור חמר': 'claypit', 'בור חימר': 'claypit', 'מכרה ברזל': 'ironmine', 'שדה יבול': 'cropland', 'חווה': 'cropland' };
  const BIDI = /[‎‏‪-‮⁦-⁩ ]/g;
  const clean = s => (s || '').replace(BIDI, '');
  const num = s => { const t = clean(String(s)).replace(/[.,\s]/g, '').replace(/[−–]/g, '-'); const v = parseInt(t, 10); return isNaN(v) ? null : v; };
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', minus: '−', shy: '' };
  const unent = h => (h || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => { if (e[0] === '#') { const c = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isNaN(c) ? m : String.fromCodePoint(c); } return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m; });
  // raw page HTML (from a HAR) -> the text a Ctrl+A copy would give, roughly: block tags become newlines
  const imgAlt = h => h.replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/gi, ' $1 ');   // icons carry their meaning in alt (status, loot x/y)
  const cellText = c => clean(unent(imgAlt(c).replace(/<script[\s\S]*?<\/script\s*>/gi, ' ').replace(/<svg[\s\S]*?<\/svg\s*>/gi, ' ').replace(/<[^>]+>/g, ' '))).replace(/\s+/g, ' ').trim();
  const htmlToText = h => {
    let x = imgAlt(h).replace(/<script[\s\S]*?<\/script\s*>/gi, ' ').replace(/<style[\s\S]*?<\/style\s*>/gi, ' ').replace(/<svg[\s\S]*?<\/svg\s*>/gi, ' ');
    // table rows -> one line per row, cells separated by tabs (what a Ctrl+A copy gives)
    x = x.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi, (m, row) => { const cells = []; const re = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi; let c; while ((c = re.exec(row))) cells.push(cellText(c[1])); return '\n' + cells.join('\t') + '\n'; });
    x = x.replace(/<\/(div|p|li|h\d|table|thead|tbody|section|article|ul|ol)\s*>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ');
    return clean(unent(x)).replace(/[ \t]*\n[ \t]*/g, '\n').replace(/[ ]{2,}/g, ' ').replace(/\n{2,}/g, '\n');
  };
  const stripTags = h => clean(h.replace(/<script[\s\S]*?<\/script\s*>/gi, ' ').replace(/<style[\s\S]*?<\/style\s*>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ');

  function detect(text) {
    const t = clean(text);
    if (/id="resourceFieldContainer"/.test(t)) return 'dorf1';
    if (/id="villageContent"/.test(t) && /buildingSlot/.test(t)) return 'dorf2';
    if (/<html|<body/i.test(t)) {   // a raw page from a HAR: decide by the text it renders to
      const x = htmlToText(t);
      if (/נ\.ת\/יום/.test(x)) return 'cp_html';
      if (/חיילים שלך/.test(x) || /כוחות בכפרים/.test(x)) return 'troops_html';
      if (/בוזז את/.test(x) || /דוח הרפתקה/.test(x)) return 'reports_html';
      if (/labelLayer/.test(t)) return 'html-unknown';
    }
    if (/מיומנויות/.test(t) && /נסיון/.test(t)) return 'hero_attr';
    if (/מסחר בפריטים/.test(t) && /מלאי/.test(t)) return 'hero_inv';
    if (/נ\.ת\/יום/.test(t)) return 'cp';
    if (/חיילים שלך/.test(t) || /כוחות בכפרים/.test(t)) return 'troops';
    if (/בוזז את/.test(t) || /דוח הרפתקה/.test(t)) return 'reports';
    if (/ייצור לשעה/.test(t) && /זמן שרת/.test(t)) return 'dorf1_text';
    return 'unknown';
  }

  function serverInfo(text) {
    const out = {};
    const m = clean(text).replace(/&nbsp;/g, ' ').match(/זמן שרת:?\s*(?:<[^>]*>\s*)*(\d{1,2}):(\d{2})(?::(\d{2}))?[^(]*\(UTC\s*([+-−]\s*\d{1,2}):(\d{2})\)/);
    if (m) { out.serverClock = `${m[1]}:${m[2]}`; out.utcOffsetH = (m[4].replace(/[−\s]/g, '-').startsWith('-') ? -1 : 1) * (Math.abs(parseInt(m[4].replace(/[^\d]/g, ''), 10)) + parseInt(m[5], 10) / 60); }
    const ts = text.match(/id="servertime"[\s\S]{0,300}?value="(\d{9,11})"/);
    if (ts) out.serverEpoch = parseInt(ts[1], 10);
    return out;
  }

  // sidebar village list: [{did, name, active, x, y}] + activeDid
  function parseVillages(html) {
    const out = { villages: [], activeDid: null };
    const re = /<div class="listEntry village( active)?" data-did="(\d+)"/g; let m;
    while ((m = re.exec(html))) {
      const seg = clean(unent(html.slice(m.index, m.index + 2500)));
      const n = seg.match(/class="name"[^>]*>([^<]+)</);
      const x = seg.match(/coordinateX"[^>]*>[^\d−-]*([−-]?\d+)/), y = seg.match(/coordinateY"[^>]*>[^\d−-]*([−-]?\d+)/);
      const v = { did: m[2], name: n ? clean(n[1]).trim() : m[2], active: !!m[1] };
      if (x && y) { v.x = parseInt(x[1].replace('−', '-'), 10); v.y = parseInt(y[1].replace('−', '-'), 10); }
      if (!out.villages.some(o => o.did === v.did)) out.villages.push(v);
      if (v.active) out.activeDid = v.did;
    }
    return out;
  }

  function parseDorf1(html) {
    const out = { type: 'dorf1', fields: [], stock: null, cap: null, queue: [] };
    const re = /<a[^>]*href="\/?build\.php\?id=(\d+)"[^>]*data-aid="(\d+)"[^>]*data-gid="(\d)"[^>]*>\s*<div class="labelLayer">\s*(\d+)\s*<\/div>/g;
    let m;
    while ((m = re.exec(html))) out.fields.push({ slot: +m[2], gid: +m[3], t: +m[3] - 1, l: +m[4] });
    out.fields.sort((a, b) => a.slot - b.slot);
    const tr = html.match(/resourceFieldContainer"[^>]*class="[^"]*tribe(\d)/); if (tr) out.tribe = TRIBE[+tr[1]] || null;
    Object.assign(out, parseResourcesBlock(html));   // raw page: var resources = {production, storage, maxStorage}
    const st = {};
    for (let i = 1; i <= 4; i++) { const r = html.match(new RegExp(`id="l${i}"[^>]*>\\s*([^<]+)<`)); if (r) st[i - 1] = num(unent(r[1])); }
    if (!out.stock && Object.keys(st).length === 4 && st[0] != null) out.stock = [st[0], st[1], st[2], st[3]];
    const wc = html.match(/class="warehouse">[\s\S]*?class="value">\s*([^<]+)/), gc = html.match(/class="granary">[\s\S]*?class="value">\s*([^<]+)/);
    if (!out.cap && wc && gc) out.cap = { W: num(unent(wc[1])), G: num(unent(gc[1])) };
    const fc = html.match(/id="stockBarFreeCrop"[^>]*>\s*([^<]+)/); if (out.freeCrop == null && fc) out.freeCrop = num(unent(fc[1]));
    const pi = out.prod ? -1 : html.indexOf('id="production"');
    if (pi >= 0) { const seg = html.slice(pi, pi + 8000); const pr = []; for (let i = 1; i <= 4; i++) { const r = seg.match(new RegExp(`<i class="r${i}"[\\s\\S]*?class="num"[^>]*>\\s*([^<]+)<`)); pr.push(r ? num(r[1]) : null); } if (pr.every(v => v != null)) out.prod = pr; }
    out.queue = parseQueue(html);
    const ti = html.indexOf('id="troops"');   // הכוחות בכפר (כולל חיות שנתפסו u31..u40): {uN: count}
    if (ti >= 0) { const seg = html.slice(ti, html.indexOf('</table>', ti) + 8); const troops = {}; const tre = /class="unit u(\d+)"[\s\S]*?class="num"[^>]*>\s*([\d.,\u202a-\u202e]+)/g; let t; while ((t = tre.exec(seg))) troops['u' + t[1]] = (troops['u' + t[1]] || 0) + num(unent(t[2])); out.troops = troops; }
    Object.assign(out, serverInfo(html));
    const vn = html.match(/class="listEntry village active"[\s\S]*?class="name"[^>]*>([^<]+)</) || html.match(/id="villageNameField"[^>]*>\s*([^<]+)/);
    if (vn) out.villageName = clean(vn[1]).trim();
    Object.assign(out, parseVillages(html));
    return out;
  }

  function parseResourcesBlock(html) {
    const m = html.match(/var resources\s*=\s*\{([\s\S]*?)\};/); if (!m) return {};
    const g = k => { const r = m[1].match(new RegExp(k + '\\s*:\\s*(\\{[^}]*\\})')); if (!r) return null; try { const o = JSON.parse(r[1]); return [o.l1, o.l2, o.l3, o.l4].map(v => v == null ? null : +v).concat(o.l5 != null ? [+o.l5] : []); } catch (e) { return null; } };
    const p = g('production'), s = g('storage'), x = g('maxStorage'); const out = {};
    if (p) { out.prod = p.slice(0, 4); if (p.length > 4) out.freeCrop = p[4]; }
    if (s) out.stock = s.slice(0, 4);
    if (x) out.cap = { W: x[0], G: x[3] };
    return out;
  }

  function parseQueue(html) {
    const q = [];
    const i = html.indexOf('buildingList'); if (i < 0) return q;
    const seg = html.slice(i, i + 6000);
    const re = /<li[^>]*>([\s\S]*?)<\/li>/g; let m;
    while ((m = re.exec(seg))) {
      const txt = stripTags(m[1]);
      const lv = txt.match(/רמה\s*(\d+)/) || txt.match(/[Ll]evel\s*(\d+)/);
      const tm = m[1].match(/class="timer"[^>]*value="(\d+)"/);
      let key = null; for (const k in HE) if (txt.includes(k) && (!key || k.length > key.length)) key = k;
      q.push({ name: txt.trim().slice(0, 40), key: key ? HE[key] : null, level: lv ? +lv[1] : null, secondsLeft: tm ? +tm[1] : null });
    }
    return q;
  }

  function parseDorf2(html) {
    const out = { type: 'dorf2', buildings: {}, crannies: [], slots: [], queue: [] };
    const re = /<div class="buildingSlot ([^"]*)"[^>]*data-aid="(\d+)"[^>]*data-gid="(\d+)"(?:[^>]*data-name="([^"]*)")?[^>]*>/g;
    let m; const seen = new Set();
    while ((m = re.exec(html))) {
      const aid = +m[2], gid = +m[3]; if (seen.has(aid)) continue; seen.add(aid);
      if (gid === 0) continue;
      const nxt = html.indexOf('<div class="buildingSlot', m.index + 10); const seg = html.slice(m.index, nxt > 0 ? Math.min(nxt, m.index + 6000) : m.index + 6000);
      const lv = seg.match(/data-level="(\d+)"/) || seg.match(/labelLayer">\s*(\d+)/);
      const level = lv ? +lv[1] : 0;
      const key = GID[gid] || null;
      out.slots.push({ aid, gid, key, name: clean(m[4] || ''), level });
      if (!key) continue;
      if (key === 'cranny') out.crannies.push(level);
      else out.buildings[key] = Math.max(out.buildings[key] || 0, level);
    }
    const tr = html.match(/buildingSlot [^"]*\b(roman|teuton|gaul|egyptian|hun)\b/); if (tr) out.tribe = { roman: 'romans', teuton: 'teutons', gaul: 'gauls', egyptian: 'egyptians', hun: 'huns' }[tr[1]];
    Object.assign(out, parseResourcesBlock(html));
    const st = {}; for (let i = 1; i <= 4; i++) { const r = html.match(new RegExp(`id="l${i}"[^>]*>\\s*([^<]+)<`)); if (r) st[i - 1] = num(unent(r[1])); }
    if (!out.stock && Object.keys(st).length === 4 && st[0] != null) out.stock = [st[0], st[1], st[2], st[3]];
    out.queue = parseQueue(html);
    const ti = html.indexOf('id="troops"');   // הכוחות בכפר (כולל חיות שנתפסו u31..u40): {uN: count}
    if (ti >= 0) { const seg = html.slice(ti, html.indexOf('</table>', ti) + 8); const troops = {}; const tre = /class="unit u(\d+)"[\s\S]*?class="num"[^>]*>\s*([\d.,\u202a-\u202e]+)/g; let t; while ((t = tre.exec(seg))) troops['u' + t[1]] = (troops['u' + t[1]] || 0) + num(unent(t[2])); out.troops = troops; }
    Object.assign(out, serverInfo(html));
    const vn = html.match(/class="listEntry village active"[\s\S]*?class="name"[^>]*>([^<]+)</); if (vn) out.villageName = clean(vn[1]).trim();
    Object.assign(out, parseVillages(html));
    return out;
  }

  function parseHeroAttr(text) {
    const t = clean(text).replace(/\r/g, '');
    const out = { type: 'hero_attr' };
    const lv = t.match(/שלב\s*(\d+)/); if (lv) out.level = +lv[1];
    const xp = t.match(/נסיון\s*\n\s*([\d.,]+)/); if (xp) out.xp = num(xp[1]);
    const pts = t.match(/מיומנויות[\s\S]*?משאבים\s*\n\s*(\d+)/); if (pts) out.pointsRes = +pts[1];
    const fs = t.match(/כוח לחימה\s*\n\s*([\d.,]+)/); if (fs) out.fighting = num(fs[1]);
    const hp = t.match(/חיים\s*\n\s*(\d+)\s*%/); if (hp) out.health = +hp[1];
    Object.assign(out, serverInfo(text));
    return out;
  }

  function parseHeroInv(text) {
    const t = clean(text).replace(/\r/g, '');
    const out = { type: 'hero_inv' };
    const i = t.indexOf('מסחר בפריטים');
    if (i >= 0) {
      const nums = t.slice(i).split('\n').map(s => s.trim()).filter(s => /^\d[\d.,]*$/.test(s)).slice(0, 4).map(num);
      if (nums.length === 4) out.bag = nums;
    }
    const lv = t.match(/שלב\s*(\d+)/); if (lv) out.level = +lv[1];
    return out;
  }

  function parseCp(text) {
    const t = clean(text).replace(/\r/g, '');
    const out = { type: 'cp', villages: [] };
    const re = /^(.+?)\t([\d.,]+)\t([^\t]*)\t[^\t]*\t([^\n]*)$/gm; let m;
    while ((m = re.exec(t))) {
      const name = m[1].trim(); if (name === 'כפר') continue;
      const cel = m[3].trim(); const cm = cel.match(/(\d+):(\d{2}):(\d{2})/);
      const row = { name, cpPerDay: num(m[2]), celebrationLeftH: cm ? (+cm[1] + cm[2] / 60 + cm[3] / 3600) : 0 };
      if (name === 'סכום') out.totalCpPerDay = row.cpPerDay; else out.villages.push(row);
    }
    const ns = t.match(/ב-(\d{2})\.(\d{2})\.(\d{2}),\s*(\d{1,2}):(\d{2})/);
    if (ns) out.nextSlot = { d: +ns[1], m: +ns[2], y: 2000 + +ns[3], hh: +ns[4], mm: +ns[5] };
    const vc = t.match(/כפרים:\s*(\d+)\s*\/\s*(\d+)/); if (vc) { out.villagesOwned = +vc[1]; out.villageSlots = +vc[2]; }
    Object.assign(out, serverInfo(text));
    return out;
  }

  function parseTroops(text) {
    const t = clean(text).replace(/\r/g, '');
    const out = { type: 'troops', villages: [] };
    const lines = t.split('\n');
    const hi = lines.findIndex(l => /^כפר\t/.test(l));
    if (hi >= 0) {
      out.unitNames = lines[hi].split('\t').slice(1);
      for (let i = hi + 1; i < lines.length; i++) {
        const cells = lines[i].split('\t'); if (cells.length < 3) break;
        const counts = cells.slice(1).map(num);
        if (cells[0] === 'סכום') out.total = counts; else out.villages.push({ name: cells[0].trim(), counts });
      }
    }
    Object.assign(out, serverInfo(text));
    return out;
  }

  // reports list: raids "x/y" per line, dated; returns per-village loot stats for the last 24h and overall fill
  function parseReports(text, nowClock) {
    const t = clean(text).replace(/\r/g, '');
    const lines = t.split('\n').map(s => s.trim());
    const out = { type: 'reports', raids: [] };
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!/ניצחון|נצחון/.test(l)) continue;
      // pasted text: status line, then "village בוזז את ...", then the time. Raw HTML row: all in one line, cells tab-separated.
      const sameLine = /\s(?:בוזז|תקף)\s/.test(l); const parts = l.split('\t');
      const m = (sameLine ? l : l).match(/(\d+)\/(\d+)/);
      const who = sameLine ? l : (lines[i + 1] || '');
      const when = sameLine ? (parts.length > 1 ? parts[parts.length - 1].trim() : (lines[i + 1] || '')) : (lines[i + 2] || '');
      let village = '?'; const k = who.search(/\s(?:בוזז|תקף)\s/);
      if (k > 0) { let pre = who.slice(0, k).split('\t').pop(); if (sameLine) pre = pre.replace(/^.*(?:\d+\/\d+|אבידות|נקרא)\s*/, ''); village = pre.trim() || '?'; }
      const r = { village, loot: m ? +m[1] : null, cap: m ? +m[2] : null, when: when, losses: /עם אבידות/.test(l) };
      r.ageH = ageHours(when, nowClock);
      out.raids.push(r);
    }
    const byV = {};
    for (const r of out.raids) {
      const v = byV[r.village] = byV[r.village] || { raids: 0, withNumbers: 0, loot: 0, cap: 0, loot24: 0, raids24: 0 };
      v.raids++;
      if (r.loot != null) { v.withNumbers++; v.loot += r.loot; v.cap += r.cap; if (r.ageH != null && r.ageH <= 24) { v.loot24 += r.loot; v.raids24++; } }
    }
    for (const k in byV) { const v = byV[k]; v.fill = v.cap ? v.loot / v.cap : null; v.lootPerHour24 = v.loot24 / 24; }
    out.byVillage = byV;
    return out;
  }
  // "היום, 18:12" / "אתמול, 23:01" / "שלשום, 09:00" / "08.10.26, 22:42" -> hours before now (server clock HH:MM)
  function ageHours(when, nowClock) {
    const m = when.match(/(\d{1,2}):(\d{2})/); if (!m) return null;
    const hm = +m[1] + m[2] / 60;
    const now = nowClock ? (+nowClock.split(':')[0] + (+nowClock.split(':')[1]) / 60) : 24;
    let days = null;
    if (/היום/.test(when)) days = 0; else if (/אתמול/.test(when)) days = 1; else if (/שלשום/.test(when)) days = 2;
    else { const d = when.match(/(\d{2})\.(\d{2})\.(\d{2})/); if (d) days = 3; }  // dated = at least 3 days ago on this list
    if (days === null) return null;
    return days * 24 + (now - hm);
  }

  function parse(text) {
    const kind = detect(text);
    switch (kind) {
      case 'dorf1': return parseDorf1(text);
      case 'dorf2': return parseDorf2(text);
      case 'hero_attr': return parseHeroAttr(text);
      case 'hero_inv': return parseHeroInv(text);
      case 'cp': return parseCp(text);
      case 'cp_html': return parseCp(htmlToText(text));
      case 'troops_html': return parseTroops(htmlToText(text));
      case 'reports_html': { const x = htmlToText(text); const si = serverInfo(text); return Object.assign(parseReports(x, si.serverClock), si); }
      case 'troops': return parseTroops(text);
      case 'reports': { const si = serverInfo(text); return Object.assign(parseReports(text, si.serverClock), si); }
      default: return { type: kind };
    }
  }

  // split one big paste into page chunks (the user may paste several pages at once)
  function parseAll(text) {
    const chunks = [];
    // HTML documents
    const htmlRe = /(?:<!DOCTYPE html[^>]*>\s*)?<html[\s\S]*?<\/html\s*>/gi; let m; let rest = text;
    while ((m = htmlRe.exec(text))) { chunks.push(m[0]); }
    rest = text.replace(htmlRe, '\n');
    // text pages: split on the "Privacy settings" / top-bar repeats or on "זמן שרת" headers
    const parts = rest.split(/\n(?=Privacy settings|‭?\d{3}‬?\n‭?[\d.]+‬?\n‭?[\d.]+‬?\n)/).map(s => s.trim()).filter(s => s.length > 20);
    for (const p of parts) chunks.push(p);
    return chunks.map(parse).filter(r => r.type !== 'unknown');
  }

  // ---------- HAR (DevTools export): pages + map tiles + map symbols, newest first per village
  const ANIMAL = { 31: 'rat', 32: 'spider', 33: 'snake', 34: 'bat', 35: 'boar', 36: 'wolf', 37: 'bear', 38: 'crocodile', 39: 'tiger', 40: 'elephant' };
  function parseMapTile(x) {
    const t = clean(unent(x.text || '')), ti = x.title || '';
    const o = { x: x.position.x, y: x.position.y, did: x.did, uid: x.uid, aid: x.aid };
    const ks = ti.match(/\{k\.(\w+)\}/g) ? ti.match(/\{k\.(\w+)\}/g).map(k => k.slice(3, -1)) : [];
    if (!ks.length) { o.kind = 'nature'; o.nature = clean(unent(ti)).trim(); }
    else if (ks[0] === 'vt') { o.kind = 'valley'; o.vtype = ks[1] || null; }
    else if (ks[0] === 'dt') { o.kind = 'village'; o.name = clean(unent(ti)).replace('{k.dt}', '').trim(); }
    else if (ks[0] === 'fo') o.kind = 'oasis_free';
    else if (ks[0] === 'bt') o.kind = 'oasis_taken';
    else o.kind = ks[0];
    o.bonus = []; let m; const bre = /\{a:r(\d)\}\s*\{a\.r\d\}\s*(\d+)%/g; while ((m = bre.exec(t))) o.bonus.push({ r: +m[1], pct: +m[2] });
    o.animals = {}; const are = /unit u(\d+)"><\/i><span class="value[^"]*">(\d+)</g; while ((m = are.exec(t))) o.animals[ANIMAL[+m[1]] || ('u' + m[1])] = +m[2];
    m = t.match(/\{k\.spieler\}\s*([^<\n]+?)\s*(?:<|\{|$)/); if (m) o.player = m[1].trim();
    m = t.match(/\{k\.einwohner\}\s*(\d+)/); if (m) o.pop = +m[1];
    m = t.match(/\{k\.allianz\}\s*([^<\n{]*)/); if (m) o.alliance = m[1].trim();
    m = t.match(/\{a\.v(\d)\}/); if (m) o.tribe = TRIBE[+m[1]] || +m[1];
    m = t.match(/\{b:ri1\}\s*([^<{]+?)\s*\{b\.ri1\}/); if (m) o.lastRaid = m[1].trim();
    return o;
  }

  // HAR חתוך (ייצוא שנקטע / קובץ ענק): סורקים רשומה-רשומה ומוותרים רק על האחרונה השבורה
  function salvageHar(txt) {
    const i = txt.indexOf('"entries"'); if (i < 0) return null;
    let n = txt.indexOf('[', i); if (n < 0) return null; n++;
    const entries = []; const L = txt.length; let broken = 0;
    while (n < L) {
      while (n < L && (txt[n] === ' ' || txt[n] === ',' || txt[n] === '\n' || txt[n] === '\r' || txt[n] === '\t')) n++;
      if (txt[n] !== '{') break;
      let depth = 0, j = n, inStr = false;
      for (; j < L; j++) { const c = txt[j]; if (inStr) { if (c === '\\') { j++; continue; } if (c === '"') inStr = false; } else if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { j++; break; } } }
      if (depth !== 0) { broken++; break; }
      try { entries.push(JSON.parse(txt.slice(n, j))); } catch (e) { broken++; }
      n = j;
    }
    if (!entries.length) return null;
    return { har: { log: { entries } }, entries: entries.length, broken };
  }

  function parseHar(har) {
    const entries = (har && har.log && har.log.entries) || [];
    const out = { type: 'har', pages: [], tiles: {}, symbols: [], errors: [] };
    const latest = {};   // one result per (type, village): the newest
    for (const e of entries) {
      try {
        const url = e.request.url || ''; const c = e.response && e.response.content || {}; const mime = (c.mimeType || '').split(';')[0];
        let body = c.text || ''; if (!body) continue;
        if (c.encoding === 'base64') { try { body = typeof atob === 'function' ? decodeURIComponent(escape(atob(body))) : Buffer.from(body, 'base64').toString('utf8'); } catch (err) { continue; } }
        const when = Date.parse(e.startedDateTime || '') || 0;
        if (/\/api\/v1\/map\/position/.test(url) && mime === 'application/json') {
          const d = JSON.parse(body); for (const x of (d.tiles || [])) { const o = parseMapTile(x); o.seen = when; out.tiles[o.x + '|' + o.y] = o; }
        } else if (/\/api\/v1\/map\/info/.test(url) && mime === 'application/json') {
          const d = JSON.parse(body); for (const el of (d.elements || [])) for (const sy of (el.symbols || [])) out.symbols.push({ x: el.position.x, y: el.position.y, type: sy.type, params: sy.parameters || {}, text: clean(unent(sy.text || '')), seen: when });
        } else if (mime === 'text/html' && !/crossdomain/.test(url)) {
          const r = parse(body); if (!r || r.type === 'unknown' || r.type === 'html-unknown') continue;
          r.url = url; r.seen = when; const key = r.type + '@' + (r.villageName || '');
          if (!latest[key] || latest[key].seen < when) latest[key] = r;
        }
      } catch (err) { out.errors.push(String(err).slice(0, 120)); }
    }
    out.pages = Object.values(latest).sort((a, b) => a.seen - b.seen);
    out.tiles = Object.values(out.tiles);
    return out;
  }

  const api = { detect, parse, parseAll, parseDorf1, parseDorf2, parseVillages, htmlToText, unent, parseHar, salvageHar, parseMapTile, parseHeroAttr, parseHeroInv, parseCp, parseTroops, parseReports, GID, HE, TRIBE, num, clean };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TImport = api;
})(typeof window !== 'undefined' ? window : globalThis);

// קישור לתוסף TraTools Listener (Chrome). האתר שואל את התוסף מה יש לו; אם אין תוסף – שקט.
const TT_EXT_ID = 'chigdpfjkjokdcalillpihhlmocicape', OBSKEY = 'tt-obs-v1', OBS_CAP = 60;
function extCall(op) { return new Promise(res => { try { if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) return res(null); chrome.runtime.sendMessage(TT_EXT_ID, { op }, r => { if (chrome.runtime.lastError || !r || r.error) return res(null); res(r); }); } catch (e) { res(null); } }); }
function isExtExport(j) { return !!(j && j.tt === 'ext' && Array.isArray(j.pages) && Array.isArray(j.tiles)); }
function loadObs() { try { return JSON.parse(localStorage.getItem(OBSKEY) || 'null') || {}; } catch (e) { return {}; } }
function mergeObs(obs) {   // תצפיות חיות: [t, {animal:n}, tEnd] לכל נווה; איחוד לפי זמן
  if (!obs || typeof obs !== 'object') return 0; const O = loadObs(); let n = 0;
  for (const k in obs) { const cur = O[k] || []; const seen = new Set(cur.map(o => o[0])); for (const o of obs[k]) { if (!Array.isArray(o)) continue; const i = cur.findIndex(c => c[0] === o[0]); if (i >= 0) { if ((o[2] || 0) > (cur[i][2] || 0)) cur[i][2] = o[2]; } else { cur.push(o); n++; } } cur.sort((a, b) => a[0] - b[0]); if (cur.length > OBS_CAP) cur.splice(0, cur.length - OBS_CAP); O[k] = cur; }
  try { localStorage.setItem(OBSKEY, JSON.stringify(O)); } catch (e) {}
  return n;
}
const extFmt = t => t ? new Date(t).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';

// ---- סרגל האתר: 5 טאבים שווים + שורת כלים (סנכרון, ייבוא קובץ, תוסף). זהה בכל הדפים.
(function () {
  const PAGES = [['index.html', 'הקרופר'], ['cp.html', 'הכפרים'], ['oases.html', 'נאות'], ['transfers.html', 'משלוחים'], ['simulator.html', 'תחילת משחק']];
  const PENDING = 'tt-import-pending';
  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const css = `
.sitenav{position:sticky;top:0;z-index:10;width:100vw;margin:-20px calc(50% - 50vw) 16px;padding:8px 16px 6px;background:var(--bg);border-bottom:2px solid var(--line);box-sizing:border-box}
.sitenav .tabs,.sitenav .bar{max-width:1100px;margin-inline:auto}
.sitenav .tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.sitenav .tabs a{display:flex;align-items:center;justify-content:center;text-align:center;min-height:40px;padding:5px 4px;font-size:.95rem;font-weight:700;line-height:1.15;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--fg);text-decoration:none}
.sitenav .tabs a:hover{border-color:var(--accent);color:var(--accent)}
.sitenav .tabs a[aria-current="page"]{background:var(--accent);border-color:var(--accent);color:#fff}
.sitenav .bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px;font-size:.85rem;min-height:30px}
.sitenav .bar{margin-top:6px}
.sitenav .bar .brand{display:inline-flex;align-items:center;gap:5px;font-weight:700;font-size:.95rem;color:var(--accent);letter-spacing:.2px}
.sitenav .bar .brand .logo{display:block}
.sitenav .bar .tbtn{font:inherit;font-size:.85rem;padding:5px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:inherit;cursor:pointer;white-space:nowrap}
.sitenav .bar .tbtn.ok{border-color:#2b7a3b;color:#2b7a3b}
.sitenav .bar .tmsg{font-size:.8rem;color:var(--muted);flex-basis:100%}
.sitenav .bar .tmsg:empty{display:none}
.sitenav .bar .tmsg a{color:var(--accent)}
.hidden{display:none!important}
.subtabs{position:sticky;z-index:9;display:flex;flex-wrap:wrap;gap:6px;padding:6px 0 8px;margin:0 0 10px;background:var(--bg)}
.subtabs button{font:inherit;font-size:.88rem;flex:1 1 auto;text-align:center;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--fg);cursor:pointer;white-space:nowrap}
.subtabs button[aria-selected="true"]{background:var(--accent-soft,#e8eef7);border-color:var(--accent);color:var(--accent);font-weight:700}
section[data-sub][hidden]{display:none}
@media(max-width:480px){.subtabs button{font-size:.82rem;padding:5px 8px}}
@media(max-width:480px){.sitenav .tabs{gap:4px}.sitenav .tabs a{font-size:.78rem;min-height:38px;padding:4px 2px;border-radius:7px}.sitenav .bar .brand{display:inline-flex;align-items:center;gap:5px;font-weight:700;font-size:.95rem;color:var(--accent);letter-spacing:.2px}
.sitenav .bar .brand .logo{display:block}
.sitenav .bar .tbtn{padding:4px 8px;font-size:.8rem}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const nav = document.querySelector('nav.sitenav'); if (!nav) return;
  nav.innerHTML = `<div class="tabs">${PAGES.map(([h, n]) => `<a href="${h}"${h === here ? ' aria-current="page"' : ''}>${n}</a>`).join('')}</div>
<div class="bar"><span class="brand" title="TraTools – כלים לטרוויאן"><svg class="logo" viewBox="0 0 64 64" width="26" height="26" aria-hidden="true"><defs><linearGradient id="ttg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe4a0"/><stop offset=".5" stop-color="#d9a441"/><stop offset="1" stop-color="#8a5a12"/></linearGradient></defs><path d="M32 4 C 40 2, 46 8, 52 8 C 58 14, 62 22, 60 30 C 62 38, 58 46, 54 52 C 46 60, 36 58, 28 60 C 18 58, 8 54, 6 44 C 2 36, 6 26, 8 20 C 12 10, 22 6, 32 4 Z" fill="#2f5d9a"/><circle cx="32" cy="32" r="21" fill="none" stroke="#bcd3f2" stroke-width="1.5" opacity=".7"/><text x="32" y="43" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="30" fill="url(#ttg)">T</text></svg>TraTools</span><button type="button" class="tbtn" id="ttImportBtn" title="קובץ HAR (DevTools → Export HAR) או הקובץ של התוסף">📂 ייבוא</button><input type="file" id="ttImportFile" accept=".har,.json,application/json" style="display:none"><button type="button" class="tbtn hidden" id="extRefresh" title="התוסף TraTools Listener">🧩 תוסף</button><span id="syncbar"></span><span class="tmsg" id="ttMsg"></span></div>`;
  const $ = id => document.getElementById(id);
  let msgTimer = null;
  function msg(html, keep) { $('ttMsg').innerHTML = html || ''; clearTimeout(msgTimer); if (html && !keep) msgTimer = setTimeout(() => { $('ttMsg').innerHTML = ''; }, 12000); }
  window.ttMsg = msg;
  // ---- ייבוא קובץ: הדף מטפל אם יש לו TT_IMPORT, אחרת נשמר ועוברים לתוכנית הבנייה
  $('ttImportBtn').addEventListener('click', () => $('ttImportFile').click());
  $('ttImportFile').addEventListener('change', async ev => {
    const f = ev.target.files[0]; if (!f) return; msg('קורא את הקובץ...', true);
    try {
      const txt = await f.text(); let j, cut = '';
      try { j = JSON.parse(txt); }
      catch (e) { const s = TImport.salvageHar(txt); if (!s) throw new Error('הקובץ לא JSON תקין (' + (e.message || e).slice(0, 60) + ')'); j = s.har; cut = ` · הקובץ היה חתוך – נקראו ${s.entries} רשומות עד נקודת החיתוך`; }
      const b = isExtExport(j) ? j : TImport.parseHar(j);
      if (!b || (!(b.pages && b.pages.length) && !(b.tiles && b.tiles.length))) { msg('לא מצאתי בקובץ דפי כפר או מפה (ב-HAR: סינון All + Preserve log).'); ev.target.value = ''; return; }
      const src = isExtExport(j) ? `קובץ תוסף מ-${extFmt(j.exportedAt)}` : 'HAR';
      if (typeof window.TT_IMPORT === 'function') { msg(`${window.TT_IMPORT(b) || 'יובא'} (${src})${cut}`); }
      else {
        const slim = { pages: b.pages, tiles: b.tiles, symbols: b.symbols, obs: b.obs, src: src + cut };
        try { localStorage.setItem(PENDING, JSON.stringify(slim)); }
        catch (e) { slim.tiles = (b.tiles || []).filter(t => t.kind !== 'valley' && t.kind !== 'nature'); try { localStorage.setItem(PENDING, JSON.stringify(slim)); } catch (e2) { msg('הקובץ גדול מדי להעברה – פתח אותו מדף תוכנית הבנייה'); ev.target.value = ''; return; } }
        location.href = 'cp.html';
      }
    } catch (e) { msg('הקובץ לא נקרא: ' + (e.message || e)); }
    ev.target.value = '';
  });
  function applyPending() {
    if (typeof window.TT_IMPORT !== 'function') return;
    let p = null; try { p = JSON.parse(localStorage.getItem(PENDING) || 'null'); } catch (e) {}
    if (!p) return; localStorage.removeItem(PENDING);
    try { msg(`${window.TT_IMPORT(p) || 'יובא'} (${p.src || 'קובץ'})`); } catch (e) { msg('הייבוא נכשל: ' + (e.message || e)); }
  }
  // ---- התוסף: הדף מחליט מה לעשות עם הנתונים (TT_EXT_APPLY(data, force) מחזיר הודעה או '')
  async function extPull(force) {
    const d = await extCall('export'); if (!d) return;
    const b = $('extRefresh'); b.classList.remove('hidden'); b.classList.add('ok'); b.textContent = '🧩 תוסף ✓'; b.title = 'התוסף מחובר' + (d.meta && d.meta.lastEvent ? ' · אירוע אחרון ' + extFmt(d.meta.lastEvent) : '') + ' – לחיצה: עדכון מלא';
    if (typeof window.TT_EXT_APPLY === 'function') { try { const m = window.TT_EXT_APPLY(d, force); if (m) msg(m + ' (מהתוסף)'); else if (force) msg('התוסף: אין חדש'); } catch (e) { msg('עדכון מהתוסף נכשל: ' + (e.message || e)); } }
    else if (force) msg('הנתונים מהתוסף נכנסים בדפי תוכנית הבנייה והנאות.');
  }
  $('extRefresh').addEventListener('click', () => extPull(true));
  window.ttExtPull = extPull;
  // ---- תת-טאבים: סקשן אחד בכל פעם (section[data-sub]); הבחירה נשמרת לכל דף
  function subtabs() {
    const secs = [...document.querySelectorAll('section[data-sub]')]; if (secs.length < 2) return;
    const key = 'tt-sub:' + here; let cur = ''; try { cur = localStorage.getItem(key) || ''; } catch (e) {}
    const fromHash = location.hash && secs.find(s => s.dataset.sub === location.hash.slice(1)) ? location.hash.slice(1) : '';
    if (fromHash) cur = fromHash; if (!secs.some(s => s.dataset.sub === cur)) cur = secs[0].dataset.sub;
    const row = document.createElement('div'); row.className = 'subtabs'; row.setAttribute('role', 'tablist');
    secs[0].parentNode.insertBefore(row, secs[0]);
    const show = id => { cur = id; try { localStorage.setItem(key, id); } catch (e) {} for (const s of secs) s.hidden = s.dataset.sub !== id; for (const b of row.children) b.setAttribute('aria-selected', b.dataset.sub === id ? 'true' : 'false'); };
    for (const s of secs) { const b = document.createElement('button'); b.type = 'button'; b.dataset.sub = s.dataset.sub; b.textContent = s.dataset.subname || s.dataset.sub; b.addEventListener('click', () => { show(s.dataset.sub); window.scrollTo({ top: 0 }); }); row.appendChild(b); }
    show(cur);
    const place = () => { row.style.top = nav.offsetHeight + 'px'; }; place(); window.addEventListener('resize', place);
    window.ttShowSub = show;
  }
  const init = () => { subtabs(); applyPending(); extPull(false); };
  window.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
})();
