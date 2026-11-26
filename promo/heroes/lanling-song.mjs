// 《峡谷之外》番外篇《番外 · 兰陵王入阵曲：一首军歌的千年漂流》（竖屏 1080×1920）：
//   第一屏标题画面 → 开头游戏图片 → 网站手机画幅录屏（事件“邙山之战”、兰陵王人物卡）+ 史书原文的文字卡
//   → 日本部分换成照片（舞乐《陵王》、陵王面具；放约 10 秒《陵王》乐曲，右下角二维码指向全曲）→ “日本传说”文字卡 → 兰陵王墓 → 结尾卡。不配地图。
// 用法：node promo/heroes/lanling-song.mjs [--still] [--music <音乐文件>]
//   先做三件事：仓库根目录 npm run build；按 lanling-song.yaml 开头的命令配音；素材放好（见下面 RYOO_SRC、PHOTOS，出处见 README 第五节）。
//   --still：不录像，每段结束截一张图到 promo/out/heroes/005-lanling-song/stills/；同时画出各张底图、文字卡和照片画面的样张。
// 成片：promo/out/heroes/005-lanling-song/lanling-song.mp4（不进仓库）。第一屏另存为 cover.png。
// 通用的部分在 episode.mjs，做法照兰陵王第二篇 lanling2.mjs。旁白文字是定稿，这里只对照检查，不改。
// 番外篇（README“内容口径”第 8 条）：史书原文卡上的原文与 scripts.md 第五篇核实记录逐字一致（开录前自动对照）；
// 日本传说、网上的说法在画面上用文字标明“日本传说（出自《教训抄》，1233 年）”“据中文网络资料”。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import QRCode from 'qrcode';
import {
  HERE, PROMO, DIST, VW, VH, PAPER, CREDIT, VOLEAD, sleep, loadNarration, requireFiles, serveDist, openPhone,
  makeTimeline, fracBefore, startScreencast, framesToVideo, renderPages, dataUrl, writeSubs, prependCover, copyChecked,
} from './episode.mjs';

const HEROES = path.join(PROMO, 'out', 'heroes');
const OUT = path.join(HEROES, '005-lanling-song');
const WORK = path.join(os.tmpdir(), 'xiagu-lanling-song');   // 视频先写在这里（E 盘直接写偶尔写坏，见 episode.mjs checkVideo）
const VOICE = path.join(OUT, 'voice');
const IMG = path.join(HEROES, 'img', '153-bigskin-1.jpg');       // 官方图片（默认造型，横版），不进仓库
const IMG_V = path.join(HEROES, 'img', '153-mobileskin-1.jpg');   // 官方图片（默认造型，竖版），第一屏用
// 《陵王》乐曲：美国华盛顿大学民族音乐学档案馆 1967 年录像（Internet Archive wauem_1967009_gagaku），只取声音。
// 条目页上的 .ia.mp4 要登录才能下载，同一段录像的 .mp4（条目页播放器用的那份，时长、大小相同）可以直接下载。
const RYOO_SRC = path.join(HEROES, 'ia-ryoo', 'wauem_1967009_gagaku_Song01-03.mp4');
const RYOO_AT = 454, RYOO_LEN = 10.5, RYOO_GAP = 0.5;   // 从录像第 454 秒（7 分 34 秒）起取 10.5 秒；n10 念完后停 0.5 秒再放
const URL_SONG = 'https://archive.org/details/wauem_1967009_gagaku';
// 照片：维基共享资源，作者和授权在画面上注明（README 第五节有表）
const WM = path.join(HEROES, 'wm-lanling-song');
const PHOTOS = {
  dance: { file: 'ryoo-hokkaido.jpg', what: '日本舞乐《陵王》 · 北海道护国神社祭奉纳（2010 年）', by: '摄影：由良和喜 · CC BY-SA 3.0 · 维基共享资源' },
  mask: { file: 'ryoo-mask-1211.jpg', what: '陵王面具，日本 1211 年制（真清田神社藏，重要文化财）', by: '摄影：Ihimutefu · CC BY-SA 4.0 · 维基共享资源' },
  stage: { file: 'ryoo-lee.jpg', what: '舞乐《陵王》（2007 年摄）', by: '摄影：lienyuan lee · CC BY 3.0 · 维基共享资源' },
  tomb: { file: 'tomb-01.jpg', what: '河北磁县兰陵王墓（2025 年摄）', by: '摄影：Windmemories · CC BY-SA 4.0 · 维基共享资源' },
};
const argv = process.argv.slice(2), STILL = argv.includes('--still');
const MUSIC = argv.includes('--music') ? argv[argv.indexOf('--music') + 1] : null;
// 结尾卡的二维码直接打开兰陵王的关系图；卡上显示的网址仍是首页
const URL_QR = 'https://lishi.alz-ai.cn/zh/#person/gao-changgong', URL_SHOW = 'lishi.alz-ai.cn';
const COVER_SEC = 1.6;   // 第一屏停留秒数（含 0.4 秒淡入正片）
for (const d of [path.join(OUT, 'stills'), WORK]) fs.mkdirSync(d, { recursive: true });
requireFiles([IMG, IMG_V, RYOO_SRC, ...Object.values(PHOTOS).map(p => path.join(WM, p.file)), path.join(VOICE, 'timing.json'), path.join(DIST, 'zh', 'index.html')], '见本文件开头的用法');

/* ---------- 旁白、第一屏、乐曲那一行、片尾小字：对照定稿 ---------- */
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

/* ---------- 史书原文的文字卡 ---------- */
// on：在哪一段、念到哪几个字时出现（不给字就是这一段一开始）；一直显示到下一张出现，或 off 那一段开始。
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
// 照片画面（日本部分以后）：每一场从 from 那一段开始，盖住网站画面，到下一场或结尾卡为止
const SCENES = [
  { id: 'dance', from: 'n08', photo: 'dance' },
  { id: 'mask', from: 'n09', photo: 'mask' },
  { id: 'legend', from: 'n11', photo: 'stage' },
  { id: 'tomb', from: 'n12', photo: 'tomb' },
];

/* ---------- 打开网站 ---------- */
const { server, base: BASE } = await serveDist();
const ph = await openPhone();
const { browser, page, cdp, tapSel, scrollCard, openCard, expectFocus, type } = ph;

// 结尾卡里的手机画面：兰陵王的关系图（先截下来，再回到首页开始录）
await page.goto(BASE + '/zh/#person/gao-changgong', { waitUntil: 'networkidle' });
await page.waitForSelector('#mseg [data-map]', { timeout: 15000 });
await sleep(1200);
await page.screenshot({ path: path.join(OUT, 'focus.png') });
await page.goto('about:blank');
await page.goto(BASE + '/zh/', { waitUntil: 'networkidle' });
await page.waitForSelector('#mpeople', { timeout: 15000 });
await sleep(1500);

const tl = makeTimeline({ shot: SHOT, vo: VO, still: STILL, stillDir: path.join(OUT, 'stills'), page });
const { mark, until, snap } = tl;

async function act() {
  // 1. 游戏图片（合成时盖在上面）；底下趁这时打开兰陵王，展开人物卡，停在河清三年（邙山）那一段
  await mark('n01');
  await sleep(300);
  await tapSel('#mfind'); await sleep(400);
  await type('兰陵王', 150);
  await sleep(300);
  await tapSel('.s-row[data-id="gao-changgong"]'); await sleep(1100);
  await expectFocus('兰陵王');
  await openCard(); await sleep(200);
  await scrollCard('河清三年', 900, 30); await snap('01-card');

  // 2. 点“邙山之战”，事件卡滚到五百骑兵；念到“将士们为他作歌”滚到《兰陵王入阵曲》（文字卡盖在上半截）
  await mark('n02');
  await sleep(200);
  await scrollCard('sel:[data-goe="mangshan-zhizhan"]', 500, 200); await sleep(150);
  await tapSel('#msheet [data-goe="mangshan-zhizhan"]'); await sleep(1000);
  await expectFocus('邙山之战');
  await openCard(); await snap('02a-event');
  await sleep(300); await scrollCard('北齐武成帝派兰陵王', 1200, 30); await snap('02b-wubai');
  await until(fracBefore(SHOT.n02.say, '将士们为他作歌') - 0.06);
  await scrollCard('齐军将士为兰陵王作歌', 1100, 30); await snap('02-ruzhenqu');

  // 3. 唐代《大面》：返回兰陵王的人物卡，滚到《教坊记》、《旧唐书·音乐志》说他戴假面那一句
  await mark('n03');
  await scrollCard(null, 400); await sleep(150);
  await tapSel('#msheet .d-back'); await sleep(1000);
  await expectFocus('兰陵王');
  await openCard(); await sleep(200);
  await scrollCard('唐代的《教坊记》', 1200, 30); await snap('03-damian');

  // 4–7. 碑文、教坊、太常寺：文字卡轮换，卡片不动；7 文字卡撤下
  await mark('n04'); await snap('04');
  await mark('n05'); await snap('05');
  await mark('n06'); await snap('06');
  await mark('n07'); await snap('07');

  // 8–13. 日本部分、乐曲、传说、墓：照片盖在上面（合成时），网站不动
  for (const id of ['n08', 'n09', 'n10', 'n11', 'n12', 'n13']) await mark(id);

  // 14. 结尾卡（合成时盖在上面）
  await mark('n14');
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
const TITLE = `<div style="position:absolute;left:0;right:0;top:52px;text-align:center;font:700 38px 'Microsoft YaHei';letter-spacing:6px;color:#8a5a2b">峡谷之外 · 番外 · 兰陵王入阵曲</div>`;
const qrOf = (url, dark = '#1B2A31') => QRCode.toDataURL(url, { errorCorrectionLevel: 'Q', margin: 2, width: 720, color: { dark, light: '#FFFFFF' } });
const qr = await qrOf(URL_QR), qrSong = await qrOf(URL_SONG);
const red = s => s.replace(/【/g, '<b style="color:#C4472D">').replace(/】/g, '</b>');
// 文字卡：盖在手机画面上半截，下半截照常露出网站上的卡片
const quoteHtml = q => `<body style="background:transparent">
  <div style="position:absolute;left:60px;right:60px;top:${PY + 170}px;padding:40px 48px 46px;border-radius:26px;background:#fbf7ee;border:2px solid #d9cdb4;box-shadow:0 14px 40px rgba(27,42,49,.28)">
    <div style="font:700 30px 'Microsoft YaHei';letter-spacing:4px;color:#8a5a2b">${q.src}</div>
    <div style="margin-top:22px;font:400 ${q.text.length > 40 ? 52 : 58}px/1.5 ${KAI};color:#1B2A31;letter-spacing:2px">${red(q.text)}</div>
  </div></body>`;
// 照片画面：纸色底，上方标题和字幕（字幕在 y≈212），照片放在框里（合成时缓慢推近），下方小字写明是什么、作者和授权
const BOX = { dance: [60, 330, 960, 1250], mask: [60, 330, 960, 1120], legend: [60, 760, 960, 880], tomb: [60, 330, 960, 1250] };
const capHtml = (p, top) => `<div style="position:absolute;left:60px;right:60px;top:${top}px;font-family:'Microsoft YaHei'">
    <div style="font-size:32px;color:#1B2A31;letter-spacing:1px">${p.what}</div>
    <div style="margin-top:8px;font-size:24px;color:#6b7679">${p.by}</div></div>`;
const frameOf = ([x, y, w, h]) => `<div style="position:absolute;left:${x - 8}px;top:${y - 8}px;width:${w + 16}px;height:${h + 16}px;background:#1B2A31;border-radius:14px;box-shadow:0 18px 44px rgba(27,42,49,.3)"></div>`;
const tag = (text, sub, x, y) => `<div style="position:absolute;left:${x}px;top:${y}px;padding:14px 26px;border-radius:14px;background:rgba(27,42,49,.86);color:#fff;font-family:'Microsoft YaHei';box-shadow:0 8px 24px rgba(0,0,0,.3)">
    <div style="font:700 40px 'Microsoft YaHei';letter-spacing:3px;color:#f2c96b">${text}</div>${sub ? `<div style="margin-top:4px;font-size:26px;color:#e8dcc0">${sub}</div>` : ''}</div>`;
const scenePage = s => {
  const b = BOX[s.id], p = PHOTOS[s.photo];
  let extra = '';
  if (s.id === 'legend') extra = `<div style="position:absolute;left:60px;right:60px;top:330px;padding:36px 46px 40px;border-radius:26px;background:#fbf7ee;border:2px solid #d9cdb4;box-shadow:0 14px 40px rgba(27,42,49,.22)">
      <div style="font:700 34px 'Microsoft YaHei';letter-spacing:3px;color:#C4472D">日本传说<span style="margin-left:18px;font-weight:400;font-size:30px;color:#8a5a2b;letter-spacing:1px">出自《教训抄》，1233 年</span></div>
      <div style="margin-top:20px;font:400 52px/1.5 ${KAI};color:#1B2A31;letter-spacing:2px">一位王子在父王陵前哀叹战事不利，落下的太阳又升起，于是大胜。</div>
      <div style="margin-top:16px;font-size:24px;color:#6b7679">《教训抄》是日本镰仓时代的乐书。这里是大意，据日本的百科辞典转述；是传说，不是史书记载。</div></div>`;
  return `<body style="background:${PAPER}">${TITLE}${frameOf(b)}${extra}${capHtml(p, b[1] + b[3] + 26)}</body>`;
};
// 盖在照片上面的字（照片在合成时放进框里，页面里的字会被照片盖住，所以单独画一张透明的）
const sceneOver = { tomb: `<body style="background:transparent">${tag('据中文网络资料', '1992 年墓前演出，未见当年报道', 88, 360)}</body>` };
// 放乐曲时盖在面具画面上：上方注明在放什么；右下角二维码指向全曲，旁边小字（定稿原文）
const MB = BOX.mask, songTop = MB[1] + MB[3] + 150;
const musicHtml = `<body style="background:transparent;font-family:'Microsoft YaHei'">
  ${tag('♪ 日本流传下来的《陵王》', '乐曲片段，约 10 秒', 88, 360)}
  <div style="position:absolute;left:0;right:0;top:${songTop - 20}px;bottom:0;background:${PAPER}"></div>
  <div style="position:absolute;left:60px;width:640px;top:${songTop + 10}px;font-size:28px;line-height:1.55;color:#1B2A31">
    <div style="font-weight:700;font-size:30px;color:#8a5a2b;margin-bottom:6px">扫码看全曲</div>${SONG_NOTE}</div>
  <div style="position:absolute;right:60px;top:${songTop}px;width:250px;height:250px;padding:10px;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(27,42,49,.18);box-sizing:border-box"><img src="${qrSong}" style="width:100%;height:100%;display:block"></div>
</body>`;
const pages = {
  // 第一屏（成片第一帧，也是平台上的预览图）：照制作标准的标题画面，版式同兰陵王第二篇
  cover: `<body style="background:#0d1216;color:#fff;font-family:'Microsoft YaHei'">
    <img src="${dataUrl(IMG)}" style="position:absolute;left:-1000px;top:0;height:1920px;filter:blur(30px) brightness(.55) saturate(.8)">
    <img src="${dataUrl(IMG_V)}" style="position:absolute;left:0;top:300px;width:1080px;
      -webkit-mask-image:linear-gradient(transparent 0,rgba(0,0,0,.55) 110px,#000 300px,#000 900px,transparent 1300px)">
    <div style="position:absolute;left:0;right:0;top:0;height:520px;background:linear-gradient(rgba(13,18,22,.92) 0,rgba(13,18,22,.75) 200px,transparent)"></div>
    <div style="position:absolute;left:0;right:0;top:1100px;bottom:0;background:linear-gradient(transparent,rgba(13,18,22,.9) 300px,#0d1216 520px)"></div>
    <div style="position:absolute;left:0;right:0;top:110px;text-align:center;font:400 64px ${KAI};letter-spacing:12px;text-indent:12px;color:#e8dcc0">峡谷之外的真实历史</div>
    <div style="position:absolute;left:0;right:0;top:1330px;text-align:center;font:700 150px/1.18 ${KAI};letter-spacing:14px;text-indent:14px;text-shadow:0 6px 30px rgba(0,0,0,.7)">一首军歌的<br><span style="color:#f2c96b">千年漂流</span></div>
    <div style="position:absolute;left:0;right:0;top:1720px;text-align:center;font-size:36px;letter-spacing:10px;text-indent:10px;color:rgba(241,236,224,.75)">番外 · 《兰陵王入阵曲》</div>
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
    <div style="position:absolute;left:0;right:0;top:110px;text-align:center;font:400 64px ${KAI};letter-spacing:12px;text-indent:12px;color:#e8dcc0">峡谷之外的真实历史</div>
    <div style="position:absolute;left:0;right:0;top:218px;text-align:center;font:700 44px ${KAI};letter-spacing:6px;text-indent:6px;color:#f2c96b">番外 · 一首军歌的千年漂流</div>
    <div style="position:absolute;left:36px;top:1466px;padding:8px 18px;border-radius:8px;background:rgba(0,0,0,.55);font-size:28px;letter-spacing:1px;color:#f1ece0">${CREDIT}</div>
  </body>`,
  music: musicHtml,
  // 结尾卡：二维码、网址；最下面小字是核实过的史料和乐曲出处（只显示、不念）
  end: `<body style="background:${PAPER};font-family:'Microsoft YaHei';color:#1B2A31">${TITLE}
    <div style="position:absolute;left:0;right:0;top:${PY - 90}px;display:flex;flex-direction:column;align-items:center">
      <div style="width:320px;height:650px;border-radius:46px;background:#1B2A31;padding:12px;box-sizing:border-box;box-shadow:0 26px 60px rgba(27,42,49,.3)">
        <img src="${dataUrl(path.join(OUT, 'focus.png'))}" style="width:100%;height:100%;object-fit:cover;object-position:top;border-radius:34px;display:block"></div>
      <div style="margin-top:26px;font:400 104px ${KAI};letter-spacing:.14em;margin-right:-.14em;line-height:1.1">历史长河</div>
      <div style="margin-top:6px;font-size:36px;color:#55676C;letter-spacing:.1em">一张图，看懂各国历史</div>
      <div style="display:flex;align-items:center;gap:36px;margin-top:26px">
        <div style="width:250px;height:250px;padding:10px;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(27,42,49,.18);box-sizing:border-box"><img src="${qr}" style="width:100%;height:100%;display:block"></div>
        <div style="font-size:50px;font-weight:700">${URL_SHOW}<div style="margin-top:14px;font-size:30px;font-weight:400;color:#55676C;letter-spacing:.06em">扫码看兰陵王的关系图</div>
          <div style="display:inline-block;margin-top:20px;padding:8px 22px;border-radius:40px;background:#C4472D;color:#fff;font-size:26px;font-weight:400;letter-spacing:.08em">电脑手机都能看 · 免费开放</div></div>
      </div>
    </div>
    <div style="position:absolute;left:50px;right:50px;bottom:34px;text-align:center;font-size:25px;line-height:1.5;color:#5f6c6f">${SOURCES}</div>
  </body>`,
};
QUOTES.forEach((q, i) => { pages['quote' + i] = quoteHtml(q); });
SCENES.forEach(s => { pages['scene-' + s.id] = scenePage(s); if (sceneOver[s.id]) pages[`scene-${s.id}-over`] = sceneOver[s.id]; });
await renderPages(pages, OUT, ['end', 'cover', ...SCENES.map(s => 'scene-' + s.id)]);

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
    const over = s.id === 'mask' ? ['-i', path.join(OUT, 'music.png')] : sceneOver[s.id] ? ['-i', path.join(OUT, `scene-${s.id}-over.png`)] : [];
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(OUT, `scene-${s.id}.png`), '-i', photoBig(s), ...over, '-filter_complex',
      `[1:v]scale=${w}:${h}[p];[0:v][p]overlay=${x}:${y}` + (over.length ? `[a];[a][2:v]overlay=0:0` : ''), '-frames:v', '1', path.join(OUT, 'stills', `scene-${s.id}${s.id === 'mask' ? '-music' : ''}.png`)]);
  }
  console.log('截图、样张在', path.join(OUT, 'stills'), '；底图、文字卡在', OUT);
  process.exit(0);
}

console.log(`录制 ${TOTAL.toFixed(1)}s，${frames.length} 帧`);
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ total: TOTAL, marks }, null, 1));
framesToVideo(frames, TOTAL, WORK, 'phone.mp4');

/* ---------- 开头的游戏图片：模糊的同一张图垫底，中间是人物，缓慢推近（同兰陵王第二篇） ---------- */
const introLen = at('n02') + 0.6, N = Math.round(introLen * 30);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', introLen.toFixed(3), '-i', IMG, '-i', path.join(OUT, 'intro.png'), '-filter_complex',
  `[0:v]split[a][b];[a]scale=-2:1920,crop=1080:1920,boxblur=26:4,eq=brightness=-0.3:saturation=0.75[bg];`
  + `[b]crop=794:882:520:0,scale=3176:3528:flags=lanczos,zoompan=z='1+0.1*on/${N}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1200:fps=30[fg];`
  + `[bg][fg]overlay=0:330[c];[c][1:v]overlay=0:0,format=yuv420p`,
  '-t', introLen.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', path.join(WORK, 'intro.mp4')]);

/* ---------- 照片画面：每一场一段视频，照片在框里缓慢推近 ---------- */
const XF = 0.4;   // 场与场之间交叉淡入的秒数
const tEnd = at('n14') - 0.1;
const sc = SCENES.map((s, i) => {
  const a = at(s.from) - 0.1, b = i + 1 < SCENES.length ? at(SCENES[i + 1].from) - 0.1 + XF : tEnd + 0.5;
  return { ...s, a, b };
});
for (const s of sc) {
  const [x, y, w, h] = BOX[s.id], len = s.b - s.a + 0.2, n = Math.round(len * 30);
  const over = sceneOver[s.id] ? ['-i', path.join(OUT, `scene-${s.id}-over.png`)] : [];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', len.toFixed(3), '-i', path.join(OUT, `scene-${s.id}.png`), '-i', photoBig(s), ...over, '-filter_complex',
    `[1:v]zoompan=z='1+0.05*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=${w}x${h}:fps=30[p];[0:v][p]overlay=${x}:${y}` + (over.length ? `[c];[c][2:v]overlay=0:0` : '') + `,format=yuv420p`,
    '-t', len.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', path.join(WORK, `scene-${s.id}.mp4`)]);
}

/* ---------- 字幕 ---------- */
writeSubs({ marks, shot: SHOT, vo: VO, voiceDir: VOICE, total: TOTAL, outDir: OUT, introId: 'n01' });

/* ---------- 文字卡、乐曲的时间 ---------- */
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

/* ---------- 《陵王》乐曲：只取声音，头尾淡入淡出，响度比旁白略低（合成后约 -16 LUFS，旁白约 -15） ---------- */
const SONG = path.join(OUT, 'ryoo-clip.wav');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(RYOO_AT), '-t', String(RYOO_LEN), '-i', RYOO_SRC, '-vn', '-af',
  `aresample=48000,afade=in:st=0:d=0.8,afade=out:st=${(RYOO_LEN - 1.6).toFixed(2)}:d=1.6,loudnorm=I=-23:TP=-2:LRA=11`, '-ar', '48000', '-ac', '2', SONG]);

/* ---------- 合成 ---------- */
// 输入：0 底色，1 录屏，2 外框，3 开头，4 结尾卡，5 乐曲画面上的二维码，6… 文字卡，再后是照片画面，再后是旁白、乐曲，最后是背景音乐
const T = TOTAL.toFixed(3), tIntro = at('n02') - 0.15;
const args = ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0x${PAPER.slice(1)}:s=1080x1920:r=30:d=${T}`, '-i', path.join(WORK, 'phone.mp4'), '-i', 'frame.png', '-i', path.join(WORK, 'intro.mp4'),
  '-loop', '1', '-framerate', '30', '-t', T, '-i', 'end.png', '-loop', '1', '-framerate', '30', '-t', T, '-i', 'music.png'];
QUOTES.forEach((_, i) => args.push('-loop', '1', '-framerate', '30', '-t', T, '-i', `quote${i}.png`));
const Q0 = 6, S0 = Q0 + QUOTES.length;
sc.forEach(s => args.push('-i', path.join(WORK, `scene-${s.id}.mp4`)));
const A0 = S0 + sc.length;
marks.forEach(m => args.push('-i', path.join(VOICE, VO[m.id].file)));
args.push('-i', SONG);
if (MUSIC) args.push('-i', path.resolve(MUSIC));
let vf = `[1:v]scale=${PW}:${PH}:flags=lanczos[ph];[0:v][ph]overlay=${PX}:${PY}[a];[a][2:v]overlay=0:0[b];`
  + `[3:v]format=rgba,fade=out:st=${tIntro.toFixed(3)}:d=0.45:alpha=1[in];[b][in]overlay=0:0:eof_action=pass[q0];`;
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
// 放乐曲时：二维码和说明
vf += `[5:v]format=rgba,fade=in:st=${(tSong - 0.4).toFixed(3)}:d=0.4:alpha=1,fade=out:st=${(tSongEnd + 0.2).toFixed(3)}:d=0.4:alpha=1[mq];`
  + `[${cur}][mq]overlay=0:0:enable='between(t,${(tSong - 0.4).toFixed(3)},${(tSongEnd + 0.6).toFixed(3)})'[m];`;
vf += `[4:v]format=rgba,fade=in:st=${tEnd.toFixed(3)}:d=0.5:alpha=1[end];[m][end]overlay=0:0:enable='gte(t,${tEnd.toFixed(3)})',subtitles=subs.ass,`
  + `fade=out:st=${(TOTAL - 0.8).toFixed(3)}:d=0.8,format=yuv420p[v]`;
// 旁白：每段在字幕出现后 VOLEAD 秒开始；乐曲放在 n10 念完之后
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
copyChecked(path.join(WORK, 'final.mp4'), path.join(OUT, 'lanling-song.mp4'));
console.log('成片：', path.join(OUT, 'lanling-song.mp4'), FULL + 's');
