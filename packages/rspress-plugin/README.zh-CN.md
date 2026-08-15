# @luhanxin/spec-hub-rspress-plugin

> 把 `spec-hub.config.yaml` 里注册的所有仓库（[`@luhanxin/spec-hub-core`](../core) 产出的
> `RegistrySyncResult[]`）渲染成一个真实的 rspress 站点的插件 —— [lhx-spec-hub](../../README.zh-CN.md)
> 的一部分。

消费已同步好的 `RegistrySyncResult[]`（通常来自 `loadAndSyncRegistry('spec-hub.config.yaml')`），
把它变成一个真实的 rspress 站点：

- **首页** —— 用的是 rspress 真正的首页布局（`pageType: 'home'` frontmatter，`hero` + `features`，
  通过 rspress 内置的 `HomeLayout`/`HomeHero`/`HomeFeature` 组件渲染——不是手写的一堆项目符号列表）。
  每个注册的仓库对应一张 feature 卡片，标题/描述取自 `spec-hub.config.yaml` 里的
  `entry.name`/`entry.description`，没配置的话 fallback 到 `{org}/{repo}` 和该仓库 `README.md`
  的一句话摘要。点击卡片进入该仓库自己的页面。
- **仓库首页（"Introduction"）** —— 该仓库的 `README.md`（或 `README.zh-CN.md`），原文直出。
- **capability 页面**（`/<org>/<repo>/specs/<slug>`）—— 该 capability 的 `spec.md` 原文，外加一个
  "History" 区块，链接到每一个动过它的 archived change。
- **archived change 页面**（`/<org>/<repo>/changes/<slug>`）—— `proposal.md`、`design.md`、
  `tasks.md`（存在的话），**以及**一个 "Spec Deltas" 区块，展示该 change 下
  `changes/archive/<dir>/specs/<slug>/spec.md` 的真实 ADDED/MODIFIED/REMOVED Requirements 内容
  ——每个动过的 capability 都会列出，并链接回它当前的 capability 页面。
- **侧边栏 + 上一页/下一页** —— 每个仓库都有一份真实的侧边栏（通过本插件的 `config` 钩子合并进
  `themeConfig.sidebar`）：一条 "Introduction" + 一个 "Specs" 分组 + 一个 "Changes" 分组（新的在
  前）。rspress 的上一页/下一页完全是从侧边栏条目顺序算出来的，所以这就是让上一页/下一页生效的
  东西——没有另外一个单独的"上一页/下一页" API 要调。

本插件从不直接访问远程仓库或网络——"内容怎么同步过来"完全是 `@luhanxin/spec-hub-core` 的职责
（完整架构见根目录 `openspec/` 下的设计文档）。

路由按 `/<org>/<repo>/specs/<capability>` 与 `/<org>/<repo>/changes/<slug>` 做命名空间隔离，
两个不同仓库各自的同名 capability 不会互相覆盖。

## 为什么没有像 vitepress 插件那样的"写页面"步骤？

rspress 专门提供了一个 `addPages` 插件钩子，用来注入不对应磁盘上任何文件的页面——整个站点（首页、
仓库页、capability 页、change 页）都是从这一个钩子在构建/开发服务器阶段、完全在内存里生成的，从来
不会往 `docs/` 目录写任何东西。VitePress 没有等价的钩子（它的路由完全基于文件），这正是
`@luhanxin/spec-hub-vitepress-plugin` 需要一个显式的 `writeSpecHubVitepressPages` 步骤、真的把
`.md` 文件写到磁盘上（在 VitePress 启动之前）的原因。这是两个框架之间一个真实的、有实际影响的差异，
不是这个包里漏掉的东西。

## 安装

```bash
pnpm add @luhanxin/spec-hub-rspress-plugin @luhanxin/spec-hub-core rspress
```

## 用法

```ts
// rspress.config.ts
import {defineConfig} from 'rspress/config';
import {loadAndSyncRegistry} from '@luhanxin/spec-hub-core';
import {specHubRspressPlugin} from '@luhanxin/spec-hub-rspress-plugin';

// spec-hub.config.yaml 列出这个站点要聚合哪些仓库——格式说明见
// @luhanxin/spec-hub-core 的 README（gitRepoUrl/path、name、description……）。
const repos = await loadAndSyncRegistry(new URL('./spec-hub.config.yaml', import.meta.url).pathname);

export default defineConfig({
  root: 'docs',
  plugins: [specHubRspressPlugin({repos})]
});
```

rspress 的配置加载器支持 `Promise<UserConfig>` 形式的默认导出，所以上面的顶层 `await` 没问题。

## 脚本

```bash
pnpm build         # 用 tsup 构建 dist/
pnpm dev           # watch 模式重新构建
pnpm typecheck     # tsc --noEmit
pnpm test          # vitest run
pnpm verify:build  # 需要同级目录存在 ../../../yjs-docs —— 针对其真实的
                   # openspec/ 内容跑一次真实的 `rspress build`
```

## 还没做的事

- 每个仓库的顶部 `nav` 条目（目前仓库只能通过首页卡片 + 侧边栏访问，没有常驻顶部导航）
- 原始 `spec.md`/`proposal.md` markdown 的展示层转换（刻意延后，直到原文渲染出来确实不好看再做——
  见 `openspec/changes/cross-repo-spec-aggregation/design.md` 的 Decision 6）

## License

[MIT](./LICENSE) © luhanxin
