# 事先说明
- 本项目基于JadeMin/aterbot
- 代码很屎，因为全是AI写的(Claude 4.0 Sonnet)
- 你要是还能看得下去的的话就往下看吧
------------------
# SkonBot

🤖 一个功能强大的Minecraft机器人，支持LittleSkin皮肤站集成和Web控制面板。

## ✨ 功能特性

- 🎮 **完整的Web管理面板** - 启动、停止、监控机器人状态等等
- 🎨 **皮肤站支持** - 自动获取并应用用户皮肤与披风
- 💬 **实时聊天** - 在Web面板中发送聊天消息(目前版本看不了其他人的回复)
- 📊 **实时日志** - 查看机器人运行状态
- ⚙️ **灵活配置** - 支持多种服务器配置

## 🚀 快速开始

### 1. 安装依赖并启动面板

```bash
npm install     #安装依赖
```
```bash
node index.mjs  #启动面板
```

### 2. 配置机器人

在Web控制面板中配置以下信息：
- 服务器地址和端口
- 机器人用户名
- 认证模式（仅离线）
- 皮肤站账户（可选

### 3. 启动
- 点击面板内的启动按钮启动机器人

## 📖 使用说明

### 基本配置

1. **服务器设置**
   - 服务器地址：Minecraft服务器的IP地址
   - 端口：服务器端口（默认25565)
   - bot名称:bot进服后显示的玩家名

3. **yggdrasil皮肤站**
   - 用户名：皮肤站用户名
   - 密码：皮肤站密码
   - 自动获取皮肤和披风

### Web控制面板功能

- **🎮 机器人控制**：启动/停止机器人
- **💬 聊天/指令功能**：发送聊天消息(包括指令)
- **📊 实时日志**：查看机器人状态和指令记录
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
    "auth": "offline"
    "littleskinUsername": "LittleSkin用户名",
    "littleskinPassword": "LittleSkin密码"
  }
}
```

## 📁 项目结构

```
SkonBot/
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
   - 检查服务器是否开启正版验证
   - 检查是否为JAVA版服务器
   - 确认服务器是否在线
   - 检查是否被防火墙拦截

2. **LittleSkin认证失败**
   - 验证用户名和密码是否正确
   - 检查网络连接
   - 确认LittleSkin账户状态正常

3. **Web面板无法访问**
   - 确认端口5000未被占用
   - 检查防火墙是否阻止了端口访问

## 📄 许可证

GPL-3.0 License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📞 支持

如果你遇到问题或有建议，请在GitHub上创建Issue。

----