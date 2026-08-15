# @luhanxin/spec-hub-vitepress-plugin

> 把 `spec-hub.config.yaml` 里注册的所有仓库（[`@luhanxin/spec-hub-core`](../core) 产出的
> `RegistrySyncResult[]`）渲染成一个真实 VitePress 站点的构建期辅助函数 ——
> [lhx-spec-hub](../../README.zh-CN.md) 的一部分。

跟 rspress 不同，VitePress 没有插入"虚拟页面"的插件钩子——它的路由完全基于文件。所以这个包是一个
普通的异步函数 `writeSpecHubVitepressPages`，需要在你自己的 `.vitepress/config.ts` 里、VitePress
读取 `srcDir` **之前** 被 await 调用。给定已同步好的 `RegistrySyncResult[]`（通常来自
`loadAndSyncRegistry('spec-hub.config.yaml')`），它会写出：

- **首页**（`index.md`）—— 用的是 VitePress 真正的首页布局（`layout: 'home'` frontmatter，
  `hero` + `features`，通过 VitePress 内置的首页主题组件渲染——不是手写的一堆项目符号列表）。
  每个注册的仓库对应一张 feature 卡片，标题/描述取自 `spec-hub.config.yaml` 里的
  `entry.name`/`entry.description`，没配置的话 fallback 到 `{org}/{repo}` 和该仓库 `README.md`
  的一句话摘要。点击卡片进入该仓库自己的页面。
- **仓库首页（"Introduction"）** —— 该仓库的 `README.md`（或 `README.zh-CN.md`），原文直出。
- **capability 页面**（`/<org>/<repo>/specs/<slug>.md`）—— 该 capability 的 `spec.md` 原文，
  外加一个 "History" 区块，链接到每一个动过它的 archived change。
- **archived change 页面**（`/<org>/<repo>/changes/<slug>.md`）—— `proposal.md`、`design.md`、
  `tasks.md`（存在的话），**以及**一个 "Spec Deltas" 区块，展示该 change 下
  `changes/archive/<dir>/specs/<slug>/spec.md` 的真实 ADDED/MODIFIED/REMOVED Requirements 内容
  ——每个动过的 capability 都会列出，并链接回它当前的 capability 页面。

它还会返回一份可以直接用的 `themeConfig.sidebar` 片段——每个仓库一条 "Introduction" + 一个
"Specs" 分组 + 一个 "Changes" 分组（新的在前）。VitePress 的上一页/下一页完全是从侧边栏条目顺序
算出来的，所以这个 `sidebar` 返回值就是让上一页/下一页生效的东西——没有另外一个单独的
"上一页/下一页" API 要调。

## 安装

```bash
pnpm add @luhanxin/spec-hub-vitepress-plugin @luhanxin/spec-hub-core vitepress
```

## 用法

```ts
// docs/.vitepress/config.ts
import {loadAndSyncRegistry} from '@luhanxin/spec-hub-core';
import {writeSpecHubVitepressPages} from '@luhanxin/spec-hub-vitepress-plugin';

export default (async () => {
  // spec-hub.config.yaml 列出这个站点要聚合哪些仓库——格式说明见
  // @luhanxin/spec-hub-core 的 README（gitRepoUrl/path、name、description……）。
  const repos = await loadAndSyncRegistry(new URL('../../spec-hub.config.yaml', import.meta.url).pathname);
  const {sidebar} = await writeSpecHubVitepressPages({repos, docsRoot: __dirname + '/..'});

  return {
    title: 'Spec Hub',
    themeConfig: {sidebar}
  };
})();
```

VitePress 的 `defineConfig()` 类型只接受一个普通的 `UserConfig` 对象（不接受 `Promise`），所以这个
示例故意没有用它，直接导出异步 IIFE 的结果——VitePress 的配置加载器本身两种都认
（`UserConfig | Promise<UserConfig>`）。

## 脚本

```bash
pnpm build         # 用 tsup 构建 dist/
pnpm dev           # watch 模式重新构建
pnpm typecheck     # tsc --noEmit
pnpm test          # vitest run
pnpm verify:build  # 需要同级目录存在 ../../../yjs-docs —— 针对其真实的
                   # openspec/ 内容跑一次真实的 `vitepress build`
```

## 还没做的事

- 每个仓库的顶部 `nav` 条目（目前只有 `themeConfig.sidebar`，没有常驻顶部导航）
- 原始 `spec.md`/`proposal.md` markdown 的展示层转换（刻意延后，见
  `openspec/changes/cross-repo-spec-aggregation/design.md` 的 Decision 6）
- 清理不再对应任何已同步内容的旧 `.md` 文件（这个函数只会写入/覆盖，从不删除）

## License

[MIT](./LICENSE) © luhanxin
