// 《峡谷之外》每一期出一份 txt，放在成片旁边，发布时直接复制用。格式是项目方 2026-11-26 在 lanling.txt 上改定的：
//
//   《峡谷之外的真实历史》二：兰陵王 - 一句“家事”，一杯毒酒      ← 系列名 + 第几篇 + 人物 - 副标题
//   （空行）
//   https://lishi.alz-ai.cn/zh/#person/gao-changgong     ← 网站上这个人物的网址
//   （空行）
//   旁白，一段一行，不编号、不写画面                   ← 只要念的；第一屏标题等“不念”的不放
//   （空行）
//   史实核对自：……                                   ← 结尾卡上的小字
//   （空行）
//   查过的原文：                                       ← 核实记录里的书目清单（带链接）；逐条对照表不放
//   · ……
//
// 内容全部取自 scripts.md 对应的那一篇（以 scripts.md 为准，txt 只是导出，不要手改）。
// 用法：node promo/heroes/export-txt.mjs            给已出成片的每一期导出
//       node promo/heroes/export-txt.mjs lanling2   只导出某一期（没出成片也照样导出）
// 出文件：promo/out/heroes/<期>/<期>.txt（UTF-8 带 BOM，Windows 换行，记事本直接能看）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const OUT = path.join(HERE, '..', 'out', 'heroes');
const SITE = 'https://lishi.alz-ai.cn/zh/#person/';

// 每一期：对应 scripts.md 里的第几篇（按“## 一、”这样的序号找），网站上的人物编号（与结尾二维码指向的一致）。
// 新增一期就在这里加一行。
const EPISODES = {
  hanxin: { no: '一', person: 'han-xin' },
  lanling: { no: '二', person: 'gao-changgong' },
  waner: { no: '三', person: 'shangguan-waner' },
  lanling2: { no: '四', person: 'gao-changgong' },
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

function exportOne(id) {
  const { no, person } = EPISODES[id];
  const sec = section(no);
  if (!sec) throw new Error(`scripts.md 里找不到第${no}篇（${id}）`);

  // 标题：“## 二、《兰陵王：一句“家事”，一杯毒酒》” → “《峡谷之外的真实历史》二：兰陵王 - 一句“家事”，一杯毒酒”
  const m = sec[0].match(/^##\s+\S+?、《(.+)》\s*$/);
  if (!m) throw new Error(`第${no}篇标题认不出：${sec[0]}`);
  const k = m[1].indexOf('：');
  const title = k < 0 ? m[1] : `${m[1].slice(0, k)} - ${m[1].slice(k + 1)}`;

  // 讲稿表：第一张“画面 | 旁白”表
  const t0 = sec.findIndex((l) => /^\|\s*画面\s*\|\s*旁白/.test(l));
  if (t0 < 0) throw new Error(`第${no}篇没有“画面 | 旁白”表`);
  let t1 = t0 + 2;
  while (t1 < sec.length && sec[t1].startsWith('|')) t1++;
  const rows = sec.slice(t0 + 2, t1).map(cells);
  const spoken = rows.filter(([scene]) => !scene.includes('不念')).map(([, say]) => say);
  const endNote = rows.find(([scene]) => scene.includes('结尾卡上的小字'));
  if (!endNote) throw new Error(`第${no}篇没有“结尾卡上的小字”一行`);

  // 核实记录里的“查过的原文：”书目清单（到下一张表或下一个小标题为止）
  const v = sec.findIndex((l) => /^#{3,}\s+核实记录/.test(l));
  const s0 = v < 0 ? -1 : sec.findIndex((l, i) => i > v && l.trim() === '查过的原文：');
  if (s0 < 0) throw new Error(`第${no}篇的核实记录里没有“查过的原文：”清单，先在 scripts.md 里补上`);
  const books = [];
  for (let i = s0 + 1; i < sec.length && !sec[i].startsWith('|') && !sec[i].startsWith('#'); i++) {
    if (/^\s*- /.test(sec[i])) books.push(inline(sec[i]).replace(/^\s*- /, '· '));
  }
  if (!books.length) throw new Error(`第${no}篇“查过的原文：”下面是空的`);

  const L = [
    `《峡谷之外的真实历史》${no}：${title}`, '',
    SITE + person, '',
    ...spoken, '',
    endNote[1], '',
    '查过的原文：', '',
    ...books, '',
  ];
  const dir = path.join(OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.txt`);
  fs.writeFileSync(file, '﻿' + L.join('\r\n') + '\r\n', 'utf8');
  console.log(`导出 ${path.relative(ROOT, file)}（旁白 ${spoken.length} 段，书目 ${books.length} 种）`);
}

const want = process.argv.slice(2);
for (const id of want.length ? want : Object.keys(EPISODES)) {
  if (!EPISODES[id]) { console.error(`不认识的期：${id}（可选：${Object.keys(EPISODES).join('、')}）`); process.exitCode = 1; continue; }
  const hasVideo = fs.existsSync(path.join(OUT, id)) && fs.readdirSync(path.join(OUT, id)).some((f) => f.endsWith('.mp4'));
  if (!want.length && !hasVideo) { console.log(`跳过 ${id}：还没出成片`); continue; }
  exportOne(id);
}
