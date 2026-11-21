// 搜索界面：人物、事件分两栏。不输入时按文明分组列出全部，可以当目录翻。
export function createSearch(H) {
  const t = H.t, st = { tab: 'p', q: '' };
  let box, input, onPick;
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hl = (s, q) => (q ? s.split(q).join(`<mark>${esc(q)}</mark>`) : s);
  // 名字开头命中排最前，其次名字、别名，再次身份，最后是简介和所属文明
  const scoreP = (p, q) => (p.n.startsWith(q) ? 4 : p.n.includes(q) || p.alt.includes(q) ? 3 : p.role.includes(q) ? 2 : (p.sum + H.lane(p.lane).name).includes(q) ? 1 : 0);
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
    box.querySelector('[data-tab="p"]').innerHTML = `${t('search.people')} <i>${P.length}</i>`;
    box.querySelector('[data-tab="e"]').innerHTML = `${t('search.events')} <i>${E.length}</i>`;
    box.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tab === st.tab));
    const isP = st.tab === 'p', items = isP ? P : E, row = isP ? rowP : rowE, score = isP ? scoreP : scoreE, when = x => (isP ? x.b0 : x.s);
    const kind = isP ? t('search.people') : t('search.events'), other = isP ? t('search.events') : t('search.people');
    const out = box.querySelector('.s-list');
    if (!items.length) {
      const n = isP ? E.length : P.length;
      out.innerHTML = `<p class="s-none">${t('search.none', { q: esc(q), kind })}${n ? t('search.other', { kind: other, n }) : t('search.scope')}</p>`;
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
    box.innerHTML = `<div class="s-box" role="dialog" aria-label="${t('search.aria')}">
      <div class="s-top"><input type="search" placeholder="${t('search.placeholder')}" aria-label="${t('search.aria')}"><button class="close" aria-label="${t('card.close')}">×</button></div>
      <div class="seg s-tabs" role="group"><button data-tab="p"></button><button data-tab="e"></button></div>
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

  return {
    isOpen: () => !!box && !box.hidden,
    open(pick) { if (!box) build(); onPick = pick; st.q = ''; input.value = ''; box.hidden = false; list(); input.focus(); },
  };
}
