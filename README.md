
# Minecraft Bot Manager

🤖 一个功能强大的Minecraft机器人管理系统，支持LittleSkin皮肤站集成和Web控制面板。

## ✨ 功能特性

- 🎮 **完整的机器人管理** - 启动、停止、监控机器人状态
- 🎨 **LittleSkin皮肤站支持** - 自动获取并应用用户皮肤和披风
- 🌐 **Web控制面板** - 直观的网页界面管理机器人
- 💬 **实时聊天** - 在Web面板中发送聊天消息
- 📊 **实时日志** - 查看机器人运行状态和聊天记录
- ⚙️ **灵活配置** - 支持多种认证模式和服务器配置

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置机器人

在Web控制面板中配置以下信息：
- 服务器地址和端口
- 机器人用户名
- 认证模式（正版/离线）
- LittleSkin皮肤站账户（可选）

### 3. 启动管理面板

```bash
node web-server.js
```

然后打开浏览器访问 `http://localhost:5000`

## 📖 使用说明

### 基本配置

1. **服务器设置**
   - 服务器地址：Minecraft服务器的IP地址
   - 端口：服务器端口（默认25565）

2. **认证模式**
   - **正版模式**：需要正版Minecraft账号
   - **离线模式**：仅需用户名，无需正版验证

3. **LittleSkin皮肤站**
   - 用户名：LittleSkin用户名
   - 密码：LittleSkin密码
   - 自动获取皮肤和披风

### Web控制面板功能

- **🎮 机器人控制**：启动/停止机器人
- **💬 聊天功能**：发送聊天消息到游戏中
- **📊 实时日志**：查看机器人状态和聊天记录
- **⚙️ 配置管理**：保存和加载配置

## 🔧 配置文件说明

项目会自动生成 `config-java.json` 配置文件：

```json
{
  "client": {
    "host": "服务器地址",
    "port": 25565,
    "username": "机器人用户名",
    "version": "1.20.1",
    "auth": "microsoft", // 或 "offline"
    "littleskinUsername": "LittleSkin用户名",
    "littleskinPassword": "LittleSkin密码"
  }
}
```

## 📁 项目结构

```
minecraft-bot-manager/
├── web-server.js           # Web服务器和API
├── aterbot-no-web.js      # 机器人核心逻辑
├── littleskin-api.js      # LittleSkin皮肤站API
├── control-panel.html     # Web控制面板界面
├── config-java.json       # 机器人配置文件（自动生成）
├── littleskin_profiles/   # LittleSkin认证信息存储
└── package.json           # 项目依赖
```

## 🛠️ 技术栈

- **Node.js** - 运行环境
- **mineflayer** - Minecraft机器人框架
- **原生Web技术** - HTML/CSS/JavaScript控制面板
- **LittleSkin API** - 皮肤站集成

## 🔒 安全说明

- 配置文件 `config-java.json` 包含敏感信息，请勿提交到公开仓库
- LittleSkin认证信息存储在 `littleskin_profiles/` 目录中，已加入 `.gitignore`
- 建议在生产环境中使用环境变量管理敏感配置

## 🐛 故障排除

### 常见问题

1. **机器人无法连接服务器**
   - 检查服务器地址和端口是否正确
   - 确认服务器是否在线
   - 检查防火墙设置

2. **LittleSkin认证失败**
   - 验证用户名和密码是否正确
   - 检查网络连接
   - 确认LittleSkin账户状态正常

3. **Web面板无法访问**
   - 确认端口5000未被占用
   - 检查防火墙是否阻止了端口访问

## 📝 更新日志

### v1.0.0
- ✅ 基础机器人功能
- ✅ Web控制面板
- ✅ LittleSkin皮肤站集成
- ✅ 实时日志系统
- ✅ 配置管理系统

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📞 支持

如果你遇到问题或有建议，请在GitHub上创建Issue。

---

**⭐ 如果这个项目对你有帮助，请给个Star支持一下！**
