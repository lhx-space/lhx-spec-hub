## 1. `@luhanxin/spec-hub-core` —— 类型与数据结构

- [x] 1.1 定义 `CapabilitySpec`/`ArchivedChange`/`RepoContent` 类型，对应 design.md Decision 6 里的两类集合（slug、verbatim markdown、关联引用列表等字段）
- [x] 1.2 定义读取入口的输入类型：仅接受本地路径 + `{org, repo}` 命名空间标识，本轮不涉及任何远程拉取/网络访问

## 2. 读取与归一化（仅支持本地路径）

- [x] 2.1 实现遍历 `specs/<capability>/spec.md` 产出 `CapabilitySpec[]`（markdown 原文逐字节保留，不解析、不转换）
- [x] 2.2 实现遍历 `changes/archive/<date>-<name>/` 产出 `ArchivedChange[]`（从目录名解析 `archivedDate`/`slug`，`proposal.md`/`design.md`/`tasks.md` 原文保留，`design.md`/`tasks.md` 缺失时对应字段为可选）
- [x] 2.3 实现 capability ↔ archived change 关联判定：检查每个已归档变更是否存在对应 `specs/<slug>/` 目录，命中的按归档日期排序写入 `CapabilitySpec.relatedChanges`
- [x] 2.4 显式忽略 `changes/<name>/`（未归档目录）：不读取，也不因为它存在而报错

## 3. 同步语义

- [x] 3.1 实现"整体重新读取并替换"的同步入口函数，不做增量 diff
- [x] 3.2 同步失败（如目录不可读）时保留上一次成功产出的内容树不被清空，返回明确的失败信号而不是静默清空

## 4. 用真实数据验证

- [x] 4.1 以 `yjs-docs` 的 `openspec/` 作为本地 fixture 跑一次同步，人工核对产出的内容树跟真实的 24 个 specs + 已归档变更一一对得上
- [x] 4.2 针对 `specs/spec-sync-engine/spec.md` 里的每条 Scenario 编写对应单测（复用同一份 fixture 或临时构造的最小目录）

## 5. `docs-site-plugins` —— 先搭最小可运行骨架

- [ ] 5.1 用 `lhx-cli add package` 新建 `packages/rspress-plugin`、`packages/vitepress-plugin`，依赖 `@luhanxin/spec-hub-core`
- [ ] 5.2 每个插件实现最小可运行版本：消费内容树，生成 `/<org>/<repo>/specs/<capability>` 与 `/<org>/<repo>/changes/<slug>` 两类路由（本轮不做搜索、不做展示层转换）
- [ ] 5.3 用第 4 节里 yjs-docs fixture 产出的内容树，分别跑通 rspress 与 vitepress 的本地构建，确认两个站点都能正常生成

## 6. `repo-registration` —— 本轮只解决协议设计，不做实现

- [ ] 6.1 敲定注册协议字段（仓库 URL、默认分支、`openspec/` 子路径、返回的凭证形状），更新 design.md 消解对应 Open Question
- [ ] 6.2 敲定 push 触发的 ingest payload 形状，更新 design.md 消解对应 Open Question
- [ ] 6.3 6.1/6.2 敲定后再评估是否在本 change 内实现，还是拆成后续 change（取决于此时中央平台的部署目标是否也已确定）

## 7. 内容源协议化（实现阶段发现的架构改进，回填 1-4 组）

- [x] 7.1 抽出 `RepoContentSource` 协议接口，把 1-4 组里直接调用 `node:fs` 的读取逻辑收进 `DiskContentSource`（协议的第一个、也是目前唯一的实现），`associate.ts`/`sync.ts` 改为只认协议、不再直接触碰文件系统——不改变 1-4 组任何 Scenario 的外部行为，只是把"怎么拿到字节"这一步做成可插拔的，见 design.md Decision 7
- [x] 7.2 新增一个纯内存的 fake `RepoContentSource` 实现（仅供测试），把 1-4 组关键 Scenario 对着这个 fake 源用 `describe.each` 跟 `DiskContentSource` 各跑一遍，证明协议抽象是真的成立、不是只在磁盘场景下凑巧能跑


