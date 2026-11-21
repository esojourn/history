// 手机版时间长河：时间自上而下，人名竖排，一次看一个文明里的一段。
import { fades, fadeOf, setHash, readHash, cardTarget } from './util.js';

export function mobile(H, card, search) {
  const $ = s => document.querySelector(s), t = H.t;
  const body = $('#mbody'), sheet = $('#msheet'), tabs = $('#mtabs');
  const AXW = 98, CW = 31, TOP = 14, MAIN = 4, FEW = 9, [f0, f1] = H.FOCUS;   // 人多的一段默认只排重要度 4 以上的，手机上不挤
  const M = { mode: 'bands', lane: H.site.default_open[0] || H.lanes[0].id, seg: 0, all: false, sel: null, full: false };
  const HIST = [], nameOf = s => (s.t === 'p' ? H.P[s.id] : H.E[s.id]).n;
  const PL = {}, SEG = {};
  const inFocus = b => b[1] < f1 && b[2] > f0;
  const within = (p, a, b) => p.d > a && p.b0 < b;

  // 每个文明的人物分成几“段”来看，一屏只排一段：
  //   人物全在样板时段（秦汉之际）里的文明，就是样板时段这一段；
  //   人物跨了很多个时期的（圣经历史），一个时期一段，没有人物的时期不算。
  H.lanes.forEach(l => {
    const ps = PL[l.id] = H.people.filter(p => p.lane === l.id).sort((a, b) => a.b0 - b.b0);
    if (ps.every(p => within(p, f0 - 40, f1 + 40))) { SEG[l.id] = ps.length ? [{ lo: f0, hi: f1, name: t('view.focus'), bands: l.bands.map((b, i) => i).filter(i => inFocus(l.bands[i])) }] : []; return; }
    SEG[l.id] = l.bands.map((b, i) => {
      const in_ = ps.filter(p => within(p, b[1], b[2]));
      if (!in_.length) return null;
      const ns = b[3] === 'l';   // 只排先后的时期：整段都画，位置只表示次序
      return { lo: ns ? b[1] : Math.max(b[1], Math.min(...in_.map(p => p.b0)) - 10), hi: ns ? b[2] : Math.min(b[2], Math.max(...in_.map(p => p.d)) + 10), name: b[0], bands: [i], ns };
    }).filter(Boolean);
  });
  const segs = () => SEG[M.lane], seg = () => segs()[M.seg];
  const defaultSeg = lane => Math.max(0, SEG[lane].findIndex(s => s.lo < f1 && s.hi > f0));
  const segOf = (lane, a, b) => { const mid = (a + b) / 2, i = SEG[lane].findIndex(s => mid >= s.lo && mid <= s.hi); return i >= 0 ? i : Math.max(0, SEG[lane].findIndex(s => b > s.lo && a < s.hi)); };
  // 一年占多少像素：一百来年的一段 12；几百年的一段 8；只排先后的一段压得很扁
  let lo = f0, hi = f1, KY = 12;
  const y = v => (v - lo) * KY + TOP;

  function bands() {
    const l = H.lane(M.lane);
    body.innerHTML = `<div style="--c:${l.c};padding:10px 0 40px">` + l.bands.map((b, i) => {
      const h = H.clamp((b[2] - b[1]) * .26, 40, 230), si = segs().findIndex(s => s.bands.includes(i));
      return `<div class="mband ${b[3] || ''}"${inFocus(b) ? ' data-focus' : ''}><div class="yr">${b[3] === 'l' ? '' : (b[3] ? t('circa') : '') + H.fmt(b[1])}</div>
        <div class="blk" style="min-height:${h}px"><b>${b[0]}</b>
        <small>${b[3] === 'l' ? t('m.onlyOrder') : t('m.years', { n: b[2] - b[1] }) + (b[3] ? t('m.traditional') : '')}</small>
        ${si >= 0 ? `<button class="go" data-m="people" data-seg="${si}">${t('m.seePeople')}</button>` : ''}</div></div>`;
    }).join('') + '</div>';
    const fo = body.querySelector('[data-focus]');
    body.scrollTop = fo ? Math.max(0, fo.offsetTop - 120) : 0;
  }

  function people(keepScroll) {
    const sg = seg();
    if (!sg) { body.innerHTML = `<p class="mnote">${t('river.noPeople')}</p>`; return; }
    lo = sg.lo; hi = sg.hi; KY = sg.ns ? 1.6 : hi - lo > 330 ? 8 : 12;
    const mine = PL[M.lane].filter(p => within(p, lo, hi)), few = mine.length <= FEW;
    const selP = M.sel && M.sel.t === 'p' ? M.sel.id : null, selE = M.sel && M.sel.t === 'e' ? H.E[M.sel.id] : null;
    const rels = selP ? H.relsOf(selP) : [], lit = new Map(rels.map(r => [r.o.id, r])), litE = new Set(selE ? selE.who : []);
    // 本文明的人在前；选中某人后，与他相关的其他文明的人作为“客人”排在后面，虚线框
    const list = mine.filter(p => few || M.all || p.imp >= MAIN || p.id === selP || lit.has(p.id) || litE.has(p.id));
    const guests = H.people.filter(p => p.lane !== M.lane && within(p, lo, hi) && (lit.has(p.id) || litE.has(p.id))).sort((a, b) => a.b0 - b.b0);
    const colsAll = list.concat(guests), cols = H.pack(colsAll, p => p.b0, p => p.d, 30 / KY, 'col');
    const Wd = Math.max(AXW + cols * CW + 8, body.clientWidth), Ht = y(hi) + 20;
    const st = keepScroll ? body.scrollTop : 0, o = ['<defs>' + fades(H, 'v') + '</defs>'];

    // 左栏：事件优先，空处补十年刻度（只排先后的一段没有刻度）
    const evs = H.events.filter(e => e.lane === M.lane && e.e >= lo && e.s <= hi && (e.imp >= 3 || e === selE)).sort((a, b) => a.s - b.s);
    let last = -99; const used = [];
    evs.forEach(e => { e._y = Math.max(y(e.s) + 4, last + 14); last = e._y; used.push(e._y); });
    if (!sg.ns) for (let v = Math.ceil(lo); v <= hi; v++) {
      if ((v <= 0 ? 1 - v : v) % 10) continue;
      const Y = y(v);
      o.push(`<line x1="${AXW - 6}" x2="${Wd}" y1="${Y}" y2="${Y}" stroke="var(--line)" stroke-width="1" opacity=".7"/>`);
      if (!used.some(u => Math.abs(u - Y - 4) < 13)) o.push(`<text class="ax" x="6" y="${Y + 4}">${H.fmt(v)}</text>`);
    }
    evs.forEach(e => {
      const dim = (selP && !e.who.includes(selP)) || (selE && e !== selE);
      o.push(`<g class="ev" data-e="${e.id}" opacity="${dim ? .3 : 1}">${e.e > e.s ? `<line x1="${AXW - 4}" x2="${AXW - 4}" y1="${y(e.s)}" y2="${y(Math.min(e.e, hi))}" stroke="var(--ink)" stroke-width="2.5" opacity=".5"/>` : ''}
        <rect x="0" y="${e._y - 11}" width="${AXW - 8}" height="14" fill="transparent"/>${e.ns ? `<text class="evn" x="6" y="${e._y}"${e === selE ? ' font-weight="700"' : ''}>${e.n.slice(0, 7)}</text>` : `<text class="ax" x="6" y="${e._y}">${H.fmt(e.s)}</text><text class="evn" x="40" y="${e._y}"${e === selE ? ' font-weight="700"' : ''}>${e.n.slice(0, 5)}</text>`}</g>`);
    });

    const cx = p => AXW + p.col * CW + CW / 2;
    colsAll.forEach(p => {
      const c = H.FAC[p.fac].c, y1 = y(Math.max(p.b0, lo - 1)), y2 = y(Math.min(p.d, hi + 1)), guest = p.lane !== M.lane, fade = fadeOf(p, 'v');
      const on = !M.sel || p.id === selP || lit.has(p.id) || litE.has(p.id);
      const ny = H.clamp(st + 8, y1 + 5, Math.max(y1 + 5, y2 - p.n.length * 14 - 3));
      o.push(`<g class="pp" data-p="${p.id}" opacity="${on ? 1 : .15}">
        <rect x="${cx(p) - 12}" y="${y1}" width="24" height="${Math.max(0, y2 - y1)}" rx="3" fill="${fade || c}" fill-opacity="${fade ? 1 : .22}"${p.id === selP ? ` stroke="${c}" stroke-width="1.5"` : guest || p.ns ? ` stroke="${c}" stroke-dasharray="3 3" stroke-opacity=".8"` : ''}/>
        ${p.reigns.map(rg => `<rect x="${cx(p) + 9}" y="${y(Math.max(rg[0], lo - 1))}" width="3" height="${Math.max(0, y(Math.min(rg[1], hi + 1)) - y(Math.max(rg[0], lo - 1)))}" fill="${c}"/>`).join('')}
        <text class="vn" x="${cx(p) - 1}" y="${ny}"${p.id === selP ? ' font-weight="700"' : ''}>${p.n}</text></g>`);
    });
    if (selP && colsAll.includes(H.P[selP])) rels.forEach(r => {
      if (!colsAll.includes(r.o) || r.year < lo || r.year > hi) return;
      const Y = y(r.year), rt = H.RT[r.t], x1 = cx(H.P[selP]), x2 = cx(r.o);
      o.push(`<g pointer-events="none"><line x1="${x1}" x2="${x2}" y1="${Y}" y2="${Y}" stroke="${rt.c}" stroke-width="1.8"${rt.dash ? ` stroke-dasharray="${rt.dash}"` : ''}/><circle cx="${x1}" cy="${Y}" r="3" fill="${rt.c}"/><circle cx="${x2}" cy="${Y}" r="3.6" fill="var(--paper)" stroke="${rt.c}" stroke-width="1.8"/></g>`);
    });
    if (selE) {
      const xs = selE.who.map(w => H.P[w]).filter(p => colsAll.includes(p)).map(cx), Y = y(selE.s);
      if (xs.length) o.push(`<g pointer-events="none"><line x1="${AXW - 4}" x2="${Math.max(...xs)}" y1="${Y}" y2="${Y}" stroke="var(--ink)" stroke-width="1.4"/>${xs.map(v => `<circle cx="${v}" cy="${Y}" r="3.4" fill="var(--ink)"/>`).join('')}</g>`);
    }
    // 分了几段的文明：顶上一条钉住的小栏，写明现在是哪一段，可以翻到上一段、下一段
    const n = segs().length, nav = n > 1 ? `<div class="mseg" style="width:${body.clientWidth}px"><button data-seg="${M.seg - 1}"${M.seg ? '' : ' disabled'} aria-label="${t('m.prevSeg')}">‹</button>
      <span><b>${sg.name}</b>${sg.ns ? t('m.onlyOrder') : `${H.fmt(Math.round(lo))}—${H.fmt(Math.round(hi))}`}</span><button data-seg="${M.seg + 1}"${M.seg < n - 1 ? '' : ' disabled'} aria-label="${t('m.nextSeg')}">›</button></div>` : '';
    body.innerHTML = `${nav}<svg id="mpeople" width="${Wd}" height="${Ht}" viewBox="0 0 ${Wd} ${Ht}">${o.join('')}</svg>
      <div class="mmore">${few ? '' : `<button data-all>${M.all ? t('m.mainOnly') : t('m.showAll', { n: mine.length })}</button><br>`}${guests.length ? t('m.guests') : ''}</div>`;
    if (body.scrollTop !== st) body.scrollTop = st;
  }

  function paint(keep) {
    document.querySelectorAll('#m .seg [data-m]').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === M.mode));
    tabs.innerHTML = H.lanes.map(l => `<button data-lane="${l.id}" aria-pressed="${l.id === M.lane}">${l.name}</button>`).join('');
    const on = tabs.querySelector('[aria-pressed="true"]');
    tabs.scrollLeft = on.offsetLeft - (tabs.clientWidth - on.offsetWidth) / 2;
    M.mode === 'bands' ? bands() : people(keep);
  }
  // 换了文明、换了一段或刚进人物层：滚到这一段最早的人物那里
  const toStart = () => { const sg = seg(), m = sg ? PL[M.lane].filter(p => within(p, sg.lo, sg.hi)) : []; body.scrollTop = m.length ? Math.max(0, y(Math.max(lo, m[0].b0)) - 20) : 0; };

  function showCard() {
    sheet.classList.toggle('on', !!M.sel);
    sheet.classList.toggle('full', !!M.sel && M.full);
    if (!M.sel) return;
    sheet.innerHTML = card(M.sel, { full: M.full, back: HIST.length ? nameOf(HIST[HIST.length - 1]) : '' });
    sheet.scrollTop = 0;
  }

  function select(sel, keep) {
    if (!keep) HIST.length = 0;
    M.sel = sel;
    if (!sel) M.full = false;
    if (sel) {
      const x = sel.t === 'p' ? H.P[sel.id] : H.E[sel.id], lane = x.lane;
      const a = sel.t === 'p' ? x.b0 : x.s, b = sel.t === 'p' ? x.d : x.e, cur = seg();
      if (lane !== M.lane) { M.lane = lane; M.all = false; M.seg = segOf(lane, a, b); }
      else if (!cur || b < cur.lo || a > cur.hi) M.seg = segOf(lane, a, b);
      M.mode = 'people';
    }
    showCard(); setHash(sel);
    paint(true);
    if (sel) {
      // 滚到他最早的一条关系附近，让关系线露在抽屉上方
      const first = sel.t === 'p' ? Math.min(H.P[sel.id].d - 10 / (KY / 12), ...H.relsOf(sel.id).map(r => r.year)) : H.E[sel.id].s;
      body.scrollTop = Math.max(0, y(Math.max(first, lo)) - 90);
    }
  }

  let sraf = 0;
  body.addEventListener('scroll', () => { if (M.mode === 'people' && !sraf) sraf = requestAnimationFrame(() => { sraf = 0; people(true); }); });
  $('#m').addEventListener('click', e => {
    const el = e.target, m = el.closest('[data-m]'), lane = el.closest('[data-lane]'), sg = el.closest('.mseg [data-seg]'), p = el.closest('[data-p]'), ev = el.closest('[data-e]');
    const to = cardTarget(e);
    const clear = () => { M.sel = null; M.all = false; M.full = false; showCard(); };
    if (m) { M.mode = m.dataset.m; if (m.dataset.seg != null) M.seg = +m.dataset.seg; clear(); paint(); if (M.mode === 'people') toStart(); }
    else if (lane) { M.lane = lane.dataset.lane; M.seg = defaultSeg(M.lane); clear(); paint(); if (M.mode === 'people') toStart(); }
    else if (sg) { M.seg = +sg.dataset.seg; clear(); setHash(null); paint(); toStart(); }
    else if (el.closest('[data-all]')) { M.all = !M.all; paint(true); }
    else if (to) { HIST.push(M.sel); select(to, true); }
    else if (el.closest('.d-back')) select(HIST.pop(), true);
    else if (el.closest('.d-full')) { M.full = !M.full; showCard(); }
    else if (el.closest('#mfind')) search.open(sel => select(sel));
    else if (el.closest('.close')) select(null);
    else if (p) select({ t: 'p', id: p.dataset.p });
    else if (ev) select({ t: 'e', id: ev.dataset.e });
    else if (M.sel && el.closest('#mbody')) select(null);
  });

  M.seg = defaultSeg(M.lane);
  paint();
  // 地址里的 #people、#rome（某个文明的人物）、#person/han-xin（某个人）
  const { sel, view } = readHash(H);
  if (sel) select(sel);
  else if (view === 'people' || PL[view]) { if (PL[view]) { M.lane = view; M.seg = defaultSeg(view); } M.mode = 'people'; paint(); toStart(); }
}
