// 桌面版时间长河：横向泳道。滚轮缩放时换一层内容，每条泳道可以展开或收起。
import { fades, fadeOf, reduceMotion, setHash, readHash, cardTarget } from './util.js';

export function desktop(H, card, search) {
  const $ = s => document.querySelector(s), t = H.t, reduce = reduceMotion();
  const svg = $('#river'), stage = $('.stage'), detail = $('#detail');
  const G = 132, AX = 34, BH = 24, RH = 21, ER = 18, CAP = 16, [lo, hi] = H.FOCUS;
  const S = { t0: H.EXTENT[0], k: 0.2, sel: null, hx: null, open: new Set(H.site.default_open), full: false };
  const HIST = [], nameOf = s => (s.t === 'p' ? H.P[s.id] : H.E[s.id]).n;   // HIST：在详情卡里一路点过来的人和事，用来“返回”
  const VIEWS = Object.fromEntries(H.site.views.map(v => [v.id, v.range]));
  const PL = {}, EL = {};
  H.lanes.forEach(l => { PL[l.id] = H.byWeight(H.people.filter(p => p.lane === l.id)); EL[l.id] = H.events.filter(e => e.lane === l.id); });
  let W = 0, raf = 0, POS = {}, EPOS = {};

  const defs = '<defs>' + H.lanes.map(l =>
    `<pattern id="hatch-${l.id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="${l.c}" stroke-width="1.6" stroke-opacity=".45"/></pattern>`).join('') + fades(H, 'h') + '</defs>';

  const plotW = () => W - G - (detail.classList.contains('on') ? 330 : 0);
  const kMin = () => (W - G) / (H.EXTENT[1] - H.EXTENT[0]);
  const fix = () => {
    S.k = H.clamp(S.k, kMin(), CAP);
    S.t0 = H.clamp(S.t0, H.EXTENT[0], Math.max(H.EXTENT[0], H.EXTENT[1] - (W - G) / S.k));
  };
  const draw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

  function render() {
    W = stage.clientWidth; fix();
    const { t0, k } = S, x = y => (y - t0) * k + G, sy = stage.scrollTop;
    const f = H.clamp((k - 2.2) / 1.6, 0, 1);            // 人物层展开的程度
    const zImp = k < 5 ? 3 : k < 8 ? 2 : 1, eImp = k < 5 ? 4 : k < 8 ? 3 : 1;
    const selP = S.sel && S.sel.t === 'p' ? S.sel.id : null;
    const selE = S.sel && S.sel.t === 'e' ? H.E[S.sel.id] : null;
    const rels = selP ? H.relsOf(selP) : [];
    const lit = new Map(rels.map(r => [r.o.id, r]));
    const litE = new Set(selE ? selE.who : []);
    const hot = p => p.id === selP || lit.has(p.id) || litE.has(p.id);
    const o = [defs];
    POS = {}; EPOS = {};
    // 大事的排位：重要的先占位，放不下的不显示。返回排在第几行，-1 是放不下
    const byPriority = evs => [...evs].sort((a, b) => (b === selE) - (a === selE) || b.imp - a.imp || a.s - b.s);
    const place = (e, rows) => {
      const x1 = x(e.s), left = x1 - 8, right = Math.max(x(e.e), x1 + 12 + e.n.length * 12.5) + 8;
      const i = rows.findIndex(rw => rw.every(([a, b]) => right <= a || left >= b));
      if (i >= 0) rows[i].push([left, right]);
      return i;
    };

    // 第一步：每条泳道显示谁、占多高。
    // 展开的泳道按缩放程度放人和大事；收起的只剩色带一条。
    // 例外：被选中的人和与他相关的人、事，即使在收起的泳道里也会显示，否则跨文明的关系线没处落脚。
    let yy = AX + 6;
    const L = H.lanes.map(l => {
      const open = S.open.has(l.id), all = PL[l.id];
      let shown = [], evs = [];
      if (f > 0.02) {
        const base = open ? all.filter(p => p.imp >= zImp) : [];
        shown = base.concat(all.filter(p => !base.includes(p) && hot(p)));
        evs = EL[l.id].filter(e => (open && e.imp >= eImp) || e === selE || (selP && e.who.includes(selP)));
      }
      const nRows = H.pack(shown, p => p.b0, p => p.d, 1.5);
      // 展开时大事在色带下面最多排三行，用到几行就留几行
      const evRows = [[], [], []], evRow = new Map();
      if (open) byPriority(evs).forEach(e => { const i = place(e, evRows); if (i >= 0) evRow.set(e, i); });
      const used = evRows.filter(rw => rw.length).length, evH = used ? used * ER + 8 : 0;
      const full = BH + evH + (nRows ? nRows * RH + 8 : 0) + (open && !all.length ? 26 : 0) + 2;
      const r = { l, open, shown, evs, evH, evRow, y: yy, bandH: H.lerp(46, BH, f), h: H.lerp(46, full, f) };
      yy += r.h + 6; return r;
    });
    const total = Math.max(yy + 6, stage.clientHeight);
    svg.setAttribute('height', total); svg.setAttribute('viewBox', `0 0 ${W} ${total}`);

    // 竖格线（年份数字在最后画，因为要钉在顶上）
    const ticks = [], step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find(s => s * k >= 72) || 1000;
    for (let m = Math.ceil((t0 - 1) / step) * step; m <= t0 + (W - G) / k; m += step) {
      const X = x(m < 0 ? m + 1 : m === 0 ? 1 : m);
      if (X < G) continue;
      o.push(`<line class="grid" x1="${X}" x2="${X}" y1="0" y2="${total}"/>`);
      ticks.push(`<text class="tick" x="${X + 4}" y="${sy + AX - 13}">${m < 0 ? t('year.bc', { n: -m }) : m === 0 ? t('year.ad1') : t('year.ad', { n: m })}</text>`);
    }

    L.forEach(r => {
      const { l, y, bandH, open } = r, occ = [];   // occ：色带这一行里已经被文字占掉的区间
      l.bands.forEach((b, i) => {
        const x1 = Math.max(x(b[1]), G), x2 = Math.min(x(b[2]), W), w = x2 - x1;
        if (w < 0.5) return;
        const leg = b[3] === 'l', trad = b[3] === 't', long = H.bandName(b, true);
        o.push(`<rect class="band" data-band="${l.id}:${i}" x="${x1}" y="${y}" width="${w}" height="${bandH}" fill="${leg ? `url(#hatch-${l.id})` : l.c}" fill-opacity="${leg ? 1 : (i % 2 ? .36 : .2) * (trad ? .55 : 1)}"${trad ? ` stroke="${l.c}" stroke-dasharray="4 3" stroke-opacity=".8"` : ''}/>`);
        const name = w >= long.length * 13 + 16 ? long : b[0];
        if (w < name.length * 13 + 12) return;
        const two = bandH >= 40 && !leg && w >= 100;
        o.push(`<text class="bn" pointer-events="none" x="${x1 + 7}" y="${y + (two ? 19 : bandH / 2 + 5)}">${name}</text>`);
        if (two) o.push(`<text class="by" pointer-events="none" x="${x1 + 7}" y="${y + 36}">${trad ? t('circa') : ''}${H.fmt(b[1])}—${H.fmt(b[2])}</text>`);
        occ.push([x1, x1 + 20 + name.length * 13]);
      });
      if (f < 0.02) return;

      o.push(`<clipPath id="cl-${l.id}"><rect x="${G}" y="${y}" width="${W - G}" height="${r.h}"/></clipPath><g clip-path="url(#cl-${l.id})" opacity="${f}">`);

      // 大事：展开时在色带下面分行排；收起时只有与选中对象相关的，挤在色带那一行
      const ey = open ? y + BH + 6 : y + 6;
      byPriority(r.evs).forEach(e => {
        const i = open ? (r.evRow.has(e) ? r.evRow.get(e) : -1) : place(e, [occ]);
        if (i < 0) return;
        const x1 = x(e.s), x2 = Math.max(x(e.e), x1), Y = ey + i * ER;
        EPOS[e.id] = Y + 6;
        if (Math.max(x2, x1 + 12 + e.n.length * 12.5) < G || x1 > W) return;
        const xa = Math.min(Math.max(x1, G + 10), Math.max(x2 - 20, x1));   // 从左边延伸进来的时间段，标记贴着左缘
        const dim = (selP && !e.who.includes(selP)) || (selE && e !== selE);
        o.push(`<g class="ev" data-e="${e.id}" opacity="${dim ? .22 : 1}">${e.e > e.s ? `<rect x="${x1}" y="${Y + 14}" width="${x2 - x1}" height="3" fill="var(--ink)"/>` : ''}<path d="M${xa} ${Y + 1}l5 5-5 5-5-5z" fill="var(--ink)"/><text class="en" x="${xa + 9}" y="${Y + 10.5}"${e === selE ? ' font-weight="700"' : ''}>${e.n}</text></g>`);
      });

      // 人物：一人一根生卒条
      const py = y + BH + r.evH + 6;
      r.shown.forEach(p => {
        const Y = py + p.row * RH, X1 = x(p.b0), X2 = x(p.d), c = H.FAC[p.fac].c, rel = lit.get(p.id), fade = fadeOf(p, 'h');
        POS[p.id] = Y + 8;
        if (X2 < G || X1 > W) return;
        o.push(`<g class="pp${p.id === selP ? ' sel' : ''}" data-p="${p.id}" opacity="${!S.sel || hot(p) ? 1 : .13}">
          <rect x="${X1}" y="${Y}" width="${X2 - X1}" height="16" rx="3" fill="${fade || c}" fill-opacity="${fade ? 1 : .2}"${p.id === selP ? ` stroke="${c}" stroke-width="1.5"` : ''}/>
          ${p.reigns.map(rg => `<rect x="${x(rg[0])}" y="${Y + 13}" width="${x(rg[1]) - x(rg[0])}" height="3" fill="${c}"/>`).join('')}
          <text class="pn" x="${Math.max(X1, G) + 6}" y="${Y + 12}">${p.n}${rel ? `<tspan class="rl" dx="7" fill="${H.RT[rel.t].c}">${rel.label}</tspan>` : ''}</text></g>`);
      });
      if (open && !PL[l.id].length) o.push(`<text class="empty" x="${G + 12}" y="${y + BH + 19}">${t('river.noPeople')}</text>`);
      o.push('</g>');
    });

    // 关系线：在双方都在世的那一年竖着连起来，可以跨泳道
    if (f > 0.02) {
      o.push(`<g pointer-events="none" opacity="${f}">`);
      if (selP && POS[selP] != null) rels.forEach(r => {
        const X = x(r.year), y1 = POS[selP], y2 = POS[r.o.id], rt = H.RT[r.t];
        if (y2 == null || X < G || X > W) return;
        o.push(`<line x1="${X}" x2="${X}" y1="${y1}" y2="${y2}" stroke="${rt.c}" stroke-width="1.8"${rt.dash ? ` stroke-dasharray="${rt.dash}"` : ''}/><circle cx="${X}" cy="${y1}" r="3" fill="${rt.c}"/><circle cx="${X}" cy="${y2}" r="3.6" fill="var(--paper)" stroke="${rt.c}" stroke-width="1.8"/>`);
      });
      if (selE) {
        const X = x(selE.s), ys = selE.who.map(w => POS[w]).filter(v => v != null), ends = ys.concat(EPOS[selE.id] != null ? [EPOS[selE.id]] : []);
        if (ends.length > 1 && X >= G && X <= W) o.push(`<line x1="${X}" x2="${X}" y1="${Math.min(...ends)}" y2="${Math.max(...ends)}" stroke="var(--ink)" stroke-width="1.4"/>${ys.map(v => `<circle cx="${X}" cy="${v}" r="3.4" fill="var(--ink)"/>`).join('')}`);
      }
      o.push('</g>');
    }

    // 左栏：文明名称；鼠标所在年份各文明处于哪个时期
    const hy = S.hx != null && S.hx > G ? t0 + (S.hx - G) / k : null, tog = f > 0.5;
    o.push(`<rect x="0" y="0" width="${G}" height="${total}" fill="var(--paper)"/><line x1="${G}" x2="${G}" y1="0" y2="${total}" stroke="var(--line)"/>`);
    L.forEach(({ l, y, bandH, h, open }) => {
      const b = hy != null && H.bandAt(l, hy), ny = y + (b ? bandH / 2 - 1 : bandH / 2 + 5), cy = ny - 5;
      o.push(`<g${tog ? ` class="lt" data-lane="${l.id}"` : ''}><rect x="0" y="${y}" width="${G}" height="${h}" fill="transparent"/><rect x="0" y="${y}" width="4" height="${h}" fill="${l.c}"/>
        ${tog ? `<path d="${open ? `M10 ${cy - 2}h9l-4.5 6z` : `M12 ${cy - 4}v9l6-4.5z`}" fill="var(--ink-2)"/>` : ''}
        <text class="ln" x="${tog ? 25 : 13}" y="${ny}">${l.name}</text>${b ? `<text class="lb" x="${tog ? 25 : 13}" y="${y + bandH / 2 + 14}">${b[0]}</text>` : ''}</g>`);
    });

    // 顶上的年份刻度：页面上下滚动时钉住不动
    o.push(`<rect x="0" y="${sy}" width="${W}" height="${AX - 6}" fill="var(--paper)"/><line x1="0" x2="${W}" y1="${sy + AX - 6}" y2="${sy + AX - 6}" stroke="var(--line)"/>`, ...ticks);
    if (hy != null) o.push(`<g pointer-events="none"><line class="cross" x1="${S.hx}" x2="${S.hx}" y1="${sy + AX - 6}" y2="${total}"/><rect x="${S.hx - 48}" y="${sy + 4}" width="96" height="19" rx="9.5" fill="var(--ink)"/><text class="ct" x="${S.hx}" y="${sy + 17.5}" text-anchor="middle">${H.fmtFull(Math.round(hy))}</text></g>`);

    svg.innerHTML = o.join('');
    svg.classList.toggle('lv-people', tog);
    $('#lvl').textContent = t(k < 0.5 ? 'lvl.world' : f < 0.5 ? 'lvl.dynasty' : 'lvl.people');
    $('#note').hidden = !(f > 0.6 && (t0 > hi + 30 || t0 + (W - G) / k < lo - 30));
    const dflt = H.site.default_open;
    const mode = S.open.size === H.lanes.length ? 'all' : S.open.size === 0 ? 'none' : S.open.size === dflt.length && dflt.every(id => S.open.has(id)) ? 'default' : '';
    document.querySelectorAll('#d [data-open]').forEach(b => b.setAttribute('aria-pressed', b.dataset.open === mode));
  }

  /* 视图切换 */
  function fly(a, b, done) {
    const k1 = H.clamp(plotW() / (b - a), kMin(), CAP), t1 = a, k0 = S.k, t0 = S.t0;
    if (reduce) { S.k = k1; S.t0 = t1; render(); if (done) done(); return; }
    const c0 = t0 + plotW() / k0 / 2, c1 = t1 + plotW() / k1 / 2, start = performance.now();
    (function tick(now) {
      const u = Math.min(1, (now - start) / 650), e = u < .5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
      S.k = Math.exp(H.lerp(Math.log(k0), Math.log(k1), e));
      S.t0 = H.lerp(c0, c1, e) - plotW() / S.k / 2;
      render();
      if (u < 1) requestAnimationFrame(tick); else if (done) done();
    })(start);
  }

  // 选中的人或事不在屏幕里时，上下滚到能看见的位置
  function reveal() {
    if (!S.sel) return;
    const v = S.sel.t === 'p' ? POS[S.sel.id] : EPOS[S.sel.id];
    if (v == null) return;
    if (v < stage.scrollTop + AX + 12 || v > stage.scrollTop + stage.clientHeight - 24) stage.scrollTop = Math.max(0, v - stage.clientHeight * .4);
  }

  function showCard() {
    detail.classList.toggle('on', !!S.sel);
    detail.classList.toggle('full', !!S.sel && S.full);
    if (!S.sel) return;
    detail.innerHTML = card(S.sel, { full: S.full, back: HIST.length ? nameOf(HIST[HIST.length - 1]) : '' });
    detail.scrollTop = 0;
  }

  // keep = 是从详情卡里点过来的，保留“返回”的路径
  function select(sel, keep) {
    if (!keep) HIST.length = 0;
    S.sel = sel;
    if (!sel) S.full = false;
    showCard(); setHash(sel);
    if (!sel) return draw();
    S.open.add((sel.t === 'p' ? H.P[sel.id] : H.E[sel.id]).lane);   // 选中谁，就把他所在的文明展开
    const a = sel.t === 'p' ? H.P[sel.id].b0 : H.E[sel.id].s, b = sel.t === 'p' ? H.P[sel.id].d : H.E[sel.id].e;
    if (S.k < 3.8 || b < S.t0 || a > S.t0 + plotW() / S.k) return fly(lo, hi, reveal);
    render(); reveal();
  }

  function click(el) {
    const p = el.closest('[data-p]'), e = el.closest('[data-e]'), ln = el.closest('[data-lane]'), b = el.closest('[data-band]');
    if (p) return select({ t: 'p', id: p.dataset.p });
    if (e) return select({ t: 'e', id: e.dataset.e });
    const toggle = id => { S.open.has(id) ? S.open.delete(id) : S.open.add(id); draw(); };
    if (ln) return toggle(ln.dataset.lane);
    if (b) {
      const [id, i] = b.dataset.band.split(':');
      // 已经在人物层：点色带是展开或收起这个文明。还没到人物层：点色带是放大到这个时期。
      if (S.k > 3) return toggle(id);
      const band = H.lane(id).bands[i], pad = (band[2] - band[1]) * .12 + 2;
      return fly(band[1] - pad, band[2] + pad);
    }
    if (S.sel) select(null);
  }

  /* 缩放与拖动。内容多了以后页面会比屏幕高：拖动同时管左右和上下，在左栏上滚轮是上下滚 */
  const px = e => e.clientX - svg.getBoundingClientRect().left;
  svg.addEventListener('wheel', e => {
    const X = px(e);
    if (X < G) return;
    e.preventDefault();
    const year = S.t0 + (X - G) / S.k;
    S.k = H.clamp(S.k * Math.exp(-e.deltaY * 0.0016), kMin(), CAP);
    S.t0 = year - (X - G) / S.k; S.hx = X; draw();
  }, { passive: false });
  let dragging = null;
  svg.addEventListener('pointerdown', e => {
    dragging = { x: e.clientX, y: e.clientY, t0: S.t0, st: stage.scrollTop, moved: false };
    try { svg.setPointerCapture(e.pointerId); } catch (_) {}
  });
  svg.addEventListener('pointermove', e => {
    if (dragging) {
      if (Math.abs(e.clientX - dragging.x) > 4 || Math.abs(e.clientY - dragging.y) > 4) { dragging.moved = true; svg.classList.add('drag'); }
      if (dragging.moved) {
        S.t0 = dragging.t0 - (e.clientX - dragging.x) / S.k; S.hx = null;
        stage.scrollTop = dragging.st - (e.clientY - dragging.y); draw();
      }
    } else { S.hx = px(e); draw(); }
  });
  svg.addEventListener('pointerup', e => {
    const d = dragging; dragging = null; svg.classList.remove('drag');
    if (d && !d.moved) { const el = document.elementFromPoint(e.clientX, e.clientY); if (el) click(el); }
  });
  svg.addEventListener('pointerleave', () => { if (!dragging) { S.hx = null; draw(); } });
  stage.addEventListener('scroll', draw);

  $('#d').addEventListener('click', e => {
    const v = e.target.closest('button[data-view]'), op = e.target.closest('[data-open]');
    if (v) { stage.scrollTop = 0; fly(...VIEWS[v.dataset.view]); }
    if (op) {
      S.open = new Set(op.dataset.open === 'all' ? H.lanes.map(l => l.id) : op.dataset.open === 'default' ? H.site.default_open : []);
      if (S.k < 3.8) fly(lo, hi); else draw();
    }
  });
  detail.addEventListener('click', e => {
    const el = e.target, to = cardTarget(e);
    if (to) { HIST.push(S.sel); select(to, true); }
    else if (el.closest('.d-back')) select(HIST.pop(), true);
    else if (el.closest('.d-full')) { S.full = !S.full; showCard(); }
    else if (el.closest('.close')) select(null);
  });
  const openSearch = () => search.open(sel => select(sel));
  $('#find').addEventListener('click', openSearch);
  // Esc：先退出全屏，再关详情卡。按 / 打开搜索。
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (S.full) { S.full = false; showCard(); } else if (S.sel) select(null); }
    else if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
  });
  $('#legend').innerHTML = Object.values(H.RT).map(r => `<span class="lg"><i style="border-top:2px ${r.dash ? 'dashed' : 'solid'} ${r.c}"></i>${r.n}</span>`).join('');
  addEventListener('resize', draw);

  W = stage.clientWidth; S.k = kMin(); render();
  // 地址里的 #focus、#all、#person/han-xin 之类，直接打开对应的视图
  const { sel, view } = readHash(H), zoomIn = w => { S.k = w / (hi - lo); S.t0 = lo; };
  if (sel) { zoomIn(W - G - 330); select(sel); }
  else if (view === 'all') { S.open = new Set(H.lanes.map(l => l.id)); zoomIn(W - G); render(); }
  else if (VIEWS[view]) { const [a, b] = VIEWS[view]; S.k = (W - G) / (b - a); S.t0 = a; render(); }
}
