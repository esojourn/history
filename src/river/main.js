// 时间长河页面的入口：取数据，按屏幕宽度启动桌面版或手机版。
import { createModel } from '../lib/model.js';
import { makeCard } from '../lib/card.js';
import { createSearch } from './search.js';
import { desktop } from './desktop.js';
import { mobile } from './mobile.js';
import { isMobile, fontButtons } from './util.js';

(async () => {
  const app = document.querySelector('#app');
  const data = await (await fetch(app.dataset.src)).json();
  const H = createModel(data, app.dataset.base);
  const card = makeCard(H), search = createSearch(H);
  fontButtons();

  if (isMobile()) { document.querySelector('#m').hidden = false; mobile(H, card, search); }
  else { document.querySelector('#d').hidden = false; desktop(H, card, search); }
})();

// 跨过手机和桌面的分界线时重新载入，换成另一套布局
const was = isMobile();
addEventListener('resize', () => { if (isMobile() !== was) location.reload(); });
