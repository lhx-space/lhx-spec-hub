## ADDED Requirements

### Requirement: 输出规范化的仓库内容树
给定一个已注册仓库的 `openspec/` 子树，同步引擎 SHALL 产出一棵按 org/repo 命名空间归一化的内容树，且仅包含两类集合：当前的 capability specs（来自 `specs/<capability>/spec.md`）与已归档的历史变更（来自 `changes/archive/<date>-<name>/`）。仍在进行中、尚未归档的 `changes/<name>/` SHALL NOT 被包含。

#### Scenario: 仓库同时存在 specs 与 archive 内容
- **WHEN** 一个已注册仓库的 `openspec/` 下同时存在 `specs/` 与 `changes/archive/`
- **THEN** 同步后的内容树同时包含对应的 capability 集合与 archived-change 集合

#### Scenario: 进行中的变更被排除
- **WHEN** 一个已注册仓库存在尚未归档的 `changes/<name>/` 目录
- **THEN** 该目录的内容不出现在同步后的内容树中

### Requirement: capability 关联历史变更
对于每一个 capability，同步引擎 SHALL 通过检查每个已归档变更自身是否包含 `specs/<capability>/` 这个 delta 目录来判定该变更是否触达过这个 capability，并将命中的历史变更按归档日期排序，作为该 capability 内容节点上的关联引用列表暴露出去。

#### Scenario: capability 关联到确实提交过该 capability delta 的历史变更
- **WHEN** 某个已归档变更的 `specs/error-monitor/` 目录下存在 delta 文件
- **THEN** `error-monitor` 这个 capability 的关联历史变更列表中包含该变更，且列表按归档日期排序

#### Scenario: 没有历史变更触达的 capability 关联列表为空
- **WHEN** 某个 capability 从未出现在任何已归档变更的 `specs/` delta 中
- **THEN** 该 capability 的关联历史变更列表为空，而不是报错或缺失该字段

### Requirement: 全量重新同步，不做增量 diff
每一次同步操作 SHALL 完整重新读取已注册仓库的整个 `specs/` 与 `changes/archive/` 子树，并整体替换上一次同步产出的内容树，而不尝试增量 diff；但同步失败时 SHALL 保留上一次成功同步的内容树不被清空。

#### Scenario: 上游已被删除的 spec 在下一次同步后消失
- **WHEN** 某个 capability 对应的 `specs/<capability>/spec.md` 在源仓库中被删除后触发了新一次同步
- **THEN** 同步后的内容树中不再包含该 capability

#### Scenario: 同步失败不清空已有内容
- **WHEN** 一次同步操作因网络或权限问题失败
- **THEN** 该仓库此前一次成功同步产出的内容树保持不变，不会因为本次失败而被清空

### Requirement: 原始 Markdown 保真，不做语义转换
同步引擎 SHALL 原样（逐字节）传递 capability spec 与历史变更文档的 Markdown 正文，不对其标题层级、列表结构做解析或语义转换；呈现层的改进（如需要）属于 `docs-site-plugins` 的职责，不属于同步引擎。

#### Scenario: spec.md 原文标题层级保持不变
- **WHEN** 某个 capability 的 `spec.md` 中包含 `### Requirement:` 与 `#### Scenario:` 标题
- **THEN** 内容树中对应字段保留这些标题层级不变，不被拍平或重新编号
