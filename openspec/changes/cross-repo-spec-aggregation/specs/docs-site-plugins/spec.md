## ADDED Requirements

### Requirement: 仅消费同步引擎的内容树，不直接访问远程仓库
`rspress` 与 `vitepress` 两个插件适配层 SHALL 仅消费 `spec-sync-engine` 产出的规范化内容树，不自行发起任何针对源仓库的网络/git 访问；框架专属代码的职责范围仅限于把这棵内容树翻译成各自框架的路由/侧边栏/导航 API。

#### Scenario: 内容树已同步到本地即可完整构建
- **WHEN** 某仓库的内容树已经由同步引擎产出并落盘，且当前处于离线环境
- **THEN** 对应插件仍能基于已同步的内容树完整生成该仓库的路由与侧边栏，不因缺少网络而失败

### Requirement: 多仓库路由命名空间
生成的路由 SHALL 按 org 与 repo 维度做命名空间隔离（形如 `/<org>/<repo>/specs/<capability>`、`/<org>/<repo>/changes/<slug>`），不允许把不同仓库的路由拍平到同一层级。

#### Scenario: 两个仓库各有一个同名 capability 互不覆盖
- **WHEN** 两个不同仓库各自都存在一个名为 `auth` 的 capability
- **THEN** 两者分别可以通过各自的 `/<org>/<repo>/specs/auth` 路径独立访问，其中一个不会覆盖或遮蔽另一个

### Requirement: 跨仓库统一搜索
由于所有已注册仓库的内容最终都落进同一个构建产物，站点 SHALL 提供覆盖全部已注册仓库的统一搜索能力，且不需要针对每个仓库单独配置搜索索引。

#### Scenario: 搜索命中多个仓库的结果
- **WHEN** 用户在站点搜索框中输入一个在多个已注册仓库中都出现过的关键词
- **THEN** 搜索结果中包含来自不同仓库、各自带有明确来源标识的匹配项
