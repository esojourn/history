// 桌面版和手机版共用的小工具。

// 生年或卒年不详的人，条的那一头渐隐。pre = h（横向，桌面）或 v（纵向，手机）
const grad = (id, c, stops, vert) => `<linearGradient id="${id}"${vert ? ' x2="0" y2="1"' : ''}>${stops.map(([o, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
export const fades = (H, pre) => Object.entries(H.FAC).map(([id, f]) =>
  grad(`${pre}l-${id}`, f.c, [[0, 0], [.7, .22]], pre === 'v') + grad(`${pre}r-${id}`, f.c, [[.3, .22], [1, 0]], pre === 'v') +
  grad(`${pre}b-${id}`, f.c, [[0, 0], [.35, .22], [.65, .22], [1, 0]], pre === 'v')).join('');
export const fadeOf = (p, pre) => (p.b == null && p.dq ? `url(#${pre}b-${p.fac})` : p.b == null ? `url(#${pre}l-${p.fac})` : p.dq ? `url(#${pre}r-${p.fac})` : null);

// 字号：1 是最小（原来的大小），往上放大几档。选择记在浏览器里，各页面通用（Base.astro 载入时就套用）。
// 网页文字靠 CSS 变量 --fz 放大；时间长河的图整张按同一倍数放大，字和条一起变大，不会互相挤压。
export const FZ = [1, 1.15, 1.3, 1.5];
export const fz = () => +getComputedStyle(document.documentElement).getPropertyValue('--fz') || 1;
export function fontButtons() {
  const sync = () => document.querySelectorAll('[data-fz]').forEach(b => { b.disabled = b.dataset.fz < 0 ? fz() <= FZ[0] : fz() >= FZ[FZ.length - 1]; });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-fz]'); if (!b) return;
    const i = FZ.findIndex(v => v >= fz() - .001), z = FZ[Math.max(0, Math.min(FZ.length - 1, i + +b.dataset.fz))];
    document.documentElement.style.setProperty('--fz', z);
    try { localStorage.setItem('fz', z); } catch (_) {}
    sync(); dispatchEvent(new Event('fzchange'));
  });
  sync();
}

export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isMobile = () => matchMedia('(max-width: 720px)').matches;

// 选中的对象写进地址栏，方便把链接发给别人：#person/han-xin、#event/gaixia
export const setHash = sel => history.replaceState(null, '', sel ? `#${sel.t === 'p' ? 'person' : 'event'}/${sel.id}` : location.pathname + location.search);
export const readHash = H => {
  const h = decodeURIComponent(location.hash.slice(1)), m = h.match(/^(person|event)\/(.+)$/);
  if (m && (m[1] === 'person' ? H.P : H.E)[m[2]]) return { sel: { t: m[1] === 'person' ? 'p' : 'e', id: m[2] } };
  return { view: h };
};
// 详情卡里的人名、事件名是真链接（指向独立页面）。在时间长河里普通点击改为就地切换；按住 Ctrl 等键点击仍然新开页面。
export const cardTarget = e => {
  const a = e.target.closest('[data-go], [data-goe]');
  if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return null;
  e.preventDefault();
  return a.dataset.go ? { t: 'p', id: a.dataset.go } : { t: 'e', id: a.dataset.goe };
};
