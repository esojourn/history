// 手机版时间长河：时间自上而下，人名竖排，一次看一个文明。
import { fades, fadeOf, setHash, readHash, cardTarget } from './util.js';

export function mobile(H, card, search) {
  const $ = s => document.querySelector(s), t = H.t;
  const body = $('#mbody'), sheet = $('#msheet'), tabs = $('#mtabs');
  const KY = 12, AXW = 98, CW = 31, TOP = 14, MAIN = 4, FEW = 9, [lo, hi] = H.FOCUS;   // 人多的文明默认只排重要度 4 以上的，手机上不挤
  const M = { mode: 'bands', lane: H.site.default_open[0] || H.lanes[0].id, all: false, sel: null, full: false };
  const HIST = [], nameOf = s => (s.t === 'p' ? H.P[s.id] : H.E[s.id]).n;
  const PL = {};
  H.lanes.forEach(l => { PL[l.id] = H.people.filter(p => p.lane === l.id).sort((a, b) => a.b0 - b.b0); });
  const y = v => (v - lo) * KY + TOP;
  const inFocus = b => b[1] < hi && b[2] > lo;

  function bands() {
    const l = H.lane(M.lane);
    body.innerHTML = `<div style="--c:${l.c};padding:10px 0 40px">` + l.bands.map(b => {
      const h = H.clamp((b[2] - b[1]) * .26, 40, 230), go = PL[l.id].length && inFocus(b) && b[3] !== 'l';
      return `<div class="mband ${b[3] || ''}"${inFocus(b) ? ' data-focus' : ''}><div class="yr">${b[3] === 'l' ? '' : (b[3] ? t('circa') : '') + H.fmt(b[1])}</div>
        <div class="blk" style="min-height:${h}px"><b>${b[0]}</b>
        <small>${b[3] === 'l' ? t('m.onlyOrder') : t('m.years', { n: b[2] - b[1] }) + (b[3] ? t('m.traditional') : '')}</small>
        ${go ? `<button class="go" data-m="people">${t('m.seePeople')}</button>` : ''}</div></div>`;
    }).join('') + '</div>';
    const fo = body.querySelector('[data-focus]');
    body.scrollTop = fo ? Math.max(0, fo.offsetTop - 120) : 0;
  }

  function people(keepScroll) {
    const mine = PL[M.lane], few = mine.length <= FEW;
    if (!mine.length) { body.innerHTML = `<p class="mnote">${t('river.noPeople')}</p>`; return; }
    const selP = M.sel && M.sel.t === 'p' ? M.sel.id : null, selE = M.sel && M.sel.t === 'e' ? H.E[M.sel.id] : null;
    const rels = selP ? H.relsOf(selP) : [], lit = new Map(rels.map(r => [r.o.id, r])), litE = new Set(selE ? selE.who : []);
    // 本文明的人在前；选中某人后，与他相关的其他文明的人作为“客人”排在后面，虚线框
    const list = mine.filter(p => few || M.all || p.imp >= MAIN);
    const guests = H.people.filter(p => p.lane !== M.lane && (lit.has(p.id) || litE.has(p.id))).sort((a, b) => a.b0 - b.b0);
    const colsAll = list.concat(guests), cols = H.pack(colsAll, p => p.b0, p => p.d, 2.5, 'col');
    const Wd = Math.max(AXW + cols * CW + 8, body.clientWidth), Ht = y(hi) + 20;
    const st = keepScroll ? body.scrollTop : 0, o = ['<defs>' + fades(H, 'v') + '</defs>'];

    // 左栏：事件优先，空处补十年刻度
    const evs = H.events.filter(e => e.lane === M.lane && (e.imp >= 3 || e === selE)).sort((a, b) => a.s - b.s);
    let last = -99; const used = [];
    evs.forEach(e => { e._y = Math.max(y(e.s) + 4, last + 14); last = e._y; used.push(e._y); });
    for (let v = Math.ceil(lo); v <= hi; v++) {
      if ((v <= 0 ? 1 - v : v) % 10) continue;
      const Y = y(v);
      o.push(`<line x1="${AXW - 6}" x2="${Wd}" y1="${Y}" y2="${Y}" stroke="var(--line)" stroke-width="1" opacity=".7"/>`);
      if (!used.some(u => Math.abs(u - Y - 4) < 13)) o.push(`<text class="ax" x="6" y="${Y + 4}">${H.fmt(v)}</text>`);
    }
    evs.forEach(e => {
      const dim = (selP && !e.who.includes(selP)) || (selE && e !== selE);
      o.push(`<g class="ev" data-e="${e.id}" opacity="${dim ? .3 : 1}">${e.e > e.s ? `<line x1="${AXW - 4}" x2="${AXW - 4}" y1="${y(e.s)}" y2="${y(e.e)}" stroke="var(--ink)" stroke-width="2.5" opacity=".5"/>` : ''}
        <rect x="0" y="${e._y - 11}" width="${AXW - 8}" height="14" fill="transparent"/><text class="ax" x="6" y="${e._y}">${H.fmt(e.s)}</text><text class="evn" x="40" y="${e._y}"${e === selE ? ' font-weight="700"' : ''}>${e.n.slice(0, 5)}</text></g>`);
    });

    const cx = p => AXW + p.col * CW + CW / 2;
    colsAll.forEach(p => {
      const c = H.FAC[p.fac].c, y1 = y(Math.max(p.b0, lo - 1)), y2 = y(Math.min(p.d, hi + 1)), guest = p.lane !== M.lane, fade = fadeOf(p, 'v');
      const on = !M.sel || p.id === selP || lit.has(p.id) || litE.has(p.id);
      const ny = H.clamp(st + 8, y1 + 5, Math.max(y1 + 5, y2 - p.n.length * 14 - 3));
      o.push(`<g class="pp" data-p="${p.id}" opacity="${on ? 1 : .15}">
        <rect x="${cx(p) - 12}" y="${y1}" width="24" height="${Math.max(0, y2 - y1)}" rx="3" fill="${fade || c}" fill-opacity="${fade ? 1 : .22}"${p.id === selP ? ` stroke="${c}" stroke-width="1.5"` : guest ? ` stroke="${c}" stroke-dasharray="3 3" stroke-opacity=".8"` : ''}/>
        ${p.reigns.map(rg => `<rect x="${cx(p) + 9}" y="${y(rg[0])}" width="3" height="${Math.max(0, y(Math.min(rg[1], hi + 1)) - y(rg[0]))}" fill="${c}"/>`).join('')}
        <text class="vn" x="${cx(p) - 1}" y="${ny}"${p.id === selP ? ' font-weight="700"' : ''}>${p.n}</text></g>`);
    });
    if (selP && colsAll.includes(H.P[selP])) rels.forEach(r => {
      if (!colsAll.includes(r.o)) return;
      const Y = y(r.year), rt = H.RT[r.t], x1 = cx(H.P[selP]), x2 = cx(r.o);
      o.push(`<g pointer-events="none"><line x1="${x1}" x2="${x2}" y1="${Y}" y2="${Y}" stroke="${rt.c}" stroke-width="1.8"${rt.dash ? ` stroke-dasharray="${rt.dash}"` : ''}/><circle cx="${x1}" cy="${Y}" r="3" fill="${rt.c}"/><circle cx="${x2}" cy="${Y}" r="3.6" fill="var(--paper)" stroke="${rt.c}" stroke-width="1.8"/></g>`);
    });
    if (selE) {
      const xs = selE.who.map(w => H.P[w]).filter(p => colsAll.includes(p)).map(cx), Y = y(selE.s);
      if (xs.length) o.push(`<g pointer-events="none"><line x1="${AXW - 4}" x2="${Math.max(...xs)}" y1="${Y}" y2="${Y}" stroke="var(--ink)" stroke-width="1.4"/>${xs.map(v => `<circle cx="${v}" cy="${Y}" r="3.4" fill="var(--ink)"/>`).join('')}</g>`);
    }
    body.innerHTML = `<svg id="mpeople" width="${Wd}" height="${Ht}" viewBox="0 0 ${Wd} ${Ht}">${o.join('')}</svg>
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
  // 换了文明或刚进人物层：滚到这个文明最早的人物那里
  const toStart = () => { const m = PL[M.lane]; body.scrollTop = m.length ? Math.max(0, y(Math.max(lo, m[0].b0)) - 20) : 0; };

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
      const lane = sel.t === 'p' ? H.P[sel.id].lane : H.E[sel.id].lane;
      if (lane !== M.lane) { M.lane = lane; M.all = false; }
      if (sel.t === 'p' && PL[lane].length > FEW && H.P[sel.id].imp < MAIN) M.all = true;
      M.mode = 'people';
    }
    showCard(); setHash(sel);
    paint(true);
    if (sel) {
      // 滚到他最早的一条关系附近，让关系线露在抽屉上方
      const first = sel.t === 'p' ? Math.min(H.P[sel.id].d - 10, ...H.relsOf(sel.id).map(r => r.year)) : H.E[sel.id].s;
      body.scrollTop = Math.max(0, y(Math.max(first, lo)) - 90);
    }
  }

  let sraf = 0;
  body.addEventListener('scroll', () => { if (M.mode === 'people' && !sraf) sraf = requestAnimationFrame(() => { sraf = 0; people(true); }); });
  $('#m').addEventListener('click', e => {
    const el = e.target, m = el.closest('[data-m]'), lane = el.closest('[data-lane]'), p = el.closest('[data-p]'), ev = el.closest('[data-e]');
    const to = cardTarget(e);
    if (m) { M.mode = m.dataset.m; M.sel = null; M.full = false; showCard(); paint(); if (M.mode === 'people') toStart(); }
    else if (lane) { M.lane = lane.dataset.lane; M.sel = null; M.all = false; M.full = false; showCard(); paint(); if (M.mode === 'people') toStart(); }
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

  paint();
  // 地址里的 #people、#rome（某个文明的人物）、#person/han-xin（某个人）
  const { sel, view } = readHash(H);
  if (sel) select(sel);
  else if (view === 'people' || PL[view]) { if (PL[view]) M.lane = view; M.mode = 'people'; paint(); toStart(); }
}
