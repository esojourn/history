// 手机版跨国关系示例的本地服务器：在仓库根目录运行  node prototypes/links/serve.mjs
// 示例页直接用正式站点的数据（data/ + locales/，现场合成）和代码（src/lib、src/river），不另存数据副本。
// 默认只有本机能打开。想用同一 Wi-Fi 下的真手机试，加 --lan 运行（地址见启动时的输出）：
//   node prototypes/links/serve.mjs --lan
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ROOT, build } from '../../src/lib/dataset.mjs';

const PORT = +process.env.PORT || 4340, LAN = process.argv.includes('--lan');
const DATA = JSON.stringify(build('zh'));
const TYPES ={ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/') { res.writeHead(302, { Location: '/prototypes/links/' }); return res.end(); }
  if (url === '/data/zh.json') {
    // 启动时合成一次；改了数据要重启服务器才看得到
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(DATA);
  }
  let f = path.join(ROOT, url);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': (TYPES[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, LAN ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`示例已启动：http://localhost:${PORT}/prototypes/links/`);
  if (LAN) for (const list of Object.values(os.networkInterfaces())) for (const a of list || [])
    if (a.family === 'IPv4' && !a.internal) console.log(`同一 Wi-Fi 下的手机打开：http://${a.address}:${PORT}/prototypes/links/`);
});
