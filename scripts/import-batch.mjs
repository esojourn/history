// 把一份“批量稿”拆成 data/ 与 locales/zh-CN/ 下的单个文件。大批量写内容时用：一批写在一个文件里，
// 跑一次就全部落盘。用法：node scripts/import-batch.mjs <批量稿.yaml> [--force]
//   已经存在的文件不覆盖（除非加 --force），所以不会冲掉别人改过的条目。
// 批量稿是一个 YAML 列表，每项的 k 表示种类：
//   k: l  地点   id prec(site|city|region) cert? name modern note?
//   k: p  人物   id fac? imp b d reign? bp dp pl name al role sum body rec? civ?(默认 china)
//   k: e  事件   id type imp s e? pl who name sum body rec? civ?
//   年份：整数；"c57" = 约 57 年；"u150" = 不详（150 只用于作图）
//   pl：["luoyang", "xu 196 220", "ye 204"] —— 地点 id，后面可带起止年
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const [file, ...flags] = process.argv.slice(2);
const force = flags.includes('--force');
const list = parse(fs.readFileSync(file, 'utf8'));
const year = (v, inline = true) => {
  const s = String(v);
  if (s[0] === 'u') return `{ unknown: true, approx: ${+s.slice(1)} }`;
  if (s[0] === 'c') return `{ year: ${+s.slice(1)}, circa: true }`;
  if (!Number.isInteger(+s)) throw new Error('年份写法有误：' + s);
  return `{ year: ${+s} }`;
};
const q = s => /^[\s\-?:,\[\]{}#&*!|>'"%@`]|: | #|^(true|false|null|~|yes|no)$|^[\d.+-]+$/i.test(s) ? JSON.stringify(s) : s;
const seq = a => `[${(a || []).map(q).join(', ')}]`;
const block = (key, a) => (a || []).length ? `${key}:\n${a.map(x => `  - ${q(x)}`).join('\n')}\n` : '';
const text = (o, extra) => `name: ${q(o.name)}\n${extra}summary: ${q(o.sum)}\nbody: |-\n${String(o.body).trim().split('\n').map(l => l.trim() ? '  ' + l.trim() : '').join('\n')}\nsources: []\n${block('recalled', o.rec)}`;

let wrote = 0, skipped = [];
const put = (rel, content) => {
  const f = path.resolve(rel);
  if (fs.existsSync(f) && !force) return skipped.push(rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content.endsWith('\n') ? content : content + '\n');
  wrote++;
};

for (const o of list) {
  const civ = o.civ || 'china';
  if (!/^[a-z0-9-]+$/.test(o.id || '')) throw new Error('id 有误：' + o.id);
  if (o.k === 'l') {
    put(`data/place/${o.id}.yaml`, `id: ${o.id}\nwikidata: null\nlat: null\nlng: null\nprecision: ${o.prec}\n${o.cert ? `certainty: ${o.cert}\n` : ''}`);
    put(`locales/zh-CN/place/${o.id}.yaml`, `name: ${q(o.name)}\nmodern: ${q(o.modern)}\n${o.note ? `note: ${q(o.note)}\n` : ''}`);
  } else if (o.k === 'p') {
    const places = o.pl === 'unknown' ? 'places: unknown\n' : 'places:\n' + o.pl.map(s => {
      const [p, a, b] = String(s).split(/\s+/);
      return `  - { place: ${p}${a ? `, start: ${+a}` : ''}${b ? `, end: ${+b}` : ''} }`;
    }).join('\n') + '\n';
    put(`data/person/${o.id}.yaml`,
      `id: ${o.id}\nwikidata: null\nciv: ${civ}\n${o.fac ? `faction: ${o.fac}\n` : ''}importance: ${o.imp}\nbirth: ${year(o.b)}\ndeath: ${year(o.d)}\n` +
      ((o.reign || []).length ? 'reign:\n' + o.reign.map(r => `  - { start: ${r[0]}, end: ${r[1]} }`).join('\n') + '\n' : '') +
      `birthplace: ${o.bp}\ndeathplace: ${o.dp}\n${places}reviewed: false\n`);
    put(`locales/zh-CN/person/${o.id}.yaml`, text(o, `aliases: ${seq(o.al)}\nrole: ${q(o.role)}\n`));
  } else if (o.k === 'e') {
    put(`data/event/${o.id}.yaml`,
      `id: ${o.id}\nwikidata: null\nciv: ${civ}\ntype: ${o.type}\nimportance: ${o.imp}\nstart: ${year(o.s)}\n${o.e != null ? `end: ${year(o.e)}\n` : ''}` +
      `places: ${o.pl === 'unknown' ? 'unknown' : `[${o.pl.join(', ')}]`}\n` +
      ((o.who || []).length ? 'participants:\n' + o.who.map(p => `  - person: ${p}`).join('\n') + '\n' : '') + 'reviewed: false\n');
    put(`locales/zh-CN/event/${o.id}.yaml`, text(o, ''));
  } else throw new Error(`${o.id}：k 应为 l / p / e`);
}
console.log(`写入 ${wrote} 个文件` + (skipped.length ? `；已存在而跳过 ${skipped.length} 个：\n  ${skipped.join('\n  ')}` : ''));
