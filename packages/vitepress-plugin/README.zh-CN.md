# @luhanxin/spec-hub-vitepress-plugin

> 把 [`@luhanxin/spec-hub-core`](../core) 同步出来的 `RepoContent` 内容树渲染成 VitePress 站点的
> 构建期辅助函数 —— [lhx-spec-hub](../../README.zh-CN.md) 的一部分。

跟 rspress 不同，VitePress 没有插入"虚拟页面"的插件钩子——它的路由完全基于文件。所以这个包是一个
普通的异步函数 `writeSpecHubVitepressPages`，需要在你自己的 `.vitepress/config.ts` 里、VitePress
读取 `srcDir` **之前** 被 await 调用：它会往 `<org>/<repo>/specs/<slug>.md` /
`<org>/<repo>/changes/<slug>.md` 写入真实的 `.md` 文件，并返回一份可以直接用的
`themeConfig.sidebar` 片段。

## 安装

```bash
pnpm add @luhanxin/spec-hub-vitepress-plugin @luhanxin/spec-hub-core vitepress
```

## 用法

```ts
// docs/.vitepress/config.ts
import {writeSpecHubVitepressPages} from '@luhanxin/spec-hub-vitepress-plugin';
import type {RepoContent} from '@luhanxin/spec-hub-core';

declare const repos: RepoContent[]; // 按你自己的方式加载已同步的内容

export default (async () => {
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

- 导航生成（目前只有 `themeConfig.sidebar`，没有顶部导航项）
- 原始 `spec.md`/`proposal.md` markdown 的展示层转换（刻意延后，见
  `openspec/changes/cross-repo-spec-aggregation/design.md` 的 Decision 6）
- 清理不再对应任何已同步内容的旧 `.md` 文件（这个函数只会写入/覆盖，从不删除）

## License

[MIT](./LICENSE) © luhanxin
