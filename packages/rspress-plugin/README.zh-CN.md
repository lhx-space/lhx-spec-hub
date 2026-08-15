# @luhanxin/spec-hub-rspress-plugin

> 把 [`@luhanxin/spec-hub-core`](../core) 同步出来的 `RepoContent` 内容树渲染成 rspress 站点的插件 —— [lhx-spec-hub](../../README.zh-CN.md) 的一部分。

消费 `@luhanxin/spec-hub-core` 针对一个或多个已同步仓库产出的 `capabilities`/`archivedChanges`，
通过 rspress 的 `addPages` 插件钩子转换成路由。本插件从不直接访问远程仓库或网络——"内容怎么同步过来"
完全是 `@luhanxin/spec-hub-core` 的职责（完整架构见根目录 `openspec/` 下的设计文档）。

路由按 `/<org>/<repo>/specs/<capability>` 与 `/<org>/<repo>/changes/<slug>` 做命名空间隔离，
两个不同仓库各自的同名 capability 不会互相覆盖。

## 安装

```bash
pnpm add @luhanxin/spec-hub-rspress-plugin @luhanxin/spec-hub-core rspress
```

## 用法

```ts
// rspress.config.ts
import {defineConfig} from 'rspress/config';
import {specHubRspressPlugin} from '@luhanxin/spec-hub-rspress-plugin';
import type {RepoContent} from '@luhanxin/spec-hub-core';

declare const repos: RepoContent[]; // 按你自己的方式加载已同步的内容

export default defineConfig({
  plugins: [specHubRspressPlugin({repos})]
});
```

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

- 侧边栏/导航生成（页面可以通过直接 URL 访问，但暂未接入导航）
- 原始 `spec.md`/`proposal.md` markdown 的展示层转换（刻意延后，直到原文渲染出来确实不好看再做——
  见 `openspec/changes/cross-repo-spec-aggregation/design.md` 的 Decision 6）

## License

[MIT](./LICENSE) © luhanxin
