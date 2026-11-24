// 《峡谷之外》用的局部示意地图：只画一小块区域的河流、湖泊、海岸线和几个地点，不画国界。
// 底图数据是 Natural Earth（公共领域），先下载到 promo/out/heroes/ne/（见 README“地图”一节）。
// 用法：node promo/heroes/map.mjs            全部重画
//       node promo/heroes/map.mjs lanling    只画某一张
// 出图：promo/out/heroes/maps/<id>.png（1080×1080）
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NE = path.join(HERE, '..', 'out', 'heroes', 'ne');
const OUT = path.join(HERE, '..', 'out', 'heroes', 'maps');
const SIZE = 1080;

// 地点坐标是凭记忆写的大致方位（古城按今天的所在地估），只够画示意图，不能当作考证结果。
// dx、dy 是地名文字相对圆点的偏移（像素）。
const MAPS = {
  hanxin: {
    title: '韩信走过的地方',
    box: [106.5, 31.6, 121.2, 40.2], // 西、南、东、北
    rivers: { 黄河: [110.6, 37.2], 渭河: [107.6, 34.05], 淮河: [116.2, 32.25] },
    places: [
      { name: '长安', note: '长乐宫', at: [108.87, 34.31], dx: 18, dy: 8 },
      { name: '井陉', note: '背水破赵', at: [114.0, 38.05], dx: 18, dy: 8 },
      { name: '垓下', note: '位置有争议', at: [117.55, 33.3], dx: -18, dy: -22, anchor: 'end' },
      { name: '淮阴', note: '故乡', at: [119.02, 33.6], dx: 0, dy: -62, anchor: 'middle' },
    ],
  },
  lanling: {
    title: '兰陵王：洛阳与邺城',
    box: [107.6, 32.4, 116.4, 37.8],
    rivers: { 黄河: [110.45, 36.6], 渭河: [108.2, 34.0] },
    places: [
      { name: '洛阳', note: '金墉城 · 邙山', at: [112.62, 34.72], dx: 18, dy: 34 },
      { name: '邺城', note: '北齐都城', at: [114.37, 36.22], dx: 18, dy: 8 },
      { name: '长安', note: '北周都城', at: [108.9, 34.3], dx: 18, dy: 34 },
    ],
  },
};

const load = (f) => JSON.parse(fs.readFileSync(path.join(NE, f + '.geojson'), 'utf8')).features;

function draw(id, m) {
  const [w, s, e, n] = m.box;
  const k = Math.cos(((s + n) / 2) * Math.PI / 180); // 经度按纬度收窄
  const scale = Math.min(SIZE / ((e - w) * k), SIZE / (n - s));
  const ox = (SIZE - (e - w) * k * scale) / 2, oy = (SIZE - (n - s) * scale) / 2;
  const P = ([lng, lat]) => [ox + (lng - w) * k * scale, oy + (n - lat) * scale];
  const inBox = ([lng, lat]) => lng > w - 1 && lng < e + 1 && lat > s - 1 && lat < n + 1;
  const d = (line) => line.map((c, i) => (i ? 'L' : 'M') + P(c).map((v) => v.toFixed(1)).join(' ')).join('');
  const lines = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates
    : g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : []);

  let svg = '';
  // 海：海岸线闭合不了，只画线，海面不填色
  for (const f of load('ne_10m_coastline')) for (const l of lines(f.geometry)) if (l.some(inBox))
    svg += `<path d="${d(l)}" fill="none" stroke="#7d9aa8" stroke-width="2.5"/>`;
  for (const f of load('ne_10m_lakes')) for (const l of lines(f.geometry)) if (l.some(inBox))
    svg += `<path d="${d(l)}Z" fill="#b9d2dc" stroke="#7d9aa8" stroke-width="1"/>`;
  for (const f of load('ne_10m_rivers_lake_centerlines')) {
    if (!f.geometry) continue;
    const rank = f.properties.scalerank ?? 9;
    const sw = rank <= 3 ? 5 : rank <= 5 ? 3.2 : rank <= 7 ? 2 : 1.2;
    for (const l of lines(f.geometry)) if (l.some(inBox))
      svg += `<path d="${d(l)}" fill="none" stroke="#7fa6b8" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${rank <= 7 ? 1 : 0.6}"/>`;
  }
  for (const [name, at] of Object.entries(m.rivers || {})) {
    const [x, y] = P(at);
    svg += `<text x="${x}" y="${y}" class="river">${name}</text>`;
  }
  for (const p of m.places) {
    const [x, y] = P(p.at);
    const a = p.anchor || 'start';
    svg += `<circle cx="${x}" cy="${y}" r="18" fill="#a83a2a" opacity=".18"/><circle cx="${x}" cy="${y}" r="9" fill="#a83a2a" stroke="#fff8e8" stroke-width="3"/>`;
    svg += `<text x="${x + p.dx}" y="${y + p.dy}" text-anchor="${a}" class="place">${p.name}</text>`;
    if (p.note) svg += `<text x="${x + p.dx}" y="${y + p.dy + 34}" text-anchor="${a}" class="note">${p.note}</text>`;
  }
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0}
    svg{display:block;background:#f3ead6}
    text{font-family:"Noto Serif SC","SimSun",serif;paint-order:stroke;stroke:#f3ead6;stroke-width:8px;stroke-linejoin:round}
    .place{font-size:46px;font-weight:700;fill:#3a2a1c}
    .note{font-size:27px;fill:#6b5644}
    .river{font-size:28px;fill:#4f7d92;font-style:italic;stroke-width:6px}
    .cap{font-size:22px;fill:#8a7763;stroke:none}
  </style><svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    ${svg}
    <text x="${SIZE - 24}" y="${SIZE - 22}" text-anchor="end" class="cap">示意图 · 河流为今天的河道 · 地点为大致方位</text>
  </svg>`;
}

fs.mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
for (const [id, m] of Object.entries(MAPS)) {
  if (want.length && !want.includes(id)) continue;
  await page.setContent(draw(id, m));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, id + '.png') });
  console.log('画好', id);
}
await browser.close();
