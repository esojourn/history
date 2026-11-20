// 检查 data/ 与 locales/ 下的 YAML 能否解析。可以带上文件名的一部分作参数，只看匹配的文件：
//   node scripts/yamlcheck.mjs han-xin gaixia
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const root = path.resolve(import.meta.dirname, '..'), only = process.argv.slice(2);
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.yaml') ? [path.join(dir, e.name)] : []));
let bad = 0, n = 0;
for (const f of [...walk(path.join(root, 'data')), ...walk(path.join(root, 'locales'))]) {
  if (only.length && !only.some(k => path.basename(f, '.yaml') === k || f.includes(k))) continue;
  n++;
  const doc = YAML.parseDocument(fs.readFileSync(f, 'utf8'));
  if (doc.errors.length) { bad++; console.log(`✗ ${path.relative(root, f)}\n    ${doc.errors[0].message.split('\n')[0]}`); }
}
console.log(bad ? `${bad} 个文件有语法错误（共检查 ${n} 个）` : `${n} 个文件语法正确`);
process.exit(bad ? 1 : 0);
