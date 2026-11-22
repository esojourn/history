// 分镜录屏：用本机 Chrome 打开 dist/ 里的网站，按 narration.yaml 的镜头逐段操作并录下来。
// 用法：node promo/record.mjs [镜头 id 前缀…] [--still] [--portrait]
//   --portrait：竖屏版用的画幅（1200×1600，合成时缩到 1080×1440 放进 1080×1920 的竖屏画面），输出到 shots-v/、stills-v/
//   不带参数：录全部镜头；带 s3 之类：只录这几段；--still：不录像，只在关键处截图，用来调试位置。
// 输出：promo/out/shots/<id>.mp4（1920×1080，30fps），promo/out/stills/*.png
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(ROOT, '../dist');
const OUT = path.join(ROOT, 'out');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2), STILL = argv.includes('--still'), PORTRAIT = argv.includes('--portrait'), only = argv.filter(a => !a.startsWith('--'));
const W = PORTRAIT ? 1200 : 1920, HGT = PORTRAIT ? 1600 : 1080, FONT = 1.3;   // 视频里字要大一点：用网站自带的字号档 1.3
// 分镜里的坐标按 1920×1080 写，换画幅时按比例换算
const sx = v => (v * W) / 1920, sy = v => (v * HGT) / 1080;
const SHOTS_DIR = PORTRAIT ? 'shots-v' : 'shots', STILLS_DIR = PORTRAIT ? 'stills-v' : 'stills';
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(path.join(OUT, SHOTS_DIR), { recursive: true });
fs.mkdirSync(path.join(OUT, STILLS_DIR), { recursive: true });

/* ---------- 本地静态服务器：直接放 dist/ ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ---------- 录制页面里的假鼠标：箭头 + 点击波纹（只在录制时注入，不改网站） ---------- */
const CURSOR = () => {
  const boot = () => {
    if (document.getElementById('__cur')) return;
    const st = document.createElement('style');
    st.textContent = `#__cur{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transition:opacity .2s;will-change:transform}
      #__cur svg{width:30px;height:30px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
      .__rip{position:fixed;z-index:2147483646;pointer-events:none;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid #e8a33d;animation:__rip .55s ease-out forwards}
      @keyframes __rip{from{transform:scale(.4);opacity:1}to{transform:scale(3.2);opacity:0}}`;
    document.head.append(st);
    const c = document.createElement('div'); c.id = '__cur';
    c.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 2.5v17.2l4.6-4.3 3 6.9 3-1.3-3-6.8h6.3z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.documentElement.append(c);
    const pos = window.__pos || [W / 2, HGT / 2];
    c.style.transform = `translate(${pos[0] - 4}px,${pos[1] - 2}px)`;
    addEventListener('mousemove', e => { window.__pos = [e.clientX, e.clientY]; c.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 2}px)`; }, true);
    addEventListener('mousedown', e => { const r = document.createElement('div'); r.className = '__rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.documentElement.append(r); setTimeout(() => r.remove(), 700); }, true);
    window.__cur = v => { c.style.opacity = v ? 1 : 0; };
  };
  const W = 1920, HGT = 1080;
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot); else boot();
};

/* ---------- 浏览器与页面 ---------- */
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'] });

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: HGT }, deviceScaleFactor: 1, locale: 'zh-CN', ...opts });
  await ctx.addInitScript(z => { try { localStorage.setItem('fz', z); } catch (_) {} }, String(opts.isMobile ? 1 : FONT));
  if (!opts.isMobile) await ctx.addInitScript(CURSOR);
  await ctx.route(/googletagmanager|google-analytics/, r => r.abort());   // 本地录制不发访问统计
  const page = await ctx.newPage();
  page.mx = W / 2; page.my = HGT / 2;
  return page;
}
async function open(page, url, wait = 1500) {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForSelector('#river g, .m-list, main', { timeout: 15000 }).catch(() => {});
  await sleep(wait);
}

/* ---------- 动作：缓动移动鼠标、滚轮、点击 ---------- */
const ease = u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
async function glide(page, x, y, ms = 700) {
  const x0 = page.mx, y0 = page.my, n = Math.max(2, Math.round(ms / 16)), t0 = Date.now();
  for (let i = 1; i <= n; i++) {
    const e = ease(i / n);
    await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
    const due = t0 + (ms * i) / n - Date.now(); if (due > 0) await sleep(due);
  }
  page.mx = x; page.my = y;
}
async function jump(page, x, y) { await page.mouse.move(x, y); page.mx = x; page.my = y; }
async function click(page, x, y, ms = 650) { await glide(page, x, y, ms); await sleep(120); await page.mouse.down(); await sleep(70); await page.mouse.up(); }
// 滚轮缩放：total 为负是放大；分成小步，持续 ms 毫秒，先慢后快再慢
async function wheel(page, total, ms) {
  const n = Math.round(ms / 33), t0 = Date.now();
  let done = 0;
  for (let i = 1; i <= n; i++) {
    const want = total * ease(i / n), d = want - done; done = want;
    await page.mouse.wheel(0, d);
    const due = t0 + (ms * i) / n - Date.now(); if (due > 0) await sleep(due);
  }
}
async function box(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error('找不到 ' + sel);
  return b;
}
// 人物条：点在条上靠左一点（名字也在左边）
async function personPt(page, id) {
  const b = await box(page, `#river [data-p="${id}"]`);
  return [b.x + Math.min(b.width * 0.35, 60), b.y + b.height / 2];
}
// 鼠标悬停时顶上会显示当前年份，读出来，换算出“某年在屏幕上的 x”
async function yearAt(page, x, y) {
  await page.mouse.move(x, y); await sleep(80);
  const s = await page.evaluate(() => [...document.querySelectorAll('#river text.ct')].map(t => t.textContent).pop() || '');
  const m = s.match(/(前)?\s*(\d+)/);
  if (!m) throw new Error('读不出年份：' + s);
  return m[1] ? 1 - +m[2] : +m[2];
}
async function xOfYear(page, year, y) {
  const xa = sx(500), xb = sx(1700), ya = await yearAt(page, xa, y), yb = await yearAt(page, xb, y);
  return xa + ((year - ya) * (xb - xa)) / (yb - ya);
}
async function escape(page) { await page.keyboard.press('Escape'); await sleep(900); }

/* ---------- 录像：Chrome 逐帧截屏（CDP screencast），再按时间戳补成 30fps ---------- */
async function record(page, name, seconds, act) {
  if (STILL) { await act(); await page.screenshot({ path: path.join(OUT, STILLS_DIR, name + '-end.png') }); return; }
  const cdp = await page.context().newCDPSession(page), frames = [];
  cdp.on('Page.screencastFrame', f => {
    frames.push({ t: f.metadata.timestamp, b: f.data });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: HGT, everyNthFrame: 1 });
  // 等第一帧，作为时间零点
  for (let i = 0; i < 100 && !frames.length; i++) await sleep(20);
  const start = Date.now();
  await act();
  const left = seconds * 1000 - (Date.now() - start);
  if (left > 0) await sleep(left);
  else console.warn(`  ${name}：动作用时 ${((Date.now() - start) / 1000).toFixed(2)}s，超过目标 ${seconds.toFixed(2)}s`);
  await sleep(300);
  const end = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  const dir = path.join(OUT, PORTRAIT ? 'frames-v' : 'frames', name);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const t0 = frames[0].t, list = [];
  frames.forEach((f, i) => {
    const file = `${String(i).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(f.b, 'base64'));
    const next = i + 1 < frames.length ? frames[i + 1].t : end;
    list.push(`file '${file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  list.push(`file '${String(frames.length - 1).padStart(5, '0')}.jpg'`);
  fs.writeFileSync(path.join(dir, 'list.txt'), list.join('\n'));
  const out = path.join(OUT, SHOTS_DIR, name + '.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
    '-vf', `fps=30,scale=${W}:${HGT}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', out]);
  console.log(`  ${name}: ${frames.length} 帧，${(end - t0).toFixed(2)}s → ${path.relative(ROOT, out)}`);
}

/* ---------- 分镜 ---------- */
const timing = JSON.parse(fs.readFileSync(path.join(OUT, 'voice', 'timing.json'), 'utf8'));
const nar = (await import('yaml')).parse(fs.readFileSync(path.join(ROOT, 'narration.yaml'), 'utf8'));
const T = id => { const t = timing.shots.find(s => s.id === id), n = nar.shots.find(s => s.id === id); return t.dur + n.pad + 0.4; };   // 多录 0.4s 留给转场

const SHOTS = {
  // 读历史最头疼什么？朝代记不住，中外对不上。——各文明色带快速横扫，再拉到六千年全景（片名在合成时叠上）
  async 's1-hook'() {
    const page = await newPage();
    await open(page, '/zh/');
    await page.evaluate(() => window.__cur(false));
    // 先放大到“朝代”一层，停在上古
    await jump(page, sx(400), sy(600));
    await wheel(page, -1100, 300); await sleep(600);
    const sweep = async () => {
      for (let i = 0; i < 4; i++) {
        await jump(page, sx(1850), 40); await jump(page, sx(1850), sy(600));
        await page.mouse.down();
        for (let s = 1; s <= 24; s++) { await page.mouse.move(sx(1850) - (sx(1550) * s) / 24, sy(600)); await sleep(16); }
        await page.mouse.up(); await jump(page, sx(300), 40);
      }
      await page.evaluate(() => document.querySelector('#d [data-view="world"]').click());
    };
    await record(page, 's1-hook', T('s1-hook'), sweep);
    await page.context().close();
  },

  // 每个文明一条泳道，横着就是时间。滚轮一推——从六千年，直接放大到一个人的一生！
  async 's2-zoom'() {
    const page = await newPage();
    await open(page, '/zh/');
    const yChina = await page.evaluate(() => { const r = document.querySelector('#river [data-lane="china"]')?.getBoundingClientRect(); return r ? r.top + r.height / 2 : 300; });
    const x25 = await xOfYear(page, 25, yChina);
    await jump(page, W / 2, HGT - 80); await page.mouse.move(W / 2, HGT - 20);
    await record(page, 's2-zoom', T('s2-zoom'), async () => {
      await glide(page, 90, 200, 700);           // 左边一列：各文明
      await glide(page, 90, sy(700), 1000);
      await glide(page, sx(400), yChina, 500);       // 横着走：顶上的年份跟着变
      await glide(page, sx(1600), yChina, 1100);
      await glide(page, x25, yChina, 600);
      await wheel(page, PORTRAIT ? -2450 : -2150, 3800);             // 一路放大到人物层
    });
    await page.context().close();
  },

  // 点一下刘秀，生平马上弹出来；他的哥哥、儿子、部将、死对头，全都连成了线。
  async 's3-person'() {
    const page = await newPage();
    await open(page, '/zh/#person/liu-xiu', 2000);
    await escape(page);
    await jump(page, sx(1100), sy(700));
    const [x, y] = await personPt(page, 'liu-xiu');
    await record(page, 's3-person', T('s3-person'), async () => {
      await click(page, x, y, 900);
      await sleep(1500);
      const [wx, wy] = await personPt(page, 'wang-mang').catch(() => [x - 200, y - 120]);
      await glide(page, wx, wy, 1400);
      await sleep(900);
      const [mx, my] = await personPt(page, 'ma-yuan').catch(() => [x + 200, y + 80]);
      await glide(page, mx, my, 1300);
    });
    await page.context().close();
  },

  // 再往后看：唐太宗开创贞观之治的那几年，穆罕默德正带领伊斯兰教统一阿拉伯半岛——原来是同一代人！
  async 's4-parallel'() {
    const page = await newPage();
    await open(page, '/zh/#person/li-shimin', 2000);
    await escape(page);
    // 展开穆罕默德所在的“两河与波斯”泳道（点泳道名称）
    const ln = await box(page, '#river [data-lane="meso"]');
    await page.evaluate(() => { document.querySelector('.stage').scrollTop = 99999; });
    await sleep(300);
    const ln2 = await box(page, '#river [data-lane="meso"]');
    await page.mouse.click(ln2.x + 40, ln2.y + ln2.height / 2);
    await sleep(900);
    await page.evaluate(() => { document.querySelector('.stage').scrollTop = 0; });
    await sleep(600);
    if (!(await page.locator('#river [data-p="muhammad"]').count())) throw new Error('两河与波斯泳道没展开' + JSON.stringify(ln));
    const [, ly] = await personPt(page, 'li-shimin');
    const x627 = await xOfYear(page, 627, sy(500));   // 贞观元年；两人的生卒条都跨过这一年
    await jump(page, sx(1300), sy(900));
    await record(page, 's4-parallel', T('s4-parallel'), async () => {
      await click(page, x627, ly, 900);
      await sleep(1500);
      // 穆罕默德在下面另一条泳道里：画面平滑往下滚，鼠标停在同一年，顶上的十字线一直标着这一年
      await glide(page, x627, sy(620), 500);
      const [, my] = await personPt(page, 'muhammad');
      const from = await page.evaluate(() => document.querySelector('.stage').scrollTop), dy = my - sy(860);
      const ms = 1700, n = Math.round(ms / 16), t0 = Date.now();
      for (let i = 1; i <= n; i++) {
        await page.evaluate(y => { document.querySelector('.stage').scrollTop = y; }, from + dy * ease(i / n));
        const due = t0 + (ms * i) / n - Date.now(); if (due > 0) await sleep(due);
      }
      await sleep(200);
      const [, my2] = await personPt(page, 'muhammad');
      await click(page, x627, my2, 600);
    });
    await page.context().close();
  },

  // 每件大事有来龙去脉，比如安史之乱；每个人有年表、足迹，还能看到同时代世界各地都有谁。
  async 's5-event'() {
    const total = T('s5-event'), a = total * 0.45 + 0.2, b = total - a + 0.6;
    let page = await newPage();
    await open(page, '/zh/#event/anshi-zhiluan', 2000);
    await escape(page);
    await jump(page, sx(1200), sy(800));
    const e = await box(page, '#river [data-e="anshi-zhiluan"]');
    await record(page, 's5a-event', a, async () => {
      await click(page, e.x + 9, e.y + e.height / 2, 800);
      await sleep(1100);
      await page.evaluate(() => { const d = document.querySelector('#detail'); d.scrollTo({ top: 260, behavior: 'smooth' }); });
    });
    await page.context().close();

    page = await newPage();
    await open(page, '/zh/person/du-fu/', 1200);
    await page.evaluate(() => window.__cur(false));
    // 慢慢往下滚：生平年表 → 地点 → 同时代的人
    const target = await page.evaluate(() => {
      const hs = [...document.querySelectorAll('h2, h3')];
      const h = hs.find(x => /同时代/.test(x.textContent)) || hs[hs.length - 1];
      return h ? Math.max(0, h.getBoundingClientRect().top + scrollY - 160) : 1600;
    });
    await record(page, 's5b-page', b, async () => {
      await sleep(500);
      const ms = (b - 1.4) * 1000, n = Math.round(ms / 16), t0 = Date.now();
      for (let i = 1; i <= n; i++) {
        await page.evaluate(y => window.scrollTo(0, y), target * ease(i / n));
        const due = t0 + (ms * i) / n - Date.now(); if (due > 0) await sleep(due);
      }
    });
    await page.context().close();
  },

  // 想找谁，一搜就到。每条内容都写明出处，查没查证，照实告诉你。
  async 's6-search'() {
    const page = await newPage();
    await open(page, '/zh/#sanguo', 1500);
    await jump(page, sx(1000), sy(650));
    const f = await box(page, '#find');
    await record(page, 's6-search', T('s6-search'), async () => {
      await click(page, f.x + f.width / 2, f.y + f.height / 2, 600);
      await sleep(200);
      await page.keyboard.type('韩信', { delay: 170 });
      await sleep(300);
      const r = await box(page, '.search .s-row');
      await click(page, r.x + 120, r.y + r.height / 2, 450);
      await sleep(1000);
      // 卡片滚到最底下的“信息出处”
      await page.evaluate(() => { const d = document.querySelector('#detail'); d.scrollTo({ top: d.scrollHeight, behavior: 'smooth' }); });
      await sleep(600);
      const s = await page.evaluate(() => { const d = document.querySelector('#detail'), r = d.getBoundingClientRect(); return [r.left + r.width / 2, r.bottom - 160]; });
      await glide(page, s[0], s[1], 900);
    });
    await page.context().close();
  },

  // 结尾卡用的手机截图（东汉，选中汉光武帝）
  async 'mobile'() {
    const page = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await open(page, '/zh/#person/liu-xiu', 2500);
    await page.screenshot({ path: path.join(OUT, 'stills', 'mobile.png') });
    await page.context().close();
  },
};

for (const [id, fn] of Object.entries(SHOTS)) {
  if (only.length && !only.some(o => id.startsWith(o))) continue;
  console.log('录制', id);
  await fn();
}
await browser.close();
server.close();
