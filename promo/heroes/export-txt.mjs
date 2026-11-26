// 《峡谷之外》每一期出一份 txt：讲稿 + 与史书核对查证的记录，放在成片旁边，方便发布时复制、给人审读。
// 内容全部取自 scripts.md 对应的那一篇（以 scripts.md 为准，txt 只是导出，不要手改）。
// 用法：node promo/heroes/export-txt.mjs            给已出成片的每一期导出
//       node promo/heroes/export-txt.mjs lanling2   只导出某一期（没出成片也照样导出）
// 出文件：promo/out/heroes/<期>/<期>.txt（UTF-8，Windows 换行，记事本直接能看）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const OUT = path.join(HERE, '..', 'out', 'heroes');

// 每一期对应 scripts.md 里的第几篇（按“## 一、”这样的序号找，标题改了也不影响）。新增一期就在这里加一行。
const EPISODES = {
  hanxin: '一',
  lanling: '二',
  waner: '三',
  lanling2: '四',
};

const md = fs.readFileSync(path.join(HERE, 'scripts.md'), 'utf8').replace(/\r\n/g, '\n');

function section(no) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## ${no}、`));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && (l.startsWith('## ') || l.trim() === '---'));
  if (end < 0) end = lines.length;
  return lines.slice(start, end);
}

// 行内的 Markdown 记号去掉，链接留下文字和网址
const inline = (s) => s
  .replace(/\*\*(.+?)\*\*/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1（$2）')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1（promo/heroes/$2）')
  .replace(/<(https?:[^>]+)>/g, '$1');

const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => inline(c.trim()));
const isRule = (l) => /^\|?\s*:?-{3,}/.test(l.trim());

// 把一段 Markdown（列表、小标题、表格、段落）转成纯文本
function toText(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('|')) {
      const head = cells(l);
      i += isRule(lines[i + 1] || '') ? 2 : 1;
      let n = 0;
      for (; i < lines.length && lines[i].startsWith('|'); i++) {
        const row = cells(lines[i]);
        n++;
        out.push(`（${n}）${head[0]}：${row[0]}`);
        for (let k = 1; k < head.length; k++) out.push(`    ${head[k]}：${row[k] ?? ''}`);
        out.push('');
      }
      i--;
      continue;
    }
    const h = l.match(/^#{3,}\s+(.*)/);
    if (h) { out.push('', `【${inline(h[1])}】`, ''); continue; }
    out.push(inline(l).replace(/^(\s*)- /, '$1· '));
  }
  return out;
}

function exportOne(id) {
  const no = EPISODES[id];
  const sec = section(no);
  if (!sec) throw new Error(`scripts.md 里找不到第${no}篇（${id}）`);
  const title = inline(sec[0].replace(/^##\s+/, ''));

  // 讲稿表：第一张“画面 | 旁白”表
  const t0 = sec.findIndex((l) => /^\|\s*画面\s*\|\s*旁白/.test(l));
  if (t0 < 0) throw new Error(`第${no}篇没有“画面 | 旁白”表`);
  let t1 = t0 + 2;
  while (t1 < sec.length && sec[t1].startsWith('|')) t1++;
  const rows = sec.slice(t0 + 2, t1).map(cells);

  const v = sec.findIndex((l) => /^#{3,}\s+核实记录/.test(l));
  const notesBefore = sec.slice(1, t0); // 状态、依据、定稿时定下的事项
  const notesAfter = sec.slice(t1, v < 0 ? sec.length : v); // 配地图、未用的句子等
  const verify = v < 0 ? [] : sec.slice(v);

  const status = (notesBefore.find((l) => l.includes('状态：')) || '').replace(/^\s*- /, '');
  const dir = path.join(OUT, id);
  const videos = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.mp4')) : [];

  const shown = [], spoken = [];
  for (const [scene, say] of rows) {
    if (scene.includes('不念')) shown.push(`${scene.replace(/（只显示，不念）/, '')}（只显示，不念）：${say}`);
    else spoken.push([scene, say]);
  }
  const chars = spoken.reduce((s, [, say]) => s + say.replace(/\s/g, '').length, 0);

  const bar = '════════════════════════════════';
  const L = [];
  L.push(`《峡谷之外》${title}`, '');
  L.push(inline(status));
  if (videos.length) L.push(`成片：${videos.map((f) => `promo/out/heroes/${id}/${f}`).join('、')}`);
  else L.push('成片：还没有');
  L.push(`本文件由 promo/heroes/export-txt.mjs 从 promo/heroes/scripts.md 第${no}篇导出（${new Date().toISOString().slice(0, 10)}），内容以 scripts.md 为准。`);

  L.push('', bar, '一、讲稿', bar, '');
  for (const s of shown.filter((x) => x.startsWith('第一屏'))) L.push(s, '');
  spoken.forEach(([scene, say], i) => {
    L.push(`${String(i + 1).padStart(2, '0')}　${say}`);
    L.push(`    〔画面：${scene}〕`, '');
  });
  for (const s of shown.filter((x) => !x.startsWith('第一屏'))) L.push(s, '');
  L.push(`旁白共 ${spoken.length} 段，连标点约 ${chars} 字。`);

  L.push('', bar, '二、制作说明', bar, '');
  L.push(...toText([...notesBefore, ...notesAfter]));

  L.push('', bar, '三、与史书核对查证的记录', bar);
  if (verify.length) L.push(...toText(verify));
  else L.push('', '这一篇还没有核实记录。');

  const text = L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.txt`);
  fs.writeFileSync(file, '﻿' + text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`导出 ${path.relative(ROOT, file)}（旁白 ${spoken.length} 段，约 ${chars} 字）`);
}

const want = process.argv.slice(2);
for (const id of want.length ? want : Object.keys(EPISODES)) {
  if (!EPISODES[id]) { console.error(`不认识的期：${id}（可选：${Object.keys(EPISODES).join('、')}）`); process.exitCode = 1; continue; }
  const hasVideo = fs.existsSync(path.join(OUT, id)) && fs.readdirSync(path.join(OUT, id)).some((f) => f.endsWith('.mp4'));
  if (!want.length && !hasVideo) { console.log(`跳过 ${id}：还没出成片`); continue; }
  exportOne(id);
}
