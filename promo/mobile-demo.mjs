// 手机版改进演示短片（竖屏 1080×1920，1 分钟以内，无旁白，字幕 + 背景音乐）。
// 用法：node promo/mobile-demo.mjs [--still] [--music <音乐文件>]
//   先在仓库根目录 npm run build 生成 dist/。
//   --still：不录像，每段结束截一张图到 out/mdemo/，用来检查位置。
// 画面：本机 Chrome 以 390×844 的手机画幅打开 dist/，用真实的触摸事件（CDP）拖动、两指缩放、点按；
//       一镜到底录下来，再放进竖屏画面，上方是标题和字幕。
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(ROOT, '../dist');
const OUT = path.join(ROOT, 'out', 'mdemo');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2), STILL = argv.includes('--still');
const MUSIC = argv.includes('--music') ? argv[argv.indexOf('--music') + 1] : null;
const VW = 390, VH = 844, DSF = 2;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

/* ---------- 本地静态服务器 ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webp': 'image/webp' };
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
const BASE = `http://127.0.0.1:${server.address().port}`;

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
    // 网页拖动时会重画，手指按下的那个元素可能已被移出页面，之后的事件就传不到 window；在它身上也听一份
    addEventListener('touchstart', e => ['touchmove', 'touchend', 'touchcancel'].forEach(n => e.target.addEventListener(n, upd, { passive: true })), { capture: true, passive: true });
    // 点按用鼠标事件发（避免触摸的就近吸附点偏），画成一个手指按下的圈
    addEventListener('mousedown', e => {
      const r = document.createElement('div'); r.className = '__tap'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      const d = dots[0]; d.style.left = r.style.left; d.style.top = r.style.top; d.style.opacity = 1;
      document.documentElement.append(r); setTimeout(() => r.remove(), 600);
    }, true);
    addEventListener('mouseup', () => setTimeout(() => { dots[0].style.opacity = 0; }, 120), true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot); else boot();
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'] });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DSF, isMobile: true, hasTouch: true, locale: 'zh-CN' });
await ctx.addInitScript(() => { try { localStorage.setItem('fz', '1'); } catch (_) {} });
await ctx.addInitScript(FINGERS);
await ctx.route(/googletagmanager|google-analytics/, r => r.abort());
const page = await ctx.newPage();
page.on('pageerror', e => console.log('页面错误：', e.message));
const cdp = await ctx.newCDPSession(page);
await page.goto(BASE + '/zh/', { waitUntil: 'networkidle' });
await page.waitForSelector('#mpeople', { timeout: 15000 });
await sleep(1500);

/* ---------- 手势：真实触摸事件 ---------- */
const ease = u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
// 结束时要带上抬起的那几根手指（空列表 Chrome 不发 touchend）
let lastPts = [];
const touch = (type, pts) => { if (type === 'touchEnd') pts = lastPts; else lastPts = pts;
  return cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id, radiusX: 1, radiusY: 1 })) }); };
async function steps(ms, fn, curve = ease) {
  const n = Math.max(2, Math.round(ms / 16)), t0 = Date.now();
  for (let i = 1; i <= n; i++) { await fn(curve(i / n)); const due = t0 + (ms * i) / n - Date.now(); if (due > 0) await sleep(due); }
}
// 一根手指从 a 拖到 b；fling=true 时最后一段快速甩出（触发惯性滑动）
async function drag([x0, y0], [x1, y1], ms, fling = false) {
  await touch('touchStart', [[x0, y0]]); await sleep(60);
  await steps(ms, async u => touch('touchMove', [[x0 + (x1 - x0) * u, y0 + (y1 - y0) * u]]), fling ? u => u * u : ease);
  if (!fling) await sleep(120);
  await touch('touchEnd', []);
}
// 两指缩放：以 (cx, cy) 为中点，两指竖着排开，间距从 d0 变到 d1
async function pinch(cx, cy, d0, d1, ms) {
  const at = d => [[cx - d * .25, cy - d / 2], [cx + d * .25, cy + d / 2]];
  await touch('touchStart', at(d0)); await sleep(80);
  await steps(ms, async u => touch('touchMove', at(d0 + (d1 - d0) * u)));
  await sleep(150); await touch('touchEnd', []);
}
async function tap(x, y) { await page.mouse.move(x, y); await page.mouse.down(); await sleep(90); await page.mouse.up(); }
async function center(sel) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error('找不到 ' + sel);
  return [b.x + b.width / 2, b.y + b.height / 2];
}
async function tapSel(sel) { const [x, y] = await center(sel); await tap(x, y); }
// 屏幕上某段朝代色块的中心（按色块上的字找）
// 返回 [点按用的 x, y, 色块左边缘 x]
const bandPt = name => page.evaluate(n => {
  const t = [...document.querySelectorAll('#mpeople text.bn')].find(t => t.textContent === n);
  const r = t.getBoundingClientRect(), x = r.x + r.width / 2 + 14, y = r.y + r.height / 2 + 10;
  const bd = document.elementsFromPoint(x, y).find(e => e.matches('[data-b]'));
  return [x, y, bd ? bd.getBoundingClientRect().x : r.x - 20];
}, name);
// 屏幕中间、数字最大的事件圆点
const bestCluster = () => page.evaluate(([w, h]) => {
  const c = [...document.querySelectorAll('#mpeople [data-c]')].map(e => { const r = e.querySelector('circle').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, n: +(e.textContent.replace('+', '') || 0) }; })
    .filter(c => c.x > 20 && c.x < w - 20 && c.y > 280 && c.y < h - 260);
  c.sort((a, b) => b.n - a.n || Math.abs(a.y - h / 2) - Math.abs(b.y - h / 2));
  return c[0] || null;
}, [VW, VH]);

/* ---------- 分段：每段的字幕和动作 ---------- */
// at：这一段字幕出现的时刻（录制时记下），lines：字幕
const marks = [];
let t0 = 0;
const mark = lines => marks.push({ at: (Date.now() - t0) / 1000, lines });
const snap = async name => { if (STILL) await page.screenshot({ path: path.join(OUT, name + '.png') }); };

async function act() {
  // 1. 一打开就是全貌
  mark(['一打开就是全貌', '几千年、十几个文明，一屏看完']);
  await sleep(3200);
  mark(['窄的文明也写出两个字', '欧洲、朝鲜、草原……竖着写，不缩小']);
  await drag([330, 560], [130, 560], 1100); await sleep(900);
  await drag([130, 560], [380, 560], 1000); await sleep(300);
  await drag([120, 560], [380, 560], 500); await sleep(800);
  await snap('1-whole');

  // 2. 两指缩放跟手
  mark(['两指缩放，跟着手指走', '稍一放大，就有朝代名和重要人物']);
  const [, yTang, xChina] = await bandPt('唐');
  for (let i = 0; i < 6; i++) { await pinch(xChina + 25, yTang, 100, 175, 750); await sleep(i === 5 ? 400 : 800); }
  await sleep(700);
  await snap('2-pinch');

  // 3. 拖动、惯性
  mark(['拖动、甩一下，顺滑地滑过去', '连着划也不卡']);
  await drag([250, 700], [250, 380], 260, true); await sleep(1300);
  await drag([250, 420], [250, 720], 260, true); await sleep(1300);
  await drag([110, 600], [350, 600], 900); await sleep(900);
  await snap('3-glide');

  // 4. 事件圆点 → 清单 → 某一件 → 返回清单
  mark(['大事挤在一起时', '合成带数字的圆点']);
  let c = await bestCluster();
  if (!c) throw new Error('屏幕上没有事件圆点');
  await sleep(1800);
  await tap(c.x, c.y); await sleep(2300);
  mark(['点开是清单', '点进一件，“返回”回到清单']);
  await snap('4a-list');
  await tapSel('#msheet [data-goe]'); await sleep(2400);
  await snap('4b-event');
  await tapSel('#msheet .d-back'); await sleep(1600);
  await tapSel('#msheet .close'); await sleep(900);

  // 5. 回到全貌，点色块直接放大到那个朝代
  mark(['点“全貌”飞回全图', '点朝代色块，直接放大到那一段']);
  await tapSel('#mseg [data-whole]'); await sleep(2000);
  const [xm, ym] = await bandPt('明');
  await tap(xm, ym); await sleep(2600);
  await snap('5-band');

  // 6. 结尾
  mark(['历史长河 · 手机版', '打开手机就能逛']);
  await sleep(3200);
}

/* ---------- 录像（CDP screencast，按时间戳补成 30fps） ---------- */
const frames = [];
if (!STILL) {
  cdp.on('Page.screencastFrame', f => {
    frames.push({ t: f.metadata.timestamp, b: f.data });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: VW * DSF, maxHeight: VH * DSF, everyNthFrame: 1 });
  for (let i = 0; i < 100 && !frames.length; i++) await sleep(20);
}
t0 = Date.now();
await act();
const TOTAL = (Date.now() - t0) / 1000;
if (STILL) { console.log('截图在', OUT, '时长约', TOTAL.toFixed(1) + 's'); await browser.close(); server.close(); process.exit(0); }
await cdp.send('Page.stopScreencast');
await browser.close(); server.close();
console.log(`录制 ${TOTAL.toFixed(1)}s，${frames.length} 帧`);

const fdir = path.join(OUT, 'frames');
fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
const end = frames[0].t + TOTAL, list = [];
frames.forEach((f, i) => {
  const file = `${String(i).padStart(5, '0')}.jpg`;
  fs.writeFileSync(path.join(fdir, file), Buffer.from(f.b, 'base64'));
  const next = i + 1 < frames.length ? frames[i + 1].t : end;
  list.push(`file '${file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
});
list.push(`file '${String(frames.length - 1).padStart(5, '0')}.jpg'`);
fs.writeFileSync(path.join(fdir, 'list.txt'), list.join('\n'));
const raw = path.join(OUT, 'phone.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(fdir, 'list.txt'),
  '-t', TOTAL.toFixed(3), '-vf', `fps=30,scale=${VW * DSF}:${VH * DSF}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', raw]);

/* ---------- 竖屏底板：标题 + 手机外框（中间挖空放录屏），用浏览器画 ---------- */
// 录屏放在 (PX, PY)，大小 PW×PH
const PW = 700, PH = Math.round(PW * VH / VW), PX = (1080 - PW) / 2, PY = 1920 - PH - 50;
const b2 = await chromium.launch({ executablePath: CHROME, headless: true });
const p2 = await b2.newPage({ viewport: { width: 1080, height: 1920 } });
await p2.setContent(`<html><body style="margin:0;width:1080px;height:1920px;overflow:hidden;background:transparent">
  <div style="position:absolute;left:${PX - 16}px;top:${PY - 16}px;width:${PW + 32}px;height:${PH + 32}px;border-radius:64px;
    box-shadow:0 0 0 2000px #efe9dc, 0 0 0 2010px #efe9dc;border:16px solid #1b2a31;box-sizing:border-box"></div>
  <div style="position:absolute;left:0;right:0;top:64px;text-align:center;font:700 40px 'Microsoft YaHei';letter-spacing:6px;color:#8a5a2b">历史长河 · 手机版新改进</div>
  </body></html>`);
await p2.screenshot({ path: path.join(OUT, 'frame.png'), omitBackground: true });
await b2.close();

/* ---------- 字幕 ---------- */
const ts = s => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = (s % 60).toFixed(2).padStart(5, '0'); return `${h}:${String(m).padStart(2, '0')}:${x}`; };
const ass = [`[Script Info]`, `ScriptType: v4.00+`, `PlayResX: 1080`, `PlayResY: 1920`, `WrapStyle: 2`, ``, `[V4+ Styles]`,
  `Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding`,
  `Style: Big,Microsoft YaHei,62,&H00312A1B,&H00312A1B,&H00DCE9EF,&H00DCE9EF,1,0,0,0,100,100,2,0,1,0,0,8,40,40,140,134`,
  `Style: Small,Microsoft YaHei,40,&H00505A60,&H00505A60,&H00DCE9EF,&H00DCE9EF,0,0,0,0,100,100,1,0,1,0,0,8,40,40,226,134`,
  ``, `[Events]`, `Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`];
marks.forEach((m, i) => {
  const a = m.at, b = i + 1 < marks.length ? marks[i + 1].at : TOTAL;
  ass.push(`Dialogue: 0,${ts(a)},${ts(b)},Big,,0,0,0,,{\\fad(250,200)}${m.lines[0]}`);
  if (m.lines[1]) ass.push(`Dialogue: 0,${ts(a)},${ts(b)},Small,,0,0,0,,{\\fad(250,200)}${m.lines[1]}`);
});
fs.writeFileSync(path.join(OUT, 'subs.ass'), ass.join('\n'));

/* ---------- 合成 ---------- */
const final = path.join(OUT, 'mobile-demo.mp4');
const args = ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0xefe9dc:s=1080x1920:r=30:d=${TOTAL.toFixed(3)}`, '-i', 'phone.mp4', '-i', 'frame.png'];
if (MUSIC) args.push('-i', path.resolve(MUSIC));
const vf = `[1:v]scale=${PW}:${PH}:flags=lanczos[ph];[0:v][ph]overlay=${PX}:${PY}[a];[a][2:v]overlay=0:0,subtitles=subs.ass,`
  + `fade=in:st=0:d=0.4,fade=out:st=${(TOTAL - 0.8).toFixed(3)}:d=0.8,format=yuv420p[v]`;
const af = MUSIC ? `;[3:a]atrim=0:${TOTAL.toFixed(3)},afade=in:st=0:d=1,afade=out:st=${(TOTAL - 2.5).toFixed(3)}:d=2.5,loudnorm=I=-16:TP=-1.5[au]` : '';
args.push('-filter_complex', vf + af, '-map', '[v]');
if (MUSIC) args.push('-map', '[au]', '-c:a', 'aac', '-b:a', '192k');
args.push('-t', TOTAL.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', 'mobile-demo.mp4');
execFileSync('ffmpeg', args, { cwd: OUT });
console.log('成片：', final, TOTAL.toFixed(1) + 's');
