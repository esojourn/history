// 一次性脚本：把 prototypes/ 里的示例数据转成 data/ 与 locales/zh-CN/ 下的正式文件。
// 迁移完成、原型删除后，这个脚本也一并删除。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import YAML from 'yaml';

const root = path.resolve(import.meta.dirname, '..');
const win = {};
for (const f of ['common.js', 'world.js', 'text.js']) vm.runInNewContext(fs.readFileSync(path.join(root, 'prototypes', f), 'utf8'), { window: win });
const H = win.H;

const out = (rel, obj) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, YAML.stringify(obj, { lineWidth: 0 }));
};
const clean = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/* ---------- 文明与时期 ---------- */
const PERIOD_IDS = {
  bible: ['primeval', 'patriarchs', 'egypt-sojourn', 'exodus-judges', 'united-monarchy', 'divided-monarchy', 'exile', 'second-temple', 'new-testament', 'early-church'],
  meso: ['sumer', 'akkad', 'ur-iii', 'old-babylon', 'kassite', 'assyria', 'neo-babylon', 'achaemenid', 'seleucid', 'parthia', 'sasanian', 'caliphate'],
  egypt: ['early-dynastic', 'old-kingdom', 'first-intermediate', 'middle-kingdom', 'second-intermediate', 'new-kingdom', 'late-period', 'ptolemaic', 'roman-byzantine-egypt'],
  greece: ['aegean', 'dark-age', 'archaic', 'classical', 'hellenistic'],
  rome: ['roman-kingdom', 'roman-republic', 'roman-empire', 'early-middle-ages', 'high-middle-ages', 'late-middle-ages', 'renaissance-reformation', 'enlightenment-revolution', 'industrial-age', 'world-wars', 'postwar'],
  india: ['indus', 'vedic', 'mahajanapada', 'maurya', 'shunga-etc', 'kushan-etc', 'gupta', 'regional-kingdoms', 'delhi-sultanate', 'mughal', 'british-india', 'republic-of-india'],
  steppe: ['steppe-tribes', 'xiongnu', 'xianbei', 'rouran', 'gokturk', 'uyghur', 'steppe-divided', 'mongol-empire', 'mongol-tribes', 'qing-rule', 'mongolia'],
  china: ['five-emperors', 'xia', 'shang', 'western-zhou', 'spring-autumn', 'warring-states', 'qin', 'chu-han', 'western-han', 'xin', 'eastern-han', 'three-kingdoms', 'western-jin', 'eastern-jin', 'north-south', 'sui', 'tang', 'five-dynasties', 'northern-song', 'southern-song', 'yuan', 'ming', 'qing', 'roc', 'prc'],
  korea: ['gojoseon', 'three-kingdoms-korea', 'unified-silla', 'goryeo', 'joseon', 'korean-empire', 'japanese-rule', 'division'],
  japan: ['jomon', 'yayoi', 'kofun', 'asuka', 'nara', 'heian', 'kamakura', 'muromachi', 'azuchi-momoyama', 'edo', 'meiji-taisho', 'showa-heisei'],
  yue: ['dongson', 'nanyue', 'jiaozhi', 'funan-champa', 'chenla-srivijaya', 'angkor', 'sea-kingdoms', 'colonial', 'independent-sea'],
};
H.lanes.forEach((l, i) => {
  const ids = PERIOD_IDS[l.id];
  if (ids.length !== l.bands.length) throw new Error(`时期数量对不上：${l.id}`);
  out(`data/polity/${l.id}.yaml`, { id: l.id, order: i + 1, color: l.c,
    periods: l.bands.map((b, j) => clean({ id: ids[j], start: b[1], end: b[2], certainty: b[3] === 'l' ? 'legendary' : b[3] === 't' ? 'traditional' : undefined })) });
  out(`locales/zh-CN/polity/${l.id}.yaml`, { name: l.name,
    periods: Object.fromEntries(l.bands.map((b, j) => { const [name, note] = b[0].split('：'); return [ids[j], clean({ name, note })]; })) });
});

/* ---------- 阵营、关系类型 ---------- */
const FACTIONS = { qin: 'china', chu: 'china', han: 'china', xiongnu: 'steppe', carthage: 'rome', parthia: 'meso' };
out('data/faction.yaml', Object.entries(FACTIONS).map(([id, civ]) => ({ id, civ, color: H.FAC[id].c })));
out('locales/zh-CN/faction.yaml', Object.fromEntries(Object.keys(FACTIONS).map(id => [id, H.FAC[id].n])));
out('data/relation-type.yaml', Object.entries(H.RT).map(([id, t]) => clean({ id, color: t.c, dashed: t.dash ? true : undefined })));

/* ---------- 人物 ---------- */
const group = p => (p.lane !== 'china' ? p.lane : p.ch === 'xihan' ? 'china-han' : 'china-qin');
const groups = {};
H.people.forEach(p => {
  (groups[group(p)] ||= { people: [], events: [] }).people.push(p.id);
  out(`data/person/${p.id}.yaml`, clean({
    id: p.id, wikidata: null, civ: p.lane, faction: FACTIONS[p.fac] ? p.fac : undefined, importance: p.imp,
    birth: p.b == null ? { unknown: true, approx: p.b0 } : clean({ year: p.b, circa: p.circa ? true : undefined }),
    death: p.dq ? { unknown: true, approx: p.d } : clean({ year: p.d, circa: p.dc ? true : undefined }),
    reign: p.reign ? [{ start: p.reign[0], end: p.reign[1] }] : undefined,
    birthplace: null, deathplace: null, places: [], reviewed: false,
  }));
  out(`locales/zh-CN/person/${p.id}.yaml`, { name: p.n, aliases: p.alt ? [p.alt] : [], role: p.role, summary: p.sum, body: (H.more.p[p.id] || '').replace(/\n/g, '\n\n'), sources: [] });
});

/* ---------- 事件 ---------- */
const evGroup = e => (e.lane !== 'china' ? e.lane : e.s <= H.B(202) ? 'china-qin' : 'china-han');
H.events.forEach(e => {
  (groups[evGroup(e)] ||= { people: [], events: [] }).events.push(e.id);
  out(`data/event/${e.id}.yaml`, clean({
    id: e.id, civ: e.lane, type: null, importance: e.imp,
    start: clean({ year: e.s, circa: e.circa ? true : undefined }), end: e.e > e.s ? { year: e.e } : undefined,
    places: [], participants: e.who.map(person => ({ person })), reviewed: false,
  }));
  out(`locales/zh-CN/event/${e.id}.yaml`, { name: e.n, summary: e.sum, body: (H.more.e[e.id] || '').replace(/\n/g, '\n\n'), sources: [] });
});

/* ---------- 关系：按“起点人物”所在的组分文件 ---------- */
const rel = {}, label = {};
H.rels.forEach(r => {
  const g = group(H.P[r.a]);
  (rel[g] ||= []).push(clean({ from: r.a, to: r.b, type: r.t, year: r.year }));
  (label[g] ||= {})[`${r.a}|${r.b}`] = r.label;
});
Object.keys(rel).forEach(g => { out(`data/relation/${g}.yaml`, rel[g]); out(`locales/zh-CN/relation/${g}.yaml`, label[g]); });

out('data/site.yaml', { extent: H.EXTENT, focus: H.FOCUS, default_open: ['china'] });
console.log(JSON.stringify(groups, null, 1));
console.log('people', H.people.length, 'events', H.events.length, 'rels', H.rels.length);
