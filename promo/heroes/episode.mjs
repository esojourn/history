// 《峡谷之外》各集共用的部分：对照定稿检查旁白、本地静态服务器、手机画幅浏览器与手势、分段计时、录屏转视频、字幕。
// 从 lanling.mjs 抽出来，韩信一集（hanxin.mjs）、兰陵王横版（lanling-h.mjs）用这里的；lanling.mjs 还是自带一份同样的代码，没有改动，重出兰陵王照旧。
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROMO = path.resolve(HERE, '..');
export const DIST = path.resolve(PROMO, '../dist');
export const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const VW = 390, VH = 844, DSF = 2;
export const PAPER = '#efe9dc';
export const CREDIT = '图片来自《王者荣耀》官方';
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const ease = u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

/* ---------- 旁白：对照 scripts.md 里某一篇的定稿，逐字一致才往下做 ---------- */
// heading：这一篇的标题行开头（如 '## 一、'）；rows：表里要念的行数（不算“只显示，不念”那一行）
export function loadNarration(yamlFile, heading, rows) {
  const shots = YAML.parse(fs.readFileSync(yamlFile, 'utf8')).shots;
  const md = fs.readFileSync(path.join(HERE, 'scripts.md'), 'utf8');
  const i = md.indexOf(heading);
  if (i < 0) { console.error('scripts.md 里找不到 ' + heading); process.exit(1); }
  const sec = md.slice(i, md.indexOf('配地图：', i));
  const rs = sec.split('\n').filter(l => l.startsWith('|')).map(l => l.split('|').map(c => c.trim()))
    .filter(c => c[1] !== '画面' && !/^-+$/.test(c[1]) && !c[1].includes('不念'));
  const want = rs.map(c => c[2]).join(''), got = shots.map(s => s.say).join('');
  if (rs.length !== rows || want !== got) { console.error(path.basename(yamlFile) + ' 的旁白和 scripts.md 的定稿对不上，先改一致再录'); process.exit(1); }
  console.log(`旁白与定稿逐字一致（${got.replace(/\s/g, '').length} 字）`);
  return shots;
}

export function requireFiles(files, hint) {
  for (const f of files) if (!fs.existsSync(f)) { console.error('缺少文件：' + f + '（' + hint + '）'); process.exit(1); }
}

/* ---------- 本地静态服务器（放 dist/） ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webp': 'image/webp' };
export async function serveDist() {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = path.join(DIST, p);
    if (!f.startsWith(DIST)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

/* ---------- 录制时页面里画出手指位置（只在录制时注入，不改网站） ---------- */
const FINGERS = () => {
  const boot = () => {
    const st = document.createElement('style');
    st.textContent = `.__f{position:fixed;z-index:2147483647;pointer-events:none;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;
        background:rgba(232,163,61,.38);border:2.5px solid rgba(255,255,255,.95);box-shadow:0 1px 6px rgba(0,0,0,.35);transition:opacity .18s}
      .__tap{position:fixed;z-index:2147483646;pointer-events:none;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;
        border:3px solid #e8a33d;animation:__tap .5s ease-out forwards}
      @keyframes __tap{from{transform:scale(.5);opacity:1}to{transform:scale(1.8);opacity:0}}`;
    document.head.append(st);
    const dots = [0, 1].map(() => { const d = document.createElement('div'); d.className = '__f'; d.style.opacity = 0; document.documentElement.append(d); return d; });
    const upd = e => dots.forEach((d, i) => { const t = e.touches[i]; d.style.opacity = t ? 1 : 0; if (t) { d.style.left = t.clientX + 'px'; d.style.top = t.clientY + 'px'; } });
    ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(n => addEventListener(n, upd, { capture: true, passive: true }));
    addEventListener('touchstart', e => ['touchmove', 'touchend', 'touchcancel'].forEach(n => e.target.addEventListener(n, upd, { passive: true })), { capture: true, passive: true });
    addEventListener('mousedown', e => {
      const r = document.createElement('div'); r.className = '__tap'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      const d = dots[0]; d.style.left = r.style.left; d.style.top = r.style.top; d.style.opacity = 1;
      document.documentElement.append(r); setTimeout(() => r.remove(), 600);
    }, true);
    addEventListener('mouseup', () => setTimeout(() => { dots[0].style.opacity = 0; }, 120), true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot); else boot();
};

/* ---------- 手机画幅的浏览器，以及在上面的各种动作 ---------- */
export async function openPhone() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'] });
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DSF, isMobile: true, hasTouch: true, locale: 'zh-CN' });
  await ctx.addInitScript(() => { try { localStorage.setItem('fz', '1'); } catch (_) {} });
  await ctx.addInitScript(FINGERS);
  await ctx.route(/googletagmanager|google-analytics/, r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('页面错误：', e.message));
  const cdp = await ctx.newCDPSession(page);

  let lastPts = [];
  const touch = (type, pts) => { if (type === 'touchEnd') pts = lastPts; else lastPts = pts;
    return cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id, radiusX: 1, radiusY: 1 })) }); };
  async function steps(ms, fn) {
    const n = Math.max(2, Math.round(ms / 16)), t0 = Date.now();
    for (let i = 1; i <= n; i++) { await fn(ease(i / n)); const due = t0 + (ms * i) / n - Date.now(); if (due > 0) await sleep(due); }
  }
  // 两指缩放：以 (cx, cy) 为中点，两指竖着排开，间距从 d0 变到 d1
  async function pinch(cx, cy, d0, d1, ms) {
    const at = d => [[cx - d * .25, cy - d / 2], [cx + d * .25, cy + d / 2]];
    await touch('touchStart', at(d0)); await sleep(80);
    await steps(ms, async u => touch('touchMove', at(d0 + (d1 - d0) * u)));
    await sleep(150); await touch('touchEnd', []);
  }
  async function tap(x, y) { await page.mouse.move(x, y); await page.mouse.down(); await sleep(90); await page.mouse.up(); }
  async function tapSel(sel) {
    const b = await page.locator(sel).first().boundingBox();
    if (!b) throw new Error('找不到 ' + sel);
    await tap(b.x + b.width / 2, b.y + b.height / 2);
  }
  // 关系图里某个人的那一条：点它露在卡片上方的那一段的中间
  async function tapPerson(id) {
    const pt = await page.evaluate(id => {
      const g = document.querySelector(`#mpeople [data-p="${id}"] rect`); if (!g) return null;
      const r = g.getBoundingClientRect(), top = Math.max(r.y, 150), bot = Math.min(r.bottom, document.querySelector('#msheet').getBoundingClientRect().top - 16);
      return [r.x + r.width / 2, (top + bot) / 2];
    }, id);
    if (!pt) throw new Error('关系图里找不到 ' + id);
    await tap(...pt);
  }
  // 关系图上某个标注（如“举荐”）在屏幕上的位置
  const labelPt = text => page.evaluate(t => {
    const e = [...document.querySelectorAll('#mpeople text')].find(x => x.textContent === t); if (!e) return null;
    const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2];
  }, text);
  // 卡片里的文字滚到某句话（或 'sel:选择器' 指的那个元素）：让它停在卡片顶部往下 off 像素处。不给就回到开头
  const scrollCard = (snip, ms = 1200, off = 8) => page.evaluate(([snip, ms, off]) => new Promise((res, rej) => {
    const sh = document.querySelector('#msheet');
    let y1 = 0;
    if (snip && snip.startsWith('sel:')) {
      const el = sh.querySelector(snip.slice(4));
      if (!el) return rej(new Error('卡片里找不到 ' + snip));
      y1 = Math.max(0, Math.min(sh.scrollHeight - sh.clientHeight, sh.scrollTop + el.getBoundingClientRect().top - sh.getBoundingClientRect().top - off));
    } else if (snip) {
      const w = document.createTreeWalker(sh, NodeFilter.SHOW_TEXT); let n, r = null;
      while ((n = w.nextNode())) { const i = n.data.indexOf(snip); if (i >= 0) { r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + snip.length); break; } }
      if (!r) return rej(new Error('卡片里找不到这句话：' + snip));
      y1 = Math.max(0, Math.min(sh.scrollHeight - sh.clientHeight, sh.scrollTop + r.getBoundingClientRect().top - sh.getBoundingClientRect().top - off));
    }
    const y0 = sh.scrollTop, t0 = performance.now(), e = u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
    const step = now => { const u = Math.min(1, (now - t0) / ms); sh.scrollTop = y0 + (y1 - y0) * e(u); if (u < 1) requestAnimationFrame(step); else res(true); };
    requestAnimationFrame(step);
  }), [snip, ms, off]);
  const sheetIs = cls => page.evaluate(c => document.querySelector('#msheet').classList.contains(c), cls);
  // 卡片：收起（只露名字）↔ 展开半屏
  async function openCard() { if (await sheetIs('peek')) { await tapSel('#msheet .mgrip'); await sleep(450); } if (await sheetIs('peek')) throw new Error('卡片没有展开'); }
  async function closeCard() { if (!(await sheetIs('peek'))) { await scrollCard(null, 250); await tapSel('#msheet .mgrip'); await sleep(450); } if (!(await sheetIs('peek'))) throw new Error('卡片没有收起'); }
  const focusName = () => page.evaluate(() => document.querySelector('#mseg b')?.textContent || '');
  async function expectFocus(name) { const f = await focusName(); if (!f.includes(name)) throw new Error(`应该聚焦“${name}”，现在是“${f}”`); }
  // 打字：一个字一个字输入
  async function type(text, gap = 230) { for (const ch of text) { await page.keyboard.insertText(ch); await sleep(gap); } }

  return { browser, ctx, page, cdp, pinch, tap, tapSel, tapPerson, labelPt, scrollCard, openCard, closeCard, expectFocus, type };
}

/* ---------- 分段：每段等上一段的旁白念完（加 pad）再开始 ---------- */
export const VOLEAD = 0.15;   // 字幕先出来一点，旁白跟上
export function makeTimeline({ shot, vo, still, stillDir, page }) {
  const marks = [];
  const tl = { marks, t0: 0 };
  // mark(id)：先等上一段的旁白念完（加 pad），再开始这一段；mark(null) 等最后一段念完
  tl.mark = async id => {
    const last = marks[marks.length - 1];
    if (last && !still) { const due = tl.t0 + (last.at + VOLEAD + vo[last.id].dur + shot[last.id].pad) * 1000 - Date.now(); if (due > 0) await sleep(due); }
    if (id) marks.push({ id, at: (Date.now() - tl.t0) / 1000 });
  };
  // 等到这一段旁白念到第 frac（0–1，按字数估）的地方。截静帧时不等
  tl.until = async frac => {
    if (still) return;
    const last = marks[marks.length - 1];
    const due = tl.t0 + (last.at + VOLEAD + vo[last.id].dur * frac) * 1000 - Date.now(); if (due > 0) await sleep(due);
  };
  tl.snap = async name => { if (still) { await sleep(500); await page.screenshot({ path: path.join(stillDir, name + '.png') }); } };
  tl.at = id => marks.find(m => m.id === id).at;
  return tl;
}
// 一段旁白里，某几个字之前的字数占全段的比例（用来在一段里面再对时间）
export function fracBefore(say, snip) {
  const i = say.indexOf(snip); if (i < 0) throw new Error('旁白里没有：' + snip);
  const n = s => s.replace(/[\s“”‘’《》]/g, '').length;
  return n(say.slice(0, i)) / n(say);
}

/* ---------- 录像（CDP screencast，按时间戳补成 30fps） ---------- */
export async function startScreencast(cdp, w = VW * DSF, h = VH * DSF) {
  const frames = [];
  cdp.on('Page.screencastFrame', f => {
    frames.push({ t: f.metadata.timestamp, b: f.data });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
  for (let i = 0; i < 100 && !frames.length; i++) await sleep(20);
  return frames;
}
export function framesToVideo(frames, total, outDir, file, w = VW * DSF, h = VH * DSF) {
  const fdir = path.join(outDir, 'frames');
  fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
  const endT = frames[0].t + total, list = [];
  frames.forEach((f, i) => {
    const name = `${String(i).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(fdir, name), Buffer.from(f.b, 'base64'));
    const next = i + 1 < frames.length ? frames[i + 1].t : endT;
    list.push(`file '${name}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  list.push(`file '${String(frames.length - 1).padStart(5, '0')}.jpg'`);
  fs.writeFileSync(path.join(fdir, 'list.txt'), list.join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(fdir, 'list.txt'),
    '-t', total.toFixed(3), '-vf', `fps=30,scale=${w}:${h}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', path.join(outDir, file)]);
  fs.rmSync(fdir, { recursive: true, force: true });
}

/* ---------- 把几张 HTML 底图画成 PNG（默认 1080×1920；横版传 1920, 1080） ---------- */
export async function renderPages(pages, outDir, opaque = [], w = 1080, h = 1920) {
  const b2 = await chromium.launch({ executablePath: CHROME, headless: true });
  const p2 = await b2.newPage({ viewport: { width: w, height: h } });
  for (const [name, html] of Object.entries(pages)) {
    await p2.setContent(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}</style>${html}`);
    await p2.waitForTimeout(300);
    await p2.screenshot({ path: path.join(outDir, name + '.png'), omitBackground: !opaque.includes(name) });
  }
  await b2.close();
}
export const dataUrl = f => `data:image/${f.endsWith('.jpg') ? 'jpeg' : 'png'};base64,${fs.readFileSync(f).toString('base64')}`;

/* ---------- 字幕：按标点断成短句，一次显示一句；时间按字数分摊，再对齐到配音里的停顿 ---------- */
const MAXLEN = 18;
export function chunksOf(say) {
  // 引号里的一整句原话当成一块，不从中间断开
  const pieces = say.match(/“[^”]*”[，。？！：；]?|[^，。？！：；“]+[，。？！：；]?/g);
  const out = []; let cur = '';
  const endsSentence = s => /[。？！][”’]?$/.test(s);
  for (const p of pieces) {
    if (cur && (cur.length + p.length > MAXLEN || endsSentence(cur))) { out.push(cur); cur = ''; }
    cur += p;
  }
  if (cur) out.push(cur);
  return out;
}
export const weight = s => [...s].reduce((w, ch) => w + (/\d/.test(ch) ? 1.6 : '，；：'.includes(ch) ? 1.3 : '。？！'.includes(ch) ? 2.2 : ch === '、' ? 0.5 : /[“”‘’《》\s]/.test(ch) ? 0 : 1), 0);
export function silences(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-35dB:d=0.1', '-f', 'null', '-'], { encoding: 'utf8' });
  const s = [...r.stderr.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]), e = [...r.stderr.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
  return s.map((a, i) => [a, e[i] ?? a + 0.2]);
}
// 太长的一句（没有逗号可断）从靠中间的顿号处折成两行
export const show = c => {
  let s = c.replace(/[，。；]$/, '').replace(/[，。]([”’])$/, '$1');
  if (s.length > MAXLEN) {
    const cuts = [...s.matchAll(/、/g)].map(m => m.index + 1), mid = s.length / 2;
    const k = cuts.length ? cuts.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a)) : Math.ceil(mid);
    s = s.slice(0, k) + '\\N' + s.slice(k);
  }
  return s;
};
export const ts = s => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = (s % 60).toFixed(2).padStart(5, '0'); return `${h}:${String(m).padStart(2, '0')}:${x}`; };
// introId 那一段的字幕用白字、放在下方（盖在游戏图片上）；其余在上方
export function writeSubs({ marks, shot, vo, voiceDir, total, outDir, introId }) {
  const ass = [`[Script Info]`, `ScriptType: v4.00+`, `PlayResX: 1080`, `PlayResY: 1920`, `WrapStyle: 2`, ``, `[V4+ Styles]`,
    `Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding`,
    `Style: Sub,Microsoft YaHei,54,&H00312A1B,&H00312A1B,&H00DCE9EF,&H00DCE9EF,1,0,0,0,100,100,1,0,1,0,0,5,30,30,0,134`,
    `Style: Intro,Microsoft YaHei,56,&H00FFFFFF,&H00FFFFFF,&H00160F0A,&H00160F0A,1,0,0,0,100,100,1,0,1,3,0,5,30,30,0,134`,
    ``, `[Events]`, `Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`];
  const subLog = [];
  marks.forEach((m, i) => {
    const cs = chunksOf(shot[m.id].say), dur = vo[m.id].dur, sil = silences(path.join(voiceDir, vo[m.id].file));
    const s0 = sil.length && sil[0][0] < 0.05 ? sil[0][1] : 0, s1 = sil.length && sil[sil.length - 1][1] > dur - 0.08 ? sil[sil.length - 1][0] : dur;
    const ws = cs.map(weight), sum = ws.reduce((a, b) => a + b, 0);
    const inner = sil.filter(([a, b]) => a > s0 + 0.05 && b < s1 - 0.05).map(([a, b]) => ({ x: (a + b) / 2, d: b - a }));
    let acc = 0, prev = 0;
    const bounds = cs.slice(0, -1).map((_, j) => {
      acc += ws[j];
      let t = s0 + (s1 - s0) * acc / sum;
      // 附近有停顿就对齐到停顿上；停得久的（句号）优先
      const near = inner.filter(q => q.x > prev + 0.3 && Math.abs(q.x - t) < 0.7).sort((a, b) => (Math.abs(a.x - t) - 1.5 * a.d) - (Math.abs(b.x - t) - 1.5 * b.d))[0];
      if (near) t = near.x;
      t = Math.max(t, prev + 0.3); prev = t; return t;
    });
    const starts = [0, ...bounds], next = i + 1 < marks.length ? marks[i + 1].at : total;
    cs.forEach((c, j) => {
      const a = m.at + (j ? VOLEAD + starts[j] : 0), b = j + 1 < cs.length ? m.at + VOLEAD + starts[j + 1] : Math.min(next, m.at + VOLEAD + dur + 0.6);
      const intro = m.id === introId;
      ass.push(`Dialogue: 0,${ts(a)},${ts(b)},${intro ? 'Intro' : 'Sub'},,0,0,0,,{\\pos(540,${intro ? 1760 : 212})\\fad(120,80)}${show(c)}`);
      subLog.push(`${ts(a)} → ${ts(b)}  ${show(c)}`);
    });
  });
  fs.writeFileSync(path.join(outDir, 'subs.ass'), ass.join('\n'));
  fs.writeFileSync(path.join(outDir, 'subs.txt'), subLog.join('\n'));
}

/* ---------- 片头封面：第一帧就是封面（不从黑屏淡入），停 cover 秒后淡入正片；声音整体往后挪 ---------- */
export function prependCover({ outDir, coverPng, body, out, total, cover = 1.0, xf = 0.4 }) {
  const off = cover - xf, full = (total + off).toFixed(3);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', cover.toFixed(3), '-i', coverPng, '-i', body, '-filter_complex',
    `[0:v]fps=30,format=yuv420p,setsar=1,settb=AVTB[cv];[1:v]fps=30,setsar=1,settb=AVTB[bd];[cv][bd]xfade=transition=fade:duration=${xf}:offset=${off.toFixed(3)},format=yuv420p[v];`
    + `[1:a]adelay=${Math.round(off * 1000)}:all=1[au]`,
    '-map', '[v]', '-map', '[au]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-t', full, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', out], { cwd: outDir });
  return full;
}
