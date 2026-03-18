# 🎨 SillyTavern Auto Illustrator - Conso Edition

**Fork from:** [Hao19911125/sillytavern-simplified-illustrator](https://github.com/Hao19911125/sillytavern-simplified-illustrator)

[English](#english) | [中文](#中文)

---

## 中文

### 📖 简介

本项目是在 **gamer-mitsuha** 的 [sillytavern-auto-illustrator](https://github.com/gamer-mitsuha/sillytavern-auto-illustrator)（原版）和 **Hao19911125** 的 [sillytavern-simplified-illustrator](https://github.com/Hao19911125/sillytavern-simplified-illustrator)（简化版）两个项目基础上的进一步开发版本。

感谢原作者 **gamer-mitsuha** 和分支作者 **Hao19911125** 的优秀工作！

### 📊 三个版本对比

| 功能 | 原版 (auto-illustrator) | 简化版 (simplified) | Conso 版 |
|------|------------------------|-------------------|----------|
| 提示词更新方式 | AI 优化（输入修改描述 → AI 生成新提示词） | 手动直编（直接编辑提示词文本） | **双模式：AI 优化 + 手动直编** |
| 进度提示 | 右下角悬浮窗 | 顶部简洁提示条 | 顶部简洁提示条 |
| 开关切换 | 需要刷新页面 | 立即生效 | 立即生效 |
| 配置隔离 | - | 独立配置 ID | 独立配置 ID |
| 独立 LLM API | - | - | ✅ 支持 |
| 图片子文件夹标签 | - | - | ✅ 支持 |
| 自动模型获取 | - | - | ✅ 支持 |
| Max Tokens 控制 | - | - | ✅ 支持 |

### ✨ Conso 版新增特性

#### ✏️ 双模式提示词编辑
- **AI 优化模式**：输入修改描述 → LLM 自动生成优化后的提示词（继承自原版）
- **手动直编模式**：直接编辑提示词文本 → 确认后立即生成新图片（继承自简化版）
- 两种模式自由切换，满足不同场景需求

#### 🤖 独立 LLM API 支持
- 支持 OpenAI 兼容的任何 LLM 服务（本地或云端）
- **自动模型获取**：一键从 API 拉取可用模型列表
- **模型选择器**：下拉选择 + 手动输入，灵活配置
- **Max Tokens 控制**：独立配置提示词生成的 Token 限制（256-32000）
- **模型持久化**：自动保存选中的模型，下次启动自动加载
- **连接测试**：验证 API 配置是否可用
- **请求快照查看**：查看最近一次独立 LLM 的完整请求内容（URL、模型、messages），方便确认角色设定和上下文是否正确传入

#### 🛡️ 稳健的 LLM 回退机制
- 独立 LLM 开关打开但配置不完整时，自动回退到酒馆共享 API，不再硬失败
- 仅在两条路径都不可用时才报错

#### 📁 图片子文件夹标签
- 为每个聊天配置独立的图片存储子文件夹标签
- 图片存储路径：`/user/images/{角色名}_{标签}/`
- 方便管理不同聊天的生成图片，避免混乱

#### 💾 独立配置
- 使用独立的配置 ID（`auto_illustrator_conso`）
- 可与原版或简化版插件共存，互不干扰

---

### 🚀 安装方法

1. 在 SillyTavern 中打开 **扩展** → **下载扩展和资源**
2. 输入本仓库地址安装
3. 重启 SillyTavern

或者手动安装：
```bash
cd SillyTavern/public/scripts/extensions/third-party
git clone https://github.com/Asobi-123/sillytavern-conso-illustrator.git
```

---

### 🙏 致谢

- 原作者：[gamer-mitsuha](https://github.com/gamer-mitsuha/sillytavern-auto-illustrator)（SillyTavern Auto Illustrator）
- 分支作者：[Hao19911125](https://github.com/Hao19911125/sillytavern-simplified-illustrator)（sillytavern-simplified-illustrator）
- 本项目在上述两个项目的基础上进行了功能增强和改进

---

### 📄 许可证

遵循原项目的 AGPL-3.0 许可证

---

## English

### 📖 About

This project is a further developed version based on **gamer-mitsuha**'s [sillytavern-auto-illustrator](https://github.com/gamer-mitsuha/sillytavern-auto-illustrator) (original) and **Hao19911125**'s [sillytavern-simplified-illustrator](https://github.com/Hao19911125/sillytavern-simplified-illustrator) (simplified edition).

Thanks to **gamer-mitsuha** (original author) and **Hao19911125** (fork author) for their excellent work!

### 📊 Version Comparison

| Feature | Original (auto-illustrator) | Simplified | Conso Edition |
|---------|---------------------------|------------|---------------|
| Prompt Update | AI-assisted (describe changes → AI generates new prompt) | Manual direct editing | **Dual mode: AI-assisted + Manual editing** |
| Progress Indicator | Bottom-right floating widget | Top toast notification | Top toast notification |
| Toggle Switch | Requires page reload | Instant effect | Instant effect |
| Config Isolation | - | Independent config ID | Independent config ID |
| Independent LLM API | - | - | ✅ Supported |
| Image Subfolder Label | - | - | ✅ Supported |
| Auto Model Discovery | - | - | ✅ Supported |
| Max Tokens Control | - | - | ✅ Supported |

### ✨ New Features in Conso Edition

#### ✏️ Dual-Mode Prompt Editing
- **AI-Assisted Mode**: Describe your changes → LLM generates an optimized prompt (inherited from original)
- **Manual Direct Edit Mode**: Directly edit prompt text → Confirm to generate immediately (inherited from simplified)
- Freely switch between both modes for different scenarios

#### 🤖 Independent LLM API Support
- Support any OpenAI-compatible LLM service (local or cloud-based)
- **Auto Model Discovery**: One-click fetch of available models from API
- **Model Selector**: Dropdown selection + manual input for flexible configuration
- **Max Tokens Control**: Independent Token limit for prompt generation (256-32000)
- **Model Persistence**: Automatically save and restore selected model across sessions
- **Connection Test**: Verify API configuration
- **Request Snapshot Viewer**: Inspect the full content of the last independent LLM request (URL, model, messages) to verify that character definitions and context are being sent correctly

#### 🛡️ Robust LLM Fallback
- When the independent LLM toggle is on but configuration is incomplete, automatically falls back to SillyTavern's shared API instead of hard-failing
- Only errors when both paths are unavailable

#### 📁 Image Subfolder Label
- Configure independent image storage subfolder labels per chat
- Image storage path: `/user/images/{CharName}_{label}/`
- Easy management of generated images across different chats

#### 💾 Independent Configuration
- Uses separate config ID (`auto_illustrator_conso`)
- Can coexist with original or simplified plugin without conflicts

---

### 🚀 Installation

1. In SillyTavern, go to **Extensions** → **Download Extensions & Assets**
2. Enter this repository URL to install
3. Restart SillyTavern

Or manual installation:
```bash
cd SillyTavern/public/scripts/extensions/third-party
git clone https://github.com/Asobi-123/sillytavern-conso-illustrator.git
```

---

### 🙏 Credits

- Original author: [gamer-mitsuha](https://github.com/gamer-mitsuha/sillytavern-auto-illustrator) (SillyTavern Auto Illustrator)
- Fork author: [Hao19911125](https://github.com/Hao19911125/sillytavern-simplified-illustrator) (sillytavern-simplified-illustrator)
- This project builds upon both projects with feature enhancements and improvements

---

### 📄 License

Follows the original project's AGPL-3.0 license
