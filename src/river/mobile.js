// 手机版时间长河：时间自上而下，人名竖排。所有文明并排连成一整张图，像地图一样拖动、两指缩放：
//   缩到最小是几千年的全貌，每个文明一条，朝代、时代是色块（点色块放大到那一段）；
//   放大以后人物的竖条、名字和大事浮出来。不再分“时代”“人物”两层。
//   点人物或事件进入“关系聚焦”：他和所有相关的人临时排在一起（其他文明的人紧挨着他），
//   时间压缩到一屏之内，连线都看得到。这个做法是对比了两个示例后定的，见 prototypes/links/ 和 docs/plan.md 2.6。
// 手指拖动、两指缩放、松手后的惯性滑动都由这里自己处理（#mbody 设了 touch-action: none），
// 不靠浏览器的滚动，所以各家浏览器（包括火狐）表现一样。
//
// 为了在手机上跟得上手指：图一次多画出屏幕外一圈（上下各约一屏，左右各半屏）。
// 手指移动、缩放时不重画，只把画好的图层整体平移、拉伸（CSS transform，由显卡做）；
// 手停下来，或者快要露出没画到的地方、拉伸得太厉害时，才重画一次。
// 重画在手机上很贵（整张图要重新生成、重新上屏，一次几十毫秒），所以能少画一次就少画一次：
//   · 文明变宽变窄一步到位，不做逐帧过渡（过渡要连着重画十几次，每次松手都卡一下）；
//   · 手还在动的时候，多画的那一圈偏向前进的方向，文明宽度也按画出来的整段来定，画一次能顶更远；
//   · 松手以后等一小会儿（IDLE 毫秒）才按停下的位置重画，接着再划就不画，连着划不会越划越卡。
// 图分三层：人物（#mpeople）、顶上的文明名（#mhead，只跟着左右动）、左边的年份（#maxis，只跟着上下动）。
import { fades, fadeOf, setHash, readHash, cardTarget, reduceMotion, fz } from './util.js';

export function mobile(H, card, search) {
  const $ = s => document.querySelector(s), t = H.t;
  const body = $('#mbody'), sheet = $('#msheet'), tabs = $('#mtabs'), seg = $('#mseg');
  // 图上的尺寸都是字号放大前的；整张图按字号倍数 Z 放大（svg 的 viewBox 取屏幕尺寸 ÷ Z）
  const AXW = 46, HDH = 36, NH = 14, BASEK = 8, GAP = .8, MINW = 24, FCW = 34, PEEK = 150, MAIN = 4, FEW = 9, ZMAX = 4;
  const Y0 = H.EXTENT[0], Y1 = H.EXTENT[1];
  const M = { lane: H.site.default_open[0] || H.lanes[0].id, all: true, sel: null, full: false, peek: false, focus: null, home: null };
  const HIST = [], nameOf = s => (s.t === 'p' ? H.P[s.id] : H.E[s.id]).n;
  let Z = fz(), z = .15;   // z：缩放倍数，1 是一年 8 像素、人名都写得出的大小
  let SL = 0, ST = 0;      // 滚动位置（屏幕像素，已乘字号倍数）
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fit = (s, w, px = 12.5) => { const n = Math.floor(w / px); return n >= s.length ? s : n > 1 ? s.slice(0, n - 1) + '…' : ''; };

  // 每个文明里的人分列排：重要的人先占位，排在左边；列与列之间留出竖写名字的地方。
  // 事件占文明最左边的一列（重要度 3 以上的）。“只看主要”时只排重要度 4 以上的人（人少的文明全排）。
  const LN = {};
  H.lanes.forEach(l => {
    const ps = H.byWeight(H.people.filter(p => p.lane === l.id)), end = p => Math.max(p.d, p.b0 + (p.n.length * NH + 12) / BASEK);
    const main = ps.length <= FEW ? ps : ps.filter(p => p.imp >= MAIN);
    const evs = H.events.filter(e => e.lane === l.id && e.imp >= 3).sort((a, b) => a.s - b.s);
    LN[l.id] = { ps, main, byImp: H.byWeight(evs), cA: H.pack(ps, p => p.b0, end, 2, 'mcA'), cM: H.pack(main, p => p.b0, end, 2, 'mcM'), ec: evs.length ? 1 : 0 };
  });
  const colOf = p => (M.all ? p.mcA : p.mcM);
  // 文明宽度随眼前变化：WV 是各文明正在显示的列数（变化时逐帧过渡，可以是小数）。
  // 列号仍是整个文明统一排的，所以上下拖动时同一个人不换列；只是用不到的右边几列收起来
  const WV = {};
  const units = id => WV[id] ?? Math.max(1, LN[id].ec + (M.all ? LN[id].cA : LN[id].cM));

  const vwV = () => body.clientWidth / Z, vhV = () => body.clientHeight / Z, slV = () => SL / Z, stV = () => ST / Z;
  const zMin = () => Math.min(.5, (vhV() - HDH - 30) / (Y1 - Y0) / BASEK);   // 缩到最小：几千年正好一屏
  // 缩小以后朝代色块渐显：z 在 .35 以下开始显出，.1 以下最浓。浓到一半以上时点图上任何地方都是“放大到这一段”
  const bandA = () => (M.focus ? 0 : H.clamp((.35 - z) / .25, 0, 1));

  // 坐标：整张图上的位置（放大前）。减去滚动距离（也换算成放大前）才是屏幕上的位置。
  // 每个文明的宽度 = 列数 × 列宽，但不窄于 MINW，缩到很小时每个文明仍是看得见的一条
  function geom() {
    if (M.focus) {
      const F = M.focus;
      return { k: F.k, cwOf: () => FCW, y: v => HDH + (v - F.lo) * F.k, yr: Y => F.lo + (Y - HDH) / F.k, x: p => AXW + (F.idx.get(p.id) + .5) * FCW,
        W: AXW + F.cols.length * FCW + 40, Ht: HDH + (F.hi - F.lo) * F.k + PEEK + 40 };
    }
    const k = BASEK * z, cw = 30 * H.clamp(z, .04, 1), G = Math.max(4, GAP * cw), X0 = {}, WW = {};
    let x = AXW + G / 2;
    H.lanes.forEach(l => { X0[l.id] = x; WW[l.id] = Math.max(MINW, units(l.id) * cw); x += WW[l.id] + G; });
    const cwOf = id => WW[id] / units(id);
    return { k, G, X0, WW, cwOf, y: v => HDH + (v - Y0) * k, yr: Y => Y0 + (Y - HDH) / k,
      x: p => X0[p.lane] + (LN[p.lane].ec + colOf(p) + .5) * cwOf(p.lane), xe: e => X0[e.lane] + .5 * cwOf(e.lane),
      W: x + vwV() * .7, Ht: HDH + (Y1 - Y0) * k + 160 };   // 右边留白，最后一个文明也能滚到屏幕左边
  }
  // 滚动不能超出图的范围
  function clampScroll(g = geom()) {
    SL = H.clamp(SL, 0, Math.max(0, g.W * Z - body.clientWidth));
    ST = H.clamp(ST, 0, Math.max(0, g.Ht * Z - body.clientHeight));
    return g;
  }
  const scrollV = (x, y) => { if (x != null) SL = x * Z; if (y != null) ST = y * Z; clampScroll(); };
  const REF = HDH + 70;   // 换文明时保持在同一年：取屏幕上方这个位置对应的年份
  const yearAt = () => geom().yr(stV() + REF);
  // 横向的“锚”：屏幕上某一点落在哪个文明的几分之几处。缩放前后让它不动
  function anchorAt(g, xv) {
    if (!g.X0) return { x: xv };
    const id = H.lanes.reduce((a, l) => (xv >= g.X0[l.id] - g.G / 2 ? l.id : a), H.lanes[0].id);
    return { id, f: (xv - g.X0[id]) / g.WW[id] };
  }
  const anchorX = (g, a) => (a.id ? g.X0[a.id] + a.f * g.WW[a.id] : a.x);
  // 屏幕正中（年份栏右边那一块的中间）是哪个文明（顶上的文明标签跟着它走）
  function laneAt() {
    const g = geom(), c = slV() + (AXW + vwV()) / 2, d = id => Math.max(g.X0[id] - g.G / 2 - c, c - g.X0[id] - g.WW[id] - g.G / 2, 0);
    return H.lanes.reduce((a, l) => (d(l.id) < d(a) ? l.id : a), H.lanes[0].id);
  }
  // 把某个文明摆在屏幕上：比屏幕窄就居中，宽就靠左
  const laneLeft = (g, id) => (g.WW[id] > vwV() - AXW - 12 ? AXW + 6 : AXW + (vwV() - AXW - g.WW[id]) / 2);
  let pin = null;   // 刚点过（飞过去）的文明：手指左右拖动以前，小栏和标签一直算它
  function place(lane, v, sy = REF) { pin = lane; scrollV(null, geom().y(v) - sy); fitW(); const g = geom(); scrollV(g.X0[lane] - laneLeft(g, lane), null); draw(); }

  // 屏幕上看得见的年份范围（顶上文明标签下面到屏幕底），上下各多算 SEEN_PAD 像素：人快露出来时文明就开始加宽
  const SEEN_PAD = 40;
  const seenRange = g => [g.yr(stV() + HDH - SEEN_PAD), g.yr(stV() + vhV() + SEEN_PAD)];
  // 某个文明在这段年份里要几列（事件那一列也算上）
  function need(id, yA, yB) {
    const L = LN[id];
    let n = 0;
    for (const p of M.all ? L.ps : L.main) if (p.d >= yA && p.b0 <= yB && colOf(p) >= n) n = colOf(p) + 1;
    return Math.max(1, L.ec + n);
  }
  // 各文明该有多宽：只看屏幕上看得见的这一段里用到第几列。人少的时段文明变窄，右边的文明跟着左移；拖到人多的时段再变宽。
  // 屏幕外预先画好的那一圈不算：那里放不下的人先不画（见 draw），拖过去时 preview() 发现放不下就重画、加宽。
  // 一步到位，不做逐帧过渡：过渡要每帧整张重画，手机上会一卡一卡的。
  // span（手还在动时才给）：按画出来的整段年份定宽度，而且只加宽不收窄，这样往前拖很远也不用为加宽再重画；
  // 手停下来以后不给 span，一步收到眼前该有的宽度（见 settle）
  function fitW(span) {
    const [yA, yB] = span || seenRange(geom());
    H.lanes.forEach(l => { const want = need(l.id, yA, yB), cur = WV[l.id]; WV[l.id] = span && cur != null ? Math.max(cur, want) : want; });
  }
  // 平滑地飞到某个文明、某一年、某个缩放倍数（过程中只拉伸画面，到了再重画）
  let fly = 0;
  function flyTo(lane, v, z1, sy = REF) {
    cancelAnimationFrame(fly); fly = 0; stopGlide(); pin = lane;
    const g0 = geom(), sx0 = g0.X0[lane] - slV(), sy0 = g0.y(v) - stV(), za = z;
    z = z1; const sx1 = laneLeft(geom(), lane); z = za;
    if (reduceMotion()) { z = z1; place(lane, v, sy); return; }
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / 380), e = 1 - Math.pow(1 - p, 3);
      z = Math.exp(H.lerp(Math.log(za), Math.log(z1), e));
      const g = geom(); scrollV(g.X0[lane] - H.lerp(sx0, sx1, e), g.y(v) - H.lerp(sy0, sy, e));
      if (p < 1) { show(); fly = requestAnimationFrame(step); } else { fly = 0; draw(); }
    };
    fly = requestAnimationFrame(step);
  }

  /* ---------- 画面跟手：先平移、拉伸画好的图层，必要时才重画 ---------- */
  let R = null, vraf = 0, idle = 0;   // R：上一次重画时的状态
  let zooming = false;      // 两指缩放（或电脑上 Ctrl+滚轮缩放）进行中
  const OXF = .5, OYF = 1;  // 屏幕外多画的宽度：左右各半屏，上下各一屏（手在动时偏向前进的方向，见 draw）
  const AHEAD = .8, IDLE = 120;
  const trav = { x: 0, y: 0 };   // 最近手指往哪边动（越近的分量越重），用来决定多画的那一圈偏向哪边
  // 状态变了（手在动）：在下一帧里能用平移、拉伸顶住就顶住，顶不住才重画
  const show = () => { clearTimeout(idle); if (!vraf) vraf = requestAnimationFrame(() => { vraf = 0; if (!preview()) draw(true); }); };
  // 停下来了：状态和上次画的不一样就重画一次，文明宽度收到眼前该有的宽度。
  // 刚缩放完（zoomed）马上重画：拉伸过的字是糊的。只是拖动的话字本来就清楚，等 IDLE 毫秒再画，
  // 这期间手指又按下来就不画了（show、touchstart 会取消），连着划的时候不会每划一下都重画
  const settle = (zoomed = false) => {
    clearTimeout(idle);
    if (zoomed) { cancelAnimationFrame(vraf); vraf = requestAnimationFrame(() => { vraf = 0; draw(); }); return; }
    if (!vraf && !preview()) { draw(); return; }   // 最后一下移动先跟上
    if (R && !R.live && R.sl === slV() && R.st === stV() && R.k === geom().k) return;
    idle = setTimeout(() => draw(), IDLE);
  };
  function preview() {
    const main = $('#mpeople'), head = $('#mhead'), axis = $('#maxis');
    if (!R || !main || R.focus !== M.focus || R.Z !== Z || R.all !== M.all) return false;
    const g = geom(), vw = vwV(), vh = vhV(), sl = slV(), st = stV();
    // 上下：屏幕位置和年份是线性的，新位置 = Ay × 旧位置 + by
    const Ay = g.k / R.k, by = HDH * (1 - Ay) + Ay * R.st - st;
    // 左右：取屏幕中间两点看它们现在落在哪里，近似成线性
    let Ax = 1, bx = R.sl - sl;
    if (g.X0) {
      const c = vw / 2, x1 = anchorX(g, anchorAt(R.g, R.sl + c - 20)) - sl, x2 = anchorX(g, anchorAt(R.g, R.sl + c + 20)) - sl;
      Ax = (x2 - x1) / 40; bx = (x1 + x2) / 2 - Ax * c;
    }
    // 拉伸太多，字会糊、变形。缩放手势进行中放宽些（手停下来马上会重画清楚），少重画几次，跟手更顺
    const loose = zooming || fly, lo = loose ? .45 : .7, hi = loose ? 3 : 1.45;
    if (Ax < lo || Ax > hi || Ay < lo || Ay > hi) return false;
    // 画好的范围在新位置上还得盖满屏幕
    if (Ax * -R.mL + bx > 0 || Ax * (vw + R.mR) + bx < vw || Ay * -R.mT + by > 0 || Ay * (vh + R.mB) + by < vh) return false;
    // 拖到人多的时段，屏幕上的文明放不下了（放不下的人上次没画）：重画、加宽
    if (R.cap) {
      const [yA, yB] = seenRange(g);
      if (H.lanes.some(l => g.X0[l.id] - sl < vw && g.X0[l.id] + g.WW[l.id] - sl > 0 && need(l.id, yA, yB) > R.cap[l.id])) return false;
    }
    let tx = ((Ax - 1) * -R.mL + bx) * Z, ty = ((Ay - 1) * -R.mT + by) * Z;
    // 只是平移时对齐到屏幕像素，字不发虚
    if (Math.abs(Ax - 1) < 1e-6 && Ay === 1) { const d = devicePixelRatio || 1; tx = Math.round(tx * d) / d; ty = Math.round(ty * d) / d; }
    main.style.transform = `translate(${tx}px,${ty}px) scale(${Ax},${Ay})`;
    head.style.transform = `translate(${tx}px,0) scale(${Ax},1)`;
    axis.style.transform = `translate(0,${ty}px) scale(1,${Ay})`;
    return true;
  }

  /* ---------- 画图（长图和关系聚焦同一个画法，聚焦时只画相关的人） ---------- */
  function draw(live = false) {   // live：手还在动（拖动、缩放、惯性滑动、飞过去的途中）
    cancelAnimationFrame(vraf); vraf = 0;
    if (!live) clearTimeout(idle);
    const main = $('#mpeople'), head = $('#mhead'), axis = $('#maxis');
    if (!main) return;
   
    // 屏幕外多画多少。停着时四周一样多；手在动时偏向前进的方向（总量不变），前面能顶得更久才需要重画
    const vw0 = vwV(), vh0 = vhV(), ox2 = 2 * Math.round(vw0 * OXF), oy2 = 2 * Math.round(vh0 * OYF);
    let mL = ox2 / 2, mT = oy2 / 2;
    if (live && !zooming && !fly) {
      if (Math.abs(trav.x) > 12) mL = Math.round(ox2 * (trav.x > 0 ? AHEAD : 1 - AHEAD));   // 手指往右拖，露出来的是左边
      if (Math.abs(trav.y) > 12) mT = Math.round(oy2 * (trav.y > 0 ? AHEAD : 1 - AHEAD));
    }
    const mR = ox2 - mL, mB = oy2 - mT;
    if (!M.focus) {
      // 先定各文明的宽度。左边的文明变宽变窄时，屏幕中间那个文明（刚点过的优先）的左边缘停在原处，眼前的内容不跟着跳；
      // 它自己变窄时右边缘尽量不动，免得整条缩出屏幕，但左边缘最多挪到年份栏旁边
      const g0 = clampScroll(), id = pin && g0.X0[pin] + g0.WW[pin] - slV() > AXW + 10 && g0.X0[pin] - slV() < vwV() - 10 ? pin : laneAt();
      const s0 = g0.X0[id] - slV(), w0 = g0.WW[id];
      fitW(live && R ? [g0.yr(stV() - mT), g0.yr(stV() + vh0 + mB)] : null);
      const g1 = geom();
      SL = (g1.X0[id] - Math.max(s0, Math.min(AXW + 6, s0 + w0 - g1.WW[id]))) * Z;
    }
    const g = clampScroll(), vw = vwV(), vh = vhV(), sl = slV(), st = stV(), F = M.focus, A = bandA(), coarse = A >= .5;
    const WL = vw + ox2, HL = vh + oy2, xL = -mL, xR = vw + mR, yT = -mT, yBt = vh + mB;
    // cap：各文明这次画到第几列。宽度只按屏幕上看得见的定，屏幕外那一圈里超出的人先不画，免得画到右边的文明里
    const cap = F ? null : Object.fromEntries(H.lanes.map(l => [l.id, Math.ceil(units(l.id) - 1e-6)]));
    R = { g, k: g.k, sl, st, mL, mR, mT, mB, focus: F, Z, all: M.all, cap, live };
    // 三个图层的位置和大小；viewBox 从 (xL, yT) 起，图里一律用屏幕坐标
    const lay = (el, l, tp, w, h, vb) => { el.style.left = l * Z + 'px'; el.style.top = tp * Z + 'px'; el.style.transform = ''; el.setAttribute('width', w * Z); el.setAttribute('height', h * Z); el.setAttribute('viewBox', vb); };
    lay(main, xL, yT, WL, HL, `${xL} ${yT} ${WL} ${HL}`);
    lay(head, xL, 0, WL, HDH, `${xL} 0 ${WL} ${HDH}`);
    lay(axis, 0, yT, AXW, HL, `0 ${yT} ${AXW} ${HL}`);
    main.classList.toggle('coarse', coarse);
    const Y = v => g.y(v) - st, X = p => g.x(p) - sl;
    const yA = g.yr(st + yT) - 2, yB = g.yr(st + yBt) + 2, mid = g.yr(st + (vh + HDH) / 2), lo = F ? F.lo : Y0, hi = F ? F.hi : Y1;
    const selP = M.sel && M.sel.t === 'p' ? H.P[M.sel.id] : null, selE = M.sel && M.sel.t === 'e' ? H.E[M.sel.id] : null;
    const rels = F && selP ? H.relsOf(selP.id) : [];
    const o = [];

    // 文明（聚焦时是“本人 / 各文明 / 同一文明”几组）的底色和分界线
    const lanes = (F ? F.groups.map(gr => ({ id: gr.lane, name: gr.name, x0: AXW + gr.a * FCW - sl, x1: AXW + gr.b * FCW - sl }))
      : H.lanes.map(l => ({ id: l.id, name: l.name, x0: g.X0[l.id] - g.G / 2 - sl, x1: g.X0[l.id] + g.WW[l.id] + g.G / 2 - sl })))
      .filter(l => l.x1 > xL && l.x0 < xR);
    lanes.forEach((l, i) => {
      const c = H.lane(l.id).c;
      o.push(`<rect x="${l.x0}" y="${yT}" width="${l.x1 - l.x0}" height="${HL}" fill="${c}" fill-opacity="${i % 2 ? .07 : .04}"/><line x1="${l.x0}" x2="${l.x0}" y1="${yT}" y2="${yBt}" stroke="var(--line)"/>`);
      if (F) return;
      H.lane(l.id).bands.forEach((b, bi) => {
        if (b[2] <= yA || b[1] >= yB) return;
        const y1 = Y(b[1]), y2 = Y(b[2]), w = l.x1 - l.x0 - 2;
        // 缩小以后：朝代、时代画成色块，深浅相间；放得下就竖写名称。传统说法的时期颜色浅一些
        if (A > 0) {
          o.push(`<rect class="bd" data-b="${l.id}:${bi}" x="${l.x0 + 1}" y="${y1}" width="${w}" height="${y2 - y1}" fill="${c}" fill-opacity="${(bi % 2 ? .2 : .11) * (b[3] ? .7 : 1) * A}"/>`);
          const n = b[0].length * 13 + 10, cx = (l.x0 + l.x1) / 2;
          if (A > .4 && w >= 15 && y2 - y1 >= n) o.push(`<text class="bn" x="${cx}" y="${H.clamp(HDH + 8, y1 + 6, y2 - n + 4)}" opacity="${A}">${b[0]}</text>`);
        }
        // 只排先后、不标年份的时期（太初）：斜线底纹，这一段的位置只表示次序
        if (b[3] === 'l') {
          o.push(`<rect x="${l.x0}" y="${y1}" width="${l.x1 - l.x0}" height="${y2 - y1}" fill="url(#mhatch)" pointer-events="none"/>`);
          if (w > 150) o.push(`<text class="ax" x="${Math.max(l.x0, AXW) + 6}" y="${Math.max(y1, HDH) + 16}">${b[0]}：${t('m.onlyOrder')}</text>`);
        }
      });
    });
    // 年份刻度：落在整十、整百的年份上（公元前按“前 n 年”的 n 取整）
    const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find(s => s * g.k >= 46) || 1000, ticks = [];
    for (let v = Math.ceil(Math.max(yA, lo)); v <= Math.min(yB, hi); v++) {
      if ((v <= 0 ? 1 - v : v) % step) continue;
      const y = Y(v);
      ticks.push([v, y]); o.push(`<line x1="${xL}" x2="${xR}" y1="${y}" y2="${y}" stroke="var(--line)" opacity=".6" pointer-events="none"/>`);
    }

    // 事件（每个文明最左边的一列，放大到一定程度才出现）：◆ 都画；竖写的名字放得下才写，重要的先占位置。
    // 持续多年的事件下面拖一条线
    if (!F && z >= .3) H.lanes.forEach(l => {
      const cw = g.cwOf(l.id), x = g.X0[l.id] + cw / 2 - sl;
      if (!LN[l.id].ec || x < xL - 10 || x > xR + 10) return;
      const taken = [], named = new Set(), vis = LN[l.id].byImp.filter(e => e.e >= yA - 40 && e.s <= yB);
      if (cw >= 20) vis.forEach(e => {
        const a = Y(e.s) - 6, b = Y(e.s) + 9 + e.n.length * 12;
        if (e === selE || !taken.some(([c, d]) => a < d + 4 && c < b + 4)) { taken.push([a, b]); named.add(e); }
      });
      [...vis].reverse().forEach(e => {
        const y1 = Y(e.s), y2 = Y(Math.max(e.s, e.e)), on = !selE || e === selE, nm = named.has(e);
        o.push(`<g class="ev" data-e="${e.id}" opacity="${on ? 1 : .25}"><rect x="${x - cw / 2}" y="${y1 - 7}" width="${cw}" height="${(nm ? e.n.length * 12 + 4 : 0) + 14}" fill="transparent"/>
          ${y2 > y1 + 2 ? `<line x1="${x}" x2="${x}" y1="${y1}" y2="${y2}" stroke="var(--ink)" stroke-width="2.5" opacity=".4"/>` : ''}
          ${nm ? `<path d="M${x} ${y1 - 5}l5 5l-5 5l-5-5z" fill="var(--ink)"/>` : `<path d="M${x} ${y1 - 3}l3 3l-3 3l-3-3z" fill="var(--ink-2)"/>`}${nm ? `<text class="evn" x="${x - 1}" y="${y1 + 9}"${e === selE ? ' font-weight="700"' : ''}>${e.n}</text>` : ''}</g>`);
      });
    });

    // 人物竖条：条的长度是寿命，右边的细条是在位时间，一头渐隐表示生年或卒年不详。
    // 缩得很小时只画成小色块（不能点，点下去是放大到那一段）
    (F ? F.cols : M.all ? H.people : H.lanes.flatMap(l => LN[l.id].main)).forEach(p => {
      if (p.d < yA || p.b0 > yB || (cap && LN[p.lane].ec + colOf(p) >= cap[p.lane])) return;
      const x = X(p);
      if (x < xL - 20 || x > xR + 20) return;
      const c = H.FAC[p.fac].c, fade = fadeOf(p, 'v'), cw = g.cwOf(p.lane), w = Math.max(1, Math.min(24, cw * .8)), me = selP === p;
      const y1 = Y(Math.max(p.b0, lo)), y2 = Y(Math.min(p.d, hi));
      if (coarse) { o.push(`<rect x="${x - w / 2}" y="${y1}" width="${w}" height="${Math.max(1, y2 - y1)}" fill="${fade || c}" fill-opacity="${fade ? 1 : .22 + .3 * A}"/>`); return; }
      const on = !selE || !selE.who.length || selE.who.includes(p.id);
      const ny = H.clamp(HDH + 6, y1 + 5, Math.max(y1 + 5, y2 - p.n.length * NH - 3));
      const name = cw >= 20 && (F || z >= .99 || y2 - y1 >= p.n.length * NH);
      o.push(`<g class="pp" data-p="${p.id}" opacity="${on ? 1 : .15}"><rect x="${x - w / 2}" y="${y1}" width="${w}" height="${Math.max(1, y2 - y1)}" rx="${w >= 6 ? 3 : 0}" fill="${fade || c}" fill-opacity="${fade ? 1 : .22 + .3 * A}"${me ? ` stroke="${c}" stroke-width="2"` : (p.ns || p.cert) && w >= 6 ? ` stroke="${c}" stroke-dasharray="3 3" stroke-opacity=".8"` : ''}/>
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
      if (y < yT || y > yBt) return;
      const rt = H.RT[r.t], x1 = X(selP), x2 = X(r.o), dir = x2 >= x1 ? 1 : -1;
      o.push(`<g pointer-events="none"><line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke="${rt.c}" stroke-width="1.8"${rt.dash ? ` stroke-dasharray="${rt.dash}"` : ''}/><circle cx="${x1}" cy="${y}" r="3" fill="${rt.c}"/><circle cx="${x2}" cy="${y}" r="3.6" fill="var(--paper)" stroke="${rt.c}" stroke-width="1.8"/>
        ${label(r.label.slice(0, 8), x2, y, dir, Math.abs(x2 - x1))}</g>`);
    });
    // 事件：一条横线连起所有参与的人
    const ax = [];
    if (selE && !coarse) {
      const xs = selE.who.map(w => H.P[w]).filter(p => !F || F.idx.has(p.id)).filter(p => M.all || F || p.imp >= MAIN || LN[p.lane].ps.length <= FEW).map(X), y = Y(selE.s);
      const x0 = F ? AXW : g.xe(selE) - sl;
      if (xs.length && y > yT && y < yBt) o.push(`<g pointer-events="none"><line x1="${Math.min(x0, ...xs)}" x2="${Math.max(x0, ...xs)}" y1="${y}" y2="${y}" stroke="var(--ink)" stroke-width="1.4"/>${xs.map(v => `<circle cx="${v}" cy="${y}" r="3.4" fill="var(--ink)"/>`).join('')}</g>`);
      if (F) ax.push(`<line x1="${AXW - 4}" x2="${AXW - 4}" y1="${y - 5}" y2="${Math.max(y + 5, Y(selE.e))}" stroke="var(--ink)" stroke-width="4"/><text class="ax" x="${AXW - 8}" y="${y + 4}" text-anchor="end" font-weight="700">${H.fmt(selE.s)}</text>`);
    }
    main.innerHTML = o.join('');

    // 左边的年份栏
    axis.innerHTML = `<rect x="0" y="${yT}" width="${AXW}" height="${HL}" fill="var(--paper)"/><line x1="${AXW}" x2="${AXW}" y1="${yT}" y2="${yBt}" stroke="var(--line)"/>`
      + (F && F.p && F.p.ns ? '' : ticks.map(([v, y]) => `<text class="ax" x="${AXW - 5}" y="${y + 4}" text-anchor="end">${H.fmt(v)}</text>`).join('')) + ax.join('');
    // 顶上的文明名：名字钉在屏幕上露出的那一段的左头
    const hd = [`<rect x="${xL}" width="${WL}" height="${HDH}" fill="var(--paper)"/><line x1="${xL}" x2="${xR}" y1="${HDH - .5}" y2="${HDH - .5}" stroke="var(--line)"/>`];
    lanes.forEach(l => {
      const a = Math.max(l.x0 + 1, AXW + 1), w = Math.min(l.x1 - 1, vw) - a, band = F ? null : H.bandAt(H.lane(l.id), mid);
      hd.push(`<rect x="${Math.max(l.x0 + 1, xL)}" y="3" width="${Math.max(0, Math.min(l.x1 - 1, xR) - Math.max(l.x0 + 1, xL))}" height="${HDH - 6}" rx="4" fill="${H.lane(l.id).c}"/>`);
      // 窄的只写名称的头两个字，再窄就不写
      const nm = w - 8 >= l.name.length * 12.5 ? l.name : w < 60 ? l.name.slice(0, 2) : fit(l.name, w - 8);
      if (w > 26) hd.push(`<text class="hd" x="${w < 40 ? a + w / 2 : a + 5}"${w < 40 ? ' text-anchor="middle"' : ''} y="${band && w >= 40 ? 16 : 23}">${nm}</text>${band && w >= 40 ? `<text class="hb" x="${a + 5}" y="${HDH - 8}">${fit(band[0], w - 8, 11)}</text>` : ''}`);
    });
    head.innerHTML = hd.join('');
    if (!F) syncLane();
  }

  // 图上方的一条小栏：长图上是“当前文明与年份 / 全貌 / 缩放 / 只看主要”；聚焦时是“全图 / 聚焦谁 / 缩放”
  function segBar() {
    const zoom = `<button data-z="-1" aria-label="${t('m.zoomOut')}">−</button><button data-z="1" aria-label="${t('m.zoomIn')}">+</button>`;
    if (M.focus) {
      const F = M.focus;
      seg.innerHTML = `<button class="back" data-map>${t('m.map')}</button><span><b>${t('m.focusOn', { name: F.p ? F.p.n : F.e.n })}</b><i>${t('m.related', { n: F.cols.length - (F.p ? 1 : 0) })}</i></span>${zoom}`;
      return;
    }
    seg.innerHTML = `<span id="mwhere"></span><button class="back" data-whole>${t('m.whole')}</button>${zoom}
      <button class="all" data-all aria-pressed="${M.all}">${M.all ? t('m.mainShort') : t('m.allShort', { n: H.people.length })}</button>`;
  }
  let lastLane = null;
  function syncLane() {
    const g = geom(), seen = pin && g.X0[pin] + g.WW[pin] - slV() > AXW + 10 && g.X0[pin] - slV() < vwV() - 10;
    const id = seen ? pin : laneAt(), l = H.lane(id), v = geom().yr(stV() + (vhV() + HDH) / 2), b = H.bandAt(l, v), w = $('#mwhere');   // 屏幕正中那一年
    M.lane = id;
    if (w) w.innerHTML = `<b>${l.name}</b><i>${b ? b[0] : ''}${b && b[3] === 'l' ? '' : ' · ' + H.fmt(Math.round(v))}</i>`;
    if (id !== lastLane) { lastLane = id; markTab(); }
  }
  function markTab() {
    tabs.querySelectorAll('[data-lane]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lane === M.lane));
    const on = tabs.querySelector('[aria-pressed="true"]');
    if (on) tabs.scrollTo({ left: on.offsetLeft - (tabs.clientWidth - on.offsetWidth) / 2, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  // 搭好图层（不画）。渐变、底纹只在这里生成一次，三个图层共用
  function paint() {
    tabs.hidden = !!M.focus;
    tabs.innerHTML = H.lanes.map(l => `<button data-lane="${l.id}" aria-pressed="${l.id === M.lane}">${l.name}</button>`).join('');
    lastLane = M.lane; markTab();
    segBar();
    if (!$('#mpeople')) body.innerHTML = `<svg class="mdefs" width="0" height="0" aria-hidden="true"><defs>${fades(H, 'v')}<pattern id="mhatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line y2="7" stroke="var(--ink-2)" stroke-opacity=".22"/></pattern></defs></svg>
      <svg id="mpeople" class="mly"></svg><svg id="maxis" class="mly" aria-hidden="true"></svg><svg id="mhead" class="mly" aria-hidden="true"></svg><div class="mcorner"></div>`;
    R = null;
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
    cancelAnimationFrame(fly); fly = 0; stopGlide();
    M.focus = { p, e, cols, groups, idx: new Map(cols.map((c, i) => [c.id, i])), lo, hi, k: H.clamp(room / (hi - lo), .4, 16) };
    M.peek = true;
    paint(); scrollV(0, 0); draw();
    if (!reduceMotion()) body.animate([{ opacity: .3, transform: 'scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
  }
  function exitFocus() {
    const h = M.home;
    M.focus = null; M.home = null;
    if (h) { z = h.z; M.all = h.all; }
    paint();
    if (h) scrollV(h.x, h.y);
    draw();
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
    if (!sel) { M.full = false; showCard(); setHash(null); if (M.focus) exitFocus(); else draw(); return; }
    setHash(sel);
    // 没有相关的人可排的（没有关系的人、没有登记参与者的事件），不进聚焦，就在长图上放大、滚到他那里
    const lonely = sel.t === 'p' ? !H.relsOf(sel.id).length : !H.E[sel.id].who.length;
    if (lonely) {
      if (M.focus) exitFocus();
      M.peek = false; showCard();
      const x = sel.t === 'p' ? H.P[sel.id] : H.E[sel.id];
      if (sel.t === 'p' && !M.all && x.imp < MAIN && LN[x.lane].ps.length > FEW) { M.all = true; segBar(); }
      cancelAnimationFrame(fly); fly = 0; stopGlide();
      z = Math.max(z, 1);
      const g = geom(), px = sel.t === 'p' ? g.x(x) : g.xe(x);
      scrollV(px - vwV() / 2, g.y(sel.t === 'p' ? x.b0 : x.s) - REF); draw();
      return;
    }
    focusOn(sel); showCard();
  }

  /* ---------- 手势 ---------- */
  // 缩放时手指中间（或屏幕中间）的那一点不动。只改状态，画面由 show() / settle() 跟上
  function zoomBy(f, mx, my) {
    mx /= Z; my /= Z;
    const g0 = geom(), yr = g0.yr(stV() + my), a = anchorAt(g0, slV() + mx);
    if (M.focus) M.focus.k = H.clamp(M.focus.k * f, .3, 40); else z = H.clamp(z * f, zMin(), ZMAX);
    const g = geom();
    scrollV(anchorX(g, a) - mx, g.y(yr) - my);
  }
  const panBy = (dx, dy) => { if (Math.abs(dx) > .5) pin = null; SL -= dx; ST -= dy; trav.x = trav.x * .9 + dx; trav.y = trav.y * .9 + dy; clampScroll(); };
  // 一根手指拖动，两根手指缩放（同时跟着手指中点平移），松手后按手指的速度惯性滑一段。
  // 拖动过的那一下不算“点”，免得一松手就选中了手指下的人
  let tp = null, glide = 0, eat = false;
  const stopGlide = () => { cancelAnimationFrame(glide); glide = 0; };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pts = e => [...e.touches].map(c => ({ x: c.clientX, y: c.clientY }));
  function startTouch(e) {
    const p = pts(e), moved = tp ? tp.moved : false;
    tp = p.length >= 2 ? { two: true, d: dist(p[0], p[1]) || 1, mx: (p[0].x + p[1].x) / 2, my: (p[0].y + p[1].y) / 2, moved: true }
      : { two: false, x: p[0].x, y: p[0].y, moved, v: [] };
    zooming = tp.two;
  }
  body.addEventListener('touchstart', e => {
    stopGlide(); cancelAnimationFrame(fly); fly = 0; clearTimeout(idle);
    if (e.touches.length === 1) { tp = null; trav.x = trav.y = 0; }
    startTouch(e);
  }, { passive: true });
  body.addEventListener('touchmove', e => {
    if (!tp) return;
    e.preventDefault();
    const p = pts(e);
    if (p.length >= 2 && tp.two) {
      const d = dist(p[0], p[1]) || 1, mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2, r = body.getBoundingClientRect();
      panBy(mx - tp.mx, my - tp.my);
      zoomBy(d / tp.d, mx - r.left, my - r.top);
      Object.assign(tp, { d, mx, my });
      show();
    } else if (p.length === 1 && !tp.two) {
      const dx = p[0].x - tp.x, dy = p[0].y - tp.y;
      if (!tp.moved && Math.abs(dx) + Math.abs(dy) < 8) return;   // 还算是点一下
      tp.moved = true;
      panBy(dx, dy);
      tp.x = p[0].x; tp.y = p[0].y;
      const now = performance.now();
      tp.v.push([now, dx, dy]);
      while (tp.v.length && now - tp.v[0][0] > 100) tp.v.shift();
      show();
    }
  }, { passive: false });
  function endTouch(e) {
    if (!tp) return;
    if (tp.moved) eat = true;
    if (e.touches.length) { startTouch(e); return; }   // 两指缩放松开一指：接着用剩下那根手指拖
    const zoomed = zooming; zooming = false;
    const v = tp.two ? [] : tp.v.filter(s => performance.now() - s[0] < 100);
    tp = null;
    if (v.length < 2 || reduceMotion()) { settle(zoomed); return; }
    const span = Math.max(16, performance.now() - v[0][0]);
    let vx = v.reduce((s, a) => s + a[1], 0) / span, vy = v.reduce((s, a) => s + a[2], 0) / span, last = performance.now();
    const step = now => {
      const dt = Math.min(40, now - last), sl = SL, st = ST; last = now;
      panBy(vx * dt, vy * dt);
      const f = Math.pow(.94, dt / 16); vx *= f; vy *= f;
      if (SL === sl) vx = 0; if (ST === st) vy = 0;   // 碰到边就停
      if (Math.hypot(vx, vy) > .02) { show(); glide = requestAnimationFrame(step); } else { glide = 0; settle(); }
    };
    glide = requestAnimationFrame(step);
  }
  body.addEventListener('touchend', endTouch);
  body.addEventListener('touchcancel', endTouch);
  // 电脑上（窗口很窄时也是手机版）：按住鼠标拖动；滚轮上下左右移动，按住 Ctrl 滚动滚轮缩放
  let md = null, wt = 0;
  body.addEventListener('pointerdown', e => {
    eat = false;
    if (e.pointerType === 'mouse' && !e.button) { stopGlide(); clearTimeout(idle); trav.x = trav.y = 0; md = { x: e.clientX, y: e.clientY, moved: false }; }
  });
  addEventListener('pointermove', e => {
    if (!md) return;
    const dx = e.clientX - md.x, dy = e.clientY - md.y;
    if (!md.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    md.moved = true; body.classList.add('drag');
    panBy(dx, dy); md.x = e.clientX; md.y = e.clientY; show();
  });
  addEventListener('pointerup', () => { if (md && md.moved) { eat = true; settle(); } md = null; body.classList.remove('drag'); });
  body.addEventListener('click', e => { if (eat) { eat = false; e.stopPropagation(); e.preventDefault(); } }, true);
  body.addEventListener('wheel', e => {
    e.preventDefault(); stopGlide();
    const r = body.getBoundingClientRect(), u = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? body.clientHeight : 1;
    if (e.ctrlKey) { zooming = true; zoomBy(Math.exp(-e.deltaY * .01), e.clientX - r.left, e.clientY - r.top); }
    else if (e.shiftKey && !e.deltaX) panBy(-e.deltaY * u, 0);
    else panBy(-e.deltaX * u, -e.deltaY * u);
    show(); clearTimeout(wt); wt = setTimeout(() => { const zoomed = zooming; zooming = false; settle(zoomed); }, 150);
  }, { passive: false });

  // 换字号：仍停在同一处
  addEventListener('fzchange', () => { const x = slV(), y = stV(); Z = fz(); scrollV(x, y); draw(); showCard(); });
  addEventListener('resize', () => draw());

  $('#m').addEventListener('click', e => {
    const el = e.target, to = cardTarget(e);
    const lane = el.closest('[data-lane]'), p = el.closest('#mpeople [data-p]'), ev = el.closest('#mpeople [data-e]'), bd = el.closest('#mpeople [data-b]');
    if (lane) flyTo(lane.dataset.lane, yearAt(), z);
    else if (el.closest('[data-z]')) { zoomBy(el.closest('[data-z]').dataset.z > 0 ? 1.5 : 1 / 1.5, body.clientWidth / 2, body.clientHeight / 2); draw(); }
    else if (el.closest('[data-whole]')) flyTo(M.lane, (Y0 + Y1) / 2, zMin(), HDH + (vhV() - HDH) / 2);
    else if (el.closest('[data-map]')) select(null);
    else if (el.closest('[data-all]')) { const x = laneAt(), v = yearAt(); M.all = !M.all; segBar(); place(x, v); }
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
    else if (bd && bandA() >= .5) {
      // 缩小时点色块：放大到这个朝代、时代，让它差不多占满一屏
      const [id, i] = bd.dataset.b.split(':'), b = H.lane(id).bands[+i];
      flyTo(id, (b[1] + b[2]) / 2, H.clamp((vhV() - HDH - 60) / (b[2] - b[1]) / BASEK, z * 2, 1.2), HDH + (vhV() - HDH) / 2);
    }
  });

  // 一开始：中国泳道的秦汉之际，缩小到能看见朝代色块的程度。
  // 地址里的 #people、#rome（某个文明）直接放大到人名看得见；#person/han-xin（某个人）进入他的关系聚焦
  const start = M.lane;   // 先记下：画第一帧时会按滚动位置改写 M.lane
  paint();
  place(start, (H.FOCUS[0] + H.FOCUS[1]) / 2, HDH + (vhV() - HDH) / 2);
  const { sel, view } = readHash(H);
  addEventListener('hashchange', () => { const r = readHash(H); if (r.sel) select(r.sel); });
  if (sel) select(sel);
  else if (view === 'people' || LN[view]) { z = 1; place(LN[view] ? view : start, H.FOCUS[0]); }
}
