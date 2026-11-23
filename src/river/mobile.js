// 手机版时间长河：时间自上而下，人名竖排。两层：
//   时代总览：一次看一个文明的各个朝代、时代（顶上点文明名称或左右滑动切换）；
//   人物：所有文明并排连成一整张长图，左右随意滑，两指缩放；点人物或事件进入“关系聚焦”——
//     他和所有相关的人临时排在一起（其他文明的人紧挨着他），时间压缩到一屏之内，连线都看得到。
//     这个做法是对比了两个示例后定的，见 prototypes/links/ 和 docs/plan.md 2.6。
import { fades, fadeOf, setHash, readHash, cardTarget, reduceMotion, fz } from './util.js';

export function mobile(H, card, search) {
  const $ = s => document.querySelector(s), t = H.t;
  const body = $('#mbody'), sheet = $('#msheet'), tabs = $('#mtabs'), seg = $('#mseg');
  // 图上的尺寸都是字号放大前的；整张图按字号倍数 Z 放大（svg 的 viewBox 取屏幕尺寸 ÷ Z）
  const AXW = 46, HDH = 36, NH = 14, BASEK = 8, GAP = .8, FCW = 34, PEEK = 150, MAIN = 4, FEW = 9;
  const Y0 = H.EXTENT[0], Y1 = H.EXTENT[1];
  const M = { mode: 'bands', lane: H.site.default_open[0] || H.lanes[0].id, all: true, sel: null, full: false, peek: false, focus: null, home: null };
  const HIST = [], nameOf = s => (s.t === 'p' ? H.P[s.id] : H.E[s.id]).n;
  let Z = fz(), z = 1;
  const inFocus = b => b[1] < H.FOCUS[1] && b[2] > H.FOCUS[0];
  const within = (p, a, b) => p.d > a && p.b0 < b;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fit = (s, w, px = 12.5) => { const n = Math.floor(w / px); return n >= s.length ? s : n > 1 ? s.slice(0, n - 1) + '…' : ''; };

  // 每个文明里的人分列排：重要的人先占位，排在左边；列与列之间留出竖写名字的地方。
  // 事件占文明最左边的一列（重要度 3 以上的）。“只看主要”时只排重要度 4 以上的人（人少的文明全排）。
  const LN = {};
  H.lanes.forEach(l => {
    const ps = H.byWeight(H.people.filter(p => p.lane === l.id)), end = p => Math.max(p.d, p.b0 + (p.n.length * NH + 12) / BASEK);
    const main = ps.length <= FEW ? ps : ps.filter(p => p.imp >= MAIN);
    const evs = H.events.filter(e => e.lane === l.id && e.imp >= 3).sort((a, b) => a.s - b.s);
    LN[l.id] = { ps, main, evs, byImp: H.byWeight(evs), cA: H.pack(ps, p => p.b0, end, 2, 'mcA'), cM: H.pack(main, p => p.b0, end, 2, 'mcM'), ec: evs.length ? 1 : 0 };
  });
  const colOf = p => (M.all ? p.mcA : p.mcM);
  let L = layout();
  function layout() {
    const X = {}; let u = 0;
    H.lanes.forEach(l => { const n = LN[l.id]; X[l.id] = u + GAP / 2; u += Math.max(1, n.ec + (M.all ? n.cA : n.cM)) + GAP; });
    return { X, total: u };
  }
  const laneW = id => Math.max(1, LN[id].ec + (M.all ? LN[id].cA : LN[id].cM));

  // 坐标：整张图上的位置（放大前）。减去滚动距离（也换算成放大前）才是屏幕上的位置
  const vwV = () => body.clientWidth / Z, vhV = () => body.clientHeight / Z, slV = () => body.scrollLeft / Z, stV = () => body.scrollTop / Z;
  function geom() {
    if (M.focus) {
      const F = M.focus;
      return { k: F.k, cw: FCW, y: v => HDH + (v - F.lo) * F.k, yr: Y => F.lo + (Y - HDH) / F.k, x: p => AXW + (F.idx.get(p.id) + .5) * FCW,
        W: AXW + F.cols.length * FCW + 40, Ht: HDH + (F.hi - F.lo) * F.k + PEEK + 40 };
    }
    const k = BASEK * z, cw = 30 * H.clamp(z, .2, 1);
    return { k, cw, y: v => HDH + (v - Y0) * k, yr: Y => Y0 + (Y - HDH) / k,
      x: p => AXW + (L.X[p.lane] + LN[p.lane].ec + colOf(p) + .5) * cw, xe: e => AXW + (L.X[e.lane] + .5) * cw,
      W: AXW + L.total * cw + vwV() * .7, Ht: HDH + (Y1 - Y0) * k + 160 };   // 右边留白，最后一个文明也能滚到屏幕左边
  }
  function size() {
    const g = geom(), m = body.querySelector('.mmap');
    if (m) { m.style.width = Math.max(g.W * Z, body.clientWidth) + 'px'; m.style.height = Math.max(g.Ht * Z, body.clientHeight) + 'px'; }
    return g;
  }
  const scrollV = (x, y) => { if (x != null) body.scrollLeft = x * Z; if (y != null) body.scrollTop = y * Z; };
  const REF = HDH + 70;   // 换层、换字号时保持在同一年：取屏幕上方这个位置对应的年份
  const yearAt = () => (M.mode === 'people' ? geom().yr(stV() + REF) : bandYear());
  // 屏幕左边第一个露出 40 像素以上的文明（顶上的文明标签跟着它走）
  function laneAt() {
    const g = geom(), sl = slV();
    const l = H.lanes.find(l => AXW + (L.X[l.id] - GAP / 2 + laneW(l.id) + GAP) * g.cw - sl > AXW + 40);
    return (l || H.lanes[H.lanes.length - 1]).id;
  }

  /* ---------- 时代总览 ---------- */
  function bands() {
    const l = H.lane(M.lane), ps = LN[M.lane].ps;
    body.innerHTML = `<div style="--c:${l.c};padding:10px 0 40px">` + l.bands.map((b, i) => {
      const h = H.clamp((b[2] - b[1]) * .26, 40, 230), has = ps.some(p => within(p, b[1], b[2]));
      return `<div class="mband ${b[3] || ''}" data-i="${i}"${inFocus(b) ? ' data-focus' : ''}><div class="yr">${b[3] === 'l' ? '' : (b[3] ? t('circa') : '') + H.fmt(b[1])}</div>
        <div class="blk" style="min-height:${h}px"><b>${b[0]}</b>
        <small>${b[3] === 'l' ? t('m.onlyOrder') : t('m.years', { n: b[2] - b[1] }) + (b[3] ? t('m.traditional') : '')}</small>
        ${has ? `<button class="go" data-m="people" data-y="${Math.max(b[1], Math.min(...ps.filter(p => within(p, b[1], b[2])).map(p => p.b0)))}">${t('m.seePeople')}</button>` : ''}</div></div>`;
    }).join('') + '</div>';
    const fo = body.querySelector('[data-focus]');
    body.scrollTop = fo ? Math.max(0, fo.offsetTop - 120) : 0;
  }
  function bandYear() {
    const at = body.scrollTop + 110, l = H.lane(M.lane);
    for (const el of body.querySelectorAll('.mband')) if (el.offsetTop + el.offsetHeight > at) {
      const b = l.bands[+el.dataset.i]; return b[1] + (b[2] - b[1]) * H.clamp((at - el.offsetTop) / el.offsetHeight, 0, 1);
    }
    return null;
  }
  function bandsTo(v) {
    const bs = H.lane(M.lane).bands, dist = b => (v < b[1] ? b[1] - v : v > b[2] ? v - b[2] : 0);
    let i = 0; bs.forEach((b, j) => { if (dist(b) < dist(bs[i])) i = j; });
    const el = body.querySelector(`.mband[data-i="${i}"]`), b = bs[i];
    if (el) body.scrollTop = Math.max(0, el.offsetTop + el.offsetHeight * H.clamp((v - b[1]) / (b[2] - b[1] || 1), 0, 1) - 110);
  }

  /* ---------- 人物长图与关系聚焦（同一个画法，聚焦时只画相关的人） ---------- */
  let raf = 0;
  const redraw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (M.mode === 'people') draw(); }); };
  function draw() {
    const svg = body.querySelector('#mpeople');
    if (!svg) return;
    const g = geom(), vw = vwV(), vh = vhV(), sl = slV(), st = stV(), F = M.focus;
    svg.setAttribute('width', body.clientWidth); svg.setAttribute('height', body.clientHeight); svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    const Y = v => g.y(v) - st, X = p => g.x(p) - sl;
    const yA = g.yr(st + HDH) - 2, yB = g.yr(st + vh) + 2, mid = g.yr(st + (vh + HDH) / 2), lo = F ? F.lo : Y0, hi = F ? F.hi : Y1;
    const selP = M.sel && M.sel.t === 'p' ? H.P[M.sel.id] : null, selE = M.sel && M.sel.t === 'e' ? H.E[M.sel.id] : null;
    const rels = F && selP ? H.relsOf(selP.id) : [];
    const o = [`<defs>${fades(H, 'v')}<pattern id="mhatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line y2="7" stroke="var(--ink-2)" stroke-opacity=".22"/></pattern></defs>`];

    // 文明（聚焦时是“本人 / 各文明 / 同一文明”几组）的底色和分界线
    const lanes = (F ? F.groups.map(gr => ({ id: gr.lane, name: gr.name, x0: AXW + gr.a * FCW - sl, x1: AXW + gr.b * FCW - sl }))
      : H.lanes.map(l => { const x0 = AXW + (L.X[l.id] - GAP / 2) * g.cw - sl; return { id: l.id, name: l.name, x0, x1: x0 + (laneW(l.id) + GAP) * g.cw }; }))
      .filter(l => l.x1 > AXW && l.x0 < vw);
    lanes.forEach((l, i) => {
      o.push(`<rect x="${l.x0}" y="${HDH}" width="${l.x1 - l.x0}" height="${vh}" fill="${H.lane(l.id).c}" fill-opacity="${i % 2 ? .07 : .04}"/><line x1="${l.x0}" x2="${l.x0}" y1="${HDH}" y2="${vh}" stroke="var(--line)"/>`);
      // 只排先后、不标年份的时期（太初）：斜线底纹，这一段的位置只表示次序
      if (!F) H.lane(l.id).bands.filter(b => b[3] === 'l' && b[2] > yA && b[1] < yB).forEach(b =>
        o.push(`<rect x="${l.x0}" y="${Y(b[1])}" width="${l.x1 - l.x0}" height="${Y(b[2]) - Y(b[1])}" fill="url(#mhatch)"/><text class="ax" x="${Math.max(l.x0, AXW) + 6}" y="${Math.max(Y(b[1]), HDH) + 16}">${b[0]}：${t('m.onlyOrder')}</text>`));
    });
    // 年份刻度：落在整十、整百的年份上（公元前按“前 n 年”的 n 取整）
    const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find(s => s * g.k >= 46) || 1000, ticks = [];
    for (let v = Math.ceil(Math.max(yA, lo)); v <= Math.min(yB, hi); v++) {
      if ((v <= 0 ? 1 - v : v) % step) continue;
      const y = Y(v); if (y < HDH + 6) continue;
      ticks.push([v, y]); o.push(`<line x1="${AXW}" x2="${vw}" y1="${y}" y2="${y}" stroke="var(--line)" opacity=".6"/>`);
    }

    // 事件（长图上每个文明最左边的一列）：◆ 都画；竖写的名字放得下才写，重要的先占位置，放大以后写得出的就多了。
    // 持续多年的事件下面拖一条线
    if (!F) H.lanes.forEach(l => {
      const x = AXW + (L.X[l.id] + .5) * g.cw - sl;
      if (x < AXW - 10 || x > vw + 10) return;
      const taken = [], named = new Set(), vis = LN[l.id].byImp.filter(e => e.e >= yA - 40 && e.s <= yB);
      if (g.cw >= 20) vis.forEach(e => {
        const a = Y(e.s) - 6, b = Y(e.s) + 9 + e.n.length * 12;
        if (e === selE || !taken.some(([c, d]) => a < d + 4 && c < b + 4)) { taken.push([a, b]); named.add(e); }
      });
      [...vis].reverse().forEach(e => {
        const y1 = Y(e.s), y2 = Y(Math.max(e.s, e.e)), on = !selE || e === selE, nm = named.has(e);
        o.push(`<g class="ev" data-e="${e.id}" opacity="${on ? 1 : .25}"><rect x="${x - g.cw / 2}" y="${y1 - 7}" width="${g.cw}" height="${(nm ? e.n.length * 12 + 4 : 0) + 14}" fill="transparent"/>
          ${y2 > y1 + 2 ? `<line x1="${x}" x2="${x}" y1="${y1}" y2="${y2}" stroke="var(--ink)" stroke-width="2.5" opacity=".4"/>` : ''}
          ${nm ? `<path d="M${x} ${y1 - 5}l5 5l-5 5l-5-5z" fill="var(--ink)"/>` : `<path d="M${x} ${y1 - 3}l3 3l-3 3l-3-3z" fill="var(--ink-2)"/>`}${nm ? `<text class="evn" x="${x - 1}" y="${y1 + 9}"${e === selE ? ' font-weight="700"' : ''}>${e.n}</text>` : ''}</g>`);
      });
    });

    // 人物竖条：条的长度是寿命，右边的细条是在位时间，一头渐隐表示生年或卒年不详
    (F ? F.cols : M.all ? H.people : H.lanes.flatMap(l => LN[l.id].main)).forEach(p => {
      if (p.d < yA || p.b0 > yB) return;
      const x = X(p);
      if (x < AXW - 20 || x > vw + 20) return;
      const c = H.FAC[p.fac].c, fade = fadeOf(p, 'v'), w = Math.min(24, g.cw * .8), me = selP === p;
      const y1 = Y(Math.max(p.b0, lo)), y2 = Y(Math.min(p.d, hi)), on = !selE || !selE.who.length || selE.who.includes(p.id);
      const ny = H.clamp(HDH + 6, y1 + 5, Math.max(y1 + 5, y2 - p.n.length * NH - 3));
      const name = g.cw >= 20 && (F || z >= .99 || y2 - y1 >= p.n.length * NH);
      o.push(`<g class="pp" data-p="${p.id}" opacity="${on ? 1 : .15}"><rect x="${x - w / 2}" y="${y1}" width="${w}" height="${Math.max(1, y2 - y1)}" rx="3" fill="${fade || c}" fill-opacity="${fade ? 1 : .22}"${me ? ` stroke="${c}" stroke-width="2"` : p.ns || p.cert ? ` stroke="${c}" stroke-dasharray="3 3" stroke-opacity=".8"` : ''}/>
        ${w >= 14 ? p.reigns.map(r => `<rect x="${x + w / 2 - 3}" y="${Y(Math.max(r[0], lo))}" width="3" height="${Math.max(0, Y(Math.min(r[1], hi)) - Y(Math.max(r[0], lo)))}" fill="${c}"/>`).join('') : ''}
        ${name ? `<text class="vn" x="${x - 1}" y="${ny}"${me ? ' font-weight="700"' : ''}>${p.n}</text>` : ''}</g>`);
    });

    // 关系线画在发生关系的那一年，标签写在对方那一头（线比标签短就写到对方外侧）；标签撞了就挪到线下或更上面
    const placed = [];
    const label = (s, x2, y, dir, span) => {
      const w = s.length * 10.5 + 4, inside = w <= span - 12, end = inside === dir > 0;
      const x = inside ? x2 - dir * 6 : x2 + dir * 6, x0 = end ? x - w : x, x1 = x0 + w;
      const ty = [y - 4, y + 13, y - 16, y + 25].find(v => !placed.some(b => Math.abs(b.y - v) < 11 && b.x0 < x1 && x0 < b.x1)) ?? y - 4;
      placed.push({ x0, x1, y: ty });
      return `<text class="rl" x="${x}" y="${ty}" text-anchor="${end ? 'end' : 'start'}">${esc(s)}</text>`;
    };
    rels.forEach(r => {
      const y = Y(r.year);
      if (y < HDH || y > vh) return;
      const rt = H.RT[r.t], x1 = X(selP), x2 = X(r.o), dir = x2 >= x1 ? 1 : -1;
      o.push(`<g pointer-events="none"><line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke="${rt.c}" stroke-width="1.8"${rt.dash ? ` stroke-dasharray="${rt.dash}"` : ''}/><circle cx="${x1}" cy="${y}" r="3" fill="${rt.c}"/><circle cx="${x2}" cy="${y}" r="3.6" fill="var(--paper)" stroke="${rt.c}" stroke-width="1.8"/>
        ${label(r.label.slice(0, 8), x2, y, dir, Math.abs(x2 - x1))}</g>`);
    });
    // 事件：一条横线连起所有参与的人
    if (selE) {
      const xs = selE.who.map(w => H.P[w]).filter(p => !F || F.idx.has(p.id)).filter(p => M.all || F || p.imp >= MAIN || LN[p.lane].ps.length <= FEW).map(X), y = Y(selE.s);
      const x0 = F ? AXW : g.xe(selE) - sl;
      if (xs.length && y > HDH && y < vh) o.push(`<g pointer-events="none"><line x1="${Math.min(x0, ...xs)}" x2="${Math.max(x0, ...xs)}" y1="${y}" y2="${y}" stroke="var(--ink)" stroke-width="1.4"/>${xs.map(v => `<circle cx="${v}" cy="${y}" r="3.4" fill="var(--ink)"/>`).join('')}</g>`);
      if (F) o.push(`<line x1="${AXW - 4}" x2="${AXW - 4}" y1="${y - 5}" y2="${Math.max(y + 5, Y(selE.e))}" stroke="var(--ink)" stroke-width="4"/>`);
    }

    // 左边的年份栏、顶上的文明名（都钉在屏幕边上）
    o.push(`<rect x="0" y="${HDH}" width="${AXW}" height="${vh}" fill="var(--paper)"/><line x1="${AXW}" x2="${AXW}" y1="${HDH}" y2="${vh}" stroke="var(--line)"/>`);
    if (!(F && F.p && F.p.ns)) ticks.forEach(([v, y]) => o.push(`<text class="ax" x="${AXW - 5}" y="${y + 4}" text-anchor="end">${H.fmt(v)}</text>`));
    if (selE && F) { const y = Y(selE.s); if (y > HDH) o.push(`<text class="ax" x="${AXW - 8}" y="${y + 4}" text-anchor="end" font-weight="700">${H.fmt(selE.s)}</text>`); }
    o.push(`<rect width="${vw}" height="${HDH}" fill="var(--paper)"/><line x1="0" x2="${vw}" y1="${HDH}" y2="${HDH}" stroke="var(--line)"/>`);
    lanes.forEach(l => {
      const a = Math.max(l.x0 + 1, AXW + 1), b = Math.min(l.x1 - 1, vw), w = b - a, band = F ? null : H.bandAt(H.lane(l.id), mid);
      o.push(`<rect x="${a}" y="3" width="${Math.max(0, w)}" height="${HDH - 6}" rx="4" fill="${H.lane(l.id).c}"/>`);
      // 窄的（聚焦时只有一个人的文明）只写名称的头两个字
      const nm = w - 8 >= l.name.length * 12.5 ? l.name : w < 60 ? l.name.slice(0, 2) : fit(l.name, w - 8);
      if (w > 26) o.push(`<text class="hd" x="${w < 40 ? a + w / 2 : a + 5}"${w < 40 ? ' text-anchor="middle"' : ''} y="${band ? 16 : 23}">${nm}</text>${band ? `<text class="hb" x="${a + 5}" y="${HDH - 8}">${fit(band[0], w - 8, 11)}</text>` : ''}`);
    });
    o.push(`<rect width="${AXW}" height="${HDH}" fill="var(--paper)"/>`);
    svg.innerHTML = o.join('');
    if (!F) syncLane();
  }

  // 人物层顶上的一条小栏：长图上是“总览 / 当前文明与年份 / 缩放 / 只看主要”；聚焦时是“全图 / 聚焦谁 / 缩放”
  function segBar() {
    seg.hidden = M.mode !== 'people';
    if (seg.hidden) return;
    const zoom = `<button data-z="-1" aria-label="${t('m.zoomOut')}">−</button><button data-z="1" aria-label="${t('m.zoomIn')}">+</button>`;
    if (M.focus) {
      const F = M.focus;
      seg.innerHTML = `<button class="back" data-map>${t('m.map')}</button><span><b>${t('m.focusOn', { name: F.p ? F.p.n : F.e.n })}</b><i>${t('m.related', { n: F.cols.length - (F.p ? 1 : 0) })}</i></span>${zoom}`;
      return;
    }
    const n = H.people.length;
    seg.innerHTML = `<button class="back" data-m="bands" aria-label="${t('m.backBands')}">${t('m.overview')}</button><span id="mwhere"></span>${zoom}
      <button class="all" data-all aria-pressed="${M.all}">${M.all ? t('m.mainShort') : t('m.allShort', { n })}</button>`;
  }
  let lastLane = null;
  function syncLane() {
    const id = laneAt(), l = H.lane(id), v = yearAt(), b = H.bandAt(l, v), w = $('#mwhere');
    M.lane = id;
    if (w) w.innerHTML = `<b>${l.name}</b><i>${b ? b[0] : ''}${b && b[3] === 'l' ? '' : ' · ' + H.fmt(Math.round(v))}</i>`;
    if (id !== lastLane) { lastLane = id; markTab(); }
  }
  function markTab() {
    tabs.querySelectorAll('[data-lane]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lane === M.lane));
    const on = tabs.querySelector('[aria-pressed="true"]');
    if (on) tabs.scrollTo({ left: on.offsetLeft - (tabs.clientWidth - on.offsetWidth) / 2, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  function map() {
    body.innerHTML = `<div class="mmap"><svg id="mpeople"></svg></div>`;
    body.classList.add('map');
    size(); draw();
  }
  // 长图上滚到某个文明、某一年
  function goTo(lane, v, smooth) {
    const g = geom(), x = (L.X[lane] - GAP / 2) * g.cw, y = g.y(v) - REF;
    body.scrollTo({ left: Math.max(0, x) * Z, top: Math.max(0, y) * Z, behavior: smooth && !reduceMotion() ? 'smooth' : 'auto' });
    redraw();
  }

  function paint() {
    document.querySelectorAll('#m .seg [data-m]').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === M.mode));
    tabs.hidden = !!M.focus;
    tabs.innerHTML = H.lanes.map(l => `<button data-lane="${l.id}" aria-pressed="${l.id === M.lane}">${l.name}</button>`).join('');
    lastLane = M.lane; markTab();
    segBar();
    body.classList.remove('map');
    M.mode === 'bands' ? bands() : map();
  }

  /* ---------- 关系聚焦 ---------- */
  // 人物：他本人排第一列；紧挨着是其他文明的相关人物（按文明分组，关系多的文明在前）；再往右是同一文明的相关人物。
  // 事件：参与的人按文明分组，事件所在的文明在前。
  // 时间只取这个人的一生和所有关系发生的年份（事件取前后几十年），压缩到人物卡上方的一屏之内。
  function focusOn(sel) {
    if (!M.focus) M.home = { z, x: slV(), y: stV(), all: M.all };
    const groups = [], cols = [];
    const add = (list, lane, name) => { if (!list.length) return; groups.push({ lane, a: cols.length, b: cols.length + list.length, name }); cols.push(...list); };
    const byLane = list => { const m = {}; list.forEach(o => (m[o.lane] ||= []).push(o)); return m; };
    let p = null, e = null, lo, hi;
    if (sel.t === 'p') {
      p = H.P[sel.id];
      const rels = H.relsOf(p.id), others = [...new Map(rels.map(r => [r.o.id, r.o])).values()];
      const first = o => Math.min(...rels.filter(r => r.o === o).map(r => r.year));
      add([p], p.lane, H.lane(p.lane).name);
      const fl = byLane(others.filter(o => o.lane !== p.lane));
      Object.keys(fl).sort((a, b) => fl[b].length - fl[a].length).forEach(l => add(fl[l].sort((x, y) => first(x) - first(y)), l, H.lane(l).name));
      add(others.filter(o => o.lane === p.lane).sort((x, y) => first(x) - first(y)), p.lane, t('m.sameLane', { lane: H.lane(p.lane).name }));
      const ys = rels.map(r => r.year);
      lo = Math.min(p.b0, ...ys) - 4; hi = Math.max(p.d, ...ys) + 4;
    } else {
      e = H.E[sel.id];
      const who = e.who.map(w => H.P[w]).filter(Boolean), fl = byLane(who);
      [e.lane, ...Object.keys(fl).filter(l => l !== e.lane)].forEach(l => fl[l] && add(fl[l].sort((x, y) => x.b0 - y.b0), l, H.lane(l).name));
      lo = Math.min(e.s - 5, ...who.map(q => Math.max(q.b0, e.s - 40))); hi = Math.max(e.e + 5, ...who.map(q => Math.min(q.d, e.e + 40)));
    }
    const room = vhV() - HDH - PEEK - 24;
    M.focus = { p, e, cols, groups, idx: new Map(cols.map((c, i) => [c.id, i])), lo, hi, k: H.clamp(room / (hi - lo), .4, 16) };
    M.mode = 'people'; M.peek = true;
    paint(); scrollV(0, 0); draw();
    if (!reduceMotion()) body.animate([{ opacity: .3, transform: 'scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
  }
  function exitFocus() {
    const h = M.home;
    M.focus = null; M.home = null;
    if (h) { z = h.z; M.all = h.all; L = layout(); }
    paint();
    if (h) { size(); scrollV(h.x, h.y); draw(); }
  }

  /* ---------- 人物卡 ---------- */
  function showCard() {
    sheet.classList.toggle('on', !!M.sel);
    sheet.classList.toggle('full', !!M.sel && M.full);
    sheet.classList.toggle('peek', !!M.sel && !M.full && M.peek);
    if (!M.sel) return;
    sheet.innerHTML = `<button class="mgrip" aria-label="${t('m.grip')}"></button>` + card(M.sel, { full: M.full, back: HIST.length ? nameOf(HIST[HIST.length - 1]) : '' });
    sheet.scrollTop = 0;
  }

  function select(sel, keep) {
    if (!keep) HIST.length = 0;
    M.sel = sel;
    if (!sel) { M.full = false; showCard(); setHash(null); if (M.focus) exitFocus(); else redraw(); return; }
    setHash(sel);
    // 没有相关的人可排的（没有关系的人、没有登记参与者的事件），不进聚焦，就在长图上滚到他那里
    const lonely = sel.t === 'p' ? !H.relsOf(sel.id).length : !H.E[sel.id].who.length;
    if (lonely) {
      if (M.focus) exitFocus();
      M.peek = false; showCard();
      const x = sel.t === 'p' ? H.P[sel.id] : H.E[sel.id];
      if (M.mode !== 'people') { M.mode = 'people'; paint(); }
      if (sel.t === 'p' && !M.all && x.imp < MAIN && LN[x.lane].ps.length > FEW) { M.all = true; L = layout(); segBar(); size(); }
      const g = geom(), px = sel.t === 'p' ? g.x(x) : g.xe(x);
      scrollV(px - vwV() / 2, g.y(sel.t === 'p' ? x.b0 : x.s) - REF); draw();
      return;
    }
    focusOn(sel); showCard();
  }

  // 两指缩放（电脑上按住 Ctrl 滚动滚轮）：手指中间的那一点不动
  function zoomBy(f, mx, my) {
    mx /= Z; my /= Z;
    const g0 = geom(), yr = g0.yr(stV() + my), u = (slV() + mx - AXW) / g0.cw;
    if (M.focus) M.focus.k = H.clamp(M.focus.k * f, .3, 40); else z = H.clamp(z * f, .08, 4);
    const g = size();
    scrollV(u * g.cw + AXW - mx, g.y(yr) - my);
    draw();
  }
  let pinch = null;
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  body.addEventListener('touchstart', e => { pinch = M.mode === 'people' && e.touches.length === 2 ? { d: dist(e.touches[0], e.touches[1]) } : null; }, { passive: true });
  body.addEventListener('touchmove', e => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const [a, b] = e.touches, d = dist(a, b), r = body.getBoundingClientRect();
    zoomBy(d / pinch.d, (a.clientX + b.clientX) / 2 - r.left, (a.clientY + b.clientY) / 2 - r.top); pinch.d = d;
  }, { passive: false });
  body.addEventListener('wheel', e => {
    if (!e.ctrlKey || M.mode !== 'people') return;
    e.preventDefault();
    const r = body.getBoundingClientRect(); zoomBy(Math.exp(-e.deltaY * .01), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  // 时代总览：左右滑动换到相邻的文明（顺序同顶上的标签），停在同一年
  let sw = null;
  body.addEventListener('touchstart', e => { sw = M.mode === 'bands' && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
  body.addEventListener('touchcancel', () => { sw = null; pinch = null; });
  body.addEventListener('touchend', e => {
    if (e.touches.length < 2) pinch = null;
    if (!sw || e.touches.length) return;
    const tc = e.changedTouches[0], dx = tc.clientX - sw.x, dy = tc.clientY - sw.y; sw = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const i = H.lanes.findIndex(l => l.id === M.lane), dir = dx < 0 ? 1 : -1, nx = H.lanes[i + dir];
    if (nx) switchBands(nx.id, dir);
  }, { passive: true });
  function switchBands(id, dir) {
    const v = bandYear();
    M.lane = id; paint(); if (v != null) bandsTo(v);
    if (dir && !reduceMotion()) body.animate([{ transform: `translateX(${dir * 40}px)` }, { transform: 'none' }], { duration: 200, easing: 'ease-out' });
  }

  // 换字号：仍停在同一年、同一处
  addEventListener('fzchange', () => {
    if (M.mode !== 'people') { const v = bandYear(); Z = fz(); paint(); if (v != null) bandsTo(v); return; }
    const x = slV(), y = stV(); Z = fz(); size(); scrollV(x, y); draw(); showCard();
  });
  addEventListener('resize', () => { if (M.mode === 'people') { size(); draw(); } });

  body.addEventListener('scroll', redraw);
  $('#m').addEventListener('click', e => {
    const el = e.target, to = cardTarget(e);
    const m = el.closest('[data-m]'), lane = el.closest('[data-lane]'), p = el.closest('#mpeople [data-p]'), ev = el.closest('#mpeople [data-e]');
    if (m) {
      const v = yearAt(), mode = m.dataset.m, ln = M.lane;   // 先记下文明：长图画第一帧时会按滚动位置改写 M.lane
      if (M.focus) { M.focus = null; M.home = null; }
      M.sel = null; M.full = false; HIST.length = 0; showCard(); setHash(null);
      M.mode = mode; paint();
      if (mode === 'people') goTo(ln,m.dataset.y != null ? +m.dataset.y : v != null ? v : H.FOCUS[0]); else if (v != null) bandsTo(v);
    }
    else if (lane) { if (M.mode === 'bands') switchBands(lane.dataset.lane); else { M.lane = lane.dataset.lane; markTab(); goTo(lane.dataset.lane, yearAt(), true); } }
    else if (el.closest('[data-z]')) zoomBy(el.closest('[data-z]').dataset.z > 0 ? 1.5 : 1 / 1.5, body.clientWidth / 2, body.clientHeight / 2);
    else if (el.closest('[data-map]')) select(null);
    else if (el.closest('[data-all]')) {
      const x = laneAt(), v = yearAt();
      M.all = !M.all; L = layout(); segBar(); size(); goTo(x, v);
    }
    else if (to) { HIST.push(M.sel); select(to, true); }
    else if (el.closest('.d-back')) select(HIST.pop(), true);
    else if (el.closest('.d-full')) { M.full = !M.full; showCard(); }
    else if (el.closest('.mgrip') || (sheet.classList.contains('peek') && el.closest('#msheet') && !el.closest('button, a'))) { M.peek = !M.peek; showCard(); }
    else if (el.closest('#mfind')) search.open(sel => select(sel));
    else if (el.closest('.close')) select(null);
    else if (p) {
      // 聚焦时点本人：收起或展开卡片；点别人：接着看他的关系（卡片上的“返回”回到上一位）
      if (M.sel && M.sel.t === 'p' && M.sel.id === p.dataset.p) { M.peek = !M.peek; showCard(); }
      else if (M.focus) { HIST.push(M.sel); select({ t: 'p', id: p.dataset.p }, true); }
      else select({ t: 'p', id: p.dataset.p });
    }
    else if (ev) select({ t: 'e', id: ev.dataset.e });
    else if (M.sel && !M.focus && el.closest('#mbody')) select(null);
  });

  paint();
  // 地址里的 #people、#rome（某个文明的人物）、#person/han-xin（某个人）
  const { sel, view } = readHash(H);
  addEventListener('hashchange', () => { const r = readHash(H); if (r.sel) select(r.sel); });
  if (sel) select(sel);
  else if (view === 'people' || LN[view]) {
    const ln = LN[view] ? view : M.lane;
    M.mode = 'people'; paint(); goTo(ln, H.FOCUS[0]);
  }
}
