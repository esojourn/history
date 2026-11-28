// 数据校验。`npm run validate` 单独运行；`npm run build` 会先跑它，有“错误”就不构建。
//   错误：数据自相矛盾或缺必填项，必须改。
//   提醒：还没做完的事（地点没查、没有出处、坐标空着……），不拦构建。加 --quiet 只看汇总。
import { loadRaw, loadText, BASE_LOCALE } from '../src/lib/dataset.mjs';

const quiet = process.argv.includes('--quiet');
const errors = [], warns = {};
const err = (where, msg) => errors.push(`${where}：${msg}`);
const warn = (kind, where) => (warns[kind] ||= []).push(where);

let raw, tx;
try { raw = loadRaw(); tx = loadText(BASE_LOCALE); } catch (e) { console.error('读取数据失败（多半是某个 YAML 文件格式有误）：\n' + e.message); process.exit(1); }

const isInt = v => Number.isInteger(v);
const unknown = v => v === 'unknown' || (v && typeof v === 'object' && v.unknown);
const TYPES = new Set(raw.relType.map(t => t.id));
const EVENT_TYPES = new Set(['battle', 'war', 'political', 'founding', 'uprising', 'cultural', 'diplomatic', 'migration', 'disaster']);
const factions = new Set(raw.faction.map(f => f.id));

// 地点引用：null = 还没查；unknown = 查过，史料无载；其余必须是已有的地点 id
const checkPlace = (where, v, field) => {
  if (v == null) return warn('地点还没查（null）', `${where}.${field}`);
  if (v === 'unknown') return;
  if (!raw.place[v]) err(where, `${field} 指向不存在的地点“${v}”`);
};

/* ---------- 文明与时期 ---------- */
for (const [id, l] of Object.entries(raw.polity)) {
  const w = `polity/${id}`, t = tx.polity[id] || {};
  if (l.id !== id) err(w, 'id 与文件名不一致');
  if (!t.name) err(w, '缺中文名称');
  if (t.short != null && [...String(t.short)].length > 2) err(w, '简称 short 最多两个字');
  (l.periods || []).forEach((p, i) => {
    if (!isInt(p.start) || !isInt(p.end) || p.start >= p.end) err(w, `时期 ${p.id} 的起止年有误`);
    if (i && p.start < l.periods[i - 1].end) err(w, `时期 ${p.id} 与前一个时期重叠`);
    if (!(t.periods || {})[p.id]?.name) err(w, `时期 ${p.id} 缺中文名称`);
  });
}

/* ---------- 地点 ---------- */
for (const [id, p] of Object.entries(raw.place)) {
  const w = `place/${id}`, t = tx.place[id] || {};
  if (p.id !== id) err(w, 'id 与文件名不一致');
  if (!t.name) err(w, '缺地名');
  if (!t.modern) err(w, '缺今地');
  if (!['site', 'city', 'region'].includes(p.precision)) err(w, 'precision 应为 site / city / region');
  if ((p.lat == null) !== (p.lng == null)) err(w, '经纬度只填了一个');
  if (p.lat != null && (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180)) err(w, '经纬度超出范围');
  if (p.lat == null) warn('地点缺坐标', w);
  if (!p.wikidata) warn('地点缺 Wikidata 编号', w);
}

/* ---------- 人物 ---------- */
const life = {};   // id → [作图起点, 终点]
for (const [id, p] of Object.entries(raw.person)) {
  const w = `person/${id}`, t = tx.person[id] || {};
  if (p.id !== id) err(w, 'id 与文件名不一致');
  if (!raw.polity[p.civ]) err(w, `civ“${p.civ}”不存在`);
  if (p.faction && !factions.has(p.faction)) err(w, `faction“${p.faction}”不存在`);
  if (!(p.importance >= 1 && p.importance <= 5)) err(w, 'importance 应为 1–5');
  if (p.seq != null) {
    const band = (raw.polity[p.civ]?.periods || []).find(x => x.id === p.era);
    if (!band || band.certainty !== 'legendary') err(w, 'seq 只用于“只排先后”的时期，era 要写那个时期的 id');
    if (!Array.isArray(p.seq) || p.seq.length !== 2 || !p.seq.every(isInt) || p.seq[0] > p.seq[1] || p.seq[0] < 1) err(w, 'seq 应为 [起, 止] 两个正整数');
    if (!p.noscale) continue;
  }
  const bu = unknown(p.birth), du = unknown(p.death);
  if (!p.birth || !p.death) { err(w, '缺 birth 或 death（不详请写 { unknown: true, approx: 年份 }）'); continue; }
  if (!bu && !isInt(p.birth.year)) err(w, 'birth.year 应为整数');
  if (!du && !isInt(p.death.year)) err(w, 'death.year 应为整数');
  if (du && !isInt(p.death.approx)) err(w, '卒年不详时要给 approx（只用于作图）');
  const b = bu ? (isInt(p.birth.approx) ? p.birth.approx : null) : p.birth.year, d = du ? p.death.approx : p.death.year;
  if (isInt(b) && isInt(d)) {
    if (d < b) err(w, '卒年早于生年');
    // long_life: true —— 史料明确记载、或由记载可以推知的高寿（如圣经所记族长的岁数），核对过才加
    if (d - b > 110 && !p.noscale && !p.long_life) err(w, `寿命 ${d - b} 岁，请核对（史料确有记载的，加 long_life: true）`);
  }
  life[id] = [isInt(b) ? b : d - 50, d];
  for (const r of p.reign || []) {
    if (!isInt(r.start) || !isInt(r.end) || r.start > r.end) err(w, '在位年份有误');
    else if (r.start < life[id][0] || r.end > life[id][1]) err(w, '在位年份超出生卒年');
  }
  checkPlace(w, p.birthplace, 'birthplace'); checkPlace(w, p.deathplace, 'deathplace');
  if (p.places !== 'unknown') {
    for (const x of p.places || []) checkPlace(w, typeof x === 'string' ? x : x.place, 'places');
    if (!(p.places || []).length) warn('人物没有活动地点', w);
  }
  if (!t.name) err(w, '缺中文名称');
  if (!t.summary) err(w, '缺简介');
  if (!(t.body || '').trim()) warn('没有正文', w);
  if (!(t.sources || []).length) warn((t.recalled || []).length ? '只有凭记忆标注的出处' : '没有出处（全凭 AI 记忆）', w);
  else if ((t.recalled || []).length) warn('部分出处凭记忆标注、尚未核对', w);
  if (!p.wikidata) warn('人物、事件缺 Wikidata 编号', w);
  if (!p.reviewed) warn('尚未人工核对', w);
}

/* ---------- 事件 ---------- */
for (const [id, e] of Object.entries(raw.event)) {
  const w = `event/${id}`, t = tx.event[id] || {};
  if (e.id !== id) err(w, 'id 与文件名不一致');
  if (!raw.polity[e.civ]) err(w, `civ“${e.civ}”不存在`);
  if (e.seq != null) {
    const band = (raw.polity[e.civ]?.periods || []).find(x => x.id === e.era);
    if (!band || band.certainty !== 'legendary') err(w, 'seq 只用于“只排先后”的时期，era 要写那个时期的 id');
    if (!isInt(e.seq) || e.seq < 1) err(w, '事件的 seq 应为一个正整数');
  }
  if (!e.start || !isInt(e.start.year)) { err(w, 'start.year 应为整数'); continue; }
  if (e.end && (!isInt(e.end.year) || e.end.year < e.start.year)) err(w, 'end 早于 start');
  if (e.type == null) warn('事件没有类型', w); else if (!EVENT_TYPES.has(e.type)) err(w, `type“${e.type}”不在规定的几种之内`);
  for (const x of e.participants || []) {
    if (!raw.person[x.person]) { err(w, `参与者“${x.person}”不存在`); continue; }
    const [b, d] = life[x.person] || [];
    if (b != null && (e.start.year > d || (e.end ? e.end.year : e.start.year) < b)) err(w, `参与者 ${x.person} 当时不在世`);
  }
  if (e.places !== 'unknown') {
    if (!(e.places || []).length) warn('地点还没查（null）', `${w}.places`);
    for (const x of e.places || []) checkPlace(w, x, 'places');
  }
  if (!t.name) err(w, '缺中文名称');
  if (!t.summary) err(w, '缺简介');
  if (!(t.body || '').trim()) warn('没有正文', w);
  if (!(t.sources || []).length) warn((t.recalled || []).length ? '只有凭记忆标注的出处' : '没有出处（全凭 AI 记忆）', w);
  else if ((t.recalled || []).length) warn('部分出处凭记忆标注、尚未核对', w);
  if (!e.reviewed) warn('尚未人工核对', w);
}

/* ---------- 关系 ---------- */
const seen = new Set();
for (const [g, list] of Object.entries(raw.relation)) {
  (list || []).forEach((r, i) => {
    const w = `relation/${g} 第 ${i + 1} 条（${r.from} → ${r.to}）`;
    if (!raw.person[r.from] || !raw.person[r.to]) return err(w, '有一端的人物不存在');
    if (!TYPES.has(r.type)) err(w, `类型“${r.type}”不存在`);
    const key = [r.from, r.to].sort().join('|');
    if (seen.has(key)) err(w, '这两个人之间已有一条关系'); seen.add(key);
    const lo = Math.max(life[r.from][0], life[r.to][0]), hi = Math.min(life[r.from][1], life[r.to][1]);
    if (lo > hi) err(w, '两人在世时间没有交集');
    else if (r.year != null && (r.year < lo || r.year > hi)) err(w, `year ${r.year} 不在两人都在世的年份（${lo} 至 ${hi}）之内`);
    if (!(tx.relation[g] || {})[`${r.from}|${r.to}`]) err(w, '缺说明文字');
  });
}

/* ---------- 诗歌链接（locales/<语言>/hymn.yaml） ---------- */
{
  const bodies = [...Object.values(tx.person), ...Object.values(tx.event)].map(t => t.body || '').join('\n');
  for (const [k, n] of Object.entries(tx.hymn || {})) {
    if (!/^\d{2}-\d{3}$/.test(String(n))) err(`hymn.yaml“${k}”`, `诗歌站编号“${n}”格式不对，应像 01-200`);
    if (!bodies.includes(`《${k}》`)) warn('登记的诗歌正文里没有提到', k);
  }
  if (!raw.site.hymn_url && Object.keys(tx.hymn || {}).length) err('data/site.yaml', '缺 hymn_url');
}

/* ---------- 输出 ---------- */
const n = o => Object.keys(o).length;
console.log(`文明 ${n(raw.polity)}　人物 ${n(raw.person)}　事件 ${n(raw.event)}　关系 ${Object.values(raw.relation).flat().length}　地点 ${n(raw.place)}`);
for (const [kind, list] of Object.entries(warns)) {
  console.log(`提醒　${kind}：${list.length} 处`);
  if (!quiet && kind !== '尚未人工核对') console.log('      ' + list.slice(0, 12).join('、') + (list.length > 12 ? ` …等 ${list.length} 处` : ''));
}
if (errors.length) { console.log(`\n错误 ${errors.length} 处：`); errors.forEach(e => console.log('  ✗ ' + e)); process.exit(1); }
console.log('没有错误。');
