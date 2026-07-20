# SillyTavern 自动插画 - Conso 版

[English](README_EN.md)

一款 SillyTavern 扩展，让你**边聊天边自动生成插图**。LLM 读取你的对话，提取画面描述，转换为图片生成提示词，实时生成插图——故事推进的同时，画面也跟着出来。

**Fork 自：** [Hao19911125/sillytavern-simplified-illustrator](https://github.com/Hao19911125/sillytavern-simplified-illustrator)，原始项目为 [gamer-mitsuha/sillytavern-auto-illustrator](https://github.com/gamer-mitsuha/sillytavern-auto-illustrator)

---

## 工作原理

```
你发送一条消息
       ↓
LLM 生成回复（流式输出）
       ↓
插件检测回复中的画面场景
       ↓
LLM 将场景转化为图片提示词（如 NovelAI 标签）
       ↓
图片生成 API 生成图片
       ↓
图片内嵌显示在聊天中
```

---

## 快速开始

前置条件：SillyTavern 已运行，并且原生 `/sd` 生图命令可用。

从酒馆扩展安装页安装：

```
https://github.com/Asobi-123/sillytavern-conso-illustrator
```

或手动安装：

```bash
cd SillyTavern/data/default-user/extensions/
git clone https://github.com/Asobi-123/sillytavern-conso-illustrator.git
```

完整配置流程见：[从零开始配置教程](docs/QUICKSTART_CN.md)。

---

## 功能一览

### 核心功能

| 功能 | 说明 |
|------|------|
| **自动插画** | 流式输出时实时检测画面场景并生成图片 |
| **悬浮主控台** | 主控台、提示词设置、画廊、独立生图、提示词仓库集中操作 |
| **双模式提示词编辑** | AI 优化 或 手动直编，自由切换 |
| **独立生图工作台** | 脱离聊天上下文——描述场景或直接粘贴提示词即可出图 |
| **流式预览** | 实时预览控件，展示流式文本和内联图片 |
| **图像查看器** | 全功能查看器：缩放、平移、旋转、导航、下载 |
| **图库控件** | 悬浮图库，按消息分组展示所有已生成图片 |
| **提示词仓库** | 上传 NovelAI PNG 自动提取提示词和参数，搜索/编辑/复制/分类管理 |

### 提示词增强

| 功能 | 说明 |
|------|------|
| **角色卡注入** | 自动将角色外貌、性格、用户 Persona 发送给 LLM |
| **角色固定 Tag** | 为每个角色锁定外貌标签；可保留旧式前置注入，也可用结构感知模式按角色段插入 |
| **世界书注入** | 插件独立的世界书选择，按聊天保存 |
| **通用样式 Tag** | 全局前缀/后缀标签，应用到所有生成的提示词 |
| **Tag 超市** | 内置离线 catalog，可搜索、分页、复制、加入通用标签、补自定义 tag 和中文触发词 |
| **AI 候选 Tag** | 独立提示词生成时只发送当前文本命中的少量候选 tag；候选数量可编辑，最近一次候选可查看 |
| **内置正则过滤** | 保留正文里的插画元数据，只从发送给模型的 prompt 中过滤插画标签 |
| **预设适配** | 上传 JSON / 文本或输入需求，生成 Conso 原生共享 API 元提示或独立 API 指南草稿 |
| **生图 SD Style 和 Vibe 组合** | 可选择关闭、固定或每次生图随机抽取 SD Style / Vibe 组合，并可保存常用搭配 |
| **NovelAI Vibe Transfer** | 可选参考图和编码 Vibe 生图增强；支持文生图和独立生图、Vibe 管理、编码/带图 `.naiv4vibe`、bundle 导入与分组 JSON 导入导出、V4/V4.5 编码缓存 |
| **NovelAI 局部重绘** | 在已有图片上绘制遮罩，预览重绘结果后再选择追加或替换原图；支持缩放画布、边缘羽化、遮罩外扩和边界保护 |
| **消息内容过滤** | 移除 HTML 标签和 CSS 噪音，减少无效 token |
| **元提示预设** | 内置预设（Default、NAI 4.5 Full）+ 自定义预设管理 |

### 配置与管理

| 功能 | 说明 |
|------|------|
| **两种生成模式** | 共享 API（零配置）或 独立 API（更干净的 AI 回复） |
| **独立 LLM API** | 支持任何 OpenAI 兼容 API，自动获取模型列表、连接测试 |
| **聊天失败手动重试** | 独立 API 模式下若聊天提示词生成失败，消息内可手动重跑一次 |
| **API 配置档案** | 保存/切换/删除命名的 API 配置方案 |
| **指南预设** | 管理独立 API 模式的频率指南和提示词编写指南 |
| **图片子文件夹** | 按聊天整理图片，使用子文件夹标签 |
| **主题切换** | 为悬浮面板切换 17 套深色/浅色主题 |
| **长文本全屏编辑** | 元提示、指南预设、独立生图 prompt 支持全屏编辑/预览 |
| **图片清理** | 自动删除超期图片（可配置保留天数） |
| **折叠式设置面板** | 三层手风琴结构，按功能分组 |
| **悬浮图标开关** | 可隐藏悬浮面板小图标，并从设置页重新打开面板 |
| **版本检查** | 自动检查 GitHub Releases 是否有新版本 |
| **双语界面** | 完整的英文和中文界面 |

---

## 两种模式：该用哪个？

| | 共享 API（默认） | 独立 API |
|---|---|---|
| **原理** | 把指令嵌入主聊天 → LLM 在回复中包含提示词 | 回复结束后单独发一次 API 调用 |
| **配置** | 零配置，启用就能用 | 需要额外配一个 LLM API 地址 |
| **对主 API 的影响** | 生图指令占用注意力和 token | 完全不影响主 API |
| **AI 回复** | 偶尔会出现提示词残留 | 干净，完全不受影响 |
| **API 开销** | 不增加调用次数 | 每条消息 +1 次 API 调用 |
| **适合** | 入门、想最快跑起来 | 不想生图干扰主 API 的用户 |
| **用哪个预设** | 元提示预设 | 指南预设 |

> **建议：** 先用共享 API 模式。如果不想让生图占用主 API 的注意力和 token，再切到独立 API。

---

## Tag 超市和候选 Tag

插件内置离线 tag catalog，运行时不联网。当前 catalog 版本为 `2026-07`，共 7928 个 tag。

要点：

- 可搜索、分页、复制、加入通用标签，也可按分类添加自定义 tag。
- 独立提示词生成只发送“当前文本命中后再随机抽样”的少量候选，不会把全库发给 AI。
- 中文桥接覆盖情况会显示出来；用户补充触发词只追加到本地设置，不覆盖内置桥接。
- 最近一次实际发送给 AI 的候选 tag 可以在面板里查看。

具体使用见：[Tag 超市教程](docs/QUICKSTART_CN.md#tag-超市可选)。

---

## 内置正则过滤

插件可以写入并操控 SillyTavern 原生 Regex 规则。正文里的插画元数据会保留，只从发送给模型的 prompt 中过滤 `img-prompt`、`auto-illustrator`、`img` 标签。

---

## 预设适配

预设适配把外部 JSON / 文本预设或用户需求转换成 Conso 原生草稿。它不会直接沿用外部运行格式，也不会把某个外部预设变成内置逻辑。

共享 API 和独立 API 的目标格式会分开生成；保存前需要人工检查。具体使用见：[预设适配教程](docs/QUICKSTART_CN.md#预设适配可选进阶)。

---

## NovelAI 高级后端功能（可选）

部分 NovelAI 高级功能需要配套后端插件：Vibe Transfer、局部重绘。只安装前端扩展时，普通 `/sd` 生图可以运行，但这些功能不可用。

后端插件路径：`server-plugin/auto-illustrator-nai-advanced`。安装后端、启用 `enableServerPlugins`、重启 SillyTavern 后才能使用。只有面板提示后端插件版本过旧，或更新说明明确提到后端插件有变更时，才需要手动覆盖 SillyTavern `plugins/` 里的同名后端插件文件夹。

- **Vibe Transfer**：给 NovelAI 生图加入参考图或已编码 Vibe 条件，支持聊天生图、独立生图、bundle 导入和分组 JSON 导入/导出。
- **局部重绘**：在已有图片上绘制遮罩，预览编辑结果后再追加或替换。

完整安装和使用见：[NovelAI 高级后端功能](docs/QUICKSTART_CN.md#novelai-高级后端功能可选进阶)。

---

## 悬浮面板怎么用？

悬浮面板把高频操作集中到一个工作台里。低频设置仍保留在旧设置页作为兜底。

| 页面 | 主要用途 |
|------|----------|
| **主控台** | 启用自动插画、切换提示词生成模式、修改当前聊天图片文件夹标签、切主题 |
| **提示词设置** | 配置共享 API / 独立 API 模式下的提示词生成规则 |
| **Vibe 管理** | 管理不限 16 条的 Vibe 库、导入编码或带图单条、bundle 与分组文件、按 16 条自动拆分组合、重命名/应用组合；单次生成最多启用 16 条 |
| **画廊** | 在面板里查看当前聊天生成过的图片 |
| **独立生图** | 直接输入场景描述或 Prompt，不发聊天消息也能测试出图 |
| **提示词仓库** | 上传 NovelAI PNG → 提取正面/负面/角色提示词 → 搜索、编辑、复制、分类 |

长文本编辑器支持全屏查看/编辑。图片点击后的原有操作弹窗仍保持原样，没有并入悬浮面板。

---

## 常见问题

| 问题 | 快速解决 |
|------|----------|
| 图片不生成 | 先确认 `/sd` 命令能用——插件依赖酒馆的图像生成扩展 |
| Vibe Transfer 没生效 | 确认已安装 `auto-illustrator-nai-advanced` 到 SillyTavern 的 `plugins/` 目录，`config.yaml` 已启用 `enableServerPlugins: true`，并已重启 SillyTavern |
| 图片出现后消失 | 检查浏览器控制台报错；确认图片存储路径存在 |
| 独立模式失败但不知道该查哪里 | 现在会直接弹出失败原因；若这条聊天消息里还没有 prompt，会出现 **重试生成提示词** 按钮；若提示“主回复为空”，先确认主 API 已切回聊天补全；若提示 API 请求失败/返回为空，再检查独立 LLM 配置 |
| 角色外貌不对 | 使用 **角色固定 Tag** 锁定每个角色的外貌标签 |
| 中文剧情匹配不到想要的 catalog tag | 打开 **Tag 超市**，用“无中文触发词”筛选检查覆盖缺口；需要时给对应 tag 补中文触发词 |
| 不知道 AI 候选到底发了什么 | 打开 **Tag 超市 → 最近一次 AI 候选**，查看来源文本和实际发送的候选 tag |
| 外部预设不知道怎么改成插件格式 | 用 **预设适配** 上传 JSON / 文本或写需求，生成后先检查草稿再保存 |
| 提示词不准确 | 试试 **独立 API 模式** + **NAI 4.5 Full** 预设 |
| 控制台日志太多 | 调整设置中的 **日志级别**（默认：INFO） |

详细故障排查见 [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)。

---

## 相关链接

- **从零开始教程** — [docs/QUICKSTART_CN.md](docs/QUICKSTART_CN.md)
- **故障排查** — [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- **更新日志** — [CHANGELOG.md](CHANGELOG.md)

---

## 版本对比

| 功能 | 原版 (auto-illustrator) | 简化版 (simplified) | Conso 版 |
|------|------------------------|-------------------|----------|
| 提示词更新方式 | AI 优化（描述修改 → AI 生成新提示词） | 手动直编（直接编辑提示词） | **双模式：AI 优化 + 手动直编** |
| 进度提示 | 右下角悬浮窗 | 顶部简洁提示条 | 顶部简洁提示条 |
| 开关切换 | 需要刷新页面 | 立即生效 | 立即生效 |
| 配置隔离 | - | 独立配置 ID | 独立配置 ID |
| 独立 LLM API | - | - | 支持 |
| 角色卡注入 | - | - | 支持 |
| 消息内容过滤 | - | - | 支持 |
| 世界书注入 | - | - | 支持 |
| API 配置档案 | - | - | 支持 |
| 角色固定 Tag | - | - | 支持 |
| Tag 超市 / AI 候选 Tag | - | - | 支持 |
| 预设适配 | - | - | 支持 |
| 随机 SD Style | - | - | 支持 |
| NovelAI Vibe Transfer | - | - | 支持（需 companion server plugin） |
| NovelAI 局部重绘 | - | - | 支持（需 companion server plugin） |
| 独立生图工作台 | - | - | 支持 |
| 指南预设 | - | - | 支持 |
| 折叠式设置面板 | - | - | 支持 |
| 版本检查 | - | - | 支持 |
| 双语界面 | - | - | 支持 |

---

## 致谢

本项目建立在三位前辈优秀作品与公开修复思路的基础上：

- **原作者：** [gamer-mitsuha](https://github.com/gamer-mitsuha/sillytavern-auto-illustrator) — SillyTavern Auto Illustrator
- **分支作者：** [Hao19911125](https://github.com/Hao19911125/sillytavern-simplified-illustrator) — SillyTavern Simplified Illustrator
- **修复参考：** [Lluviose/sillytavern-auto-illustrator-beta](https://github.com/Lluviose/sillytavern-auto-illustrator-beta) — `1.7.3` 中部分稳定性与兼容性补丁参考了该仓库公开提交中的修复思路，并按 Conso 版结构做了适配

感谢三位的开创性工作和公开分享，没有他们就没有这个项目！

## 许可证

AGPL-3.0 — 遵循原项目许可证。
