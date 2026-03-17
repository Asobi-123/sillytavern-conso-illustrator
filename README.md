# 🎨 SillyTavern Auto Illustrator - Conso Edition

**Fork from:** [sillytavern-simplified-illustrator](https://github.com/Hao19911125/sillytavern-simplified-illustrator)

[English](#english) | [中文](#中文)

---

## 中文

### 📖 简介

这是基于 [Hao19911125/sillytavern-simplified-illustrator](https://github.com/Hao19911125/sillytavern-simplified-illustrator) 的进一步开发版本。

感谢原作者 **gamer-mitsuha** 和分支作者 **Hao19911125** 的优秀工作！本项目在他们的基础上进行了增强，添加了更多功能和改进。

### ✨ 本版本的特性和改进

#### 🎯 更简洁的进度提示
- **原版**：右下角悬浮窗显示进度
- **本版**：顶部简洁提示条
  - 生成中：`正在生成 1/3 图片`
  - 完成时：`图片生成完成！`（3秒后自动消失）

#### ⚡ 开关立即生效
- **原版**：切换开关后需要刷新页面
- **本版**：勾选/取消立即生效，无需刷新

#### ✏️ 直接编辑提示词
- **原版**：点击「更新提示词」→ 输入想要的修改 → AI 生成新提示词
- **本版**：点击「更新提示词」→ **直接编辑**当前提示词 → 点完成 → 立即生成新图片

#### 💾 独立配置
- 使用独立的配置 ID（`auto_illustrator_conso`）
- 可与原版插件共存，互不干扰

#### 🤖 独立 LLM 支持（v1.0.0 新增）
- **自动模型获取**：从独立 LLM API 自动获取可用模型列表
- **灵活 API 配置**：支持 OpenAI 兼容的任何 LLM 服务（本地或云端）
- **Max Tokens 控制**：独立配置提示词生成的 Token 限制
- **模型持久化**：自动保存选中的 LLM 模型，下次使用时自动加载

---

### 🚀 安装方法

1. 在 SillyTavern 中打开 **扩展** → **下载扩展和资源**
2. 输入本仓库地址安装
3. 重启 SillyTavern

或者手动安装：
```bash
cd SillyTavern/public/scripts/extensions/third-party
git clone https://github.com/Hao19911125/sillytavern-simplified-illustrator.git
```

---

### 🙏 致谢

- 原作者：[gamer-mitsuha](https://github.com/gamer-mitsuha/sillytavern-auto-illustrator)（SillyTavern Auto Illustrator）
- 分支作者：[Hao19911125](https://github.com/Hao19911125)（sillytavern-simplified-illustrator）
- 本项目在上述两个项目的基础上进行了功能增强和改进

---

### 📄 许可证

遵循原项目的 AGPL-3.0 许可证

---

## English

### 📖 About

This is a further developed version based on [Hao19911125/sillytavern-simplified-illustrator](https://github.com/Hao19911125/sillytavern-simplified-illustrator).

Thanks to **gamer-mitsuha** (original author) and **Hao19911125** (fork author) for their excellent work! This project builds upon their foundation with enhanced features and improvements.

### ✨ Differences from Original

#### 🎯 Cleaner Progress Notifications
- **Original**: Floating widget in bottom-right corner
- **This version**: Simple top toast notification
  - Generating: `Generating image 1/3`
  - Complete: `Image generation complete!` (auto-dismiss after 3s)

#### ⚡ Instant Toggle Effect
- **Original**: Need to reload page after toggling
- **This version**: Takes effect immediately, no reload needed

#### ✏️ Direct Prompt Editing
- **Original**: Click "Update Prompt" → Describe changes → AI generates new prompt
- **This version**: Click "Update Prompt" → **Directly edit** the prompt → Click confirm → Generate immediately

#### 💾 Independent Configuration
- Uses separate config ID (`auto_illustrator_conso`)
- Can coexist with original plugin without conflicts

#### 🤖 Independent LLM Support (New in v1.0.0)
- **Auto Model Discovery**: Automatically fetch available models from independent LLM API
- **Flexible API Configuration**: Support any OpenAI-compatible LLM service (local or cloud-based)
- **Max Tokens Control**: Independent Token limit configuration for prompt generation
- **Model Persistence**: Automatically save and restore selected LLM model on next use

---

### 🚀 Installation

1. In SillyTavern, go to **Extensions** → **Download Extensions & Assets**
2. Enter this repository URL to install
3. Restart SillyTavern

Or manual installation:
```bash
cd SillyTavern/public/scripts/extensions/third-party
git clone https://github.com/Hao19911125/sillytavern-simplified-illustrator.git
```

---

### 🙏 Credits

- Original author: [gamer-mitsuha](https://github.com/gamer-mitsuha/sillytavern-auto-illustrator) (SillyTavern Auto Illustrator)
- Fork author: [Hao19911125](https://github.com/Hao19911125) (sillytavern-simplified-illustrator)
- This project builds upon both projects with feature enhancements and improvements

---

### 📄 License

Follows the original project's AGPL-3.0 license
