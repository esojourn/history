// 《峡谷之外》韩信“多多益善”一篇《多多益善：兵越多，越难带》（竖屏 1080×1920）：
//   第一屏标题画面 → 开头游戏图片 → 网站手机画幅录屏（人物卡、事件“垓下之战”、汉高祖、关系图）+ 史书原文卡
//   + 讲当年明月论述的“观点卡” → 结尾卡。不配地图。
// 用法：node promo/heroes/hanxin-duoduo.mjs [--still] [--music <音乐文件>]
//   先做两件事：仓库根目录 npm run build；按 hanxin-duoduo.yaml 开头的命令配音。
//   --still：不录像，每段结束截一张图到 promo/out/heroes/007-hanxin-duoduo/stills/，用来检查位置；同时画出各张底图、文字卡。
// 成片：promo/out/heroes/007-hanxin-duoduo/hanxin-duoduo.mp4（不进仓库）。第一屏另存为 cover.png，可在平台上传封面时用。
// 做法照韩信“胯下之辱”一篇（hanxin-kuaxia.mjs），通用的部分在 episode.mjs。旁白文字是定稿，这里只对照检查，不改。
//
// 两种文字卡，样子分开：
//   1. 史书原文卡（浅米色卡，盖在手机画面上半截，标“《史记》××原文”）：原文与 scripts.md 第七篇两张核实表“原文”一栏逐字一致（开录前自动对照）。
//   2. 观点卡（深色整块，盖住整个手机画面，左上角注明“据当年明月《明朝那些事儿》”）：讲当年明月论述的几句（第 3–7 段）。
//      这本书还在版权期内，卡上只出现“不会超过十五个人”这一小句原话（加引号），其余是定稿里的转述；
//      卡上每一处文字开录前都对照 scripts.md 第七篇，找不到就停。仓库里不存他的原文。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import QRCode from 'qrcode';
import {
  HERE, PROMO, DIST, VW, VH, PAPER, CREDIT, VOLEAD, sleep, loadNarration, requireFiles, serveDist, openPhone,
  makeTimeline, fracBefore, startScreencast, framesToVideo, renderPages, dataUrl, writeSubs, prependCover, copyChecked,
} from './episode.mjs';

const OUT = path.join(PROMO, 'out', 'heroes', '007-hanxin-duoduo');
const WORK = path.join(os.tmpdir(), 'xiagu-hanxin-duoduo');   // 录屏、开头、正片、成片先写在这里（E 盘直接写偶尔写坏，见 episode.mjs checkVideo）
const VOICE = path.join(OUT, 'voice');
const IMG = path.join(PROMO, 'out', 'heroes', 'img', '150-bigskin-1.jpg');       // 官方图片（默认造型，横版），不进仓库
const IMG_V = path.join(PROMO, 'out', 'heroes', 'img', '150-mobileskin-1.jpg');   // 官方图片（默认造型，竖版），第一屏用
const argv = process.argv.slice(2), STILL = argv.includes('--still');
const MUSIC = argv.includes('--music') ? argv[argv.indexOf('--music') + 1] : null;
// 结尾卡的二维码直接打开韩信的关系图；卡上显示的网址仍是首页
const URL_QR = 'https://lishi.alz-ai.cn/zh/#person/han-xin', URL_SHOW = 'lishi.alz-ai.cn';
const COVER_SEC = 1.6;   // 第一屏停留秒数（含 0.4 秒淡入正片）
for (const d of [path.join(OUT, 'stills'), WORK]) fs.mkdirSync(d, { recursive: true });
requireFiles([IMG, IMG_V, path.join(VOICE, 'timing.json'), path.join(DIST, 'zh', 'index.html')], '见本文件开头的用法');

/* ---------- 旁白、第一屏、片尾小字：对照定稿 ---------- */
const SHOTS = loadNarration(path.join(HERE, 'hanxin-duoduo.yaml'), '## 七、', 11);
const SEC = (() => { const md = fs.readFileSync(path.join(HERE, 'scripts.md'), 'utf8').replace(/\r\n/g, '\n'), i = md.indexOf('## 七、'); const j = md.indexOf('\n---', i); return md.slice(i, j < 0 ? undefined : j); })();
const notRead = SEC.slice(0, SEC.indexOf('\n配地图：')).split('\n').filter(l => l.startsWith('|') && l.includes('不念')).map(l => l.split('|')[2].trim());
const [TITLE_ROW, SOURCES] = notRead;
if (TITLE_ROW !== '峡谷之外的真实历史 / 多多益善 / 兵越多，越难带 / 韩信') { console.error('scripts.md 第七篇的第一屏文字变了，先改本脚本的第一屏'); process.exit(1); }
if (!SOURCES || !SOURCES.startsWith('史实核对自：')) { console.error('scripts.md 第七篇找不到结尾卡上的小字'); process.exit(1); }
const SHOT = Object.fromEntries(SHOTS.map(s => [s.id, s]));
const VO = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(VOICE, 'timing.json'), 'utf8')).shots.map(s => [s.id, s]));
for (const s of SHOTS) if (!VO[s.id]) { console.error('配音里缺少 ' + s.id + '，改了 hanxin-duoduo.yaml 要重新配音'); process.exit(1); }

/* ---------- 史书原文卡 ---------- */
// on：在哪一段、念到哪几个字时出现（不给字就是这一段一开始）；一直显示到下一张出现，或 off 那一段开始。
// book：卡上标的书名；src：核实表里这句原文前面最近的出处要是它。text 里【】括起来的字用红色突出，/ 是手动换行；
// 去掉【】和 / 后必须是 scripts.md 第七篇核实表“原文”一栏里的原话。
const LZ = '《史记》淮阴侯列传原文', GZ = '《史记》高祖本纪原文';
const QUOTES = [
  { on: ['n02', '韩信说'], book: LZ, src: '列传', text: '陛下不过能将【十万】' },
  { on: ['n02', '那你呢'], book: LZ, src: '列传', text: '臣【多多而益善】耳', off: 'n03' },
  { on: ['n08', '《史记》记载'], book: GZ, src: '《高祖本纪》', text: '淮阴侯将【三十万】自当之', off: 'n09' },
  { on: ['n09', '连百万'], book: GZ, src: '《高祖本纪》', text: '连百万之军，/战必胜，攻必取，/【吾不如韩信】', off: 'n10' },
];
{
  // 第七篇有两张核实表（“第二版新增说法的核实”和“核实记录”），表头第二栏是“原文”或“原文或出处”；两张都收进来对照
  const cells = [];
  let inTable = false;
  for (const l of SEC.split('\n')) {
    if (!l.startsWith('|')) { inTable = false; continue; }
    const c = l.split('|').map(x => x.trim());
    if (/^原文/.test(c[2])) { inTable = true; continue; }
    if (inTable && !/^-+$/.test(c[2])) cells.push(c[2].replace(/[‘’]/g, m => (m === '‘' ? '“' : '”')));
  }
  if (cells.length < 20) { console.error('scripts.md 第七篇的核实表没找全（只找到 ' + cells.length + ' 行）'); process.exit(1); }
  const BOOKS = ['列传', '《高祖本纪》', '《汉书》'];
  for (const q of QUOTES) {
    const plain = q.text.replace(/[【】/]/g, '');
    const hit = cells.find(c => { const i = c.indexOf(plain); if (i < 0) return false; const pre = c.slice(0, i);
      const last = BOOKS.map(b => [b, pre.lastIndexOf(b)]).sort((a, b) => b[1] - a[1])[0]; return last[1] >= 0 && last[0] === q.src; });
    if (!hit) { console.error(`文字卡上的原文在核实表“原文”一栏里找不到（或出处不是${q.src}）：${plain}`); process.exit(1); }
  }
  console.log(`史书原文卡 ${QUOTES.length} 张，原文都与核实表一致`);
}

/* ---------- 观点卡（据当年明月《明朝那些事儿》） ---------- */
// view：整块的深色底，各自一张，换的时候交叉淡入淡出；item：盖在某张 view 上、念到才跳出来的一项。
// text 里【】的字用金色突出，/ 是换行；check：要在 scripts.md 第七篇里找得到的字（定稿里的转述或画面说明），找不到就停。
const N05 = [['传令', '命令'], ['听懂', '听得懂'], ['吃饭', '吃饭'], ['宿营', '宿营'], ['路程', '路程'], ['天气', '天气'], ['地形', '地形'], ['士气', '士气'], ['哗变', '哗变']];
const ORIGINAL = '不会超过十五个人';   // 卡上唯一一句当年明月的原话
const VIEWS = [
  { id: 'book', on: ['n03', '当年明月'], check: ['当年明月', '《明朝那些事儿》', '第 2 部第十四章', '土木堡'] },
  { id: 'fight', on: ['n04'], check: ['两个人打架'] },
  { id: 'army', on: ['n05'], check: ['十万人', '就有十万个脑子', ...N05.map(x => x[0])] },
  { id: 'scale', on: ['n06'], check: [] },
];
const ITEMS = [
  ...N05.map(([w, snip], i) => ({ view: 'army', on: ['n05', snip], id: 'i' + i, word: w })),
  { view: 'scale', on: ['n06', '人数多十倍'], id: 'x10', check: ['人数 ×10 → 麻烦 ×100'] },
  { view: 'scale', on: ['n06', '韩信之后'], id: 'qian', check: ['韩信之后一千多年，真能做到多多益善的'] },
  { view: 'scale', on: ['n06', '不会超过'], id: 'yuan', check: [`“${ORIGINAL}”`] },
  { view: 'scale', on: ['n07', '多多益善比的'], id: 'tongchou', check: ['比的不是力气，是统筹'] },
  { view: 'scale', on: ['n07', '把几十万人'], id: 'yigeren', check: ['把几十万人，指挥得像一个人'] },
];
{
  const all = [...VIEWS.flatMap(v => v.check), ...ITEMS.flatMap(x => x.check || [x.word])];
  const miss = all.filter(s => !SEC.includes(s));
  if (miss.length) { console.error('观点卡上的字在 scripts.md 第七篇里找不到：' + miss.join('、')); process.exit(1); }
  if (!SEC.includes(`“${ORIGINAL}”`)) { console.error('定稿里没有加引号的“不会超过十五个人”'); process.exit(1); }
  console.log(`观点卡 ${VIEWS.length} 张、跳出的项目 ${ITEMS.length} 个，字都在定稿里；原话只有“${ORIGINAL}”一句`);
}
const VIEW_END = 'n08';   // 观点卡在“垓下”这一段开始时淡出，露出网站

/* ---------- 打开网站 ---------- */
const { server, base: BASE } = await serveDist();
const ph = await openPhone();
const { browser, page, cdp, pinch, tapSel, tapPerson, scrollCard, openCard, closeCard, expectFocus, type } = ph;

// 结尾卡里的手机画面：韩信的关系图（先截下来，再回到首页开始录）
await page.goto(BASE + '/zh/#person/han-xin', { waitUntil: 'networkidle' });
await page.waitForSelector('#mseg [data-map]', { timeout: 15000 });
await sleep(1200);
await page.screenshot({ path: path.join(OUT, 'focus.png') });
await page.goto('about:blank');
await page.goto(BASE + '/zh/', { waitUntil: 'networkidle' });
await page.waitForSelector('#mpeople', { timeout: 15000 });
await sleep(1500);

const tl = makeTimeline({ shot: SHOT, vo: VO, still: STILL, stillDir: path.join(OUT, 'stills'), page });
const { mark, snap } = tl;

async function goEvent(id, name) {
  await openCard();
  await scrollCard(`sel:[data-goe="${id}"]`, 500, 200); await sleep(150);
  await tapSel(`#msheet [data-goe="${id}"]`); await sleep(1000);
  await expectFocus(name);
  await openCard();
}
// 从事件卡、别人的卡片返回韩信（卡片上的“返回 韩信”）
async function back(name) {
  await scrollCard(null, 400); await sleep(150);
  await tapSel('#msheet .d-back'); await sleep(1100);
  await expectFocus(name);
}
// 关系图上几个人的那一条（取露在卡片上方的部分）
const bars = ids => page.evaluate(ids => ids.map(id => { const g = document.querySelector(`#mpeople [data-p="${id}"] rect`); return g ? g.getBoundingClientRect().toJSON() : null; }), ids);

async function act() {
  // 1. 游戏图片（合成时盖在上面），网站停在全貌
  await mark('n01');

  // 2. 搜索“韩信”，点第一条，进入他的关系图；展开人物卡（原文卡盖在上半截）
  await mark('n02');
  await sleep(200);
  await tapSel('#mfind'); await sleep(400);
  await type('韩信', 180);
  await sleep(350); await snap('02a-search');
  await tapSel('.s-row[data-id="han-xin"]'); await sleep(900);
  await expectFocus('韩信');
  await openCard(); await snap('02-card');

  // 3–7. 观点卡盖住整个手机画面，网站看不见；趁这时把卡片滚到“垓下之战”的链接，下一段直接点
  await mark('n03'); await snap('03');
  await mark('n04');
  await mark('n05');
  await mark('n06');
  await mark('n07');
  await sleep(300); await scrollCard('sel:[data-goe="gaixia"]', 600, 200); await snap('07-hidden');

  // 8. 观点卡淡出，点开事件“垓下之战”，卡片滚到“据《史记·高祖本纪》，韩信率三十万人居中”
  await mark('n08');
  await sleep(450);
  await tapSel('#msheet [data-goe="gaixia"]'); await sleep(1000);
  await expectFocus('垓下');
  await openCard(); await sleep(200);
  await scrollCard('据《史记·高祖本纪》，韩信率', 1200, 30); await snap('08-gaixia');

  // 9. 聚焦刘邦：返回韩信，点关系图上的“汉高祖”，卡片滚到“韩信在北方攻取魏、赵、齐之后，局势才逐渐扭转”
  await mark('n09');
  await back('韩信'); await closeCard();
  await tapPerson('liu-bang'); await sleep(1000);
  await expectFocus('汉高祖');
  await openCard(); await sleep(200);
  await scrollCard('其间他在彭城大败', 1200, 30); await snap('09-liubang');

  // 10. 回到韩信的关系图：收起卡片，韩信、汉高祖、项羽同屏
  await mark('n10');
  await back('韩信'); await closeCard(); await sleep(400);
  {
    const [hx, lb, xy] = await bars(['han-xin', 'liu-bang', 'xiang-yu']);
    if (!lb || !xy) throw new Error('韩信的关系图上找不到汉高祖或项羽');
    const sheetTop = await page.evaluate(() => document.querySelector('#msheet').getBoundingClientRect().top);
    const vis = r => r && r.y > 120 && r.bottom < sheetTop - 10;
    if (!(vis(hx) && vis(lb) && vis(xy))) {
      // 三个人不全在屏幕上：以三人中间为中点，两指缩小，让三条都露出来
      const ys = [hx, lb, xy].filter(Boolean).map(r => r.y + r.height / 2), cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      await pinch(VW / 2, Math.min(Math.max(cy, 250), sheetTop - 150), 150, 90, 1100);
    } else {
      await pinch(VW / 2, (Math.min(hx.y, lb.y, xy.y) + Math.max(hx.bottom, lb.bottom, xy.bottom)) / 2, 90, 115, 1100);
    }
  }
  await sleep(300); await snap('10-sanren');
  {
    const r = await bars(['han-xin', 'liu-bang', 'xiang-yu']);
    const names = await page.evaluate(() => [...document.querySelectorAll('#mpeople text')].map(t => ({ t: t.textContent, y: t.getBoundingClientRect().y })).filter(x => x.y > 100 && x.y < 760).map(x => x.t));
    for (const n of ['韩信', '汉高祖', '项羽']) if (!names.some(t => t.includes(n))) console.log(`注意：关系图同屏那一幕看不到“${n}”的名字`, r);
  }

  // 11. 结尾卡（合成时盖在上面）
  await mark('n11');
  await mark(null);
}

/* ---------- 录像 ---------- */
const frames = STILL ? null : await startScreencast(cdp);
tl.t0 = Date.now();
try { await act(); } catch (e) { console.error('录制中断：', e.message); await page.screenshot({ path: path.join(OUT, 'stills', 'error.png') }); await browser.close(); server.close(); process.exit(1); }
const TOTAL = (Date.now() - tl.t0) / 1000;
if (!STILL) await cdp.send('Page.stopScreencast');
await browser.close(); server.close();
const marks = tl.marks, at = tl.at;

/* ---------- 各张底图：用浏览器画（1080×1920） ---------- */
// 录屏放在 (PX, PY)，大小 PW×PH；上方是标题和字幕
const PW = 700, PH = Math.round(PW * VH / VW), PX = (1080 - PW) / 2, PY = 1920 - PH - 50;
const KAI = "'STKaiti','KaiTi',serif";
const TITLE = `<div style="position:absolute;left:0;right:0;top:52px;text-align:center;font:700 38px 'Microsoft YaHei';letter-spacing:6px;color:#8a5a2b">峡谷之外 · 韩信</div>`;
const qr = await QRCode.toDataURL(URL_QR, { errorCorrectionLevel: 'Q', margin: 2, width: 720, color: { dark: '#1B2A31', light: '#FFFFFF' } });
const red = s => s.replace(/\//g, '<br>').replace(/【/g, '<b style="color:#C4472D">').replace(/】/g, '</b>');
const gold = s => s.replace(/\//g, '<br>').replace(/【/g, '<b style="color:#f2c96b;font-weight:700">').replace(/】/g, '</b>');
// 史书原文卡：盖在手机画面上半截（关系图那一块），下半截照常露出网站上的卡片
const quoteHtml = q => `<body style="background:transparent">
  <div style="position:absolute;left:60px;right:60px;top:${PY + 170}px;padding:40px 48px 46px;border-radius:26px;background:#fbf7ee;border:2px solid #d9cdb4;box-shadow:0 14px 40px rgba(27,42,49,.28)">
    <div style="font:700 30px 'Microsoft YaHei';letter-spacing:4px;color:#8a5a2b">${q.book}</div>
    <div style="margin-top:22px;font:400 62px/1.5 ${KAI};color:#1B2A31;letter-spacing:2px">${red(q.text)}</div>
  </div></body>`;
// 观点卡：深色整块，盖住整个手机画面和外框（上方的标题、字幕照常）；左上角注明出处。和米色的史书原文卡分开
const VT = 300, VB = 1880;   // 观点卡的上下沿
const viewBox = inner => `<body style="background:transparent;font-family:'Microsoft YaHei';color:#f1ece0">
  <div style="position:absolute;left:44px;right:44px;top:${VT}px;height:${VB - VT}px;border-radius:40px;background:#1f2e35;box-shadow:0 18px 50px rgba(27,42,49,.35)">
    <div style="position:absolute;left:44px;top:40px;padding:10px 26px;border-radius:40px;border:2px solid rgba(242,201,107,.65);font-size:32px;letter-spacing:2px;color:#f2c96b">据当年明月《明朝那些事儿》</div>
  </div>${inner}</body>`;
const at_ = (top, html, extra = '') => `<div style="position:absolute;left:44px;right:44px;top:${top}px;text-align:center;${extra}">${html}</div>`;
const itemBox = inner => `<body style="background:transparent;font-family:'Microsoft YaHei';color:#f1ece0">${inner}</body>`;
// “十万人”下面 3×3 的格子
const TILE_W = 270, TILE_H = 170, GAP = 40, GRID_TOP = 870;
const tileXY = i => [540 + ((i % 3) - 1) * (TILE_W + GAP) - TILE_W / 2, GRID_TOP + Math.floor(i / 3) * (TILE_H + GAP)];
const VIEW_HTML = {
  book: viewBox(at_(800, `<div style="font-size:56px;letter-spacing:12px;text-indent:12px;color:#f2c96b">当年明月</div>`)
    + at_(920, `<div style="font:700 108px ${KAI};letter-spacing:4px">《明朝那些事儿》</div>`)
    + at_(1110, `<div style="font-size:50px;letter-spacing:6px;color:#d9d2c0">第 2 部 · 第十四章</div><div style="margin-top:26px;font:700 76px ${KAI};letter-spacing:10px;text-indent:10px;color:#f2c96b">“土木堡”</div>`)),
  fight: viewBox(at_(1000, `<div style="font:700 150px ${KAI};letter-spacing:14px;text-indent:14px">两个人打架</div>`)),
  army: viewBox(at_(520, `<div style="font:700 170px ${KAI};letter-spacing:16px;text-indent:16px;color:#f2c96b">十万人</div>`)
    + at_(740, `<div style="font-size:48px;letter-spacing:6px;color:#d9d2c0">就有十万个脑子</div>`)
    + N05.map((_, i) => { const [x, y] = tileXY(i); return `<div style="position:absolute;left:${x}px;top:${y}px;width:${TILE_W}px;height:${TILE_H}px;border-radius:22px;border:2px dashed rgba(241,236,224,.16)"></div>`; }).join('')),
  scale: viewBox(''),
};
const ITEM_HTML = {
  ...Object.fromEntries(N05.map(([w], i) => { const [x, y] = tileXY(i); return ['i' + i, itemBox(
    `<div style="position:absolute;left:${x}px;top:${y}px;width:${TILE_W}px;height:${TILE_H}px;border-radius:22px;background:#2d424b;border:3px solid rgba(242,201,107,.8);box-sizing:border-box;display:flex;align-items:center;justify-content:center;font:700 78px ${KAI};letter-spacing:6px;text-indent:6px">${w}</div>`)]; })),
  x10: itemBox(at_(520, `<div style="white-space:nowrap"><span style="font:700 84px ${KAI}">人数</span><span style="font:700 72px 'Microsoft YaHei'"> ×10</span><span style="margin:0 30px;font-size:64px;color:#d9d2c0">→</span><span style="font:700 92px ${KAI};color:#f2c96b">麻烦</span><span style="font:700 80px 'Microsoft YaHei';color:#f2c96b"> ×100</span></div>`)),
  qian: itemBox(at_(860, `<div style="font-size:46px;letter-spacing:3px;color:#d9d2c0">韩信之后一千多年，真能做到多多益善的</div>`)),
  yuan: itemBox(at_(950, `<div style="white-space:nowrap;font:700 86px ${KAI};color:#f2c96b">“${ORIGINAL}”</div>`)),
  tongchou: itemBox(at_(1300, `<div style="font-size:60px;letter-spacing:4px">${gold('比的不是力气，是【统筹】')}</div>`)),
  yigeren: itemBox(at_(1440, `<div style="font:700 84px/1.45 ${KAI};letter-spacing:6px;text-indent:6px">${gold('把几十万人，/指挥得像【一个人】')}</div>`)),
};
// 系列标题（第一屏和开头同一位置，第一屏淡入开头时不重影）：样式同韩信“胯下之辱”一篇（项目方 2026-11-28 要求加大、“真实历史”更明显）
const SERIES = `<div style="position:absolute;left:0;right:0;top:92px;text-align:center;font-family:${KAI};color:#e8dcc0;letter-spacing:8px;text-indent:8px;white-space:nowrap;text-shadow:0 4px 20px rgba(0,0,0,.6)">`
  + `<span style="font-size:84px">峡谷之外的</span><span style="font-size:112px;font-weight:700;color:#f2c96b">真实历史</span></div>`;
const pages = {
  // 第一屏（成片第一帧，也是平台上的预览图）：照制作标准的标题画面（版式同韩信“胯下之辱”一篇）。竖版图居中，同一造型的横版图模糊垫底；
  // 大标题分两行：“多多益善 / 兵越多，越难带”，后一行金色
  cover: `<body style="background:#0d1216;color:#fff;font-family:'Microsoft YaHei'">
    <img src="${dataUrl(IMG)}" style="position:absolute;left:-1000px;top:0;height:1920px;filter:blur(30px) brightness(.55) saturate(.8)">
    <img src="${dataUrl(IMG_V)}" style="position:absolute;left:0;top:300px;width:1080px;
      -webkit-mask-image:linear-gradient(transparent 0,rgba(0,0,0,.55) 110px,#000 300px,#000 900px,transparent 1300px)">
    <div style="position:absolute;left:0;right:0;top:0;height:520px;background:linear-gradient(rgba(13,18,22,.92) 0,rgba(13,18,22,.75) 200px,transparent)"></div>
    <div style="position:absolute;left:0;right:0;top:1100px;bottom:0;background:linear-gradient(transparent,rgba(13,18,22,.9) 300px,#0d1216 520px)"></div>
    ${SERIES}
    <div style="position:absolute;left:0;right:0;top:1340px;text-align:center;font:700 128px/1.22 ${KAI};letter-spacing:8px;text-indent:8px;text-shadow:0 6px 30px rgba(0,0,0,.7)">多多益善<br><span style="color:#f2c96b">兵越多，越难带</span></div>
    <div style="position:absolute;left:0;right:0;top:1720px;text-align:center;font-size:36px;letter-spacing:10px;text-indent:10px;color:rgba(241,236,224,.75)">韩信</div>
    <div style="position:absolute;right:30px;bottom:30px;font-size:24px;color:rgba(241,236,224,.7)">${CREDIT}</div>
  </body>`,
  // 手机外框（中间挖空放录屏）
  frame: `<body style="background:transparent">
    <div style="position:absolute;left:${PX - 16}px;top:${PY - 16}px;width:${PW + 32}px;height:${PH + 32}px;border-radius:64px;
      box-shadow:0 0 0 2000px ${PAPER};border:16px solid #1b2a31;box-sizing:border-box"></div>${TITLE}</body>`,
  // 开头：盖在游戏图片上的字（系列名、这一集的标题、图片出处）；图片本身在合成时放到 y=330–1530
  intro: `<body style="background:transparent;color:#fff;font-family:'Microsoft YaHei'">
    <div style="position:absolute;left:0;right:0;top:330px;height:90px;background:linear-gradient(#0d1216,transparent)"></div>
    <div style="position:absolute;left:0;right:0;top:1370px;height:160px;background:linear-gradient(transparent,#0d1216)"></div>
    ${SERIES}
    <div style="position:absolute;left:0;right:0;top:256px;text-align:center;font:700 46px ${KAI};letter-spacing:6px;text-indent:6px;color:#f1ece0;text-shadow:0 3px 14px rgba(0,0,0,.6)">韩信：多多益善，兵越多，越难带</div>
    <div style="position:absolute;left:36px;top:1466px;padding:8px 18px;border-radius:8px;background:rgba(0,0,0,.55);font-size:28px;letter-spacing:1px;color:#f1ece0">${CREDIT}</div>
  </body>`,
  // 结尾卡：二维码、网址；最下面小字是核实过的史料和观点的出处（只显示、不念）
  end: `<body style="background:${PAPER};font-family:'Microsoft YaHei';color:#1B2A31">${TITLE}
    <div style="position:absolute;left:0;right:0;top:${PY - 60}px;display:flex;flex-direction:column;align-items:center">
      <div style="width:340px;height:690px;border-radius:48px;background:#1B2A31;padding:13px;box-sizing:border-box;box-shadow:0 26px 60px rgba(27,42,49,.3)">
        <img src="${dataUrl(path.join(OUT, 'focus.png'))}" style="width:100%;height:100%;object-fit:cover;object-position:top;border-radius:36px;display:block"></div>
      <div style="margin-top:30px;font:400 108px ${KAI};letter-spacing:.14em;margin-right:-.14em;line-height:1.1">历史长河</div>
      <div style="margin-top:8px;font-size:36px;color:#55676C;letter-spacing:.1em">一张图，看懂各国历史</div>
      <div style="display:flex;align-items:center;gap:36px;margin-top:30px">
        <div style="width:250px;height:250px;padding:10px;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(27,42,49,.18);box-sizing:border-box"><img src="${qr}" style="width:100%;height:100%;display:block"></div>
        <div style="font-size:50px;font-weight:700">${URL_SHOW}<div style="margin-top:14px;font-size:30px;font-weight:400;color:#55676C;letter-spacing:.06em">扫码看韩信的关系图</div>
          <div style="display:inline-block;margin-top:20px;padding:8px 22px;border-radius:40px;background:#C4472D;color:#fff;font-size:26px;font-weight:400;letter-spacing:.08em">电脑手机都能看 · 免费开放</div></div>
      </div>
    </div>
    <div style="position:absolute;left:50px;right:50px;bottom:34px;text-align:center;font-size:26px;line-height:1.5;color:#5f6c6f">${SOURCES}</div>
  </body>`,
};
QUOTES.forEach((q, i) => { pages['quote' + i] = quoteHtml(q); });
for (const v of VIEWS) pages['view-' + v.id] = VIEW_HTML[v.id];
for (const x of ITEMS) pages['item-' + x.id] = ITEM_HTML[x.id];
await renderPages(pages, OUT, ['end', 'cover']);
if (STILL) {
  // 观点卡每张 view 叠上它的全部项目，另存一张看全貌
  const b = path.join(OUT, 'stills');
  for (const v of VIEWS) {
    const its = ITEMS.filter(x => x.view === v.id);
    const ins = [path.join(OUT, 'view-' + v.id + '.png'), ...its.map(x => path.join(OUT, 'item-' + x.id + '.png'))];
    let f = `color=c=0x${PAPER.slice(1)}:s=1080x1920[bg];[bg][0:v]overlay`;
    its.forEach((_, i) => { f += `[s${i}];[s${i}][${i + 1}:v]overlay`; });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...ins.flatMap(x => ['-i', x]), '-filter_complex', f, '-frames:v', '1', path.join(b, 'view-' + v.id + '-full.png')]);
  }
  console.log('截图在', b, '；底图、文字卡在', OUT); process.exit(0);
}

console.log(`录制 ${TOTAL.toFixed(1)}s，${frames.length} 帧`);
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ total: TOTAL, marks }, null, 1));
framesToVideo(frames, TOTAL, WORK, 'phone.mp4');

/* ---------- 开头的游戏图片：模糊的同一张图垫底，中间是人物，缓慢推近（裁切位置同韩信第一篇） ---------- */
const introLen = at('n02') + 0.6, N = Math.round(introLen * 30);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', introLen.toFixed(3), '-i', IMG, '-i', path.join(OUT, 'intro.png'), '-filter_complex',
  `[0:v]split[a][b];[a]scale=-2:1920,crop=1080:1920,boxblur=26:4,eq=brightness=-0.3:saturation=0.75[bg];`
  + `[b]crop=794:882:840:0,scale=3176:3528:flags=lanczos,zoompan=z='1+0.1*on/${N}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1200:fps=30[fg];`
  + `[bg][fg]overlay=0:330[c];[c][1:v]overlay=0:0,format=yuv420p`,
  '-t', introLen.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', path.join(WORK, 'intro.mp4')]);

/* ---------- 字幕 ---------- */
writeSubs({ marks, shot: SHOT, vo: VO, voiceDir: VOICE, total: TOTAL, outDir: OUT, introId: 'n01' });

/* ---------- 各层文字卡的出现、消失时间 ---------- */
// 每一层：png、a 开始淡入、fin 淡入秒数、o 开始淡出、fout 淡出秒数
const tOf = ([id, snip]) => (snip ? at(id) + VOLEAD + VO[id].dur * fracBefore(SHOT[id].say, snip) - 0.15 : at(id));
const layers = [];
QUOTES.forEach((q, i) => {
  const a = tOf(q.on), nx = QUOTES[i + 1];
  const cross = !q.off && !!nx;   // 紧接着下一张：在下一张淡入的同时淡出（两张卡高矮不一，不淡出的话旧卡的下沿会露出来）
  const b = q.off ? at(q.off) - 0.1 : nx ? tOf(nx.on) : at('n11') - 0.1;
  layers.push({ png: `quote${i}.png`, a, fin: 0.3, o: cross ? b : b - 0.3, fout: 0.3, log: `${q.book}  ${q.text.replace(/[/【】]/g, '')}` });
});
const vEnd = at(VIEW_END) - 0.05;
VIEWS.forEach((v, i) => {
  const a = tOf(v.on), nx = VIEWS[i + 1], b = nx ? tOf(nx.on) : vEnd;
  const o = nx ? b : b, fout = nx ? 0.35 : 0.4;   // 换下一张时交叉淡出；最后一张在“垓下”一段开始时淡出
  layers.push({ png: `view-${v.id}.png`, a, fin: i ? 0.35 : 0.4, o, fout, log: `观点卡 ${v.id}` });
  for (const x of ITEMS.filter(x => x.view === v.id)) layers.push({ png: `item-${x.id}.png`, a: tOf(x.on), fin: 0.25, o, fout, log: `  ${x.id}` });
});
layers.sort((p, q) => p.a - q.a);
fs.writeFileSync(path.join(OUT, 'quotes.txt'), layers.map(l => `${l.a.toFixed(2)} → ${(l.o + l.fout).toFixed(2)}  ${l.log}`).join('\n'));

/* ---------- 合成 ---------- */
// 输入：0 底色，1 录屏，2 外框，3 开头，4 结尾卡，5… 各层文字卡，再后是旁白，最后是音乐
const T = TOTAL.toFixed(3), tEnd = at('n11') - 0.1, tIntro = at('n02') - 0.15;
const args = ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0x${PAPER.slice(1)}:s=1080x1920:r=30:d=${T}`, '-i', path.join(WORK, 'phone.mp4'), '-i', 'frame.png', '-i', path.join(WORK, 'intro.mp4'),
  '-loop', '1', '-framerate', '30', '-t', T, '-i', 'end.png'];
// 每一层只在自己出现的那几秒里解码（-ss/-t 加 setpts 对回总时间轴），省得几十张整片长的图一起跑
layers.forEach(l => args.push('-loop', '1', '-framerate', '30', '-t', (l.o + l.fout - l.a + 0.2).toFixed(3), '-i', l.png));
const Q0 = 5, A0 = Q0 + layers.length;
marks.forEach(m => args.push('-i', path.join(VOICE, VO[m.id].file)));
if (MUSIC) args.push('-i', path.resolve(MUSIC));
let vf = `[1:v]scale=${PW}:${PH}:flags=lanczos[ph];[0:v][ph]overlay=${PX}:${PY}[a];[a][2:v]overlay=0:0[b];`
  + `[3:v]format=rgba,fade=out:st=${tIntro.toFixed(3)}:d=0.45:alpha=1[in];[b][in]overlay=0:0:eof_action=pass[q0];`;
layers.forEach((l, i) => {
  vf += `[${Q0 + i}:v]format=rgba,setpts=PTS+${l.a.toFixed(3)}/TB,fade=in:st=${l.a.toFixed(3)}:d=${l.fin}:alpha=1,fade=out:st=${l.o.toFixed(3)}:d=${l.fout}:alpha=1[qq${i}];`
    + `[q${i}][qq${i}]overlay=0:0:eof_action=pass:enable='between(t,${l.a.toFixed(3)},${(l.o + l.fout).toFixed(3)})'[q${i + 1}];`;
});
vf += `[4:v]format=rgba,fade=in:st=${tEnd.toFixed(3)}:d=0.5:alpha=1[end];[q${layers.length}][end]overlay=0:0,subtitles=subs.ass,`
  + `fade=out:st=${(TOTAL - 0.8).toFixed(3)}:d=0.8,format=yuv420p[v]`;
// 旁白：每段在字幕出现后 VOLEAD 秒开始；音乐压低，有人声时再自动让一让（sidechain）
const vo = marks.map((m, i) => `[${A0 + i}:a]aresample=48000,adelay=${Math.round((m.at + VOLEAD) * 1000)}:all=1[v${i}]`);
let af = `;${vo.join(';')};${marks.map((_, i) => `[v${i}]`).join('')}amix=inputs=${marks.length}:normalize=0,apad,atrim=0:${T},asplit=2[narr][key]`;
if (MUSIC) {
  const mi = A0 + marks.length;
  af += `;[${mi}:a]aresample=48000,atrim=0:${T},volume=0.26,afade=in:st=0:d=1,afade=out:st=${(TOTAL - 2.5).toFixed(3)}:d=2.5[mu]`
    + `;[mu][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]`
    + `;[narr][duck]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11[au]`;
} else af += `;[narr]loudnorm=I=-15:TP=-1.5:LRA=11[au]`;
args.push('-filter_complex', vf + af, '-map', '[v]', '-map', '[au]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-t', T, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', path.join(WORK, 'body.mp4'));
execFileSync('ffmpeg', args, { cwd: OUT });

/* ---------- 第一屏 ---------- */
const FULL = prependCover({ outDir: OUT, coverPng: 'cover.png', body: path.join(WORK, 'body.mp4'), out: path.join(WORK, 'final.mp4'), total: TOTAL, cover: COVER_SEC });
copyChecked(path.join(WORK, 'final.mp4'), path.join(OUT, 'hanxin-duoduo.mp4'));
console.log('成片：', path.join(OUT, 'hanxin-duoduo.mp4'), FULL + 's');
