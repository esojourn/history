// 在 dataset.mjs 合成的数据上建索引、加工具函数。浏览器和构建时（生成独立页面）共用，不碰 DOM。
// 年份一律是天文纪年整数：公元前 n 年 = 1 - n。
export function createModel(data, base = '/') {
  const H = { ...data, FAC: data.fac, RT: data.rt, EXTENT: data.site.extent, FOCUS: data.site.focus };

  /* 界面文字 */
  H.t = (key, vars) => {
    const s = data.ui[key];
    if (s == null) return key;
    return vars ? String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k])) : String(s);
  };
  H.fmt = y => (y <= 0 ? H.t('year.bc', { n: 1 - y }) : H.t('year.ad', { n: y }));
  H.fmtFull = y => (y <= 0 ? H.t('year.bcFull', { n: 1 - y }) : H.t('year.adFull', { n: y }));
  H.url = (kind, id) => `${base}${kind}/${id}/`;
  H.riverUrl = (kind, id) => `${base}#${kind}/${id}`;

  /* 索引 */
  // 生年不详的人，从估计的年份起画一段渐隐的条（估计值只用于作图，不显示为数字）
  H.people.forEach(p => { p.b0 = p.b != null ? p.b : p.e0 != null ? p.e0 : p.d - 50; });
  H.P = Object.fromEntries(H.people.map(p => [p.id, p]));
  H.E = Object.fromEntries(H.events.map(e => [e.id, e]));
  H.lane = id => H.lanes.find(l => l.id === id);
  H.bandAt = (lane, y) => lane.bands.find(b => y >= b[1] && y < b[2]);
  H.bandName = (b, full) => (full && b[5] ? `${b[0]}：${b[5]}` : b[0]);

  H.life = p => {
    const c = H.t('circa');
    if (p.ns) return H.t('life.order');
    if (p.b == null && p.dq) return H.t('life.unknown');
    return `${p.b == null ? H.t('life.bUnknown') : (p.circa ? c : '') + H.fmt(p.b)}—${p.dq ? H.t('life.dUnknown') : (p.dc ? c : '') + H.fmt(p.d)}`;
  };
  H.span = e => (e.ns ? H.t('life.order') : (e.circa ? H.t('circa') : '') + (e.e > e.s ? `${H.fmt(e.s)}—${H.fmt(e.e)}` : H.fmt(e.s)));
  H.when = e => (e.ns ? '' : H.span(e));   // 列表里用：只排先后的事不必每行都重复那句话

  // 一个人的全部关系。没有标年份的，取双方都在世那段时间的中点来画线
  H.relsOf = id => H.rels.filter(r => r.a === id || r.b === id).map(r => {
    const o = H.P[r.a === id ? r.b : r.a], me = H.P[id];
    const lo = Math.max(o.b0, me.b0), hi = Math.min(o.d, me.d);
    return { o, t: r.t, label: r.label, year: r.year != null ? r.year : (lo + hi) / 2, dated: r.year != null };
  });
  H.eventsOf = id => H.events.filter(e => e.who.includes(id));

  /* 工具 */
  H.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  H.lerp = (a, b, f) => a + (b - a) * f;
  // 排行：把时间上不重叠的条放进同一行。按传入顺序占位，所以先传重要的，它们的行号就稳定。
  H.pack = (items, s, e, gap = 0, key = 'row') => {
    const rows = [];
    items.forEach(it => {
      let r = rows.findIndex(row => row.every(q => e(q) + gap <= s(it) || e(it) + gap <= s(q)));
      if (r < 0) { r = rows.length; rows.push([]); }
      rows[r].push(it); it[key] = r;
    });
    return rows.length;
  };
  H.byWeight = list => [...list].sort((a, b) => b.imp - a.imp || a.b0 - b.b0);
  return H;
}
