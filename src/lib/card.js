// 人物、事件的详情卡。只拼 HTML 字符串，不碰 DOM，所以三处共用：
//   侧栏（手机上是底部抽屉）　full: false
//   全屏　　　　　　　　　　　full: true
//   独立页面（构建时生成）　　full: true, page: true
// 全屏多出来的年表、同时代的人、当时的世界，都由结构数据算出，不需要另写文字。
const ORDER = ['kin', 'lord', 'mentor', 'ally', 'rival'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function makeCard(H) {
  const t = H.t;
  const paras = s => (s ? s.split(/\n\s*\n/).map(x => `<p class="d-more">${esc(x.trim())}</p>`).join('') : '');
  const wrap = s => `<div class="d-wrap">${s}</div>`;
  const pLink = (p, cls = '') => `<a href="${H.url('person', p.id)}" data-go="${p.id}"${cls ? ` class="${cls}"` : ''}>`;
  const eLink = e => `<a href="${H.url('event', e.id)}" data-goe="${e.id}">`;
  const laneTag = id => { const l = H.lane(id); return `<p class="d-lane"><i style="background:${l.c}"></i>${l.name}</p>`; };
  const ageAt = (p, y) => (p.b == null || p.ns ? '' : t('card.age', { circa: p.circa ? t('circa') + ' ' : '', n: Math.round(y - p.b) }));

  const bar = (o, kind, id) => (o.page
    ? `<div class="d-bar"><a class="d-river" href="${H.riverUrl(kind, id)}">${t('card.inRiver')}</a></div>`
    : `<div class="d-bar">${o.back ? `<button class="d-back">${t('card.back', { name: o.back })}</button>` : ''}<span class="sp"></span>${o.full ? `<a class="d-pagelink" href="${H.url(kind, id)}">${t('card.page')}</a>` : ''}
       <button class="d-full">${t(o.full ? 'card.unfull' : 'card.full')}</button><button class="close" aria-label="${t('card.close')}">×</button></div>`);

  /* 地点 */
  const placeShort = id => (id === 'unknown' ? t('place.unknown') : H.places[id] ? H.places[id].n : '');
  const placeRow = (label, id, years) => {
    if (!id) return '';
    if (id === 'unknown') return `<li><small>${label}</small><span>${t('place.unknown')}</span></li>`;
    const pl = H.places[id];
    if (!pl) return '';
    return `<li><small>${label}${years ? ' ' + years : ''}</small><b>${pl.n}</b><span>${t('place.modern', { m: pl.modern })}${pl.cert === 'disputed' ? '，' + t('place.disputed') : ''}</span>${pl.note ? `<p>${esc(pl.note)}</p>` : ''}</li>`;
  };

  const world = y => `<h3>${t('card.world', { y: H.fmtFull(Math.round(y)) })}</h3><ul class="d-list d-world">${H.lanes.map(l => {
    const b = H.bandAt(l, y); return b ? `<li><small>${l.name}</small><span>${b[0]}</span></li>` : '';
  }).join('')}</ul>`;

  // 信息出处：每一条的最下面都有，侧栏、全屏、独立页面一样。
  //   列了出处的：逐条列出，网址变成链接；
  //   没列出处的：照实写明是 AI 凭记忆写的草稿。
  const show = u => { let s = u.replace(/^https?:\/\//, ''); try { s = decodeURI(s); } catch { /* 网址里有不合规的转义，原样显示 */ } return s.length > 48 ? s.slice(0, 46) + '…' : s; };
  //   rec：凭记忆标注、没有核对过的书目，单独列出并写明。
  const srcList = a => `<ul class="d-src">${a.map(s => `<li>${esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" rel="noopener" target="_blank">${esc(show(u))}</a>`)}</li>`).join('')}</ul>`;
  const sources = x => {
    const rec = x.rec || [];
    let h = `<h3>${t('card.sources')}</h3>`;
    if (x.src.length) h += srcList(x.src);
    if (rec.length) h += `<p class="d-recalled">${t('source.recalled')}</p>` + srcList(rec);
    if (!x.src.length) h += `<p class="d-review">${t('source.ai')}</p>`;
    else if (rec.length) h += `<p class="d-review">${t('source.mixed')}</p>`;
    else if (!x.rev) h += `<p class="d-review">${t('review.pending')}</p>`;
    return h;
  };

  /* ---------- 人物 ---------- */
  function person(id, o) {
    const p = H.P[id], rs = H.relsOf(id), es = H.eventsOf(id).sort((a, b) => a.s - b.s);
    const lived = p.b != null && !p.dq && !p.ns ? '，' + t('card.lived', { circa: p.circa || p.dc ? t('circa') : '', n: p.d - p.b }) : '';
    const reign = p.reigns.map(r => '，' + t('card.reign', { a: H.fmt(r[0]), b: H.fmt(r[1]), n: r[1] - r[0] })).join('');
    const where = [p.bp && placeShort(p.bp) && p.bp !== 'unknown' ? t('card.born', { place: placeShort(p.bp) }) : '',
      p.dp && placeShort(p.dp) && p.dp !== 'unknown' ? t('card.died', { place: placeShort(p.dp) }) : ''].filter(Boolean).join('，');
    const top = `${bar(o, 'person', id)}<div class="d-head"><${o.page ? 'h1' : 'h2'}>${p.n}</${o.page ? 'h1' : 'h2'}>${p.alt ? `<span class="d-alt">${p.alt}</span>` : ''}</div>${laneTag(p.lane)}
      <p class="d-meta"><b>${H.life(p)}</b>${lived}　${p.role}${reign}</p>${where ? `<p class="d-where">${where}</p>` : ''}`;
    const text = `<p class="d-sum">${esc(p.sum)}</p>${paras(p.body)}`;

    if (!o.full) return wrap(top + text +
      (rs.length ? `<h3>${t('card.rels')}</h3><ul class="d-rels">${rs.map(r => `<li>${pLink(r.o)}<i style="background:${H.RT[r.t].c}"></i><b>${r.o.n}</b><span>${r.label}</span></a></li>`).join('')}</ul>` : '') +
      (es.length ? `<h3>${t('card.events')}</h3><ul class="d-evs">${es.map(e => `<li>${eLink(e)}<b>${H.when(e)}</b><span>${e.n}</span></a></li>`).join('')}</ul>` : '') +
      `<button class="d-full d-expand">${t('card.expandP')}</button>` + sources(p));

    // 生平年表：出生、在位、有明确年份的关系、参与的事件、去世，按时间排
    const rows = [];
    if (p.b != null) rows.push([p.b - .5, t(p.circa ? 'chron.bornCirca' : 'chron.born')]);
    p.reigns.forEach(r => { rows.push([r[0], t('chron.reignStart')]); if (r[1] !== p.d) rows.push([r[1], t('chron.reignEnd')]); });
    rs.filter(r => r.dated).forEach(r => rows.push([r.year, `${pLink(r.o)}${r.o.n}</a><span>${r.label}</span>`]));
    es.forEach(e => rows.push([e.s, `${eLink(e)}${e.n}</a>${e.e > e.s ? `<span>${t('chron.to', { y: H.fmt(e.e) })}</span>` : ''}<p>${esc(e.sum)}</p>`]));
    if (!p.dq) rows.push([p.d + .5, t(p.dc ? 'chron.diedCirca' : 'chron.died')]);
    rows.sort((a, b) => a[0] - b[0]);
    // 只排先后的人物（太初）没有年份可排，年表、同时代的人、当时的世界都不出
    const chron = p.ns ? '' : `<h3>${t('card.chron')}</h3><ol class="d-chron">${rows.map(([y, html]) => {
      const Y = Math.round(y + (y % 1 ? (y > p.d ? -.5 : .5) : 0));
      return `<li><span class="y">${H.fmt(Y)}</span><span class="a">${Y === p.b ? '' : ageAt(p, Y)}</span><div>${html}</div></li>`;
    }).join('')}</ol>`;

    const groups = ORDER.filter(k => H.RT[k]).map(k => {
      const g = rs.filter(r => r.t === k);
      return g.length ? `<p class="d-group"><i style="border-top:2px ${H.RT[k].dash ? 'dashed' : 'solid'} ${H.RT[k].c}"></i>${H.RT[k].n}</p><ul class="d-list">${g.map(r =>
        `<li>${pLink(r.o)}${r.o.n}</a><span>${r.label}</span><small>${r.o.role}${r.o.ns ? '' : '，' + H.life(r.o)}${r.o.lane !== p.lane ? '，' + H.lane(r.o.lane).name : ''}</small></li>`).join('')}</ul>` : '';
    }).join('');
    const yrs = x => (x.s == null ? '' : x.e != null && x.e !== x.s ? `${H.fmt(x.s)}—${H.fmt(x.e)}` : H.fmt(x.s));
    const places = placeRow(t('place.birth'), p.bp) + placeRow(t('place.death'), p.dp) + p.pl.map(x => placeRow(t('place.active'), x.p, yrs(x))).join('');
    const peers = p.ns ? [] : H.people.filter(q => q.lane !== p.lane && !q.ns && Math.min(q.d, p.d) - Math.max(q.b0, p.b0) >= 10)
      .sort((a, b) => b.imp - a.imp || a.b0 - b.b0).slice(0, 8);
    const mid = p.reigns.length ? (p.reigns[0][0] + p.reigns[0][1]) / 2 : (p.b0 + p.d) / 2;

    return wrap(top + `<div class="d-cols"><div class="d-main">${text}${chron}${sources(p)}</div><div class="d-side">
      ${rs.length ? `<h3>${t('card.rels')}</h3>${groups}` : ''}
      ${places ? `<h3>${t('card.places')}</h3><ul class="d-list d-places">${places}</ul>` : ''}
      ${peers.length ? `<h3>${t('card.peers')}</h3><ul class="d-list">${peers.map(q => `<li>${pLink(q)}${q.n}</a><span>${q.role}</span><small>${H.lane(q.lane).name}，${H.life(q)}</small></li>`).join('')}</ul>` : ''}
      ${p.ns ? '' : world(mid)}</div></div>`);
  }

  /* ---------- 事件 ---------- */
  function event(id, o) {
    const e = H.E[id], who = e.who.map(w => H.P[w]).filter(Boolean);
    const at = e.pl.filter(x => x !== 'unknown' && H.places[x]).map(x => H.places[x].n).join('、');
    const top = `${bar(o, 'event', id)}<div class="d-head"><${o.page ? 'h1' : 'h2'}>${e.n}</${o.page ? 'h1' : 'h2'}></div>${laneTag(e.lane)}
      <p class="d-meta"><b>${H.span(e)}</b>${e.e > e.s ? '，' + t('card.duration', { n: e.e - e.s }) : ''}</p>${at ? `<p class="d-where">${t('card.at', { place: at })}</p>` : ''}`;
    const text = `<p class="d-sum">${esc(e.sum)}</p>${paras(e.body)}`;

    if (!o.full) return wrap(top + text +
      (who.length ? `<h3>${t('card.who')}</h3><ul class="d-rels">${who.map(p => `<li>${pLink(p)}<i style="background:${H.FAC[p.fac].c}"></i><b>${p.n}</b><span>${p.role}</span></a></li>`).join('')}</ul>` : '') +
      `<button class="d-full d-expand">${t('card.expandE')}</button>` + sources(e));

    const same = H.events.filter(x => x.lane === e.lane).sort((a, b) => a.s - b.s || a.e - b.e), i = same.indexOf(e);
    const near = (list, label) => (list.length ? `<p class="d-group">${label}</p><ul class="d-list">${list.map(x => `<li><small>${H.when(x)}</small>${eLink(x)}${x.n}</a></li>`).join('')}</ul>` : '');
    const elsewhere = e.ns ? [] : H.events.filter(x => x.lane !== e.lane && !x.ns && x.s <= e.e + 5 && x.e >= e.s - 5).sort((a, b) => a.s - b.s).slice(0, 8);
    const places = e.pl.map(x => placeRow(t('place.event'), x)).join('');

    return wrap(top + `<div class="d-cols"><div class="d-main">${text}
      ${who.length ? `<h3>${t('card.who')}</h3><ul class="d-list d-who">${who.map(p => `<li>${pLink(p)}${p.n}</a><span>${p.role}</span><small>${p.b != null && e.s >= p.b ? t('card.ageAt', { age: ageAt(p, e.s) }) : ''}</small><p>${esc(p.sum)}</p></li>`).join('')}</ul>` : ''}
      ${sources(e)}</div>
      <div class="d-side">${places ? `<h3>${t('card.places')}</h3><ul class="d-list d-places">${places}</ul>` : ''}
      <h3>${t('card.near', { lane: H.lane(e.lane).name })}</h3>${near(same.slice(Math.max(0, i - 2), i), t('card.before'))}${near(same.slice(i + 1, i + 3), t('card.after'))}
      ${elsewhere.length ? `<h3>${t('card.elsewhere')}</h3><ul class="d-list">${elsewhere.map(x => `<li><small>${H.span(x)}</small>${eLink(x)}${x.n}</a><small>${H.lane(x.lane).name}</small></li>`).join('')}</ul>` : ''}
      ${e.ns ? '' : world(e.s)}</div></div>`);
  }

  return (sel, o = {}) => (sel.t === 'p' ? person(sel.id, o) : event(sel.id, o));
}
