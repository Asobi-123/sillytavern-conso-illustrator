# 🎨 SillyTavern Auto Illustrator - Simplified Edition

[English](#english) | [中文](#中文)

---

## 中文

### 📖 简介

这是基于 [SillyTavern Auto Illustrator](https://github.com/gamer-mitsuha/sillytavern-auto-illustrator) 的修改版本。

感谢原作者 **gamer-mitsuha** 的优秀工作！本项目在原版基础上做了一些个人化调整，以适应我的使用习惯。

### ✨ 与原版的区别

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
- 使用独立的配置 ID（`auto_illustrator_lite`）
- 可与原版插件共存，互不干扰

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

- 原版作者：[gamer-mitsuha](https://github.com/gamer-mitsuha/sillytavern-auto-illustrator)
- 本项目仅做了界面和交互上的小调整，核心功能来自原版

---

### 📄 许可证

遵循原项目的 AGPL-3.0 许可证

---

## English

### 📖 About

This is a modified version based on [SillyTavern Auto Illustrator](https://github.com/gamer-mitsuha/sillytavern-auto-illustrator).

Thanks to the original author **gamer-mitsuha** for the excellent work! This project makes some personal adjustments to better suit my usage preferences.

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
- Uses separate config ID (`auto_illustrator_lite`)
- Can coexist with original plugin without conflicts

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

- Original author: [gamer-mitsuha](https://github.com/gamer-mitsuha/sillytavern-auto-illustrator)
- This project only makes minor UI/UX adjustments; core functionality comes from the original

---

### 📄 License

Follows the original project's AGPL-3.0 license
