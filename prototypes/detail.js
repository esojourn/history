/* 方案 A 的详情卡与搜索界面。
 * 详情卡有两种大小：侧栏（手机上是底部抽屉）和全屏。全屏多出来的年表、同时代的人、当时的世界，
 * 都是从结构数据里算出来的，不需要另外写文字；另写的长文在 text.js。 */
(function () {
  const H = window.H;
  const more = () => H.more || { p: {}, e: {} };
  const paras = s => (s ? s.split('\n').map(x => `<p class="d-more">${x}</p>`).join('') : '');
  const wrap = s => `<div class="d-wrap">${s}</div>`;
  const laneTag = id => { const l = H.lane(id); return `<p class="d-lane"><i style="background:${l.c}"></i>${l.name}</p>`; };
  const bar = o => `<div class="d-bar">${o.back ? `<button class="d-back">返回 ${o.back}</button>` : ''}<span class="sp"></span>
    <button class="d-full">${o.full ? '收起全屏' : '展开全屏'}</button><button class="close" aria-label="关闭">×</button></div>`;
  const ageAt = (p, y) => (p.b == null ? '' : `${p.circa ? '约 ' : ''}${Math.round(y - p.b)} 岁`);
  const world = y => `<h3>${H.fmtFull(Math.round(y))}前后的世界</h3><ul class="d-list d-world">${H.lanes.map(l => {
    const b = H.bandAt(l, y); return b ? `<li><small>${l.name}</small><span>${b[0].split('：')[0]}</span></li>` : '';
  }).join('')}</ul>`;
  const ORDER = ['kin', 'lord', 'mentor', 'ally', 'rival'];

  /* ---------- 人物 ---------- */
  function person(id, o) {
    const p = H.P[id], rs = H.relsOf(id), es = H.eventsOf(id).sort((a, b) => a.s - b.s);
    const lived = p.b != null && !p.dq ? `，享年${p.circa || p.dc ? '约' : ''} ${p.d - p.b} 岁` : '';
    const reign = p.reign ? `，${H.fmt(p.reign[0])}—${H.fmt(p.reign[1])} 在位（${p.reign[1] - p.reign[0]} 年）` : '';
    const top = `${bar(o)}<div class="d-head"><h2>${p.n}</h2>${p.alt ? `<span class="d-alt">${p.alt}</span>` : ''}</div>${laneTag(p.lane)}
      <p class="d-meta"><b>${H.life(p)}</b>${lived}　${p.role}${reign}</p>`;
    const text = `<p class="d-sum">${p.sum}</p>${paras(more().p[id])}`;

    if (!o.full) return wrap(top + text +
      (rs.length ? `<h3>关系</h3><ul class="d-rels">${rs.map(r => `<li><button data-go="${r.o.id}"><i style="background:${H.RT[r.t].c}"></i><b>${r.o.n}</b><span>${r.label}</span></button></li>`).join('')}</ul>` : '') +
      (es.length ? `<h3>参与的事件</h3><ul class="d-evs">${es.map(e => `<li><button data-goe="${e.id}"><b>${H.span(e)}</b><span>${e.n}</span></button></li>`).join('')}</ul>` : '') +
      '<button class="d-full d-expand">展开全屏：生平年表、同时代的人</button>');

    // 生平年表：出生、在位、有明确年份的关系、参与的事件、去世，按时间排
    const rows = [];
    if (p.b != null) rows.push([p.b - .5, `${p.circa ? '约于此年' : ''}出生`]);
    if (p.reign) { rows.push([p.reign[0], '开始在位']); if (p.reign[1] !== p.d) rows.push([p.reign[1], '在位结束']); }
    H.rels.filter(r => r.year != null && (r.a === id || r.b === id)).forEach(r => {
      const q = H.P[r.a === id ? r.b : r.a];
      rows.push([r.year, `<button data-go="${q.id}">${q.n}</button><span>${r.label}</span>`]);
    });
    es.forEach(e => rows.push([e.s, `<button data-goe="${e.id}">${e.n}</button>${e.e > e.s ? `<span>至${H.fmt(e.e)}</span>` : ''}<p>${e.sum}</p>`]));
    if (!p.dq) rows.push([p.d + .5, `${p.dc ? '约于此年' : ''}去世`]);
    rows.sort((a, b) => a[0] - b[0]);
    const chron = `<h3>生平年表</h3><ol class="d-chron">${rows.map(([y, t]) => {
      const Y = Math.round(y + (y % 1 ? (y > p.d ? -.5 : .5) : 0));
      return `<li><span class="y">${H.fmt(Y)}</span><span class="a">${Y === p.b ? '' : ageAt(p, Y)}</span><div>${t}</div></li>`;
    }).join('')}</ol>`;

    const groups = ORDER.map(t => {
      const g = rs.filter(r => r.t === t);
      return g.length ? `<p class="d-group"><i style="border-top:2px ${H.RT[t].dash ? 'dashed' : 'solid'} ${H.RT[t].c}"></i>${H.RT[t].n}</p><ul class="d-list">${g.map(r =>
        `<li><button data-go="${r.o.id}">${r.o.n}</button><span>${r.label}</span><small>${r.o.role}，${H.life(r.o)}${r.o.lane !== p.lane ? '，' + H.lane(r.o.lane).name : ''}</small></li>`).join('')}</ul>` : '';
    }).join('');
    const peers = H.people.filter(q => q.lane !== p.lane && Math.min(q.d, p.d) - Math.max(q.b0, p.b0) >= 10)
      .sort((a, b) => b.imp - a.imp || a.b0 - b.b0).slice(0, 8);
    const mid = p.reign ? (p.reign[0] + p.reign[1]) / 2 : (p.b0 + p.d) / 2;

    return wrap(top + `<div class="d-cols"><div class="d-main">${text}${chron}</div><div class="d-side">
      ${rs.length ? `<h3>关系</h3>${groups}` : ''}
      ${peers.length ? `<h3>同时代的其他文明人物</h3><ul class="d-list">${peers.map(q => `<li><button data-go="${q.id}">${q.n}</button><span>${q.role}</span><small>${H.lane(q.lane).name}，${H.life(q)}</small></li>`).join('')}</ul>` : ''}
      ${world(mid)}</div></div>`);
  }

  /* ---------- 事件 ---------- */
  function event(id, o) {
    const e = H.E[id], who = e.who.map(w => H.P[w]);
    const top = `${bar(o)}<div class="d-head"><h2>${e.n}</h2></div>${laneTag(e.lane)}
      <p class="d-meta"><b>${H.span(e)}</b>${e.e > e.s ? `，历时 ${e.e - e.s} 年` : ''}</p>`;
    const text = `<p class="d-sum">${e.sum}</p>${paras(more().e[id])}`;

    if (!o.full) return wrap(top + text +
      (who.length ? `<h3>相关人物</h3><ul class="d-rels">${who.map(p => `<li><button data-go="${p.id}"><i style="background:${H.FAC[p.fac].c}"></i><b>${p.n}</b><span>${p.role}</span></button></li>`).join('')}</ul>` : '') +
      '<button class="d-full d-expand">展开全屏：前后的事、同期的其他文明</button>');

    const same = H.events.filter(x => x.lane === e.lane).sort((a, b) => a.s - b.s || a.e - b.e), i = same.indexOf(e);
    const near = (list, label) => (list.length ? `<p class="d-group">${label}</p><ul class="d-list">${list.map(x => `<li><small>${H.span(x)}</small><button data-goe="${x.id}">${x.n}</button></li>`).join('')}</ul>` : '');
    const else_ = H.events.filter(x => x.lane !== e.lane && x.s <= e.e + 5 && x.e >= e.s - 5).sort((a, b) => a.s - b.s).slice(0, 8);

    return wrap(top + `<div class="d-cols"><div class="d-main">${text}
      ${who.length ? `<h3>相关人物</h3><ul class="d-list d-who">${who.map(p => `<li><button data-go="${p.id}">${p.n}</button><span>${p.role}</span><small>${p.b != null && e.s >= p.b ? '时年' + ageAt(p, e.s) : ''}</small><p>${p.sum}</p></li>`).join('')}</ul>` : ''}</div>
      <div class="d-side"><h3>${H.lane(e.lane).name}：前后的事</h3>${near(same.slice(Math.max(0, i - 2), i), '此前')}${near(same.slice(i + 1, i + 3), '此后')}
      ${else_.length ? `<h3>前后五年内，其他文明的事</h3><ul class="d-list">${else_.map(x => `<li><small>${H.span(x)}</small><button data-goe="${x.id}">${x.n}</button><small>${H.lane(x.lane).name}</small></li>`).join('')}</ul>` : ''}
      ${world(e.s)}</div></div>`);
  }

  H.card = (sel, o) => (sel.t === 'p' ? person(sel.id, o) : event(sel.id, o));

  /* ================= 搜索界面：人物、事件分两类 ================= */
  let box, input, onPick;
  const st = { tab: 'p', q: '' };
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hl = (s, q) => (q ? s.split(q).join(`<mark>${esc(q)}</mark>`) : s);
  // 名字开头命中排最前，其次名字、别名，再次身份，最后是简介和所属文明
  const scoreP = (p, q) => (p.n.startsWith(q) ? 4 : p.n.includes(q) || (p.alt || '').includes(q) ? 3 : p.role.includes(q) ? 2 : (p.sum + H.lane(p.lane).name).includes(q) ? 1 : 0);
  const scoreE = (e, q) => (e.n.startsWith(q) ? 4 : e.n.includes(q) ? 3 : e.who.some(w => H.P[w].n.includes(q)) ? 2 : (e.sum + H.lane(e.lane).name).includes(q) ? 1 : 0);
  // 只在简介里命中时，把命中的那半句显示出来，让人知道为什么会搜到它
  const why = (x, q, plain) => {
    const i = q ? x.sum.indexOf(q) : -1;
    return i < 0 || plain.includes(q) || x.n.includes(q) || (x.alt || '').includes(q) ? hl(plain, q)
      : (i > 6 ? '…' : '') + hl(x.sum.slice(Math.max(0, i - 6), i + q.length + 16), q) + '…';
  };
  const rowP = (p, q) => `<button class="s-row" data-t="p" data-id="${p.id}"><i style="background:${H.FAC[p.fac].c}"></i><b>${hl(p.n, q)}${p.alt ? `<small>${hl(p.alt, q)}</small>` : ''}</b>
    <span class="yr">${H.life(p)}</span><span class="ro">${why(p, q, p.role)}</span><span class="la">${H.lane(p.lane).name}</span></button>`;
  const rowE = (e, q) => `<button class="s-row e" data-t="e" data-id="${e.id}"><i></i><b>${hl(e.n, q)}</b>
    <span class="yr">${H.span(e)}</span><span class="ro">${why(e, q, e.who.slice(0, 4).map(w => H.P[w].n).join('、'))}</span><span class="la">${H.lane(e.lane).name}</span></button>`;

  function list(typed) {
    const q = st.q;
    const P = q ? H.people.filter(p => scoreP(p, q)) : H.people, E = q ? H.events.filter(e => scoreE(e, q)) : H.events;
    // 正在输入时，哪一类命中得更准（名字命中胜过简介里带到），就自动切到哪一类
    if (typed && q) {
      const bestP = Math.max(0, ...P.map(p => scoreP(p, q))), bestE = Math.max(0, ...E.map(e => scoreE(e, q)));
      if (bestE > bestP) st.tab = 'e'; else if (bestP > bestE) st.tab = 'p';
    }
    box.querySelector('[data-tab="p"]').innerHTML = `人物 <i>${P.length}</i>`;
    box.querySelector('[data-tab="e"]').innerHTML = `事件 <i>${E.length}</i>`;
    box.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tab === st.tab));
    const isP = st.tab === 'p', items = isP ? P : E, row = isP ? rowP : rowE, score = isP ? scoreP : scoreE, when = x => (isP ? x.b0 : x.s);
    const out = box.querySelector('.s-list');
    if (!items.length) {
      const n = isP ? E.length : P.length;
      out.innerHTML = `<p class="s-none">没有找到含“${esc(q)}”的${isP ? '人物' : '事件'}。${n ? `${isP ? '事件' : '人物'}里有 ${n} 条，点上面的“${isP ? '事件' : '人物'}”查看。` : '示例只收了公元前 262 至前 138 年前后的内容。'}</p>`;
    } else if (q) {
      out.innerHTML = [...items].sort((a, b) => score(b, q) - score(a, q) || b.imp - a.imp || when(a) - when(b)).map(x => row(x, q)).join('');
    } else {
      out.innerHTML = H.lanes.map(l => {
        const g = items.filter(x => x.lane === l.id).sort((a, b) => when(a) - when(b));
        return g.length ? `<h3><i style="background:${l.c}"></i>${l.name}<span>${g.length}</span></h3>` + g.map(x => row(x, '')).join('') : '';
      }).join('');
    }
    out.scrollTop = 0;
  }

  function build() {
    box = document.createElement('div'); box.className = 'search'; box.hidden = true;
    box.innerHTML = `<div class="s-box" role="dialog" aria-label="搜索人物和事件">
      <div class="s-top"><input type="search" placeholder="输入名字、称号、身份或简介里的字" aria-label="搜索"><button class="close" aria-label="关闭">×</button></div>
      <div class="seg s-tabs" role="group" aria-label="搜哪一类"><button data-tab="p"></button><button data-tab="e"></button></div>
      <div class="s-list"></div></div>`;
    document.body.append(box);
    input = box.querySelector('input');
    const close = () => { box.hidden = true; };
    input.addEventListener('input', () => { st.q = input.value.trim(); list(true); });
    box.addEventListener('click', e => {
      const tab = e.target.closest('[data-tab]'), row = e.target.closest('.s-row');
      if (tab) { st.tab = tab.dataset.tab; list(); input.focus(); }
      else if (row) { close(); onPick({ t: row.dataset.t, id: row.dataset.id }); }
      else if (e.target === box || e.target.closest('.close')) close();
    });
    box.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') close();
      else if (e.key === 'Enter') { const first = box.querySelector('.s-row'); if (first) first.click(); }
    });
  }

  H.searchOpen = () => !!box && !box.hidden;
  H.openSearch = pick => {
    if (!box) build();
    onPick = pick; st.q = ''; input.value = ''; box.hidden = false; list(); input.focus();
  };
})();
