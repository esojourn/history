// 《峡谷之外》兰陵王一集（竖屏 1080×1920）：开头游戏图片 → 网站手机画幅录屏 → 一处局部地图 → 结尾卡。
// 用法：node promo/heroes/lanling.mjs [--still] [--music <音乐文件>]
//   先做三件事：仓库根目录 npm run build；按 lanling.yaml 开头的命令配音；node promo/heroes/map.mjs lanling-luoyang 画地图。
//   --still：不录像，每段结束截一张图到 promo/out/heroes/002-lanling/stills/，用来检查位置。
// 成片：promo/out/heroes/002-lanling/lanling.mp4（不进仓库）。第一帧就是封面（官方游戏图片 + 片名），封面图另存为 cover.png，可在平台上传封面时用。
// 做法沿用 promo/mobile-demo.mjs：本机 Chrome 以 390×844 的手机画幅打开 dist/，一镜到底录下来，每段的长短跟着旁白走；
// 游戏图片、地图、结尾卡是合成时盖在录屏上面的。旁白文字是定稿，这里只对照检查，不改。
import { chromium } from 'playwright-core';
import QRCode from 'qrcode';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROMO = path.resolve(HERE, '..');
const DIST = path.resolve(PROMO, '../dist');
const OUT = path.join(PROMO, 'out', 'heroes', '002-lanling');
const VOICE = path.join(OUT, 'voice');
const IMG = path.join(PROMO, 'out', 'heroes', 'img', '153-bigskin-1.jpg');       // 官方图片（默认造型，横版），不进仓库
const IMG_V = path.join(PROMO, 'out', 'heroes', 'img', '153-mobileskin-1.jpg');   // 官方图片（默认造型，竖版），封面用
const COVER = 1.0, XF = 0.4;   // 片头封面停留的秒数、封面淡入正片的秒数
const MAP = path.join(PROMO, 'out', 'heroes', 'maps', 'lanling-luoyang.png');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2), STILL = argv.includes('--still');
const MUSIC = argv.includes('--music') ? argv[argv.indexOf('--music') + 1] : null;
const VW = 390, VH = 844, DSF = 2;
const PAPER = '#efe9dc';
// 结尾卡的二维码直接打开兰陵王的关系图；卡上显示的网址仍是首页
const URL_QR = 'https://lishi.alz-ai.cn/zh/#person/gao-changgong', URL_SHOW = 'lishi.alz-ai.cn';
const CREDIT = '图片来自《王者荣耀》官方';
const SOURCES = '史实核对自：《北齐书》兰陵武王长恭传、武成纪、后主纪，《教坊记》（维基文库电子版）。';
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
for (const f of [IMG, IMG_V, MAP, path.join(VOICE, 'timing.json'), path.join(DIST, 'zh', 'index.html')])
  if (!fs.existsSync(f)) { console.error('缺少文件：' + f + '（见本文件开头的用法）'); process.exit(1); }

/* ---------- 旁白：对照定稿，逐字一致才往下做 ---------- */
const SHOTS = YAML.parse(fs.readFileSync(path.join(HERE, 'lanling.yaml'), 'utf8')).shots;
{
  const md = fs.readFileSync(path.join(HERE, 'scripts.md'), 'utf8');
  const sec = md.slice(md.indexOf('## 二、'), md.indexOf('配地图：'));
  const rows = sec.split('\n').filter(l => l.startsWith('|')).map(l => l.split('|').map(c => c.trim()))
    .filter(c => c[1] !== '画面' && !/^-+$/.test(c[1]) && !c[1].includes('不念'));
  const want = rows.map(c => c[2]).join(''), got = SHOTS.map(s => s.say).join('');
  if (rows.length !== 15 || want !== got) { console.error('lanling.yaml 的旁白和 scripts.md 的定稿对不上，先改一致再录'); process.exit(1); }
  console.log(`旁白与定稿逐字一致（${got.replace(/\s/g, '').length} 字）`);
}
const SHOT = Object.fromEntries(SHOTS.map(s => [s.id, s]));
const VO = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(VOICE, 'timing.json'), 'utf8')).shots.map(s => [s.id, s]));

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

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'] });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DSF, isMobile: true, hasTouch: true, locale: 'zh-CN' });
await ctx.addInitScript(() => { try { localStorage.setItem('fz', '1'); } catch (_) {} });
await ctx.addInitScript(FINGERS);
await ctx.route(/googletagmanager|google-analytics/, r => r.abort());
const page = await ctx.newPage();
page.on('pageerror', e => console.log('页面错误：', e.message));
const cdp = await ctx.newCDPSession(page);

// 结尾卡里的手机画面：兰陵王的关系图（先截下来，再回到首页开始录）
await page.goto(BASE + '/zh/#person/gao-changgong', { waitUntil: 'networkidle' });
await page.waitForSelector('#mseg [data-map]', { timeout: 15000 });
await sleep(1200);
await page.screenshot({ path: path.join(OUT, 'focus.png') });
await page.goto('about:blank');
await page.goto(BASE + '/zh/', { waitUntil: 'networkidle' });
await page.waitForSelector('#mpeople', { timeout: 15000 });
await sleep(1500);

/* ---------- 手势与动作 ---------- */
const ease = u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
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
// 关系图上某个标注（如“赐毒酒”）在屏幕上的位置
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

/* ---------- 分段 ---------- */
// mark(id)：先等上一段的旁白念完（加 pad），再开始这一段；mark(null) 等最后一段念完
const VOLEAD = 0.15;   // 字幕先出来一点，旁白跟上
const marks = [];
let t0 = 0;
async function mark(id) {
  const last = marks[marks.length - 1];
  if (last && !STILL) { const due = t0 + (last.at + VOLEAD + VO[last.id].dur + SHOT[last.id].pad) * 1000 - Date.now(); if (due > 0) await sleep(due); }
  if (id) marks.push({ id, at: (Date.now() - t0) / 1000 });
}
const snap = async name => { if (STILL) { await sleep(500); await page.screenshot({ path: path.join(OUT, 'stills', name + '.png') }); } };

async function act() {
  // 1. 游戏图片（合成时盖在上面），网站停在全貌
  await mark('n01');

  // 2. 点开兰陵王：搜索“兰陵王”，点第一条，进入他的关系图
  await mark('n02');
  await sleep(700);
  await tapSel('#mfind'); await sleep(600);
  for (const ch of '兰陵王') { await page.keyboard.insertText(ch); await sleep(230); }
  await sleep(600); await snap('02a-search');
  await tapSel('.s-row[data-id="gao-changgong"]'); await sleep(1200);
  await expectFocus('兰陵王');
  await snap('02-focus');

  // 3. 人物卡：展开，先是简介和“相貌柔美而性情勇猛”，再滚到《教坊记》那一句
  await mark('n03');
  await sleep(300); await openCard(); await snap('03a-card');
  await sleep(2400); await scrollCard('河清三年', 1400); await snap('03-jiaofang');

  // 4a. “围困洛阳”：地图盖在上面；趁这时在卡片里点“邙山之战”，展开事件卡
  await mark('n04a');
  await sleep(600);
  await scrollCard('sel:[data-goe="mangshan-zhizhan"]', 500, 200); await sleep(150);
  await tapSel('#msheet [data-goe="mangshan-zhizhan"]'); await sleep(1000);
  await expectFocus('邙山之战');
  await openCard();
  // 4b. 事件“邙山之战”：标题、简介，再滚到五百骑兵那一段
  await mark('n04b');
  await snap('04a-event');
  await sleep(1300); await scrollCard('北齐武成帝派兰陵王', 1300); await snap('04-wubai');
  // 5. 摘下头盔、派弩手下城：就在这一段里，画面不动，让人看清
  await mark('n05');
  await snap('05-toukui');
  // 6. 《兰陵王入阵曲》
  await mark('n06');
  await sleep(300); await scrollCard('齐军将士为兰陵王作歌', 1200); await snap('06-ruzhenqu');

  // 7. 聚焦后主高纬：从事件返回兰陵王，在关系图上点“北齐后主”
  await mark('n07');
  await scrollCard(null, 400); await sleep(150);
  await tapSel('#msheet .d-back'); await sleep(1100);
  await expectFocus('兰陵王');
  await tapPerson('gao-wei'); await sleep(1200);
  await expectFocus('北齐后主');
  await snap('07-gaowei');
  // 8. 展开后主的卡片
  await mark('n08');
  await sleep(500); await openCard(); await snap('08-card');
  // 9. 滚到“先后杀害斛律光、兰陵王高长恭等名将”
  await mark('n09');
  await sleep(600); await scrollCard('他在位期间', 1400); await snap('09-shahai');
  // 10. 收起卡片，在关系图上放大到“赐毒酒”那条线
  await mark('n10');
  await sleep(500); await closeCard(); await sleep(500);
  { const p = await labelPt('赐毒酒'); if (!p) throw new Error('后主的关系图上没有“赐毒酒”'); await pinch(p[0] - 30, p[1] - 20, 70, 126, 1100); }
  await snap('10-zoom');

  // 11. 回到兰陵王的人物卡：收财物自污
  await mark('n11');
  await sleep(400); await tapPerson('gao-changgong'); await sleep(1200);
  await expectFocus('兰陵王');
  await sleep(1100); await openCard(); await sleep(300);
  await scrollCard('后主曾对他说', 1400); await snap('11-ziwu');
  // 12. 部下劝他称病，没能退成：还是这一段，画面不动
  await mark('n12');
  await snap('12-weituicheng');

  // 13. 时间轴到 573 年：收起卡片，在他的关系图上放大到 573 年“赐毒酒”那条线
  await mark('n13');
  await sleep(300); await closeCard(); await sleep(500);
  { const p = await labelPt('赐毒酒'); if (!p) throw new Error('兰陵王的关系图上没有“赐毒酒”'); await pinch(p[0] - 40, p[1] - 30, 70, 140, 1200); }
  await snap('13-573');

  // 14. 事件“北周灭北齐”
  await mark('n14');
  await page.evaluate(() => { location.hash = 'event/beizhou-mie-beiqi'; }); await sleep(1000);
  await expectFocus('北周灭北齐');
  await openCard();
  await snap('14-mieqi');

  // 15. 结尾卡（合成时盖在上面）
  await mark('n15');
  await mark(null);
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
if (STILL) { console.log('截图在', path.join(OUT, 'stills')); await browser.close(); server.close(); process.exit(0); }
await cdp.send('Page.stopScreencast');
await browser.close(); server.close();
console.log(`录制 ${TOTAL.toFixed(1)}s，${frames.length} 帧`);
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ total: TOTAL, marks }, null, 1));

const fdir = path.join(OUT, 'frames');
fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
const endT = frames[0].t + TOTAL, list = [];
frames.forEach((f, i) => {
  const file = `${String(i).padStart(5, '0')}.jpg`;
  fs.writeFileSync(path.join(fdir, file), Buffer.from(f.b, 'base64'));
  const next = i + 1 < frames.length ? frames[i + 1].t : endT;
  list.push(`file '${file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
});
list.push(`file '${String(frames.length - 1).padStart(5, '0')}.jpg'`);
fs.writeFileSync(path.join(fdir, 'list.txt'), list.join('\n'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(fdir, 'list.txt'),
  '-t', TOTAL.toFixed(3), '-vf', `fps=30,scale=${VW * DSF}:${VH * DSF}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', path.join(OUT, 'phone.mp4')]);
fs.rmSync(fdir, { recursive: true, force: true });

/* ---------- 各张底图：用浏览器画（1080×1920） ---------- */
const at = id => marks.find(m => m.id === id).at;
// 录屏放在 (PX, PY)，大小 PW×PH；上方是标题和字幕
const PW = 700, PH = Math.round(PW * VH / VW), PX = (1080 - PW) / 2, PY = 1920 - PH - 50;
const TITLE = `<div style="position:absolute;left:0;right:0;top:52px;text-align:center;font:700 38px 'Microsoft YaHei';letter-spacing:6px;color:#8a5a2b">峡谷之外 · 兰陵王</div>`;
const data = f => `data:image/${f.endsWith('.jpg') ? 'jpeg' : 'png'};base64,${fs.readFileSync(f).toString('base64')}`;
const qr = await QRCode.toDataURL(URL_QR, { errorCorrectionLevel: 'Q', margin: 2, width: 720, color: { dark: '#1B2A31', light: '#FFFFFF' } });
const PAGES = {
  // 封面：成片第一帧（社交平台上显示的就是它）。竖版官方图片居中，同一张横版图模糊垫底，下方大字片名
  cover: `<body style="background:#0d1216;color:#fff;font-family:'Microsoft YaHei'">
    <img src="${data(IMG)}" style="position:absolute;left:-1000px;top:0;height:1920px;filter:blur(30px) brightness(.55) saturate(.8)">
    <img src="${data(IMG_V)}" style="position:absolute;left:0;top:170px;width:1080px">
    <div style="position:absolute;left:0;right:0;top:0;height:330px;background:linear-gradient(#0d1216 45%,transparent)"></div>
    <div style="position:absolute;left:0;right:0;top:1180px;bottom:0;background:linear-gradient(transparent,#0d1216 42%)"></div>
    <div style="position:absolute;left:0;right:0;top:70px;text-align:center;font:400 96px 'STKaiti','KaiTi',serif;letter-spacing:16px;text-indent:16px">峡谷之外</div>
    <div style="position:absolute;left:0;right:0;top:200px;text-align:center;font-size:34px;letter-spacing:8px;color:#d8c9a8">王者荣耀人物的真实历史</div>
    <div style="position:absolute;left:0;right:0;top:1420px;text-align:center;font:700 200px 'STKaiti','KaiTi',serif;letter-spacing:30px;text-indent:30px;color:#fff;text-shadow:0 6px 30px rgba(0,0,0,.6)">兰陵王</div>
    <div style="position:absolute;left:0;right:0;top:1680px;text-align:center;font:700 64px 'Microsoft YaHei';letter-spacing:4px;color:#e8c27a">一句“家事”，一杯毒酒</div>
    <div style="position:absolute;right:30px;top:1850px;font-size:26px;letter-spacing:1px;color:rgba(241,236,224,.8)">${CREDIT}</div>
  </body>`,
  // 手机外框（中间挖空放录屏）
  frame: `<body style="background:transparent">
    <div style="position:absolute;left:${PX - 16}px;top:${PY - 16}px;width:${PW + 32}px;height:${PH + 32}px;border-radius:64px;
      box-shadow:0 0 0 2000px ${PAPER};border:16px solid #1b2a31;box-sizing:border-box"></div>${TITLE}</body>`,
  // 开头：盖在游戏图片上的字（系列名、这一集的标题、图片出处）；图片本身在合成时放到 y=330–1530
  intro: `<body style="background:transparent;color:#fff;font-family:'Microsoft YaHei'">
    <div style="position:absolute;left:0;right:0;top:330px;height:90px;background:linear-gradient(#0d1216,transparent)"></div>
    <div style="position:absolute;left:0;right:0;top:1370px;height:160px;background:linear-gradient(transparent,#0d1216)"></div>
    <div style="position:absolute;left:0;right:0;top:92px;text-align:center;font:400 104px 'STKaiti','KaiTi',serif;letter-spacing:16px;text-indent:16px">峡谷之外</div>
    <div style="position:absolute;left:0;right:0;top:232px;text-align:center;font-size:34px;letter-spacing:8px;color:#d8c9a8">王者荣耀人物的真实历史</div>
    <div style="position:absolute;left:36px;top:1466px;padding:8px 18px;border-radius:8px;background:rgba(0,0,0,.55);font-size:28px;letter-spacing:1px;color:#f1ece0">${CREDIT}</div>
    <div style="position:absolute;left:0;right:0;top:1578px;text-align:center;font:700 52px 'Microsoft YaHei';letter-spacing:4px;color:#e8c27a">兰陵王：一句“家事”，一杯毒酒</div>
  </body>`,
  // 地图：盖住手机，上方的标题和字幕照常
  mapcard: `<body style="background:transparent">
    <div style="position:absolute;left:0;right:0;top:${PY - 17}px;bottom:0;background:${PAPER}"></div>
    <img src="${data(MAP)}" style="position:absolute;left:40px;top:${PY + 190}px;width:1000px;border-radius:26px;box-shadow:0 14px 40px rgba(27,42,49,.22);border:2px solid #d9cdb4">
  </body>`,
  // 结尾卡：二维码、网址；最下面小字是核实过的史料（只显示、不念）
  end: `<body style="background:${PAPER};font-family:'Microsoft YaHei';color:#1B2A31">${TITLE}
    <div style="position:absolute;left:0;right:0;top:${PY - 10}px;display:flex;flex-direction:column;align-items:center">
      <div style="width:340px;height:690px;border-radius:48px;background:#1B2A31;padding:13px;box-sizing:border-box;box-shadow:0 26px 60px rgba(27,42,49,.3)">
        <img src="${data(path.join(OUT, 'focus.png'))}" style="width:100%;height:100%;object-fit:cover;object-position:top;border-radius:36px;display:block"></div>
      <div style="margin-top:36px;font:400 108px 'STKaiti','KaiTi',serif;letter-spacing:.14em;margin-right:-.14em;line-height:1.1">历史长河</div>
      <div style="margin-top:8px;font-size:36px;color:#55676C;letter-spacing:.1em">一张图，看懂各国历史</div>
      <div style="display:flex;align-items:center;gap:36px;margin-top:34px">
        <div style="width:250px;height:250px;padding:10px;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(27,42,49,.18);box-sizing:border-box"><img src="${qr}" style="width:100%;height:100%;display:block"></div>
        <div style="font-size:50px;font-weight:700">${URL_SHOW}<div style="margin-top:14px;font-size:30px;font-weight:400;color:#55676C;letter-spacing:.06em">扫码看兰陵王的关系图</div>
          <div style="display:inline-block;margin-top:20px;padding:8px 22px;border-radius:40px;background:#C4472D;color:#fff;font-size:26px;font-weight:400;letter-spacing:.08em">电脑手机都能看 · 免费开放</div></div>
      </div>
    </div>
    <div style="position:absolute;left:60px;right:60px;bottom:44px;text-align:center;font-size:28px;line-height:1.55;color:#5f6c6f">${SOURCES.replace('，《教坊记》', '，<br>《教坊记》')}</div>
  </body>`,
};
const b2 = await chromium.launch({ executablePath: CHROME, headless: true });
const p2 = await b2.newPage({ viewport: { width: 1080, height: 1920 } });
for (const [name, html] of Object.entries(PAGES)) {
  await p2.setContent(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:1080px;height:1920px;overflow:hidden}</style>${html}`);
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: path.join(OUT, name + '.png'), omitBackground: name !== 'end' && name !== 'cover' });
}
await b2.close();

/* ---------- 开头的游戏图片：模糊的同一张图垫底，中间是人物，缓慢推近 ---------- */
const introLen = at('n02') + 0.6, N = Math.round(introLen * 30);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', introLen.toFixed(3), '-i', IMG, '-i', path.join(OUT, 'intro.png'), '-filter_complex',
  `[0:v]split[a][b];[a]scale=-2:1920,crop=1080:1920,boxblur=26:4,eq=brightness=-0.3:saturation=0.75[bg];`
  + `[b]crop=794:882:520:0,scale=3176:3528:flags=lanczos,zoompan=z='1+0.1*on/${N}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1200:fps=30[fg];`
  + `[bg][fg]overlay=0:330[c];[c][1:v]overlay=0:0,format=yuv420p`,
  '-t', introLen.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', path.join(OUT, 'intro.mp4')]);

/* ---------- 字幕：按标点断成短句，一次显示一句；时间按字数分摊，再对齐到配音里的停顿 ---------- */
const MAXLEN = 18;
function chunksOf(say) {
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
const weight = s => [...s].reduce((w, ch) => w + (/\d/.test(ch) ? 1.6 : '，；：'.includes(ch) ? 1.3 : '。？！'.includes(ch) ? 2.2 : ch === '、' ? 0.5 : /[“”‘’《》\s]/.test(ch) ? 0 : 1), 0);
function silences(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-35dB:d=0.1', '-f', 'null', '-'], { encoding: 'utf8' });
  const s = [...r.stderr.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]), e = [...r.stderr.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
  return s.map((a, i) => [a, e[i] ?? a + 0.2]);
}
// 太长的一句（没有逗号可断）从靠中间的顿号处折成两行
const show = c => {
  let s = c.replace(/[，。；]$/, '').replace(/[，。]([”’])$/, '$1');
  if (s.length > MAXLEN) {
    const cuts = [...s.matchAll(/、/g)].map(m => m.index + 1), mid = s.length / 2;
    const k = cuts.length ? cuts.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a)) : Math.ceil(mid);
    s = s.slice(0, k) + '\\N' + s.slice(k);
  }
  return s;
};
const ts = s => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = (s % 60).toFixed(2).padStart(5, '0'); return `${h}:${String(m).padStart(2, '0')}:${x}`; };
const ass = [`[Script Info]`, `ScriptType: v4.00+`, `PlayResX: 1080`, `PlayResY: 1920`, `WrapStyle: 2`, ``, `[V4+ Styles]`,
  `Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding`,
  `Style: Sub,Microsoft YaHei,54,&H00312A1B,&H00312A1B,&H00DCE9EF,&H00DCE9EF,1,0,0,0,100,100,1,0,1,0,0,5,30,30,0,134`,
  `Style: Intro,Microsoft YaHei,56,&H00FFFFFF,&H00FFFFFF,&H00160F0A,&H00160F0A,1,0,0,0,100,100,1,0,1,3,0,5,30,30,0,134`,
  ``, `[Events]`, `Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`];
const subLog = [];
marks.forEach((m, i) => {
  const cs = chunksOf(SHOT[m.id].say), dur = VO[m.id].dur, sil = silences(path.join(VOICE, VO[m.id].file));
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
  const starts = [0, ...bounds], next = i + 1 < marks.length ? marks[i + 1].at : TOTAL;
  cs.forEach((c, j) => {
    const a = m.at + (j ? VOLEAD + starts[j] : 0), b = j + 1 < cs.length ? m.at + VOLEAD + starts[j + 1] : Math.min(next, m.at + VOLEAD + dur + 0.6);
    const intro = m.id === 'n01';
    ass.push(`Dialogue: 0,${ts(a)},${ts(b)},${intro ? 'Intro' : 'Sub'},,0,0,0,,{\\pos(540,${intro ? 1760 : 212})\\fad(120,80)}${show(c)}`);
    subLog.push(`${ts(a)} → ${ts(b)}  ${show(c)}`);
  });
});
fs.writeFileSync(path.join(OUT, 'subs.ass'), ass.join('\n'));
fs.writeFileSync(path.join(OUT, 'subs.txt'), subLog.join('\n'));

/* ---------- 合成 ---------- */
// 输入：0 底色，1 录屏，2 外框，3 开头，4 地图，5 结尾卡，6… 旁白，最后是音乐
const T = TOTAL.toFixed(3), tMap0 = at('n04a') - 0.1, tMap1 = at('n04b') - 0.25, tEnd = at('n15') - 0.1, tIntro = at('n02') - 0.15;
const args = ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0x${PAPER.slice(1)}:s=1080x1920:r=30:d=${T}`, '-i', 'phone.mp4', '-i', 'frame.png', '-i', 'intro.mp4',
  '-loop', '1', '-framerate', '30', '-t', T, '-i', 'mapcard.png', '-loop', '1', '-framerate', '30', '-t', T, '-i', 'end.png'];
marks.forEach(m => args.push('-i', path.join(VOICE, VO[m.id].file)));
if (MUSIC) args.push('-i', path.resolve(MUSIC));
const vf = `[1:v]scale=${PW}:${PH}:flags=lanczos[ph];[0:v][ph]overlay=${PX}:${PY}[a];[a][2:v]overlay=0:0[b];`
  + `[3:v]format=rgba,fade=out:st=${tIntro.toFixed(3)}:d=0.45:alpha=1[in];[b][in]overlay=0:0:eof_action=pass[c];`
  + `[4:v]format=rgba,fade=in:st=${tMap0.toFixed(3)}:d=0.35:alpha=1,fade=out:st=${tMap1.toFixed(3)}:d=0.35:alpha=1[mp];[c][mp]overlay=0:0[d];`
  + `[5:v]format=rgba,fade=in:st=${tEnd.toFixed(3)}:d=0.5:alpha=1[end];[d][end]overlay=0:0,subtitles=subs.ass,`
  + `fade=out:st=${(TOTAL - 0.8).toFixed(3)}:d=0.8,format=yuv420p[v]`;
// 旁白：每段在字幕出现后 VOLEAD 秒开始；音乐压低，有人声时再自动让一让（sidechain）
const vo = marks.map((m, i) => `[${6 + i}:a]aresample=48000,adelay=${Math.round((m.at + VOLEAD) * 1000)}:all=1[v${i}]`);
let af = `;${vo.join(';')};${marks.map((_, i) => `[v${i}]`).join('')}amix=inputs=${marks.length}:normalize=0,apad,atrim=0:${T},asplit=2[narr][key]`;
if (MUSIC) {
  const mi = 6 + marks.length;
  af += `;[${mi}:a]aresample=48000,atrim=0:${T},volume=0.26,afade=in:st=0:d=1,afade=out:st=${(TOTAL - 2.5).toFixed(3)}:d=2.5[mu]`
    + `;[mu][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]`
    + `;[narr][duck]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11[au]`;
} else af += `;[narr]loudnorm=I=-15:TP=-1.5:LRA=11[au]`;
args.push('-filter_complex', vf + af, '-map', '[v]', '-map', '[au]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-t', T, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', 'body.mp4');
execFileSync('ffmpeg', args, { cwd: OUT });

/* ---------- 片头封面：第一帧就是封面（不从黑屏淡入），停 COVER 秒后淡入正片；声音整体往后挪 ---------- */
const off = COVER - XF, FULL = (TOTAL + off).toFixed(3);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', COVER.toFixed(3), '-i', 'cover.png', '-i', 'body.mp4', '-filter_complex',
  `[0:v]fps=30,format=yuv420p,setsar=1,settb=AVTB[cv];[1:v]fps=30,setsar=1,settb=AVTB[bd];[cv][bd]xfade=transition=fade:duration=${XF}:offset=${off.toFixed(3)},format=yuv420p[v];`
  + `[1:a]adelay=${Math.round(off * 1000)}:all=1[au]`,
  '-map', '[v]', '-map', '[au]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-t', FULL, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', 'lanling.mp4'], { cwd: OUT });
fs.rmSync(path.join(OUT, 'body.mp4'));
console.log('成片：', path.join(OUT, 'lanling.mp4'), FULL + 's');
