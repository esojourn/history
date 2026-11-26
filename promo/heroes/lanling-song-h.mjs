// 《峡谷之外》番外篇《番外 · 兰陵王入阵曲：一首军歌的千年漂流》·横版（1920×1080）：
//   内容、旁白、配音、音乐、史书原文卡、照片、《陵王》乐曲与竖版（lanling-song.mjs）相同，网站画面换成桌面版。
// 用法：node promo/heroes/lanling-song-h.mjs [--still] [--music <音乐文件>]
//   先做两件事：仓库根目录 npm run build；配音沿用竖版的（promo/out/heroes/005-lanling-song/voice/，见 lanling-song.yaml 开头）。
//   素材同竖版：乐曲录像在 promo/out/heroes/ia-ryoo/，照片在 promo/out/heroes/wm-lanling-song/（出处见 README 第五节）。
//   --still：不录像，每段结束截一张图到 promo/out/heroes/005-lanling-song/h/stills/，同时画出第一屏、文字卡、照片画面、结尾卡。
// 成片：promo/out/heroes/005-lanling-song/lanling-song-h.mp4（不进仓库）；中间文件都在 promo/out/heroes/005-lanling-song/h/，不碰竖版的文件。
// 视频文件先在系统临时目录里生成，最后复制过来并整段解码检查（E 盘直接写会偶尔写坏，见 episode.mjs 的 checkVideo）。
// 做法同兰陵王第二篇横版（lanling2-h.mjs）：桌面版网站、假鼠标、一镜到底；文字卡盖在左边的时间轴上，右边人物卡照常露出。
// 照片画面按横版重排：照片在左，说明、标签、二维码在右边一栏，字不压照片。旁白、原文都是定稿，这里只对照检查，不改。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import QRCode from 'qrcode';
import {
  HERE, PROMO, DIST, PAPER, CREDIT, VOLEAD, sleep, loadNarration, requireFiles, serveDist, openDesktop, DW as W, DH as H,
  makeTimeline, fracBefore, startScreencast, framesToVideo, renderPages, dataUrl, writeSubs, prependCover, copyChecked,
} from './episode.mjs';

const HEROES = path.join(PROMO, 'out', 'heroes');
const SRC = path.join(HEROES, '005-lanling-song');
const OUT = path.join(SRC, 'h');
const VOICE = path.join(SRC, 'voice');   // 竖版做好的配音，直接复用
const IMG = path.join(HEROES, 'img', '153-bigskin-1.jpg');   // 官方图片（默认造型，横版 1920×882），不进仓库
const FINAL = path.join(SRC, 'lanling-song-h.mp4');
const WORK = path.join(os.tmpdir(), 'xiagu-lanling-song-h');
// 《陵王》乐曲：同竖版（美国华盛顿大学民族音乐学档案馆 1967 年录像，Internet Archive wauem_1967009_gagaku），只取声音
const RYOO_SRC = path.join(HEROES, 'ia-ryoo', 'wauem_1967009_gagaku_Song01-03.mp4');
const RYOO_AT = 454, RYOO_LEN = 10.5, RYOO_GAP = 0.5;   // 从录像第 454 秒（7 分 34 秒）起取 10.5 秒；n10 念完后停 0.5 秒再放
const URL_SONG = 'https://archive.org/details/wauem_1967009_gagaku';
// 照片：同竖版，维基共享资源，作者和授权在画面上注明（README 第五节有表）
const WM = path.join(HEROES, 'wm-lanling-song');
const PHOTOS = {
  dance: { file: 'ryoo-hokkaido.jpg', what: '日本舞乐《陵王》 · 北海道护国神社祭奉纳（2010 年）', by: '摄影：由良和喜 · CC BY-SA 3.0 · 维基共享资源' },
  mask: { file: 'ryoo-mask-1211.jpg', what: '陵王面具，日本 1211 年制（真清田神社藏，重要文化财）', by: '摄影：Ihimutefu · CC BY-SA 4.0 · 维基共享资源' },
  stage: { file: 'ryoo-lee.jpg', what: '舞乐《陵王》（2007 年摄）', by: '摄影：lienyuan lee · CC BY 3.0 · 维基共享资源' },
  tomb: { file: 'tomb-01.jpg', what: '河北磁县兰陵王墓（2025 年摄）', by: '摄影：Windmemories · CC BY-SA 4.0 · 维基共享资源' },
};
const argv = process.argv.slice(2), STILL = argv.includes('--still');
const MUSIC = argv.includes('--music') ? argv[argv.indexOf('--music') + 1] : null;
const URL_QR = 'https://lishi.alz-ai.cn/zh/#person/gao-changgong', URL_SHOW = 'lishi.alz-ai.cn';
const COVER_SEC = 1.6;   // 第一屏停留秒数（含 0.4 秒淡入正片），同竖版
for (const d of [path.join(OUT, 'stills'), WORK]) fs.mkdirSync(d, { recursive: true });
requireFiles([IMG, RYOO_SRC, ...Object.values(PHOTOS).map(p => path.join(WM, p.file)), path.join(VOICE, 'timing.json'), path.join(DIST, 'zh', 'index.html')], '见本文件开头的用法');

/* ---------- 旁白、第一屏、乐曲那一行、片尾小字：对照定稿（同竖版） ---------- */
const SHOTS = loadNarration(path.join(HERE, 'lanling-song.yaml'), '## 五、', 14, '不配地图');
const SEC = (() => { const md = fs.readFileSync(path.join(HERE, 'scripts.md'), 'utf8').replace(/\r\n/g, '\n'), i = md.indexOf('## 五、'), j = md.indexOf('\n## ', i + 1); return md.slice(i, j < 0 ? undefined : j); })();
const notRead = SEC.slice(0, SEC.indexOf('不配地图')).split('\n').filter(l => l.startsWith('|') && l.split('|')[1].includes('不念')).map(l => l.split('|').map(c => c.trim()));
const TITLE_ROW = notRead.find(c => c[1].startsWith('第一屏'))?.[2];
const SONG_ROW = notRead.find(c => c[2] === '（乐曲）')?.[1];
const SOURCES = notRead.find(c => c[1].startsWith('结尾卡上的小字'))?.[2];
if (TITLE_ROW !== '峡谷之外的真实历史 / 一首军歌的 / 千年漂流 / 番外 · 《兰陵王入阵曲》') { console.error('scripts.md 第五篇的第一屏文字变了，先改本脚本的第一屏'); process.exit(1); }
const SONG_NOTE = SONG_ROW && (SONG_ROW.match(/小字“([^”]+)”/) || [])[1];
if (SONG_NOTE !== '全曲：1967 年《陵王》舞步示范录像，美国华盛顿大学民族音乐学档案馆藏，Internet Archive') { console.error('scripts.md 第五篇“乐曲”那一行的小字变了，先改本脚本'); process.exit(1); }
if (!SOURCES || !SOURCES.includes(URL_SONG)) { console.error('scripts.md 第五篇结尾卡小字里找不到全曲网址'); process.exit(1); }
const SHOT = Object.fromEntries(SHOTS.map(s => [s.id, s]));
const VO = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(VOICE, 'timing.json'), 'utf8')).shots.map(s => [s.id, s]));
for (const s of SHOTS) if (!VO[s.id]) { console.error('配音里缺少 ' + s.id + '，改了 lanling-song.yaml 要重新配音'); process.exit(1); }
if (SHOT.n10.pad < RYOO_GAP + RYOO_LEN + 0.4) { console.error('lanling-song.yaml 里 n10 的 pad 不够放乐曲'); process.exit(1); }

/* ---------- 史书原文的文字卡：同竖版 ---------- */
// text 里【】括起来的字用红色突出；“……”表示中间省略。去掉【】后，“……”隔开的每一截都必须是核实记录“原文”一栏里的原话。
const QUOTES = [
  { on: ['n02'], src: '《北齐书》本传原文', text: '率五百骑再入周军，【遂至金墉之下】' },
  { on: ['n02', '将士们为他作歌'], src: '《北齐书》本传原文', text: '于是大捷。【武士共歌谣之，为兰陵王入阵曲是也】' },
  { on: ['n03'], src: '《旧唐书·音乐志》原文', text: '《大面》出于北齐。北齐兰陵王长恭，才武而面美，【常著假面以对敌】……齐人壮之，【为此舞以效其指麾击刺之容】' },
  { on: ['n04'], src: '唐《代国长公主碑》原文', text: '初则天太后御明堂宴……岐王【年五岁】，为卫王，【弄《兰陵王》】' },
  { on: ['n05'], src: '《旧唐书·音乐志》原文', text: '玄宗以其【非正声】，【置教坊于禁中以处之】' },
  { on: ['n06'], src: '《资治通鉴》开元二年原文', text: '旧制，雅俗之乐，【皆隶太常】。上精晓音律，以太常礼乐之司，【不应典倡优杂伎】；乃【更置左右教坊以教俗乐】', off: 'n07' },
];
{
  const rec = SEC.slice(SEC.indexOf('### 核实记录'));
  for (const q of QUOTES) for (const part of q.text.replace(/[【】]/g, '').split('……')) {
    if (!rec.includes(part)) { console.error('文字卡上的原文在核实记录里找不到：' + part); process.exit(1); }
  }
  console.log(`史书原文卡 ${QUOTES.length} 张，原文都与核实记录一致`);
}
// 照片画面：同竖版，每一场从 from 那一段开始，整屏盖住网站画面，到下一场或结尾卡为止
const SCENES = [
  { id: 'dance', from: 'n08', photo: 'dance' },
  { id: 'mask', from: 'n09', photo: 'mask' },
  { id: 'legend', from: 'n11', photo: 'stage' },
  { id: 'tomb', from: 'n12', photo: 'tomb' },
];

/* ---------- 打开网站（桌面版） ---------- */
const { server, base: BASE } = await serveDist();
const dk = await openDesktop();
const { browser, page, cdp, cursor, clickSel, scrollCard, pointAt, expectSel, type } = dk;

// 结尾卡里的电脑画面：兰陵王的关系图（先截下来，再回到首页开始录）
await page.goto(BASE + '/zh/#person/gao-changgong', { waitUntil: 'networkidle' });
await page.waitForSelector('#river [data-p="gao-changgong"]', { timeout: 15000 });
await sleep(1500);
await cursor(false);
await page.screenshot({ path: path.join(OUT, 'focus.png') });
await page.goto('about:blank');
await page.goto(BASE + '/zh/', { waitUntil: 'networkidle' });
await page.waitForSelector('#river g', { timeout: 15000 });
await sleep(1500);
await cursor(false);

const tl = makeTimeline({ shot: SHOT, vo: VO, still: STILL, stillDir: path.join(OUT, 'stills'), page });
const { mark, until, snap } = tl;

async function act() {
  // 1. 游戏图片（合成时盖在上面）；底下趁这时搜索“兰陵王”并点开，卡片滚到“邙山之战”的链接
  await mark('n01');
  await sleep(300);
  await clickSel('#find', null, 400); await sleep(300);
  await type('兰陵王', 150);
  await sleep(300);
  await clickSel('.search .s-row[data-id="gao-changgong"]', 110, 400); await sleep(1200);
  await expectSel('person/gao-changgong');
  await dk.measure();
  await scrollCard('sel:[data-goe="mangshan-zhizhan"]', 600, 380); await sleep(200);
  await snap('01-card');

  // 2. 点“邙山之战”，事件卡滚到五百骑兵；念到“将士们为他作歌”滚到《兰陵王入阵曲》（文字卡盖在左边）
  await mark('n02');
  await cursor(true); await sleep(150);
  await clickSel('#detail [data-goe="mangshan-zhizhan"]', 90, 600); await sleep(1000);
  await expectSel('event/mangshan-zhizhan');
  await snap('02a-event');
  await sleep(200); await scrollCard('北齐武成帝派兰陵王', 1100, 40);
  await pointAt('兰陵王率五百骑兵冲入周军阵中', 700); await snap('02b-wubai');
  await until(fracBefore(SHOT.n02.say, '将士们为他作歌') - 0.06);
  await scrollCard('齐军将士为兰陵王作歌', 1000, 140); await pointAt('称为《兰陵王入阵', 600); await snap('02-ruzhenqu');

  // 3. 唐代《大面》：返回兰陵王的人物卡，滚到《教坊记》“常著假面以对敌”那一段
  await mark('n03');
  await scrollCard(null, 400); await sleep(100);
  await clickSel('#detail .d-back', 50, 600); await sleep(1000);
  await expectSel('person/gao-changgong');
  await sleep(200); await scrollCard('唐代的《教坊记》', 1200, 200);
  await pointAt('唐代的《教坊记》', 700); await snap('03-damian');

  // 4–7. 碑文、教坊、太常寺：文字卡轮换，卡片不动；7 文字卡撤下
  await mark('n04'); await snap('04');
  await mark('n05'); await snap('05');
  await mark('n06'); await snap('06');
  await mark('n07'); await snap('07');

  // 8–13. 日本部分、乐曲、传说、墓：照片画面整屏盖在上面（合成时），网站不动
  for (const id of ['n08', 'n09', 'n10', 'n11', 'n12', 'n13']) await mark(id);

  // 14. 结尾卡（合成时盖在上面）
  await mark('n14');
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
// 官方横版图 1920×882，放大到 1080 高，左边留出 IMGL 像素（压暗的底色）：人物的脸在大标题右边，不被字压住（同 lanling2-h.mjs）
const IMGW = Math.round(1920 * H / 882), IMGL = 100, DX = dk.detailX;
const KAI = "'STKaiti','KaiTi',serif";
const qrOf = url => QRCode.toDataURL(url, { errorCorrectionLevel: 'Q', margin: 2, width: 720, color: { dark: '#1B2A31', light: '#FFFFFF' } });
const qr = await qrOf(URL_QR), qrSong = await qrOf(URL_SONG);
const red = s => s.replace(/【/g, '<b style="color:#C4472D">').replace(/】/g, '</b>');
const SHADE = `<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,18,22,.94) 0,rgba(13,18,22,.78) 34%,rgba(13,18,22,0) 60%)"></div>`;
const SERIES = `<div style="position:absolute;left:110px;top:150px;font:400 56px ${KAI};letter-spacing:10px;color:#e8dcc0">峡谷之外的真实历史</div>`;
const CREDIT_TAG = `<div style="position:absolute;right:30px;bottom:24px;font-size:24px;letter-spacing:1px;color:rgba(241,236,224,.85)">${CREDIT}</div>`;
const TOPLINE = `<div style="position:absolute;left:0;right:0;top:40px;text-align:center;font:700 34px 'Microsoft YaHei';letter-spacing:6px;color:#8a5a2b">峡谷之外 · 番外 · 兰陵王入阵曲</div>`;
// 文字卡：盖在左边的时间轴上（顶栏、右边的人物卡照常露出），底下留给字幕
const quoteHtml = q => `<body style="background:transparent">
  <div style="position:absolute;left:90px;width:${DX - 180}px;top:170px;box-sizing:border-box;padding:44px 60px 52px;border-radius:26px;background:#fbf7ee;border:2px solid #d9cdb4;box-shadow:0 14px 40px rgba(27,42,49,.28)">
    <div style="font:700 32px 'Microsoft YaHei';letter-spacing:4px;color:#8a5a2b">${q.src}</div>
    <div style="margin-top:24px;font:400 ${q.text.length > 40 ? 58 : 66}px/1.55 ${KAI};color:#1B2A31;letter-spacing:3px">${red(q.text)}</div>
  </div></body>`;
// 照片画面：纸色底，最上面一行系列名；照片在左边的框里（合成时缓慢推近），右边一栏放说明（是什么、作者和授权）和标签，字不压照片。
// 框按照片本身的长宽比定（竖照片竖框、横照片横框）；底下 y≈960 以下留给字幕。
const BOX = { dance: [420, 130, 585, 780], mask: [110, 130, 1040, 780], legend: [110, 170, 800, 600], tomb: [110, 130, 1080, 780] };
const colOf = id => { const [x, , w] = BOX[id], l = x + w + 70; return { l, w: 1830 - l }; };
// 说明：放在右栏，下沿和照片下沿对齐（像展品的标签）
const capHtml = (p, id) => { const [, y, , h] = BOX[id], c = colOf(id); return `<div style="position:absolute;left:${c.l}px;width:${c.w}px;bottom:${H - y - h}px;font-family:'Microsoft YaHei'">
    <div style="width:60px;height:4px;background:#C4472D;margin-bottom:18px"></div>
    <div style="font-size:32px;line-height:1.45;color:#1B2A31;letter-spacing:1px">${p.what}</div>
    <div style="margin-top:10px;font-size:24px;line-height:1.45;color:#6b7679">${p.by}</div></div>`; };
const frameOf = ([x, y, w, h]) => `<div style="position:absolute;left:${x - 8}px;top:${y - 8}px;width:${w + 16}px;height:${h + 16}px;background:#1B2A31;border-radius:14px;box-shadow:0 18px 44px rgba(27,42,49,.3)"></div>`;
const tag = (text, sub, x, y) => `<div style="position:absolute;left:${x}px;top:${y}px;padding:14px 26px;border-radius:14px;background:rgba(27,42,49,.9);color:#fff;font-family:'Microsoft YaHei';box-shadow:0 8px 24px rgba(0,0,0,.25)">
    <div style="font:700 40px 'Microsoft YaHei';letter-spacing:3px;color:#f2c96b">${text}</div>${sub ? `<div style="margin-top:4px;font-size:26px;color:#e8dcc0">${sub}</div>` : ''}</div>`;
const scenePage = s => {
  const b = BOX[s.id], p = PHOTOS[s.photo], c = colOf(s.id);
  let extra = '';
  // “日本传说”文字卡：右栏上半，下面是这张舞乐照片的说明
  if (s.id === 'legend') extra = `<div style="position:absolute;left:${c.l}px;width:${c.w}px;top:130px;box-sizing:border-box;padding:34px 42px 36px;border-radius:26px;background:#fbf7ee;border:2px solid #d9cdb4;box-shadow:0 14px 40px rgba(27,42,49,.22)">
      <div style="font:700 36px 'Microsoft YaHei';letter-spacing:3px;color:#C4472D">日本传说<span style="margin-left:18px;font-weight:400;font-size:30px;color:#8a5a2b;letter-spacing:1px">出自《教训抄》，1233 年</span></div>
      <div style="margin-top:18px;font:400 50px/1.5 ${KAI};color:#1B2A31;letter-spacing:2px">一位王子在父王陵前哀叹战事不利，落下的太阳又升起，于是大胜。</div>
      <div style="margin-top:14px;font-size:24px;line-height:1.5;color:#6b7679">《教训抄》是日本镰仓时代的乐书。这里是大意，据日本的百科辞典转述；是传说，不是史书记载。</div></div>`;
  // “据中文网络资料”：放在右栏上方（竖版是盖在照片左上角，横版有地方，就不压照片）
  if (s.id === 'tomb') extra = tag('据中文网络资料', '1992 年墓前演出，未见当年报道', c.l, 130);
  return `<body style="background:${PAPER}">${TOPLINE}${frameOf(b)}${extra}${s.id === 'legend' ? '' : capHtml(p, s.id)}${s.id === 'legend' ? `<div style="position:absolute;left:${b[0]}px;width:${b[2]}px;top:${b[1] + b[3] + 30}px;font-family:'Microsoft YaHei'">
    <div style="font-size:30px;color:#1B2A31;letter-spacing:1px">${p.what}</div><div style="margin-top:8px;font-size:24px;color:#6b7679">${p.by}</div></div>` : ''}</body>`;
};
// 放乐曲时盖在面具画面上：右栏上方注明在放什么，下面二维码指向全曲，旁边小字（定稿原文）；面具照片和它的说明照常露出
const MC = colOf('mask');
const musicHtml = `<body style="background:transparent;font-family:'Microsoft YaHei'">
  ${tag('♪ 日本流传下来的《陵王》', '乐曲片段，约 10 秒', MC.l, 130)}
  <div style="position:absolute;left:${MC.l}px;width:${MC.w}px;top:320px;display:flex;gap:28px;align-items:flex-start">
    <div style="flex:none;width:240px;height:240px;padding:10px;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(27,42,49,.18);box-sizing:border-box"><img src="${qrSong}" style="width:100%;height:100%;display:block"></div>
    <div style="font-size:26px;line-height:1.55;color:#1B2A31"><div style="font-weight:700;font-size:30px;color:#8a5a2b;margin-bottom:6px">扫码看全曲</div>${SONG_NOTE}</div>
  </div></body>`;
const pages = {
  // 第一屏：照样张 title-h.png（图片右移 100 像素，字不压脸）；文字同竖版
  cover: `<body style="background:#0d1216;color:#fff;font-family:'Microsoft YaHei';overflow:hidden">
    <img src="${dataUrl(IMG)}" style="position:absolute;left:${IMGL}px;top:0;height:${H}px;-webkit-mask-image:linear-gradient(90deg,transparent,#000 260px)">${SHADE}
    ${SERIES}
    <div style="position:absolute;left:104px;top:330px;font:700 140px/1.2 ${KAI};letter-spacing:12px;text-shadow:0 6px 30px rgba(0,0,0,.7)">一首军歌的<br><span style="color:#f2c96b">千年漂流</span></div>
    <div style="position:absolute;left:114px;top:720px;font-size:34px;letter-spacing:10px;color:rgba(241,236,224,.75)">番外 · 《兰陵王入阵曲》</div>
    ${CREDIT_TAG}
  </body>`,
  // 开头：盖在推近的游戏图片上的字。系列标题、出处和第一屏同一位置；大字换成一行集标题，下方留给第一句旁白的字幕
  intro: `<body style="background:transparent;color:#fff;font-family:'Microsoft YaHei'">${SHADE}
    <div style="position:absolute;left:0;right:0;bottom:0;height:260px;background:linear-gradient(transparent,rgba(13,18,22,.8))"></div>
    ${SERIES}
    <div style="position:absolute;left:112px;top:250px;font:700 52px ${KAI};letter-spacing:6px;color:#f2c96b">番外 · 一首军歌的千年漂流</div>
    ${CREDIT_TAG}
  </body>`,
  music: musicHtml,
  // 结尾卡：左边电脑画面（兰陵王的关系图），右边二维码和网址；下面小字是核实过的史料和乐曲出处（只显示、不念）
  end: `<body style="background:radial-gradient(circle at 30% 40%,#f7f3ea 0,${PAPER} 55%,#e4dccb 100%);font-family:'Microsoft YaHei';color:#1B2A31">
    ${TOPLINE.replace('top:40px', 'top:44px')}
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
    <div style="position:absolute;left:80px;right:80px;top:770px;text-align:center;font-size:25px;line-height:1.5;color:#5f6c6f">${SOURCES}</div>
  </body>`,
};
QUOTES.forEach((q, i) => { pages['quote' + i] = quoteHtml(q); });
SCENES.forEach(s => { pages['scene-' + s.id] = scenePage(s); });
await renderPages(pages, OUT, ['end', 'cover', ...SCENES.map(s => 'scene-' + s.id)], W, H);

// 照片按框的大小裁好（放大 3 倍，推近时不抖）
const photoBig = s => path.join(OUT, `scene-${s.id}-photo.png`);
for (const s of SCENES) {
  const [, , w, h] = BOX[s.id];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(WM, PHOTOS[s.photo].file), '-vf',
    `scale=${w * 3}:${h * 3}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w * 3}:${h * 3}`, '-frames:v', '1', photoBig(s)]);
}
if (STILL) {
  // 样张：照片画面（照片未推近）、放乐曲时的画面
  for (const s of SCENES) {
    const [x, y, w, h] = BOX[s.id];
    const over = s.id === 'mask' ? ['-i', path.join(OUT, 'music.png')] : [];
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(OUT, `scene-${s.id}.png`), '-i', photoBig(s), ...over, '-filter_complex',
      `[1:v]scale=${w}:${h}[p];[0:v][p]overlay=${x}:${y}` + (over.length ? `[a];[a][2:v]overlay=0:0` : ''), '-frames:v', '1', path.join(OUT, 'stills', `scene-${s.id}${s.id === 'mask' ? '-music' : ''}.png`)]);
  }
  console.log('截图、样张在', path.join(OUT, 'stills'), '；底图、文字卡在', OUT);
  process.exit(0);
}

console.log(`录制 ${TOTAL.toFixed(1)}s，${frames.length} 帧`);
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ total: TOTAL, marks }, null, 1));
framesToVideo(frames, TOTAL, WORK, 'screen.mp4', W, H);

/* ---------- 开头的游戏图片：铺满画面（位置同第一屏），朝人物的脸缓慢推近（同 lanling2-h.mjs） ---------- */
const introLen = at('n02') + 0.6, N = Math.round(introLen * 30);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', introLen.toFixed(3), '-i', IMG, '-i', path.join(OUT, 'intro.png'), '-filter_complex',
  `[0:v]scale=${IMGW}:${H}:flags=lanczos,pad=${IMGW + IMGL}:${H}:${IMGL}:0:color=0x0d1216,crop=${W}:${H}:0:0,scale=${W * 2}:${H * 2}:flags=lanczos,`
  + `zoompan=z='1+0.08*on/${N}':x='iw*0.62-(iw/zoom*0.62)':y='ih*0.3-(ih/zoom*0.3)':d=1:s=${W}x${H}:fps=30[fg];`
  + `[fg][1:v]overlay=0:0,format=yuv420p`,
  '-t', introLen.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', path.join(WORK, 'intro.mp4')]);

/* ---------- 照片画面：每一场一段整屏视频，照片在框里缓慢推近（同竖版） ---------- */
const XF = 0.4;   // 场与场之间交叉淡入的秒数
const tEnd = at('n14') - 0.1;
const sc = SCENES.map((s, i) => {
  const a = at(s.from) - 0.1, b = i + 1 < SCENES.length ? at(SCENES[i + 1].from) - 0.1 + XF : tEnd + 0.5;
  return { ...s, a, b };
});
for (const s of sc) {
  const [x, y, w, h] = BOX[s.id], len = s.b - s.a + 0.2, n = Math.round(len * 30);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', len.toFixed(3), '-i', path.join(OUT, `scene-${s.id}.png`), '-i', photoBig(s), '-filter_complex',
    `[1:v]zoompan=z='1+0.05*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=${w}x${h}:fps=30[p];[0:v][p]overlay=${x}:${y},format=yuv420p`,
    '-t', len.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', path.join(WORK, `scene-${s.id}.mp4`)]);
}

/* ---------- 字幕：断句和对时同竖版；横版放在画面下方正中 ---------- */
writeSubs({ marks, shot: SHOT, vo: VO, voiceDir: VOICE, total: TOTAL, outDir: OUT, introId: 'n01', landscape: true });

/* ---------- 文字卡、乐曲的时间（同竖版） ---------- */
const tOf = ([id, snip]) => (snip ? at(id) + VOLEAD + VO[id].dur * fracBefore(SHOT[id].say, snip) - 0.15 : at(id));
const qt = QUOTES.map((q, i) => {
  const a = tOf(q.on), nx = QUOTES[i + 1];
  const b = q.off ? at(q.off) - 0.1 : nx ? tOf(nx.on) : at('n07') - 0.1;
  return { a, b, cross: !q.off && !!nx };   // cross：紧接着下一张，和下一张交叉淡入淡出
});
const tSong = at('n10') + VOLEAD + VO.n10.dur + RYOO_GAP, tSongEnd = tSong + RYOO_LEN;
fs.writeFileSync(path.join(OUT, 'quotes.txt'), [
  ...QUOTES.map((q, i) => `${qt[i].a.toFixed(2)} → ${qt[i].b.toFixed(2)}  ${q.src}：${q.text}`),
  ...sc.map(s => `${s.a.toFixed(2)} → ${s.b.toFixed(2)}  照片画面 ${s.id}：${PHOTOS[s.photo].what}`),
  `${tSong.toFixed(2)} → ${tSongEnd.toFixed(2)}  《陵王》乐曲（录像第 ${RYOO_AT} 秒起 ${RYOO_LEN} 秒）`,
].join('\n'));

/* ---------- 《陵王》乐曲：同竖版，只取声音，头尾淡入淡出 ---------- */
const SONG = path.join(OUT, 'ryoo-clip.wav');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(RYOO_AT), '-t', String(RYOO_LEN), '-i', RYOO_SRC, '-vn', '-af',
  `aresample=48000,afade=in:st=0:d=0.8,afade=out:st=${(RYOO_LEN - 1.6).toFixed(2)}:d=1.6,loudnorm=I=-23:TP=-2:LRA=11`, '-ar', '48000', '-ac', '2', SONG]);

/* ---------- 合成 ---------- */
// 输入：0 录屏，1 开头，2 结尾卡，3 乐曲画面上的二维码，4… 文字卡，再后是照片画面，再后是旁白、乐曲，最后是背景音乐
const T = TOTAL.toFixed(3), tIntro = at('n02') - 0.15;
const args = ['-y', '-loglevel', 'error', '-i', path.join(WORK, 'screen.mp4'), '-i', path.join(WORK, 'intro.mp4'),
  '-loop', '1', '-framerate', '30', '-t', T, '-i', 'end.png', '-loop', '1', '-framerate', '30', '-t', T, '-i', 'music.png'];
QUOTES.forEach((_, i) => args.push('-loop', '1', '-framerate', '30', '-t', T, '-i', `quote${i}.png`));
const Q0 = 4, S0 = Q0 + QUOTES.length;
sc.forEach(s => args.push('-i', path.join(WORK, `scene-${s.id}.mp4`)));
const A0 = S0 + sc.length;
marks.forEach(m => args.push('-i', path.join(VOICE, VO[m.id].file)));
args.push('-i', SONG);
if (MUSIC) args.push('-i', path.resolve(MUSIC));
let vf = `[0:v]fps=30,format=yuv420p[a];`
  + `[1:v]format=rgba,fade=out:st=${tIntro.toFixed(3)}:d=0.45:alpha=1[in];[a][in]overlay=0:0:eof_action=pass[q0];`;
QUOTES.forEach((_, i) => {
  const { a, b, cross } = qt[i];
  // 紧接下一张的：在下一张淡入的同时淡出（两张卡高矮不一，不淡出的话旧卡的下沿会露出来）
  const outF = `,fade=out:st=${(cross ? b : b - 0.3).toFixed(3)}:d=0.3:alpha=1`;
  vf += `[${Q0 + i}:v]format=rgba,fade=in:st=${a.toFixed(3)}:d=0.3:alpha=1${outF}[qq${i}];`
    + `[q${i}][qq${i}]overlay=0:0:enable='between(t,${a.toFixed(3)},${(cross ? b + 0.3 : b).toFixed(3)})'[q${i + 1}];`;
});
// 照片画面：每一场在自己的时间里淡入，盖住网站画面；前面补透明帧，让时间对上
let cur = `q${QUOTES.length}`;
sc.forEach((s, i) => {
  vf += `[${S0 + i}:v]format=rgba,tpad=start_duration=${s.a.toFixed(3)}:color=black@0,fade=in:st=${s.a.toFixed(3)}:d=${XF}:alpha=1[ss${i}];`
    + `[${cur}][ss${i}]overlay=0:0:eof_action=pass:enable='between(t,${s.a.toFixed(3)},${s.b.toFixed(3)})'[s${i}];`;
  cur = `s${i}`;
});
// 放乐曲时：标签、二维码和说明
vf += `[3:v]format=rgba,fade=in:st=${(tSong - 0.4).toFixed(3)}:d=0.4:alpha=1,fade=out:st=${(tSongEnd + 0.2).toFixed(3)}:d=0.4:alpha=1[mq];`
  + `[${cur}][mq]overlay=0:0:enable='between(t,${(tSong - 0.4).toFixed(3)},${(tSongEnd + 0.6).toFixed(3)})'[m];`;
vf += `[2:v]format=rgba,fade=in:st=${tEnd.toFixed(3)}:d=0.5:alpha=1[end];[m][end]overlay=0:0:enable='gte(t,${tEnd.toFixed(3)})',subtitles=subs.ass,`
  + `fade=out:st=${(TOTAL - 0.8).toFixed(3)}:d=0.8,format=yuv420p[v]`;
// 声音：同竖版。旁白每段在字幕出现后 VOLEAD 秒开始；乐曲放在 n10 念完之后
const vo = marks.map((m, i) => `[${A0 + i}:a]aresample=48000,adelay=${Math.round((m.at + VOLEAD) * 1000)}:all=1[v${i}]`);
const si = A0 + marks.length;
let af = `;${vo.join(';')};[${si}:a]aresample=48000,adelay=${Math.round(tSong * 1000)}:all=1[song]`
  + `;${marks.map((_, i) => `[v${i}]`).join('')}amix=inputs=${marks.length}:normalize=0,apad,atrim=0:${T},asplit=2[narr][key]`;
if (MUSIC) {
  // 背景音乐：放《陵王》前 0.8 秒渐渐停下，放完 0.8 秒后再渐渐回来；有人声时自动让一让（sidechain）
  const a = tSong.toFixed(3), b = tSongEnd.toFixed(3);
  af += `;[${si + 1}:a]aresample=48000,atrim=0:${T},volume=0.26,afade=in:st=0:d=1,afade=out:st=${(TOTAL - 2.5).toFixed(3)}:d=2.5,`
    + `volume='1-min(clip((t-${a}+0.8)/0.8,0,1),clip((${b}+0.8-t)/0.8,0,1))':eval=frame[mu]`
    + `;[mu][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]`
    + `;[narr][song][duck]amix=inputs=3:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11[au]`;
} else af += `;[narr][song]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11[au]`;
args.push('-filter_complex', vf + af, '-map', '[v]', '-map', '[au]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-t', T, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', path.join(WORK, 'body.mp4'));
execFileSync('ffmpeg', args, { cwd: OUT });

/* ---------- 第一屏 ---------- */
const FULL = prependCover({ outDir: OUT, coverPng: 'cover.png', body: path.join(WORK, 'body.mp4'), out: path.join(WORK, 'final.mp4'), total: TOTAL, cover: COVER_SEC });
copyChecked(path.join(WORK, 'final.mp4'), FINAL);
fs.rmSync(WORK, { recursive: true, force: true });
console.log('成片：', FINAL, FULL + 's');
