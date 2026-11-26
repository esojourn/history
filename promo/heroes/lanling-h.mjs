// 《峡谷之外》兰陵王一集·横版（1920×1080）：内容、旁白与竖版（lanling.mjs）相同，网站画面换成桌面版。
// 用法：node promo/heroes/lanling-h.mjs [--still] [--music <音乐文件>]
//   先做三件事：仓库根目录 npm run build；配音沿用竖版的（promo/out/heroes/lanling/voice/，见 lanling.yaml 开头）；
//   node promo/heroes/map.mjs lanling-luoyang 画地图。
//   --still：不录像，每段结束截一张图到 promo/out/heroes/lanling/h/stills/，用来检查位置。
// 成片：promo/out/heroes/lanling/lanling-h.mp4（不进仓库）；中间文件都在 promo/out/heroes/lanling/h/，不碰竖版的文件。
// 做法沿用 promo/record.mjs：本机 Chrome 以 1920×1080、字号 1.3 档打开 dist/ 的桌面版，画出假鼠标，一镜到底录下来，
// 每段的长短跟着旁白走；游戏图片、地图、结尾卡是合成时盖在录屏上面的。旁白文字是定稿，这里只对照检查，不改。
import QRCode from 'qrcode';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  HERE, PROMO, DIST, CHROME, PAPER, CREDIT, sleep, ease, loadNarration, requireFiles, serveDist, makeTimeline, VOLEAD,
  startScreencast, framesToVideo, renderPages, dataUrl, prependCover, chunksOf, weight, silences, show, ts,
} from './episode.mjs';

const W = 1920, H = 1080, FZ = '1.3';   // 视频里字要大一点：用网站自带的字号档 1.3（同功能介绍片）
const SRC = path.join(PROMO, 'out', 'heroes', 'lanling');
const OUT = path.join(SRC, 'h');
const VOICE = path.join(SRC, 'voice');   // 竖版做好的配音，直接复用
const IMG = path.join(PROMO, 'out', 'heroes', 'img', '153-bigskin-1.jpg');   // 官方图片（默认造型，横版 1920×882），不进仓库
const MAP = path.join(PROMO, 'out', 'heroes', 'maps', 'lanling-luoyang.png');
const argv = process.argv.slice(2), STILL = argv.includes('--still');
const MUSIC = argv.includes('--music') ? argv[argv.indexOf('--music') + 1] : null;
const URL_QR = 'https://lishi.alz-ai.cn/zh/#person/gao-changgong', URL_SHOW = 'lishi.alz-ai.cn';
const SOURCES = '史实核对自：《北齐书》兰陵武王长恭传、武成纪、后主纪，《教坊记》（维基文库电子版）。';
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
requireFiles([IMG, MAP, path.join(VOICE, 'timing.json'), path.join(DIST, 'zh', 'index.html')], '见本文件开头的用法');

const SHOTS = loadNarration(path.join(HERE, 'lanling.yaml'), '## 二、', 15);
const SHOT = Object.fromEntries(SHOTS.map(s => [s.id, s]));
const VO = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(VOICE, 'timing.json'), 'utf8')).shots.map(s => [s.id, s]));
const { server, base: BASE } = await serveDist();

/* ---------- 录制页面里的假鼠标：箭头 + 点击波纹（同 record.mjs，只在录制时注入，不改网站） ---------- */
const CURSOR = () => {
  const boot = () => {
    if (document.getElementById('__cur')) return;
    const st = document.createElement('style');
    st.textContent = `#__cur{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transition:opacity .25s;will-change:transform}
      #__cur svg{width:30px;height:30px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
      .__rip{position:fixed;z-index:2147483646;pointer-events:none;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid #e8a33d;animation:__rip .55s ease-out forwards}
      @keyframes __rip{from{transform:scale(.4);opacity:1}to{transform:scale(3.2);opacity:0}}`;
    document.head.append(st);
    const c = document.createElement('div'); c.id = '__cur';
    c.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 2.5v17.2l4.6-4.3 3 6.9 3-1.3-3-6.8h6.3z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.documentElement.append(c);
    c.style.transform = 'translate(1100px,640px)';
    addEventListener('mousemove', e => { c.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 2}px)`; }, true);
    addEventListener('mousedown', e => { const r = document.createElement('div'); r.className = '__rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.documentElement.append(r); setTimeout(() => r.remove(), 700); }, true);
    window.__cur = v => { c.style.opacity = v ? 1 : 0; };
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot); else boot();
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'zh-CN' });
await ctx.addInitScript(z => { try { localStorage.setItem('fz', z); } catch (_) {} }, FZ);
await ctx.addInitScript(CURSOR);
await ctx.route(/googletagmanager|google-analytics/, r => r.abort());
const page = await ctx.newPage();
page.on('pageerror', e => console.log('页面错误：', e.message));
const cdp = await ctx.newCDPSession(page);

// 结尾卡里的电脑画面：兰陵王的关系图（先截下来，再回到首页开始录）
await page.goto(BASE + '/zh/#person/gao-changgong', { waitUntil: 'networkidle' });
await page.waitForSelector('#river [data-p="gao-changgong"]', { timeout: 15000 });
await sleep(1500);
await page.evaluate(() => window.__cur(false));
await page.screenshot({ path: path.join(OUT, 'focus.png') });
await page.goto('about:blank');
await page.goto(BASE + '/zh/', { waitUntil: 'networkidle' });
await page.waitForSelector('#river g', { timeout: 15000 });
await sleep(1500);
await page.evaluate(() => window.__cur(false));
const DETAIL_X = 1491;   // 右侧人物卡的左边缘（1.3 档字号下宽 429px）；地图只盖住它左边的时间轴

/* ---------- 鼠标动作 ---------- */
let mx = 1100, my = 640;
async function glide(x, y, ms = 700) {
  const x0 = mx, y0 = my, n = Math.max(2, Math.round(ms / 16)), t = Date.now();
  for (let i = 1; i <= n; i++) {
    const e = ease(i / n);
    await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
    const due = t + (ms * i) / n - Date.now(); if (due > 0) await sleep(due);
  }
  mx = x; my = y;
}
async function click(x, y, ms = 650) { await glide(x, y, ms); await sleep(120); await page.mouse.down(); await sleep(70); await page.mouse.up(); }
async function box(sel) { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('找不到 ' + sel); return b; }
async function clickSel(sel, dx = null, ms = 650) { const b = await box(sel); await click(b.x + (dx ?? b.width / 2), b.y + b.height / 2, ms); }
// 滚轮缩放：total 为负是放大；分成小步，持续 ms 毫秒
async function wheel(total, ms) {
  const n = Math.round(ms / 33), t = Date.now(); let done = 0;
  for (let i = 1; i <= n; i++) {
    const want = total * ease(i / n), d = want - done; done = want;
    await page.mouse.wheel(0, d);
    const due = t + (ms * i) / n - Date.now(); if (due > 0) await sleep(due);
  }
}
// 时间轴上某人的生卒条：返回条在屏幕上的位置（左边被左栏挡住的部分不算，右边被人物卡挡住的不算）
async function bar(id) {
  const r = await page.evaluate(id => { const g = document.querySelector(`#river [data-p="${id}"] rect`); return g && g.getBoundingClientRect().toJSON(); }, id);
  if (!r) throw new Error('时间轴上找不到 ' + id);
  const x1 = Math.max(r.x, 182), x2 = Math.min(r.x + r.width, DETAIL_X - 10);
  return { x1, x2, y: r.y + r.height / 2, right: r.x + r.width };
}
// 时间轴上某个关系标注（如“赐毒酒”）的位置
const labelPt = text => page.evaluate(t => {
  const e = [...document.querySelectorAll('#river tspan.rl')].find(x => x.textContent === t); if (!e) return null;
  const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2];
}, text);
// 右侧卡片滚到某句话（或 'sel:选择器'）：让它停在卡片顶部往下 off 像素处。不给就回到开头
const scrollCard = (snip, ms = 1200, off = 70) => page.evaluate(([snip, ms, off]) => new Promise((res, rej) => {
  const sh = document.querySelector('#detail');
  let y1 = 0;
  const to = rect => Math.max(0, Math.min(sh.scrollHeight - sh.clientHeight, sh.scrollTop + rect.top - sh.getBoundingClientRect().top - off));
  if (snip && snip.startsWith('sel:')) {
    const el = sh.querySelector(snip.slice(4)); if (!el) return rej(new Error('卡片里找不到 ' + snip));
    y1 = to(el.getBoundingClientRect());
  } else if (snip) {
    const w = document.createTreeWalker(sh, NodeFilter.SHOW_TEXT); let n, r = null;
    while ((n = w.nextNode())) { const i = n.data.indexOf(snip); if (i >= 0) { r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + snip.length); break; } }
    if (!r) return rej(new Error('卡片里找不到这句话：' + snip));
    y1 = to(r.getBoundingClientRect());
  }
  const y0 = sh.scrollTop, t0 = performance.now(), e = u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const step = now => { const u = Math.min(1, (now - t0) / ms); sh.scrollTop = y0 + (y1 - y0) * e(u); if (u < 1) requestAnimationFrame(step); else res(true); };
  requestAnimationFrame(step);
}), [snip, ms, off]);
// 卡片里某句话在屏幕上的位置（鼠标指过去）
const textPt = snip => page.evaluate(snip => {
  const sh = document.querySelector('#detail'), w = document.createTreeWalker(sh, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const i = n.data.indexOf(snip); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + snip.length); const b = r.getClientRects()[0]; return [b.x + Math.min(b.width, 200) / 2, b.bottom + 4]; } }
  return null;
}, snip);
async function pointAt(snip, ms = 800) { const p = await textPt(snip); if (!p) throw new Error('卡片里找不到这句话：' + snip); await glide(p[0], p[1], ms); }
const selected = () => page.evaluate(() => location.hash);
async function expectSel(hash) { const h = await selected(); if (h !== '#' + hash) throw new Error(`应该选中 ${hash}，现在是 ${h}`); }

/* ---------- 分段 ---------- */
const tl = makeTimeline({ shot: SHOT, vo: VO, still: STILL, stillDir: path.join(OUT, 'stills'), page });
const { mark, until, snap } = tl;

async function act() {
  // 1. 游戏图片（合成时盖在上面），网站停在全貌
  await mark('n01');

  // 2. 点开兰陵王：点搜索框，输入“兰陵王”，点第一条；时间轴飞到他的年代，右边出人物卡，关系线连出来
  await mark('n02');
  await page.evaluate(() => window.__cur(true));
  await sleep(300);
  await clickSel('#find', null, 700); await sleep(400);
  for (const ch of '兰陵王') { await page.keyboard.insertText(ch); await sleep(230); }
  await sleep(500); await snap('02a-search');
  await clickSel('.search .s-row[data-id="gao-changgong"]', 110, 500); await sleep(1300);
  await expectSel('person/gao-changgong');
  await until(0.35); await pointAt('高长恭，一名孝瓘', 900);
  await snap('02-focus');

  // 3. 人物卡：先指着“相貌柔美而性情勇猛”，再把卡片滚到“河清三年”那一段，指着《教坊记》那一句
  await mark('n03');
  await sleep(200); await pointAt('相貌柔美而性情勇猛', 900); await snap('03a-card');
  await until(0.3); await scrollCard('河清三年', 1200, 60);
  await until(0.45); await pointAt('唐代的《教坊记》', 800); await snap('03-jiaofang');

  // 4a. “围困洛阳”：地图盖在时间轴上（右边人物卡照常露出）；趁这时在卡片里点“邙山之战”
  await mark('n04a');
  await sleep(300);
  await scrollCard('sel:[data-goe="mangshan-zhizhan"]', 600, 380); await sleep(200);
  await clickSel('#detail [data-goe="mangshan-zhizhan"]', 90, 700); await sleep(1100);
  await expectSel('event/mangshan-zhizhan');
  // 4b. 事件“邙山之战”：滚到五百骑兵那一段
  await mark('n04b');
  await snap('04a-event');
  await sleep(500); await scrollCard('北齐武成帝派兰陵王', 1300, 40);
  await pointAt('兰陵王率五百骑兵冲入周军阵中', 900); await snap('04-wubai');
  // 5. 摘下头盔、派弩手下城：鼠标跟着那一句往下指
  await mark('n05');
  await until(0.3); await pointAt('他摘下头盔露出面容', 900); await snap('05-toukui');
  // 6. 《兰陵王入阵曲》
  await mark('n06');
  await sleep(200); await scrollCard('齐军将士为兰陵王作歌', 1100, 140); await pointAt('称为《兰陵王入阵', 700); await snap('06-ruzhenqu');

  // 7. 后来的皇帝：返回兰陵王，在时间轴上点“北齐后主”
  await mark('n07');
  await scrollCard(null, 400); await sleep(100);
  await clickSel('#detail .d-back', 50, 700); await sleep(1100);
  await expectSel('person/gao-changgong');
  { const b = await bar('gao-wei'); await click(b.x1 + 60, b.y, 900); } await sleep(1000);
  await expectSel('person/gao-wei');
  await pointAt('北齐的末代皇帝', 800);
  await snap('07-gaowei');
  // 8. 后主的卡片：开头
  await mark('n08');
  await snap('08-card');
  // 9. 滚到“先后杀害斛律光、兰陵王高长恭等名将”
  await mark('n09');
  await sleep(500); await scrollCard('他在位期间', 1300, 40); await pointAt('后杀害斛律光', 800); await snap('09-shahai');
  // 10. 时间轴上：鼠标移到后主和兰陵王之间“赐毒酒”那条连线上（兰陵王生卒条的末端，573 年），滚轮放大一点
  await mark('n10');
  await sleep(500);
  { if (!(await labelPt('赐毒酒'))) throw new Error('后主的关系上没有“赐毒酒”');
    const a = await bar('gao-changgong'), b = await bar('gao-wei'); await glide(a.right - 1, (a.y + b.y) / 2, 1100); await sleep(300); await wheel(-260, 1500); }
  await snap('10-zoom');

  // 11. 回到兰陵王：点他的生卒条，卡片滚到“后主曾对他说”那一段
  await mark('n11');
  await sleep(300);
  { const b = await bar('gao-changgong'); await click(b.x1 + 60, b.y, 800); } await sleep(1000);
  await expectSel('person/gao-changgong');
  await scrollCard('后主曾对他说', 1300, 60); await pointAt('有意收受财物以自污', 900); await snap('11-ziwu');
  // 12. 部下劝他称病，没能退成：鼠标跟着往下指
  await mark('n12');
  await until(0.45); await pointAt('却没能退下来', 900); await snap('12-weituicheng');

  // 13. 时间轴到 573 年：鼠标移到他生卒条的末端（顶上显示“公元 573 年”），滚轮再放大
  await mark('n13');
  await sleep(200);
  { const b = await bar('gao-changgong'); if (b.right > DETAIL_X - 20) throw new Error('兰陵王的条末端被卡片挡住了'); await glide(b.right - 2, b.y, 1100); }
  await sleep(250); await wheel(-420, 1500);
  { const yr = await page.evaluate(() => [...document.querySelectorAll('#river text.ct')].map(t => t.textContent).pop() || ''); if (!/573/.test(yr)) throw new Error('顶上显示的年份不是 573：' + yr); }
  await snap('13-573');

  // 14. 事件“北周灭北齐”：在时间轴上点它
  await mark('n14');
  await sleep(150);
  await clickSel('#river [data-e="beizhou-mie-beiqi"] text', 40, 900); await sleep(1100);
  await expectSel('event/beizhou-mie-beiqi');
  await pointAt('攻入邺城', 800);
  await snap('14-mieqi');

  // 15. 结尾卡（合成时盖在上面）
  await mark('n15');
  await mark(null);
}

/* ---------- 录像 ---------- */
let frames = null;
if (!STILL) frames = await startScreencast(cdp, W, H);
tl.t0 = Date.now();
await act();
const TOTAL = (Date.now() - tl.t0) / 1000;
if (STILL) { console.log('截图在', path.join(OUT, 'stills')); await browser.close(); server.close(); process.exit(0); }
await cdp.send('Page.stopScreencast');
await browser.close(); server.close();
const marks = tl.marks, at = tl.at;
console.log(`录制 ${TOTAL.toFixed(1)}s，${frames.length} 帧`);
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ total: TOTAL, marks }, null, 1));
framesToVideo(frames, TOTAL, OUT, 'screen.mp4', W, H);

/* ---------- 各张底图：用浏览器画（1920×1080） ---------- */
// 官方横版图 1920×882，放大到 1080 高（2351 宽），左移 IMGX，人物在画面偏右，左边暗处放字
const IMGX = 140, IMGW = Math.round(1920 * H / 882);
const qr = await QRCode.toDataURL(URL_QR, { errorCorrectionLevel: 'Q', margin: 2, width: 720, color: { dark: '#1B2A31', light: '#FFFFFF' } });
const KAI = "'STKaiti','KaiTi',serif";
const PAGES = {
  // 封面：成片第一帧（社交平台上显示的就是它）。官方图片铺满，左边压暗放片名
  cover: `<body style="background:#0d1216;color:#fff;font-family:'Microsoft YaHei'">
    <img src="${dataUrl(IMG)}" style="position:absolute;left:-${IMGX}px;top:0;height:${H}px">
    <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,18,22,.92) 0,rgba(13,18,22,.75) 30%,rgba(13,18,22,0) 56%)"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:200px;background:linear-gradient(transparent,rgba(13,18,22,.7))"></div>
    <div style="position:absolute;left:110px;top:150px;font:400 84px ${KAI};letter-spacing:14px">峡谷之外</div>
    <div style="position:absolute;left:114px;top:258px;font-size:32px;letter-spacing:7px;color:#d8c9a8">王者荣耀人物的真实历史</div>
    <div style="position:absolute;left:100px;top:420px;font:700 200px ${KAI};letter-spacing:26px;text-shadow:0 6px 30px rgba(0,0,0,.6)">兰陵王</div>
    <div style="position:absolute;left:116px;top:690px;font:700 62px 'Microsoft YaHei';letter-spacing:4px;color:#e8c27a">一句“家事”，一杯毒酒</div>
    <div style="position:absolute;right:30px;bottom:24px;font-size:24px;letter-spacing:1px;color:rgba(241,236,224,.85)">${CREDIT}</div>
  </body>`,
  // 开头：盖在推近的游戏图片上的字。系列名、片名、图片出处和封面在同一位置（封面淡入这里时字不重影），只是大字“兰陵王”换成第一句旁白的字幕
  intro: `<body style="background:transparent;color:#fff;font-family:'Microsoft YaHei'">
    <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,18,22,.92) 0,rgba(13,18,22,.75) 30%,rgba(13,18,22,0) 56%)"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:260px;background:linear-gradient(transparent,rgba(13,18,22,.8))"></div>
    <div style="position:absolute;left:110px;top:150px;font:400 84px ${KAI};letter-spacing:14px">峡谷之外</div>
    <div style="position:absolute;left:114px;top:258px;font-size:32px;letter-spacing:7px;color:#d8c9a8">王者荣耀人物的真实历史</div>
    <div style="position:absolute;left:116px;top:690px;font:700 62px 'Microsoft YaHei';letter-spacing:4px;color:#e8c27a">一句“家事”，一杯毒酒</div>
    <div style="position:absolute;right:30px;bottom:24px;font-size:24px;letter-spacing:1px;color:rgba(241,236,224,.85)">${CREDIT}</div>
  </body>`,
  // 地图：盖住左边的时间轴，右边的人物卡和顶栏照常；字幕在下方
  mapcard: `<body style="background:transparent">
    <div style="position:absolute;left:0;top:58px;width:${DETAIL_X}px;bottom:0;background:${PAPER}"></div>
    <img src="${dataUrl(MAP)}" style="position:absolute;left:${Math.round((DETAIL_X - 806) / 2)}px;top:84px;height:821px;border-radius:22px;box-shadow:0 14px 40px rgba(27,42,49,.22);border:2px solid #d9cdb4">
  </body>`,
  // 结尾卡：左边电脑画面（兰陵王的关系图），右边二维码和网址；下面小字是核实过的史料（只显示、不念）；最下面留给字幕
  end: `<body style="background:radial-gradient(circle at 30% 40%,#f7f3ea 0,${PAPER} 55%,#e4dccb 100%);font-family:'Microsoft YaHei';color:#1B2A31">
    <div style="position:absolute;left:0;right:0;top:44px;text-align:center;font:700 34px 'Microsoft YaHei';letter-spacing:6px;color:#8a5a2b">峡谷之外 · 兰陵王</div>
    <div style="position:absolute;left:110px;top:150px;width:900px;height:506px;padding:14px;border-radius:22px;background:#1B2A31;box-shadow:0 26px 60px rgba(27,42,49,.3)">
      <img src="${dataUrl(path.join(OUT, 'focus.png'))}" style="width:100%;height:100%;display:block;border-radius:10px"></div>
    <div style="position:absolute;left:500px;top:684px;width:120px;height:26px;background:#1B2A31;border-radius:0 0 8px 8px"></div>
    <div style="position:absolute;left:1110px;top:150px">
      <div style="font:400 112px ${KAI};letter-spacing:.14em;line-height:1.1">历史长河</div>
      <div style="margin-top:10px;font-size:36px;color:#55676C;letter-spacing:.1em">一张图，看懂各国历史</div>
      <div style="display:flex;align-items:center;gap:36px;margin-top:40px">
        <div style="width:250px;height:250px;padding:10px;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(27,42,49,.18);box-sizing:border-box"><img src="${qr}" style="width:100%;height:100%;display:block"></div>
        <div style="font-size:50px;font-weight:700">${URL_SHOW}<div style="margin-top:14px;font-size:30px;font-weight:400;color:#55676C;letter-spacing:.06em">扫码看兰陵王的关系图</div>
          <div style="display:inline-block;margin-top:20px;padding:8px 22px;border-radius:40px;background:#C4472D;color:#fff;font-size:26px;font-weight:400;letter-spacing:.08em">电脑手机都能看 · 免费开放</div></div>
      </div>
    </div>
    <div style="position:absolute;left:60px;right:60px;top:800px;text-align:center;font-size:26px;line-height:1.5;color:#5f6c6f">${SOURCES}</div>
  </body>`,
};
await renderPages(PAGES, OUT, ['end', 'cover'], W, H);

/* ---------- 开头的游戏图片：铺满画面，缓慢推近 ---------- */
const introLen = at('n02') + 0.6, N = Math.round(introLen * 30);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', introLen.toFixed(3), '-i', IMG, '-i', path.join(OUT, 'intro.png'), '-filter_complex',
  `[0:v]scale=${IMGW}:${H}:flags=lanczos,crop=${W}:${H}:${IMGX}:0,scale=${W * 2}:${H * 2}:flags=lanczos,`
  + `zoompan=z='1+0.08*on/${N}':x='iw*0.52-(iw/zoom*0.52)':y='ih*0.4-(ih/zoom*0.4)':d=1:s=${W}x${H}:fps=30[fg];`
  + `[fg][1:v]overlay=0:0,format=yuv420p`,
  '-t', introLen.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', path.join(OUT, 'intro.mp4')]);

/* ---------- 字幕：断句和对时同竖版；横版放在画面下方正中，白字半透明深色底 ---------- */
const SUBY = 1000;
const ass = [`[Script Info]`, `ScriptType: v4.00+`, `PlayResX: ${W}`, `PlayResY: ${H}`, `WrapStyle: 2`, ``, `[V4+ Styles]`,
  `Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding`,
  `Style: Sub,Microsoft YaHei,50,&H00FFFFFF,&H00FFFFFF,&H40312A1B,&H40312A1B,1,0,0,0,100,100,2,0,3,14,0,5,30,30,0,134`,
  `Style: Intro,Microsoft YaHei,54,&H00FFFFFF,&H00FFFFFF,&H00160F0A,&H00160F0A,1,0,0,0,100,100,2,0,1,3,0,5,30,30,0,134`,
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
    const near = inner.filter(q => q.x > prev + 0.3 && Math.abs(q.x - t) < 0.7).sort((a, b) => (Math.abs(a.x - t) - 1.5 * a.d) - (Math.abs(b.x - t) - 1.5 * b.d))[0];
    if (near) t = near.x;
    t = Math.max(t, prev + 0.3); prev = t; return t;
  });
  const starts = [0, ...bounds], next = i + 1 < marks.length ? marks[i + 1].at : TOTAL;
  cs.forEach((c, j) => {
    const a = m.at + (j ? VOLEAD + starts[j] : 0), b = j + 1 < cs.length ? m.at + VOLEAD + starts[j + 1] : Math.min(next, m.at + VOLEAD + dur + 0.6);
    const intro = m.id === 'n01';
    ass.push(`Dialogue: 0,${ts(a)},${ts(b)},${intro ? 'Intro' : 'Sub'},,0,0,0,,{\\pos(960,${SUBY})\\fad(120,80)}${show(c)}`);
    subLog.push(`${ts(a)} → ${ts(b)}  ${show(c)}`);
  });
});
fs.writeFileSync(path.join(OUT, 'subs.ass'), ass.join('\n'));
fs.writeFileSync(path.join(OUT, 'subs.txt'), subLog.join('\n'));

/* ---------- 合成 ---------- */
// 输入：0 录屏，1 开头，2 地图，3 结尾卡，4… 旁白，最后是音乐
const T = TOTAL.toFixed(3), tMap0 = at('n04a') - 0.1, tMap1 = at('n04b') - 0.25, tEnd = at('n15') - 0.1, tIntro = at('n02') - 0.15;
const args = ['-y', '-loglevel', 'error', '-i', 'screen.mp4', '-i', 'intro.mp4',
  '-loop', '1', '-framerate', '30', '-t', T, '-i', 'mapcard.png', '-loop', '1', '-framerate', '30', '-t', T, '-i', 'end.png'];
marks.forEach(m => args.push('-i', path.join(VOICE, VO[m.id].file)));
if (MUSIC) args.push('-i', path.resolve(MUSIC));
const vf = `[0:v]fps=30,format=yuv420p[a];`
  + `[1:v]format=rgba,fade=out:st=${tIntro.toFixed(3)}:d=0.45:alpha=1[in];[a][in]overlay=0:0:eof_action=pass[c];`
  + `[2:v]format=rgba,fade=in:st=${tMap0.toFixed(3)}:d=0.35:alpha=1,fade=out:st=${tMap1.toFixed(3)}:d=0.35:alpha=1[mp];[c][mp]overlay=0:0[d];`
  + `[3:v]format=rgba,fade=in:st=${tEnd.toFixed(3)}:d=0.5:alpha=1[end];[d][end]overlay=0:0,subtitles=subs.ass,`
  + `fade=out:st=${(TOTAL - 0.8).toFixed(3)}:d=0.8,format=yuv420p[v]`;
// 旁白、音乐的处理同竖版：每段在字幕出现后 VOLEAD 秒开始；音乐压低，有人声时再自动让一让
const vo = marks.map((m, i) => `[${4 + i}:a]aresample=48000,adelay=${Math.round((m.at + VOLEAD) * 1000)}:all=1[v${i}]`);
let af = `;${vo.join(';')};${marks.map((_, i) => `[v${i}]`).join('')}amix=inputs=${marks.length}:normalize=0,apad,atrim=0:${T},asplit=2[narr][key]`;
if (MUSIC) {
  const mi = 4 + marks.length;
  af += `;[${mi}:a]aresample=48000,atrim=0:${T},volume=0.26,afade=in:st=0:d=1,afade=out:st=${(TOTAL - 2.5).toFixed(3)}:d=2.5[mu]`
    + `;[mu][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]`
    + `;[narr][duck]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11[au]`;
} else af += `;[narr]loudnorm=I=-15:TP=-1.5:LRA=11[au]`;
args.push('-filter_complex', vf + af, '-map', '[v]', '-map', '[au]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-t', T, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', 'body.mp4');
execFileSync('ffmpeg', args, { cwd: OUT });

/* ---------- 片头封面：第一帧就是封面，停 1 秒后淡入正片（同竖版） ---------- */
const FULL = prependCover({ outDir: OUT, coverPng: 'cover.png', body: 'body.mp4', out: path.join(SRC, 'lanling-h.mp4'), total: TOTAL });
fs.rmSync(path.join(OUT, 'body.mp4'));
console.log('成片：', path.join(SRC, 'lanling-h.mp4'), FULL + 's');
