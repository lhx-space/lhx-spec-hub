## 1. `@luhanxin/spec-hub-core` —— 类型与数据结构

- [ ] 1.1 定义 `CapabilitySpec`/`ArchivedChange`/`RepoContent` 类型，对应 design.md Decision 6 里的两类集合（slug、verbatim markdown、关联引用列表等字段）
- [ ] 1.2 定义读取入口的输入类型：仅接受本地路径 + `{org, repo}` 命名空间标识，本轮不涉及任何远程拉取/网络访问

## 2. 读取与归一化（仅支持本地路径）

- [ ] 2.1 实现遍历 `specs/<capability>/spec.md` 产出 `CapabilitySpec[]`（markdown 原文逐字节保留，不解析、不转换）
- [ ] 2.2 实现遍历 `changes/archive/<date>-<name>/` 产出 `ArchivedChange[]`（从目录名解析 `archivedDate`/`slug`，`proposal.md`/`design.md`/`tasks.md` 原文保留，`design.md`/`tasks.md` 缺失时对应字段为可选）
- [ ] 2.3 实现 capability ↔ archived change 关联判定：检查每个已归档变更是否存在对应 `specs/<slug>/` 目录，命中的按归档日期排序写入 `CapabilitySpec.relatedChanges`
- [ ] 2.4 显式忽略 `changes/<name>/`（未归档目录）：不读取，也不因为它存在而报错

## 3. 同步语义

- [ ] 3.1 实现"整体重新读取并替换"的同步入口函数，不做增量 diff
- [ ] 3.2 同步失败（如目录不可读）时保留上一次成功产出的内容树不被清空，返回明确的失败信号而不是静默清空

## 4. 用真实数据验证

- [ ] 4.1 以 `yjs-docs` 的 `openspec/` 作为本地 fixture 跑一次同步，人工核对产出的内容树跟真实的 24 个 specs + 已归档变更一一对得上
- [ ] 4.2 针对 `specs/spec-sync-engine/spec.md` 里的每条 Scenario 编写对应单测（复用同一份 fixture 或临时构造的最小目录）

## 5. `docs-site-plugins` —— 先搭最小可运行骨架

- [ ] 5.1 用 `lhx-cli add package` 新建 `packages/rspress-plugin`、`packages/vitepress-plugin`，依赖 `@luhanxin/spec-hub-core`
- [ ] 5.2 每个插件实现最小可运行版本：消费内容树，生成 `/<org>/<repo>/specs/<capability>` 与 `/<org>/<repo>/changes/<slug>` 两类路由（本轮不做搜索、不做展示层转换）
- [ ] 5.3 用第 4 节里 yjs-docs fixture 产出的内容树，分别跑通 rspress 与 vitepress 的本地构建，确认两个站点都能正常生成

## 6. `repo-registration` —— 本轮只解决协议设计，不做实现

- [ ] 6.1 敲定注册协议字段（仓库 URL、默认分支、`openspec/` 子路径、返回的凭证形状），更新 design.md 消解对应 Open Question
- [ ] 6.2 敲定 push 触发的 ingest payload 形状，更新 design.md 消解对应 Open Question
- [ ] 6.3 6.1/6.2 敲定后再评估是否在本 change 内实现，还是拆成后续 change（取决于此时中央平台的部署目标是否也已确定）
