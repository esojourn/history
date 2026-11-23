// 手机版看跨国关系的两个示例，共用这一张长图：
//   所有国家并排连成一整张图，时间自上而下，人物是竖条；左右随意滑，不再一屏一个国家；
//   两指缩放（电脑上按住 Ctrl 滚动滚轮，或点右上角的 + −）。
// 两个示例只在“点中一个人以后”不同，由 <body data-mode> 决定：
//   reorder（示例一）：和他有关系的国家整条挪到他所在国家的旁边；
//   focus（示例二）：进入“关系聚焦”，他和所有相关的人排在一起，时间压缩到一屏之内。
// 数据和工具函数直接用正式站点的（serve.mjs 现场合成 /data/zh.json）。
import { createModel } from '/src/lib/model.js';
import { fades, fadeOf, reduceMotion } from '/src/river/util.js';

const MODE = document.body.dataset.mode;
const H = createModel(await (await fetch('/data/zh.json')).json(), '/zh/');
const $ = s => document.querySelector(s);
const sc = $('#sc'), sp = $('#sp'), cv = $('#cv'), sheet = $('#sheet'), title = $('#title'), TITLE = title.textContent;
const AXW = 46, HDH = 36, Y0 = H.EXTENT[0], Y1 = H.EXTENT[1], NH = 14, BASEK = 6, GAP = .8, FCW = 34, SHEETH = 130;
const ease = t => 1 - Math.pow(1 - t, 3);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fit = (s, w) => { const n = Math.floor(w / 12.5); return n >= s.length ? s : n > 1 ? s.slice(0, n - 1) + '…' : ''; };

const BASE = H.lanes.map(l => l.id);
const S = { z: 1, order: BASE.slice(), sel: null, focus: null, home: null, stack: [], anim: null, hl: null, open: false };

// 每个国家里的人分列排：重要的人先占位，所以排在国家的左边；列与列之间留出写名字的地方
const LP = {};
H.lanes.forEach(l => {
  const ps = H.byWeight(H.people.filter(p => p.lane === l.id));
  LP[l.id] = { ps, cols: H.pack(ps, p => p.b0, p => Math.max(p.d, p.b0 + (p.n.length * NH + 12) / BASEK), 2, 'col') || 1 };
});
let L = laneU();
function laneU() { const X = {}; let u = 0; S.order.forEach(id => { X[id] = u + GAP / 2; u += LP[id].cols + GAP; }); return { X, total: u }; }
const off = id => (S.anim ? (S.anim.from[id] || 0) * (1 - ease(S.anim.p || 0)) : 0);

// 坐标：y 是年份到像素，x 是人物所在列的中线（都是整张图上的位置，减去滚动距离才是屏幕上的位置）
function geom() {
  if (S.focus) {
    const F = S.focus;
    return { k: F.k, cw: FCW, y: v => HDH + (v - F.lo) * F.k, yr: Y => F.lo + (Y - HDH) / F.k,
      x: p => AXW + (F.idx.get(p.id) + .5) * FCW, W: AXW + F.cols.length * FCW + 40, Ht: HDH + (F.hi - F.lo) * F.k + SHEETH + 30 };
  }
  const k = BASEK * S.z, cw = 30 * H.clamp(S.z, .2, 1);
  return { k, cw, y: v => HDH + (v - Y0) * k, yr: Y => Y0 + (Y - HDH) / k,
    x: p => AXW + (L.X[p.lane] + p.col + .5) * cw + off(p.lane), W: AXW + L.total * cw + 60, Ht: HDH + (Y1 - Y0) * k + SHEETH + 30 };
}
function size(g) { sp.style.width = g.W + 'px'; sp.style.height = g.Ht + 'px'; }
// 国家（聚焦时是“本人 / 各国 / 本国”几组）在屏幕上占的横向范围
function lanesOnScreen(g, sl) {
  if (S.focus) return S.focus.groups.map(gr => ({ id: gr.lane, name: gr.name, x0: AXW + gr.a * FCW - sl, x1: AXW + gr.b * FCW - sl }));
  return S.order.map(id => { const x0 = AXW + (L.X[id] - GAP / 2) * g.cw + off(id) - sl; return { id, name: H.lane(id).name, x0, x1: x0 + (LP[id].cols + GAP) * g.cw }; });
}

let raf = 0;
const redraw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
function draw() {
  const g = geom(), vw = sc.clientWidth, vh = sc.clientHeight, sl = sc.scrollLeft, st = sc.scrollTop;
  cv.setAttribute('width', vw); cv.setAttribute('height', vh); cv.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  const Y = v => g.y(v) - st, X = p => g.x(p) - sl;
  const yA = g.yr(st + HDH) - 2, yB = g.yr(st + vh) + 2, mid = g.yr(st + (vh + HDH) / 2);
  const selP = S.sel && H.P[S.sel], rels = selP ? H.relsOf(selP.id) : [], lit = new Set(rels.map(r => r.o.id));
  const lanes = lanesOnScreen(g, sl).filter(l => l.x1 > AXW && l.x0 < vw);
  const o = [`<defs>${fades(H, 'v')}<pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line y2="7" stroke="var(--ink-2)" stroke-opacity=".22"/></pattern></defs>`];

  // 国家底色和分界线
  lanes.forEach((l, i) => {
    const c = H.lane(l.id).c;
    o.push(`<rect x="${l.x0}" y="${HDH}" width="${l.x1 - l.x0}" height="${vh}" fill="${c}" fill-opacity="${i % 2 ? .07 : .04}"/><line x1="${l.x0}" x2="${l.x0}" y1="${HDH}" y2="${vh}" stroke="var(--line)"/>`);
    // 只排先后、不标年份的时期（太初）：斜线底纹
    if (!S.focus) H.lane(l.id).bands.filter(b => b[3] === 'l' && b[2] > yA && b[1] < yB).forEach(b =>
      o.push(`<rect x="${l.x0}" y="${Y(b[1])}" width="${l.x1 - l.x0}" height="${Y(b[2]) - Y(b[1])}" fill="url(#hatch)"/><text class="ax" x="${Math.max(l.x0, AXW) + 6}" y="${Math.max(Y(b[1]), HDH) + 16}">${b[0]}：只排先后，不标年份</text>`));
  });
  // 年份刻度
  const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find(s => s * g.k >= 46) || 1000;
  const ticks = [];
  // 刻度落在整十、整百的年份上（公元前按“前 n 年”的 n 取整）
  for (let v = Math.ceil(yA); v <= yB; v++) { if ((v <= 0 ? 1 - v : v) % step) continue; const y = Y(v); if (y < HDH + 6) continue; ticks.push([v, y]); o.push(`<line x1="${AXW}" x2="${vw}" y1="${y}" y2="${y}" stroke="var(--line)" opacity=".6"/>`); }

  // 人物竖条
  const list = S.focus ? S.focus.cols : H.people;
  list.forEach(p => {
    if (p.d < yA || p.b0 > yB) return;
    const x = X(p);
    if (x < AXW - 20 || x > vw + 20) return;
    const c = H.FAC[p.fac].c, fade = fadeOf(p, 'v'), w = Math.min(24, g.cw * .8);
    const lo = S.focus ? S.focus.lo : Y0, hi = S.focus ? S.focus.hi : Y1;
    const y1 = Y(Math.max(p.b0, lo)), y2 = Y(Math.min(p.d, hi)), on = !selP || p === selP || lit.has(p.id);
    const showName = g.cw >= 20 && (S.focus || S.z >= .99 || y2 - y1 >= p.n.length * NH);
    const ny = H.clamp(HDH + 6, y1 + 5, Math.max(y1 + 5, y2 - p.n.length * NH - 3));
    o.push(`<g class="pp" data-p="${p.id}" opacity="${on ? 1 : .14}"><rect x="${x - w / 2}" y="${y1}" width="${w}" height="${Math.max(1, y2 - y1)}" rx="3" fill="${fade || c}" fill-opacity="${fade ? 1 : .24}"${p === selP ? ` stroke="${c}" stroke-width="2"` : p.ns || p.cert ? ` stroke="${c}" stroke-dasharray="3 3" stroke-opacity=".8"` : ''}/>
      ${w >= 14 ? p.reigns.map(r => `<rect x="${x + w / 2 - 3}" y="${Y(Math.max(r[0], lo))}" width="3" height="${Math.max(0, Y(Math.min(r[1], hi)) - Y(Math.max(r[0], lo)))}" fill="${c}"/>`).join('') : ''}
      ${showName ? `<text class="vn" x="${x - 1}" y="${ny}"${p === selP ? ' font-weight="700"' : ''}>${p.n}</text>` : ''}</g>`);
  });

  // 关系线：画在发生关系的那一年；标签写在对方那一头
  const placed = [];
  if (selP) rels.forEach(r => {
    const y = Y(r.year);
    if (y < HDH || y > vh) return;
    const rt = H.RT[r.t], x1 = X(selP), x2 = X(r.o), dir = x2 >= x1 ? 1 : -1, hl = S.hl === r.o.id, sw = hl ? 3.4 : 1.8;
    o.push(`<g pointer-events="none"><line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke="${rt.c}" stroke-width="${sw}"${rt.dash ? ` stroke-dasharray="${rt.dash}"` : ''}/><circle cx="${x1}" cy="${y}" r="3" fill="${rt.c}"/><circle cx="${x2}" cy="${y}" r="${hl ? 5 : 3.6}" fill="var(--paper)" stroke="${rt.c}" stroke-width="1.8"/>
      ${Math.abs(x2 - x1) > 26 ? label(r.label.slice(0, 8), x2 - dir * 6, y, dir, hl) : ''}</g>`);
  });
  // 关系标签：和已经写下的标签撞了，就挪到线的下方或更上面
  function label(s, x, y, dir, hl) {
    const w = s.length * 10.5 + 4, x0 = dir > 0 ? x - w : x, x1 = x0 + w;
    const ty = [y - 4, y + 13, y - 16, y + 25].find(t => !placed.some(b => Math.abs(b.y - t) < 11 && b.x0 < x1 && x0 < b.x1)) ?? y - 4;
    placed.push({ x0, x1, y: ty });
    return `<text class="rl" x="${x}" y="${ty}" text-anchor="${dir > 0 ? 'end' : 'start'}"${hl ? ' font-weight="700"' : ''}>${esc(s)}</text>`;
  }

  // 左边的年份栏、顶上的国家名（都钉在屏幕边上）
  o.push(`<rect x="0" y="${HDH}" width="${AXW}" height="${vh}" fill="var(--paper)"/><line x1="${AXW}" x2="${AXW}" y1="${HDH}" y2="${vh}" stroke="var(--line)"/>`);
  ticks.forEach(([v, y]) => o.push(`<text class="ax" x="${AXW - 5}" y="${y + 4}" text-anchor="end">${H.fmt(v)}</text>`));
  o.push(`<rect width="${vw}" height="${HDH}" fill="var(--paper)"/><line x1="0" x2="${vw}" y1="${HDH}" y2="${HDH}" stroke="var(--line)"/>`);
  lanes.forEach(l => {
    const a = Math.max(l.x0 + 1, AXW + 1), b = Math.min(l.x1 - 1, vw), w = b - a, band = S.focus ? null : H.bandAt(H.lane(l.id), mid);
    o.push(`<rect x="${a}" y="3" width="${Math.max(0, w)}" height="${HDH - 6}" rx="4" fill="${H.lane(l.id).c}"/>`);
    // 窄的（聚焦时只有一个人的国家）只写国名的头两个字
    const nm = w - 8 >= l.name.length * 12.5 ? l.name : w < 60 ? l.name.slice(0, 2) : fit(l.name, w - 8);
    if (w > 26) o.push(`<text class="hd" x="${a + (w < 40 ? w / 2 : 5)}"${w < 40 ? ' text-anchor="middle"' : ''} y="${band ? 16 : 23}">${nm}</text>${band ? `<text class="hb" x="${a + 5}" y="${HDH - 8}">${fit(band[0], (w - 8) * 1.1)}</text>` : ''}`);
  });
  o.push(`<rect width="${AXW}" height="${HDH}" fill="var(--paper)"/>`);
  cv.innerHTML = o.join('');
}

/* ---------- 人物卡 ---------- */
function showCard() {
  const p = S.sel && H.P[S.sel];
  sheet.classList.toggle('on', !!p);
  sheet.classList.toggle('open', !!p && S.open);
  if (!p) return;
  const l = H.lane(p.lane), rels = H.relsOf(p.id);
  const chip = (r, foreign) => `<button data-r="${r.o.id}"><i style="background:${H.RT[r.t].c}"></i>${r.o.n}<span>${foreign ? H.lane(r.o.lane).name + ' · ' : ''}${esc(r.label)}</span></button>`;
  const fr = rels.filter(r => r.o.lane !== p.lane), sr = rels.filter(r => r.o.lane === p.lane);
  sheet.innerHTML = `<div class="cd-h"><b>${p.n}</b><small><i class="cd-lane" style="background:${l.c}"></i>${l.name} · ${H.life(p)} · ${esc(p.role)}</small>
      <button class="tg">${S.open ? '收起' : '展开'}</button><button class="x" aria-label="关闭">×</button></div>
    <p class="cd-sum">${esc(p.sum)}</p>
    ${fr.length ? `<p class="cd-g">和其他国家的人（${fr.length}）</p><div class="cd-rels">${fr.map(r => chip(r, true)).join('')}</div>` : ''}
    ${sr.length ? `<p class="cd-g">和本国的人（${sr.length}）</p><div class="cd-rels">${sr.map(r => chip(r)).join('')}</div>` : ''}
    <p class="cd-note">这是展现形式的示例，简介取自正式站点。${p.src.length ? '出处见正式站点的人物页。' : esc(H.t('source.ai'))}</p>`;
  sheet.scrollTop = 0;
}

/* ---------- 示例一：相关国家挪到旁边 ---------- */
function setOrder(order, place) {
  // place(g)：换序以后滚到哪里；各国从原来在屏幕上的位置滑到新位置
  S.anim = null;
  const g0 = geom(), sl0 = sc.scrollLeft, old = {};
  S.order.forEach(id => { old[id] = AXW + L.X[id] * g0.cw - sl0; });
  S.order = order; L = laneU();
  const g = geom(); size(g);
  sc.scrollLeft = place(g);
  const from = {};
  S.order.forEach(id => { from[id] = old[id] - (AXW + L.X[id] * g.cw - sc.scrollLeft); });
  $('#reset').hidden = S.order.join() === BASE.join();
  animate(from);
}
function animate(from) {
  if (reduceMotion()) { draw(); return; }
  S.anim = { from, t0: performance.now(), p: 0 };
  const step = now => { if (!S.anim) return; S.anim.p = Math.min(1, (now - S.anim.t0) / 450); draw(); if (S.anim.p < 1) requestAnimationFrame(step); else { S.anim = null; draw(); } };
  requestAnimationFrame(step);
}
function selectReorder(id) {
  const p = H.P[id], rels = H.relsOf(id);
  S.sel = id; S.hl = null; showCard(); hash(id);
  // 有关系的国家按关系多少排；挪到这个人所在国家离他近的那一边（他在本国的左半边就挪到左边）
  const cnt = {};
  rels.forEach(r => { if (r.o.lane !== p.lane) cnt[r.o.lane] = (cnt[r.o.lane] || 0) + 1; });
  const rel = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]), left = p.col < LP[p.lane].cols / 2;
  const order = BASE.filter(l => !rel.includes(l));
  order.splice(order.indexOf(p.lane) + (left ? 0 : 1), 0, ...(left ? [...rel].reverse() : rel));
  // 滚到能同时看到他和离他最近的一位外国相关人物；放不下就把他放在靠边的地方，多留地方给那一边
  const vw = sc.clientWidth, vh = sc.clientHeight;
  setOrder(order, g => {
    const px = g.x(p), fx = rels.filter(r => r.o.lane !== p.lane).map(r => g.x(r.o)).sort((a, b) => Math.abs(a - px) - Math.abs(b - px))[0];
    if (fx == null) return px - (vw + AXW) / 2;
    const a = Math.min(px, fx), b = Math.max(px, fx);
    return b - a < vw - AXW - 60 ? (a + b) / 2 - (vw + AXW) / 2 : fx < px ? px - vw + 40 : px - AXW - 30;
  });
  const ys = rels.map(r => r.year);
  sc.scrollTop = geom().y(ys.length ? Math.min(...ys) : p.b0) - HDH - (vh - HDH - SHEETH) * .3;
}

/* ---------- 示例二：关系聚焦 ---------- */
function enterFocus(id, push = true) {
  const p = H.P[id], rels = H.relsOf(id);
  if (!S.focus) S.home = { z: S.z, sl: sc.scrollLeft, st: sc.scrollTop };
  else if (push) S.stack.push(S.focus.p.id);
  // 他本人排第一列；紧挨着是其他国家的相关人物（按国家分组，关系多的国家在前）；再往右是本国的相关人物
  const others = [...new Map(rels.map(r => [r.o.id, r.o])).values()];
  const first = o => Math.min(...rels.filter(r => r.o === o).map(r => r.year));
  const fl = {};
  others.filter(o => o.lane !== p.lane).forEach(o => (fl[o.lane] ||= []).push(o));
  const cols = [p], groups = [{ lane: p.lane, a: 0, b: 1, name: p.n }];
  Object.keys(fl).sort((a, b) => fl[b].length - fl[a].length).forEach(l => {
    const a = cols.length; cols.push(...fl[l].sort((x, y) => first(x) - first(y))); groups.push({ lane: l, a, b: cols.length, name: H.lane(l).name });
  });
  const same = others.filter(o => o.lane === p.lane).sort((x, y) => first(x) - first(y));
  if (same.length) { const a = cols.length; cols.push(...same); groups.push({ lane: p.lane, a, b: cols.length, name: '本国 · ' + H.lane(p.lane).name }); }
  // 时间只取他的一生和所有关系发生的年份，压缩到人物卡上方的一屏之内
  const ys = rels.map(r => r.year), lo = Math.min(p.b0, ...ys) - 4, hi = Math.max(p.d, ...ys) + 4;
  const room = sc.clientHeight - HDH - SHEETH - 24;
  S.focus = { p, cols, idx: new Map(cols.map((c, i) => [c.id, i])), groups, lo, hi, k: H.clamp(room / (hi - lo), .4, 16) };
  S.sel = id; S.hl = null; S.open = false;
  size(geom()); sc.scrollTop = 0; sc.scrollLeft = 0;
  bar(); showCard(); hash(id); draw();
  if (!reduceMotion()) cv.animate([{ opacity: .2, transform: 'scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
}
function exitFocus() {
  const h = S.home;
  S.focus = null; S.sel = null; S.stack = []; S.hl = null; S.open = false;
  S.z = h.z; size(geom()); sc.scrollLeft = h.sl; sc.scrollTop = h.st;
  bar(); showCard(); hash(null); draw();
}
function bar() {
  $('#back').hidden = !S.focus; $('#prev').hidden = !S.stack.length;
  title.textContent = S.focus ? `聚焦：${S.focus.p.n}` : TITLE;
}
// 点卡片里的某位相关人物：把他那条关系线加粗，并滚到看得见的地方
function showRel(oid) {
  const g = geom(), r = H.relsOf(S.sel).find(x => x.o.id === oid), vw = sc.clientWidth, vh = sc.clientHeight;
  S.hl = oid; S.open = false; showCard();
  const y = g.y(r.year), x = g.x(r.o);
  if (y - sc.scrollTop < HDH + 20 || y - sc.scrollTop > vh - SHEETH - 20) sc.scrollTop = y - (vh - SHEETH + HDH) / 2;
  if (x - sc.scrollLeft < AXW + 20 || x - sc.scrollLeft > vw - 20) sc.scrollLeft = x - (vw + AXW) / 2;
  redraw();
}

/* ---------- 操作 ---------- */
const hash = id => history.replaceState(null, '', id ? `#p/${id}` : location.pathname);
function zoomBy(f, mx, my) {
  const g0 = geom(), yr = g0.yr(sc.scrollTop + my), u = (sc.scrollLeft + mx - AXW) / g0.cw;
  if (S.focus) S.focus.k = H.clamp(S.focus.k * f, .3, 40); else S.z = H.clamp(S.z * f, .08, 4);
  const g = geom(); size(g);
  sc.scrollTop = g.y(yr) - my; sc.scrollLeft = u * g.cw + AXW - mx;
  draw();
}
// 两指缩放
let pinch = null;
const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
sc.addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = { d: dist(e.touches[0], e.touches[1]) }; }, { passive: true });
sc.addEventListener('touchmove', e => {
  if (!pinch || e.touches.length !== 2) return;
  e.preventDefault();
  const [a, b] = e.touches, d = dist(a, b), r = sc.getBoundingClientRect();
  zoomBy(d / pinch.d, (a.clientX + b.clientX) / 2 - r.left, (a.clientY + b.clientY) / 2 - r.top); pinch.d = d;
}, { passive: false });
sc.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; });
// 电脑：Ctrl + 滚轮（触控板两指捏合也是这个）缩放；鼠标按住拖动
sc.addEventListener('wheel', e => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const r = sc.getBoundingClientRect(); zoomBy(Math.exp(-e.deltaY * .01), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
let drag = null, moved = false;
sc.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && !e.button) { drag = { x: e.clientX, y: e.clientY, sl: sc.scrollLeft, st: sc.scrollTop }; moved = false; } });
addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; sc.classList.add('drag'); }
  if (moved) { sc.scrollLeft = drag.sl - dx; sc.scrollTop = drag.st - dy; }
});
addEventListener('pointerup', () => { drag = null; sc.classList.remove('drag'); });

sc.addEventListener('scroll', redraw);
addEventListener('resize', () => { size(geom()); draw(); });
cv.addEventListener('click', e => {
  if (moved) { moved = false; return; }
  const p = e.target.closest('[data-p]');
  if (MODE === 'reorder') {
    if (p) selectReorder(p.dataset.p);
    else if (S.sel) { S.sel = null; S.hl = null; S.open = false; showCard(); hash(null); draw(); }
  } else if (p) {
    if (S.focus && p.dataset.p === S.sel) { S.hl = null; showCard(); draw(); }
    else enterFocus(p.dataset.p);
  }
});
document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.z) { zoomBy(b.dataset.z > 0 ? 1.5 : 1 / 1.5, sc.clientWidth / 2, sc.clientHeight / 2); return; }
  if (b.id === 'reset') {   // 恢复原顺序：选中的人留在屏幕上原来的位置
    const p = S.sel && H.P[S.sel], g0 = geom(), sx = p ? g0.x(p) - sc.scrollLeft : 0, sl = sc.scrollLeft;
    setOrder(BASE.slice(), g => (p ? g.x(p) - sx : sl)); return;
  }
  if (b.id === 'back') { exitFocus(); return; }
  if (b.id === 'prev') { enterFocus(S.stack.pop(), false); bar(); return; }
  if (b.classList.contains('tg')) { S.open = !S.open; showCard(); return; }
  if (b.classList.contains('x')) {
    if (MODE === 'focus') { sheet.classList.remove('on'); return; }
    S.sel = null; S.hl = null; S.open = false; showCard(); hash(null); draw(); return;
  }
  if (b.dataset.r) { MODE === 'reorder' ? selectReorder(b.dataset.r) : showRel(b.dataset.r); return; }
  if (b.dataset.try) { $('.tip')?.remove(); MODE === 'reorder' ? selectReorder(b.dataset.try) : enterFocus(b.dataset.try); return; }
  if (b.classList.contains('ok')) $('.tip')?.remove();
});

// 开始：中国泳道，秦汉之际。地址里带 #p/某人 的，直接选中他
size(geom());
sc.scrollLeft = (L.X.china - GAP / 2) * geom().cw;
sc.scrollTop = geom().y(H.FOCUS[0]) - HDH - 10;
draw();
const m = location.hash.match(/^#p\/(.+)$/);
if (m && H.P[m[1]]) { $('.tip')?.remove(); MODE === 'reorder' ? selectReorder(m[1]) : enterFocus(m[1]); }
