// 《峡谷之外》韩信“多多益善”一篇·横版（1920×1080）：内容、旁白、配音、史书原文卡、观点卡与竖版（hanxin-duoduo.mjs）相同，网站画面换成桌面版。
// 用法：node promo/heroes/hanxin-duoduo-h.mjs [--still] [--music <音乐文件>]
//   先做两件事：仓库根目录 npm run build；配音沿用竖版的（promo/out/heroes/007-hanxin-duoduo/voice/，见 hanxin-duoduo.yaml 开头）。
//   --still：不录像，每段结束截一张图到 promo/out/heroes/007-hanxin-duoduo/h/stills/，同时画出第一屏、文字卡、观点卡、结尾卡，用来检查位置。
// 成片：promo/out/heroes/007-hanxin-duoduo/hanxin-duoduo-h.mp4（不进仓库）；中间文件都在 promo/out/heroes/007-hanxin-duoduo/h/，不碰竖版的文件。
// 视频文件先在系统临时目录里生成，最后复制过来并整段解码检查（E 盘直接写会偶尔写坏，见 episode.mjs 的 checkVideo）。
// 做法同韩信“胯下之辱”一篇横版（hanxin-kuaxia-h.mjs）：桌面版网站、假鼠标、一镜到底，每段的长短跟着旁白走；游戏图片、文字卡、结尾卡是合成时盖上去的。
// 两种文字卡，样子分开（同竖版）：
//   1. 史书原文卡（浅米色，盖在左边的时间轴上，右边人物卡照常露出）：原文开录前对照 scripts.md 第七篇两张核实表。
//   2. 观点卡（深色整块，盖住整个网站画面，只留下方字幕；左上角注明“据当年明月《明朝那些事儿》”）：第 3–7 段。
//      卡上当年明月的原话只有“不会超过十五个人”一句，其余是定稿里的转述；开录前逐项对照 scripts.md 第七篇。仓库里不存他的原文。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import QRCode from 'qrcode';
import {
  HERE, PROMO, DIST, PAPER, CREDIT, VOLEAD, sleep, loadNarration, requireFiles, serveDist, openDesktop, DW as W, DH as H,
  makeTimeline, fracBefore, startScreencast, framesToVideo, renderPages, dataUrl, writeSubs, prependCover, copyChecked,
} from './episode.mjs';

const SRC = path.join(PROMO, 'out', 'heroes', '007-hanxin-duoduo');
const OUT = path.join(SRC, 'h');
const VOICE = path.join(SRC, 'voice');   // 竖版做好的配音，直接复用
const IMG = path.join(PROMO, 'out', 'heroes', 'img', '150-bigskin-1.jpg');   // 官方图片（默认造型，横版 1920×882），不进仓库
const FINAL = path.join(SRC, 'hanxin-duoduo-h.mp4');
const WORK = path.join(os.tmpdir(), 'xiagu-hanxin-duoduo-h');
const argv = process.argv.slice(2), STILL = argv.includes('--still');
const MUSIC = argv.includes('--music') ? argv[argv.indexOf('--music') + 1] : null;
const URL_QR = 'https://lishi.alz-ai.cn/zh/#person/han-xin', URL_SHOW = 'lishi.alz-ai.cn';
const COVER_SEC = 1.6;   // 第一屏停留秒数（含 0.4 秒淡入正片），同竖版
for (const d of [path.join(OUT, 'stills'), WORK]) fs.mkdirSync(d, { recursive: true });
requireFiles([IMG, path.join(VOICE, 'timing.json'), path.join(DIST, 'zh', 'index.html')], '见本文件开头的用法');

/* ---------- 旁白、第一屏、片尾小字：对照定稿（同竖版） ---------- */
const SHOTS = loadNarration(path.join(HERE, 'hanxin-duoduo.yaml'), '## 七、', 11);
const SEC = (() => { const md = fs.readFileSync(path.join(HERE, 'scripts.md'), 'utf8').replace(/\r\n/g, '\n'), i = md.indexOf('## 七、'); const j = md.indexOf('\n---', i); return md.slice(i, j < 0 ? undefined : j); })();
const [TITLE_ROW, SOURCES] = SEC.slice(0, SEC.indexOf('\n配地图：')).split('\n').filter(l => l.startsWith('|') && l.includes('不念')).map(l => l.split('|')[2].trim());
if (TITLE_ROW !== '峡谷之外的真实历史 / 多多益善 / 兵越多，越难带 / 韩信') { console.error('scripts.md 第七篇的第一屏文字变了，先改本脚本的第一屏'); process.exit(1); }
if (!SOURCES || !SOURCES.startsWith('史实核对自：')) { console.error('scripts.md 第七篇找不到结尾卡上的小字'); process.exit(1); }
const SHOT = Object.fromEntries(SHOTS.map(s => [s.id, s]));
const VO = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(VOICE, 'timing.json'), 'utf8')).shots.map(s => [s.id, s]));
for (const s of SHOTS) if (!VO[s.id]) { console.error('配音里缺少 ' + s.id + '，改了 hanxin-duoduo.yaml 要重新配音'); process.exit(1); }

/* ---------- 史书原文卡（同竖版；横版卡宽，换行的地方重新挑过） ---------- */
// 【】里的字用红色突出，/ 是手动换行；去掉【】和 / 后必须是核实表“原文”一栏里的原话，出处（src）也要对上
const LZ = '《史记》淮阴侯列传原文', GZ = '《史记》高祖本纪原文';
const QUOTES = [
  { on: ['n02', '韩信说'], book: LZ, src: '列传', text: '陛下不过能将【十万】' },
  { on: ['n02', '那你呢'], book: LZ, src: '列传', text: '臣【多多而益善】耳', off: 'n03' },
  { on: ['n08', '《史记》记载'], book: GZ, src: '《高祖本纪》', text: '淮阴侯将【三十万】自当之', off: 'n09' },
  { on: ['n09', '连百万'], book: GZ, src: '《高祖本纪》', text: '连百万之军，战必胜，攻必取，/【吾不如韩信】', off: 'n10' },
];
{
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

/* ---------- 观点卡（同竖版，据当年明月《明朝那些事儿》） ---------- */
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
  console.log(`观点卡 ${VIEWS.length} 张、跳出的项目 ${ITEMS.length} 个，字都在定稿里；原话只有“${ORIGINAL}”一句`);
}
const VIEW_END = 'n08';   // 观点卡在“垓下”这一段开始时淡出，露出网站

/* ---------- 打开网站（桌面版） ---------- */
const { server, base: BASE } = await serveDist();
const dk = await openDesktop();
const { browser, page, cdp, cursor, glide, click, clickSel, bar, wheel, link, scrollCard, pointAt, expectSel, type } = dk;

// 结尾卡里的电脑画面：韩信的关系图（先截下来，再回到首页开始录）
await page.goto(BASE + '/zh/#person/han-xin', { waitUntil: 'networkidle' });
await page.waitForSelector('#river [data-p="han-xin"]', { timeout: 15000 });
await sleep(1500);
await cursor(false);
await page.screenshot({ path: path.join(OUT, 'focus.png') });
await page.goto('about:blank');
await page.goto(BASE + '/zh/', { waitUntil: 'networkidle' });
await page.waitForSelector('#river g', { timeout: 15000 });
await sleep(1500);
await cursor(false);

const tl = makeTimeline({ shot: SHOT, vo: VO, still: STILL, stillDir: path.join(OUT, 'stills'), page });
const { mark, snap } = tl;
// 从事件卡、别人的卡片返回韩信：卡片回到开头，点左上角“返回”
async function back(id) {
  await scrollCard(null, 300); await sleep(100);
  await clickSel('#detail .d-back', 50, 500); await sleep(750);
  await expectSel('person/' + id);
}
// 时间轴上点某人的生卒条（露在外面的那一段靠左处）
async function clickBar(id, ms = 900) {
  const b = await bar(id); if (b.x2 - b.x1 < 40) throw new Error(id + ' 的生卒条在屏幕外');
  await click(b.x1 + Math.min(80, (b.x2 - b.x1) / 2), b.y, ms); await sleep(800);
  await expectSel('person/' + id);
}

async function act() {
  // 1. 游戏图片（合成时盖在上面），网站停在全貌
  await mark('n01');

  // 2. 搜索“韩信”，点第一条：时间轴飞到秦汉之际，右边出人物卡（两张原文卡盖在左边的时间轴上）
  await mark('n02');
  await cursor(true); await sleep(200);
  await clickSel('#find', null, 600); await sleep(300);
  await type('韩信', 180);
  await sleep(350); await snap('02a-search');
  await clickSel('.search .s-row[data-id="han-xin"]', 110, 450); await sleep(1100);
  await expectSel('person/han-xin');
  await dk.measure();
  await sleep(200); await pointAt('定魏、赵、齐', 900); await snap('02-card');

  // 3–7. 观点卡盖住整个画面，网站看不见；趁这时把卡片滚到“垓下之战”的链接，鼠标藏起来
  await mark('n03'); await snap('03');
  await mark('n04');
  await mark('n05');
  await mark('n06');
  await mark('n07');
  await sleep(300); await cursor(false);
  await scrollCard('sel:[data-goe="gaixia"]', 600, 380); await snap('07-hidden');

  // 8. 观点卡淡出，点开事件“垓下之战”，卡片滚到“据《史记·高祖本纪》，韩信率三十万人居中”，鼠标指着
  await mark('n08');
  await sleep(450); await cursor(true);
  await clickSel('#detail [data-goe="gaixia"]', 90, 600); await sleep(750);
  await expectSel('event/gaixia');
  await sleep(200); await scrollCard('据《史记·高祖本纪》，韩信率', 1100, 60);
  await pointAt('韩信率三十万人居中', 700); await snap('08-gaixia');

  // 9. 刘邦：返回韩信，在时间轴上点“汉高祖”，卡片滚到“韩信在北方攻取魏、赵、齐之后，局势才逐渐扭转”
  await mark('n09');
  await back('han-xin');
  await clickBar('liu-bang', 800);
  await sleep(200); await scrollCard('其间他在彭城大败', 1100, 60);
  await pointAt('韩信在北方攻取魏、赵、齐之后', 700); await snap('09-liubang');

  // 10. 点回韩信：时间轴上韩信、汉高祖、项羽同屏，连线都连在他身上；滚轮放大，鼠标先指汉高祖那条线，再移到项羽那条线
  await mark('n10');
  await sleep(150);
  await clickBar('han-xin', 800);
  { const a = await link('liu-bang'), b = await link('xiang-yu');
    await glide((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 800); await sleep(150); await wheel(-160, 1100); }
  await sleep(150);
  { const a = await link('liu-bang'); await glide(a[0], a[1], 700); }
  await sleep(500);
  { const b = await link('xiang-yu'); await glide(b[0], b[1], 800); }
  {
    const r = await Promise.all(['han-xin', 'liu-bang', 'xiang-yu'].map(id => bar(id)));
    r.forEach((b, i) => { if (b.x2 - b.x1 < 60 || b.y < 120 || b.y > H - 60) console.log('注意：同屏那一幕', ['韩信', '汉高祖', '项羽'][i], '露得不全', b); });
  }
  await snap('10-sanren');

  // 11. 结尾卡（合成时盖在上面）
  await mark('n11');
  await mark(null);
}

/* ---------- 录像 ---------- */
const frames = STILL ? null : await startScreencast(cdp, W, H);
tl.t0 = Date.now();
try { await act(); } catch (e) { console.error('录制中断：', e.message); await page.screenshot({ path: path.join(OUT, 'stills', 'error.png') }); await browser.close(); server.close(); process.exit(1); }
const TOTAL = (Date.now() - tl.t0) / 1000;
if (!STILL) await cdp.send('Page.stopScreencast');
await browser.close(); server.close();
const marks = tl.marks, at = tl.at;

/* ---------- 各张底图：用浏览器画（1920×1080） ---------- */
// 官方横版图 1920×882，放大到 1080 高（2351 宽），左移 IMGX（同韩信“胯下之辱”横版）：人物的脸在画面偏右，左边压暗放字
const IMGX = 230, IMGW = Math.round(1920 * H / 882), DX = dk.detailX;
const KAI = "'STKaiti','KaiTi',serif";
const qr = await QRCode.toDataURL(URL_QR, { errorCorrectionLevel: 'Q', margin: 2, width: 720, color: { dark: '#1B2A31', light: '#FFFFFF' } });
const SHADE = `<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,18,22,.94) 0,rgba(13,18,22,.8) 36%,rgba(13,18,22,0) 62%)"></div>`;
// 系列标题——“朱红印章”刊头（同韩信“胯下之辱”横版，项目方 2026-11-28 选定）
const SERIF = "'Noto Serif SC','Source Han Serif SC','SimSun',serif";
const SERIES = `<div style="position:absolute;left:108px;top:128px;display:flex;align-items:center;font-family:${SERIF};white-space:nowrap">`
  + `<span style="font-size:58px;font-weight:500;letter-spacing:12px;color:#e8dcc0;text-shadow:0 4px 16px rgba(0,0,0,.6)">峡谷之外的</span>`
  + `<span style="margin-left:8px;padding:6px 10px 8px 22px;background:#b3392b;border-radius:4px;font-size:62px;font-weight:900;letter-spacing:12px;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.35)">真实历史</span></div>`;
const CREDIT_TAG = `<div style="position:absolute;right:30px;bottom:24px;font-size:24px;letter-spacing:1px;color:rgba(241,236,224,.85)">${CREDIT}</div>`;
const red = s => s.replace(/\//g, '<br>').replace(/【/g, '<b style="color:#C4472D">').replace(/】/g, '</b>');
const gold = s => s.replace(/\//g, '<br>').replace(/【/g, '<b style="color:#f2c96b;font-weight:700">').replace(/】/g, '</b>');
// 史书原文卡：盖在左边的时间轴上（顶栏、右边的人物卡照常露出），底下留给字幕
const quoteHtml = q => `<body style="background:transparent">
  <div style="position:absolute;left:90px;width:${DX - 180}px;top:${q.top || 200}px;box-sizing:border-box;padding:46px 60px 54px;border-radius:26px;background:#fbf7ee;border:2px solid #d9cdb4;box-shadow:0 14px 40px rgba(27,42,49,.28)">
    <div style="font:700 32px 'Microsoft YaHei';letter-spacing:4px;color:#8a5a2b">${q.book}</div>
    <div style="margin-top:26px;font:400 70px/1.55 ${KAI};color:#1B2A31;letter-spacing:3px">${red(q.text)}</div>
  </div></body>`;
// 观点卡：深色整块，盖住整个网站画面（下方留给字幕）；左上角注明出处。和米色的史书原文卡分开
const VL = 60, VR = 60, VT = 50, VB = 930;
const viewBox = inner => `<body style="background:transparent;font-family:'Microsoft YaHei';color:#f1ece0">
  <div style="position:absolute;left:${VL}px;right:${VR}px;top:${VT}px;height:${VB - VT}px;border-radius:36px;background:#1f2e35;box-shadow:0 18px 50px rgba(27,42,49,.35)">
    <div style="position:absolute;left:44px;top:36px;padding:10px 26px;border-radius:40px;border:2px solid rgba(242,201,107,.65);font-size:32px;letter-spacing:2px;color:#f2c96b">据当年明月《明朝那些事儿》</div>
  </div>${inner}</body>`;
// 居中的一行（left/right 可另给，用来放在左半或右半）
const at_ = (top, html, l = VL, r = VR) => `<div style="position:absolute;left:${l}px;right:${r}px;top:${top}px;text-align:center">${html}</div>`;
const itemBox = inner => `<body style="background:transparent;font-family:'Microsoft YaHei';color:#f1ece0">${inner}</body>`;
// “十万人”在左半，右半是 3×3 的格子
const TILE_W = 290, TILE_H = 172, GAP = 36, GRID_CX = 1350, GRID_TOP = 196;
const tileXY = i => [GRID_CX + ((i % 3) - 1) * (TILE_W + GAP) - TILE_W / 2, GRID_TOP + Math.floor(i / 3) * (TILE_H + GAP)];
const VIEW_HTML = {
  book: viewBox(at_(250, `<div style="font-size:56px;letter-spacing:12px;text-indent:12px;color:#f2c96b">当年明月</div>`)
    + at_(350, `<div style="font:700 124px ${KAI};letter-spacing:6px">《明朝那些事儿》</div>`)
    + at_(560, `<div style="font-size:50px;letter-spacing:6px;color:#d9d2c0">第 2 部 · 第十四章</div><div style="margin-top:22px;font:700 80px ${KAI};letter-spacing:10px;text-indent:10px;color:#f2c96b">“土木堡”</div>`)),
  fight: viewBox(at_(380, `<div style="font:700 180px ${KAI};letter-spacing:18px;text-indent:18px">两个人打架</div>`)),
  army: viewBox(at_(300, `<div style="font:700 180px ${KAI};letter-spacing:16px;text-indent:16px;color:#f2c96b">十万人</div>`, VL, 1920 - 860)
    + at_(540, `<div style="font-size:50px;letter-spacing:6px;color:#d9d2c0">就有十万个脑子</div>`, VL, 1920 - 860)
    + N05.map((_, i) => { const [x, y] = tileXY(i); return `<div style="position:absolute;left:${x}px;top:${y}px;width:${TILE_W}px;height:${TILE_H}px;border-radius:22px;border:2px dashed rgba(241,236,224,.16)"></div>`; }).join('')),
  scale: viewBox(''),
};
const ITEM_HTML = {
  ...Object.fromEntries(N05.map(([w], i) => { const [x, y] = tileXY(i); return ['i' + i, itemBox(
    `<div style="position:absolute;left:${x}px;top:${y}px;width:${TILE_W}px;height:${TILE_H}px;border-radius:22px;background:#2d424b;border:3px solid rgba(242,201,107,.8);box-sizing:border-box;display:flex;align-items:center;justify-content:center;font:700 80px ${KAI};letter-spacing:6px;text-indent:6px">${w}</div>`)]; })),
  x10: itemBox(at_(150, `<div style="white-space:nowrap"><span style="font:700 92px ${KAI}">人数</span><span style="font:700 80px 'Microsoft YaHei'"> ×10</span><span style="margin:0 40px;font-size:72px;color:#d9d2c0">→</span><span style="font:700 100px ${KAI};color:#f2c96b">麻烦</span><span style="font:700 88px 'Microsoft YaHei';color:#f2c96b"> ×100</span></div>`)),
  qian: itemBox(at_(345, `<div style="font-size:48px;letter-spacing:4px;color:#d9d2c0">韩信之后一千多年，真能做到多多益善的</div>`)),
  yuan: itemBox(at_(420, `<div style="white-space:nowrap;font:700 100px ${KAI};color:#f2c96b">“${ORIGINAL}”</div>`)),
  tongchou: itemBox(at_(630, `<div style="font-size:60px;letter-spacing:4px">${gold('比的不是力气，是【统筹】')}</div>`)),
  yigeren: itemBox(at_(740, `<div style="white-space:nowrap;font:700 88px ${KAI};letter-spacing:6px;text-indent:6px">${gold('把几十万人，指挥得像【一个人】')}</div>`)),
};
const pages = {
  // 第一屏：照韩信“胯下之辱”横版。横图铺满，人物偏右，左边压暗放字；大标题分两行“多多益善 / 兵越多，越难带”，后一行金色（同竖版）
  cover: `<body style="background:#0d1216;color:#fff;font-family:'Microsoft YaHei';overflow:hidden">
    <img src="${dataUrl(IMG)}" style="position:absolute;left:-${IMGX}px;top:0;height:${H}px">${SHADE}
    ${SERIES}
    <div style="position:absolute;left:100px;top:330px;font:700 124px/1.24 ${KAI};letter-spacing:10px;text-shadow:0 6px 30px rgba(0,0,0,.7)">多多益善<br><span style="color:#f2c96b">兵越多，越难带</span></div>
    <div style="position:absolute;left:112px;top:680px;font-size:36px;letter-spacing:10px;color:rgba(241,236,224,.75)">韩信</div>
    ${CREDIT_TAG}
  </body>`,
  // 开头：盖在推近的游戏图片上的字。系列标题、出处和第一屏同一位置；大字换成一行集标题，下方留给第一句旁白的字幕
  intro: `<body style="background:transparent;color:#fff;font-family:'Microsoft YaHei'">${SHADE}
    <div style="position:absolute;left:0;right:0;bottom:0;height:260px;background:linear-gradient(transparent,rgba(13,18,22,.8))"></div>
    ${SERIES}
    <div style="position:absolute;left:110px;top:262px;font:700 52px ${KAI};letter-spacing:6px;color:#f1ece0;text-shadow:0 3px 14px rgba(0,0,0,.6)">韩信：多多益善，兵越多，越难带</div>
    ${CREDIT_TAG}
  </body>`,
  // 结尾卡：左边电脑画面（韩信的关系图），右边二维码和网址；下面小字是核实过的史料和观点出处（只显示、不念）
  end: `<body style="background:radial-gradient(circle at 30% 40%,#f7f3ea 0,${PAPER} 55%,#e4dccb 100%);font-family:'Microsoft YaHei';color:#1B2A31">
    <div style="position:absolute;left:0;right:0;top:44px;text-align:center;font:700 34px 'Microsoft YaHei';letter-spacing:6px;color:#8a5a2b">峡谷之外 · 韩信</div>
    <div style="position:absolute;left:110px;top:150px;width:900px;height:506px;padding:14px;border-radius:22px;background:#1B2A31;box-shadow:0 26px 60px rgba(27,42,49,.3)">
      <img src="${dataUrl(path.join(OUT, 'focus.png'))}" style="width:100%;height:100%;display:block;border-radius:10px"></div>
    <div style="position:absolute;left:500px;top:684px;width:120px;height:26px;background:#1B2A31;border-radius:0 0 8px 8px"></div>
    <div style="position:absolute;left:1110px;top:150px">
      <div style="font:400 112px ${KAI};letter-spacing:.14em;line-height:1.1">历史长河</div>
      <div style="margin-top:10px;font-size:36px;color:#55676C;letter-spacing:.1em">一张图，看懂各国历史</div>
      <div style="display:flex;align-items:center;gap:36px;margin-top:40px">
        <div style="width:250px;height:250px;padding:10px;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(27,42,49,.18);box-sizing:border-box"><img src="${qr}" style="width:100%;height:100%;display:block"></div>
        <div style="font-size:50px;font-weight:700">${URL_SHOW}<div style="margin-top:14px;font-size:30px;font-weight:400;color:#55676C;letter-spacing:.06em">扫码看韩信的关系图</div>
          <div style="display:inline-block;margin-top:20px;padding:8px 22px;border-radius:40px;background:#C4472D;color:#fff;font-size:26px;font-weight:400;letter-spacing:.08em">电脑手机都能看 · 免费开放</div></div>
      </div>
    </div>
    <div style="position:absolute;left:60px;right:60px;top:790px;text-align:center;font-size:26px;line-height:1.5;color:#5f6c6f">${SOURCES}</div>
  </body>`,
};
QUOTES.forEach((q, i) => { pages['quote' + i] = quoteHtml(q); });
for (const v of VIEWS) pages['view-' + v.id] = VIEW_HTML[v.id];
for (const x of ITEMS) pages['item-' + x.id] = ITEM_HTML[x.id];
await renderPages(pages, OUT, ['end', 'cover'], W, H);
if (STILL) {
  // 观点卡每张 view 叠上它的全部项目，另存一张看全貌（底下垫一张网站截图）
  const b = path.join(OUT, 'stills'), base = path.join(b, '02-card.png');
  for (const v of VIEWS) {
    const its = ITEMS.filter(x => x.view === v.id);
    const ins = [base, path.join(OUT, 'view-' + v.id + '.png'), ...its.map(x => path.join(OUT, 'item-' + x.id + '.png'))];
    let f = '[0:v][1:v]overlay';
    its.forEach((_, i) => { f += `[s${i}];[s${i}][${i + 2}:v]overlay`; });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...ins.flatMap(x => ['-i', x]), '-filter_complex', f, '-frames:v', '1', path.join(b, 'view-' + v.id + '-full.png')]);
  }
  for (const [i, s] of [[0, '02-card'], [2, '08-gaixia'], [3, '09-liubang']]) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(b, s + '.png'), '-i', path.join(OUT, `quote${i}.png`), '-filter_complex', 'overlay', '-frames:v', '1', path.join(b, s + '-quote.png')]);
  }
  console.log('截图在', b, '；底图、文字卡在', OUT); process.exit(0);
}

console.log(`录制 ${TOTAL.toFixed(1)}s，${frames.length} 帧`);
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ total: TOTAL, marks }, null, 1));
framesToVideo(frames, TOTAL, WORK, 'screen.mp4', W, H);

/* ---------- 开头的游戏图片：铺满画面（位置同第一屏），朝人物的脸缓慢推近（同韩信“胯下之辱”横版） ---------- */
const introLen = at('n02') + 0.6, N = Math.round(introLen * 30);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', introLen.toFixed(3), '-i', IMG, '-i', path.join(OUT, 'intro.png'), '-filter_complex',
  `[0:v]scale=${IMGW}:${H}:flags=lanczos,crop=${W}:${H}:${IMGX}:0,scale=${W * 2}:${H * 2}:flags=lanczos,`
  + `zoompan=z='1+0.08*on/${N}':x='iw*0.66-(iw/zoom*0.66)':y='ih*0.3-(ih/zoom*0.3)':d=1:s=${W}x${H}:fps=30[fg];`
  + `[fg][1:v]overlay=0:0,format=yuv420p`,
  '-t', introLen.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', path.join(WORK, 'intro.mp4')]);

/* ---------- 字幕：断句和对时同竖版；横版放在画面下方正中 ---------- */
writeSubs({ marks, shot: SHOT, vo: VO, voiceDir: VOICE, total: TOTAL, outDir: OUT, introId: 'n01', landscape: true });

/* ---------- 各层文字卡的出现、消失时间（同竖版） ---------- */
const tOf = ([id, snip]) => (snip ? at(id) + VOLEAD + VO[id].dur * fracBefore(SHOT[id].say, snip) - 0.15 : at(id));
const layers = [];
QUOTES.forEach((q, i) => {
  const a = tOf(q.on), nx = QUOTES[i + 1];
  const cross = !q.off && !!nx;
  const b = q.off ? at(q.off) - 0.1 : nx ? tOf(nx.on) : at('n11') - 0.1;
  layers.push({ png: `quote${i}.png`, a, fin: 0.3, o: cross ? b : b - 0.3, fout: 0.3, log: `${q.book}  ${q.text.replace(/[/【】]/g, '')}` });
});
const vEnd = at(VIEW_END) - 0.05;
VIEWS.forEach((v, i) => {
  const a = tOf(v.on), nx = VIEWS[i + 1], o = nx ? tOf(nx.on) : vEnd, fout = nx ? 0.35 : 0.4;
  layers.push({ png: `view-${v.id}.png`, a, fin: i ? 0.35 : 0.4, o, fout, log: `观点卡 ${v.id}` });
  for (const x of ITEMS.filter(x => x.view === v.id)) layers.push({ png: `item-${x.id}.png`, a: tOf(x.on), fin: 0.25, o, fout, log: `  ${x.id}` });
});
layers.sort((p, q) => p.a - q.a);
fs.writeFileSync(path.join(OUT, 'quotes.txt'), layers.map(l => `${l.a.toFixed(2)} → ${(l.o + l.fout).toFixed(2)}  ${l.log}`).join('\n'));

/* ---------- 合成 ---------- */
// 输入：0 录屏，1 开头，2 结尾卡，3… 各层文字卡，再后是旁白，最后是音乐
const T = TOTAL.toFixed(3), tEnd = at('n11') - 0.1, tIntro = at('n02') - 0.15;
const args = ['-y', '-loglevel', 'error', '-i', path.join(WORK, 'screen.mp4'), '-i', path.join(WORK, 'intro.mp4'),
  '-loop', '1', '-framerate', '30', '-t', T, '-i', 'end.png'];
// 每一层只在自己出现的那几秒里解码（setpts 对回总时间轴）
layers.forEach(l => args.push('-loop', '1', '-framerate', '30', '-t', (l.o + l.fout - l.a + 0.2).toFixed(3), '-i', l.png));
const Q0 = 3, A0 = Q0 + layers.length;
marks.forEach(m => args.push('-i', path.join(VOICE, VO[m.id].file)));
if (MUSIC) args.push('-i', path.resolve(MUSIC));
let vf = `[0:v]fps=30,format=yuv420p[a];`
  + `[1:v]format=rgba,fade=out:st=${tIntro.toFixed(3)}:d=0.45:alpha=1[in];[a][in]overlay=0:0:eof_action=pass[q0];`;
layers.forEach((l, i) => {
  vf += `[${Q0 + i}:v]format=rgba,setpts=PTS+${l.a.toFixed(3)}/TB,fade=in:st=${l.a.toFixed(3)}:d=${l.fin}:alpha=1,fade=out:st=${l.o.toFixed(3)}:d=${l.fout}:alpha=1[qq${i}];`
    + `[q${i}][qq${i}]overlay=0:0:eof_action=pass:enable='between(t,${l.a.toFixed(3)},${(l.o + l.fout).toFixed(3)})'[q${i + 1}];`;
});
vf += `[2:v]format=rgba,fade=in:st=${tEnd.toFixed(3)}:d=0.5:alpha=1[end];[q${layers.length}][end]overlay=0:0,subtitles=subs.ass,`
  + `fade=out:st=${(TOTAL - 0.8).toFixed(3)}:d=0.8,format=yuv420p[v]`;
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
copyChecked(path.join(WORK, 'final.mp4'), FINAL);
fs.rmSync(WORK, { recursive: true, force: true });
console.log('成片：', FINAL, FULL + 's');
