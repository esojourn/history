import { defineConfig } from 'astro/config';

// 纯静态站点：`npm run build` 生成 dist/，整个目录放到任何能放静态文件的主机上即可。
export default defineConfig({
  devToolbar: { enabled: false },
});
