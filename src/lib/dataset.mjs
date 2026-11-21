// 构建时在 Node 里运行：读 data/（结构）和 locales/<语言>/（文字），合成网站用的一份数据。
// 校验脚本 scripts/validate.mjs 也用这里的读取函数。
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export const ROOT = process.cwd();
export const BASE_LOCALE = 'zh-CN';
// 增加语言：在 locales/ 下建目录，再在这里加一行。缺的文字自动回退到中文。
export const LANGS = [{ code: 'zh', dir: 'zh-CN', html: 'zh-CN' }];

const read = f => YAML.parse(fs.readFileSync(f, 'utf8'));
const readDir = rel => {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) return {};
  return Object.fromEntries(fs.readdirSync(dir).filter(f => f.endsWith('.yaml')).sort().map(f => [f.slice(0, -5), read(path.join(dir, f))]));
};
const readFile = rel => { const f = path.join(ROOT, rel); return fs.existsSync(f) ? read(f) : null; };

export function loadRaw() {
  return {
    site: readFile('data/site.yaml'),
    polity: readDir('data/polity'),
    faction: readFile('data/faction.yaml') || [],
    relType: readFile('data/relation-type.yaml') || [],
    person: readDir('data/person'),
    event: readDir('data/event'),
    place: readDir('data/place'),
    relation: readDir('data/relation'),       // { 组: [关系, …] }
  };
}

export function loadText(dir) {
  const d = `locales/${dir}`;
  return {
    ui: readFile(`${d}/ui.yaml`) || {},
    polity: readDir(`${d}/polity`),
    faction: readFile(`${d}/faction.yaml`) || {},
    person: readDir(`${d}/person`),
    event: readDir(`${d}/event`),
    place: readDir(`${d}/place`),
    relation: readDir(`${d}/relation`),
  };
}

const isUnknown = v => v === 'unknown' || (v && typeof v === 'object' && v.unknown);
const und = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)));
const placeRef = v => (v == null ? undefined : v === 'unknown' ? 'unknown' : String(v));

// 构建一个站点要生成上百个页面，每页都要这份数据；几秒内重复要就给同一份，不必每次重读几百个文件。
const cache = new Map();
export function build(code) {
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < 3000) return hit.data;
  const data = compose(code);
  cache.set(code, { at: Date.now(), data });
  return data;
}

/** 合成一种语言的整份数据（紧凑格式，字段名短，直接发给浏览器）。 */
function compose(code) {
  const lang = LANGS.find(l => l.code === code);
  const raw = loadRaw(), tx = loadText(lang.dir), base = lang.dir === BASE_LOCALE ? tx : loadText(BASE_LOCALE);
  const text = (kind, id) => ({ ...(base[kind][id] || {}), ...(tx[kind][id] || {}) });
  const ui = { ...base.ui, ...tx.ui };

  const lanes = Object.values(raw.polity).sort((a, b) => a.order - b.order).map(l => {
    const t = text('polity', l.id), pt = t.periods || {};
    return { id: l.id, name: t.name || l.id, c: l.color,
      // [名称, 起, 止, 确定度(t 传统 / l 传说), id, 补充说明]
      bands: l.periods.map(p => [(pt[p.id] || {}).name || p.id, p.start, p.end, p.certainty === 'legendary' ? 'l' : p.certainty === 'traditional' ? 't' : '', p.id, (pt[p.id] || {}).note || '']) };
  });

  const fac = Object.fromEntries(lanes.map(l => [l.id, { n: l.name, c: l.c }]));
  const facText = { ...base.faction, ...tx.faction };
  raw.faction.forEach(f => { fac[f.id] = { n: facText[f.id] || f.id, c: f.color }; });
  const rt = Object.fromEntries(raw.relType.map(t => [t.id, und({ n: ui[`rel.${t.id}`] || t.id, c: t.color, dash: t.dashed ? '5 4' : undefined })]));

  const people = Object.values(raw.person).map(p => {
    const t = text('person', p.id), bu = isUnknown(p.birth), du = isUnknown(p.death);
    return und({
      id: p.id, n: t.name || p.id, alt: (t.aliases || []).join('、'), lane: p.civ, fac: p.faction || p.civ, imp: p.importance,
      b: bu ? undefined : p.birth.year, e0: bu ? p.birth.approx : undefined, circa: !bu && p.birth.circa ? 1 : undefined,
      d: du ? p.death.approx : p.death.year, dq: du ? 1 : undefined, dc: !du && p.death.circa ? 1 : undefined,
      reigns: (p.reign || []).map(r => [r.start, r.end]),
      role: t.role || '', sum: t.summary || '', body: (t.body || '').trim(), src: t.sources || [], rec: (t.recalled || []).length ? t.recalled : undefined,
      bp: placeRef(p.birthplace), dp: placeRef(p.deathplace),
      pl: p.places === 'unknown' ? [] : (p.places || []).map(x => (typeof x === 'string' ? { p: x } : und({ p: x.place, s: x.start, e: x.end }))),
      wd: p.wikidata, rev: p.reviewed ? 1 : undefined,
    });
  });

  const events = Object.values(raw.event).map(e => {
    const t = text('event', e.id);
    return und({
      id: e.id, n: t.name || e.id, lane: e.civ, imp: e.importance, type: e.type,
      s: e.start.year, e: e.end ? e.end.year : e.start.year, circa: e.start.circa ? 1 : undefined,
      who: (e.participants || []).map(x => x.person), sum: t.summary || '', body: (t.body || '').trim(), src: t.sources || [], rec: (t.recalled || []).length ? t.recalled : undefined,
      pl: e.places === 'unknown' ? ['unknown'] : (e.places || []).map(String),
      wd: e.wikidata, rev: e.reviewed ? 1 : undefined,
    });
  });
  // who 为空数组时 und() 会去掉它，补回来，页面代码就不用到处判空
  events.forEach(e => { e.who ||= []; e.src ||= []; e.pl ||= []; e.sum ||= ''; e.body ||= ''; });
  people.forEach(p => { p.src ||= []; p.pl ||= []; p.reigns ||= []; p.alt ||= ''; p.role ||= ''; p.sum ||= ''; p.body ||= ''; });

  const rels = Object.entries(raw.relation).flatMap(([g, list]) => (list || []).map(r => {
    const lt = { ...(base.relation[g] || {}), ...(tx.relation[g] || {}) };
    return und({ a: r.from, b: r.to, t: r.type, year: r.year, label: lt[`${r.from}|${r.to}`] || '' });
  }));

  const places = Object.fromEntries(Object.values(raw.place).map(p => {
    const t = text('place', p.id);
    return [p.id, und({ n: t.name || p.id, modern: t.modern || '', note: t.note, lat: p.lat, lng: p.lng, prec: p.precision, cert: p.certainty, wd: p.wikidata })];
  }));

  return { lang: lang.code, htmlLang: lang.html, ui, site: raw.site, lanes, fac, rt, people, events, rels, places };
}
