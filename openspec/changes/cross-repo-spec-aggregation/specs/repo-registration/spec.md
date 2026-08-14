## ADDED Requirements

### Requirement: 无需上游 openspec CLI 支持的独立注册命令
系统 SHALL 提供一个独立于上游 `openspec` CLI 的注册命令（上游没有插件/hook 机制，无法挂载），供仓库所有者一次性运行以将该仓库的 git remote 注册到中央平台。

#### Scenario: 首次注册成功
- **WHEN** 仓库所有者在已配置好全局 profile 的机器上，于目标仓库内运行注册命令
- **THEN** 中央平台记录该仓库，后续对该仓库的同步得以进行

#### Scenario: 未配置全局 profile 时给出明确指引
- **WHEN** 仓库所有者在从未配置过全局 profile 的机器上运行注册命令
- **THEN** 命令给出如何配置 profile（中央平台地址与凭证）的明确指引，而不是模糊的失败报错

### Requirement: 全局 profile 复用
注册命令 SHALL 读取一份全局 profile（中央平台地址 + 凭证），使得在同一台机器上注册第二个及以后的仓库时无需重新填写平台连接信息。

#### Scenario: 同一机器注册第二个仓库无需重新配置
- **WHEN** 某台机器已经通过注册第一个仓库配置好了全局 profile
- **THEN** 在该机器上注册第二个仓库时，注册命令直接复用已有 profile 中的平台地址与凭证
