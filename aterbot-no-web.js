// 修改版的aterbot启动器，创建支持命令执行的机器人
const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');

// 全局机器人实例
let bot = null;
let isConnected = false;

// 读取配置
function loadConfig() {
    try {
        if (fs.existsSync('./config-java.json')) {
            const config = JSON.parse(fs.readFileSync('./config-java.json', 'utf8'));
            return config.client;
        }
    } catch (error) {
        console.error('读取配置失败:', error);
    }

    // 默认配置
    return {
        host: 'localhost',
        port: 25565,
        username: 'aterbot',
        version: '1.21.1',
        auth: 'offline'
    };
}

// 管理员权限检测
const adminDetection = {
    isAdmin: false,
    commandMode: false,

    // 检测管理员权限
    checkAdminStatus(bot) {
        try {
            // 监听聊天消息以检测权限反馈
            bot.on('message', (message) => {
                const text = message.toString();

                // 检测权限相关的消息
                if (text.includes('你现在是管理员') || 
                    text.includes('You are now an operator') ||
                    text.includes('权限等级: 4') ||
                    text.includes('Permission level: 4') ||
                    text.includes('Opped') ||
                    text.includes('已获得管理员权限')) {

                    if (!this.isAdmin) {
                        this.isAdmin = true;
                        console.log('🎉 检测到机器人已获得管理员权限！');
                        this.enableCommandMode(bot);
                    }
                }

                // 检测权限移除
                if (text.includes('你不再是管理员') || 
                    text.includes('You are no longer an operator') ||
                    text.includes('Deopped') ||
                    text.includes('已移除管理员权限')) {

                    if (this.isAdmin) {
                        this.isAdmin = false;
                        this.commandMode = false;
                        console.log('⚠️ 检测到机器人管理员权限已被移除');
                    }
                }
            });

            // 定期检测权限状态（每30秒）
            setInterval(() => {
                if (bot && isConnected) {
                    // 尝试执行一个管理员命令来检测权限
                    try {
                        bot.chat('/gamemode spectator @s');
                        setTimeout(() => {
                            bot.chat('/gamemode creative @s');
                        }, 1000);
                    } catch (error) {
                        // 忽略错误，这只是检测
                    }
                }
            }, 30000);

        } catch (error) {
            console.error('管理员权限检测初始化失败:', error);
        }
    },

    // 启用命令模式
    enableCommandMode(bot) {
        if (this.commandMode) return;

        this.commandMode = true;
        console.log('🚀 自动启用命令模式！');

        // 监听聊天消息以执行命令
        bot.on('message', (message) => {
            if (!this.isAdmin || !this.commandMode) return;

            const text = message.toString();
            const match = text.match(/^<(.+?)> !(.+)$/);

            if (match) {
                const [, player, command] = match;
                console.log(`执行来自 ${player} 的命令: ${command}`);

                try {
                    // 执行命令
                    bot.chat(`/${command}`);
                } catch (error) {
                    console.error('命令执行失败:', error);
                    bot.chat(`命令执行失败: ${error.message}`);
                }
            }
        });

        // 发送启用通知
        setTimeout(() => {
            if (bot && isConnected) {
                bot.chat('§a[机器人] 命令模式已自动启用！使用 !<命令> 来执行指令');
            }
        }, 2000);
    }
};

// 创建机器人
function createBot() {
    const config = loadConfig();

    console.log('🤖 创建新的机器人实例...');
    console.log('配置信息:', {
        host: config.host,
        port: config.port,
        username: config.username,
        version: config.version
    });

    bot = mineflayer.createBot({
        host: config.host,
        port: parseInt(config.port) || 25565,
        username: config.username || 'aterbot',
        version: config.version || '1.21.1',
        auth: 'offline',
        hideErrors: false
    });

    // 连接成功事件
    bot.on('spawn', () => {
        isConnected = true;
        console.log('🎉 机器人已成功进入服务器！');
        console.log(`当前位置: ${bot.entity.position}`);

        // 启用管理员检测
        adminDetection.checkAdminStatus(bot);

        // 发送进入通知
        setTimeout(() => {
            bot.chat('§a[机器人] 已连接到服务器，控制面板可用！');
        }, 1000);
    });

    // 聊天消息事件
    bot.on('message', (message) => {
        console.log('聊天消息:', message.toString());
    });

    // 错误处理
    bot.on('error', (err) => {
        console.error('🚨 机器人错误:', err.message);
        isConnected = false;
    });

    // 断开连接事件
    bot.on('end', () => {
        console.log('🔌 机器人已断开连接');
        isConnected = false;
    });

    // 被踢出事件
    bot.on('kicked', (reason) => {
        console.log('👢 机器人被踢出:', reason);

        // 特别处理用户名相关错误
        const reasonStr = JSON.stringify(reason);
        if (reasonStr.includes('illegal_characters')) {
            console.error('\n🚫 用户名包含非法字符错误！');
            console.error('建议解决方案:');
            console.error('1. 确保用户名只包含字母(a-z, A-Z)和数字(0-9)');
            console.error('2. 不要使用下划线(_)、连字符(-)或其他特殊字符');
            console.error('3. 用户名长度不超过16个字符');
            console.error('4. 重新保存配置并重启机器人');
            console.error(`当前用户名: "${config.username}"`);

            // 检查当前用户名
            const illegalChars = config.username.match(/[^a-zA-Z0-9]/g);
            if (illegalChars) {
                console.error(`❌ 发现非法字符: ${illegalChars.join(', ')}`);
                console.error(`💡 建议修改为: ${config.username.replace(/[^a-zA-Z0-9]/g, '')}`);
            }
        }

        isConnected = false;
        bot = null;
    });

    // 监听标准输入，处理控制面板命令
    process.stdin.on('data', (data) => {
        const input = data.toString().trim();

        if (input.startsWith('COMMAND:')) {
            const command = input.replace('COMMAND:', '');
            if (bot && isConnected) {
                try {
                    console.log(`📤 执行命令: ${command}`);
                    bot.chat(command);
                } catch (error) {
                    console.error('命令执行失败:', error);
                }
            } else {
                console.log('⚠️ 机器人未连接，无法执行命令');
            }
        } else if (input.startsWith('CHAT:')) {
            const message = input.replace('CHAT:', '');
            if (bot && isConnected) {
                try {
                    console.log(`💬 发送消息: ${message}`);
                    bot.chat(message);
                } catch (error) {
                    console.error('消息发送失败:', error);
                }
            } else {
                console.log('⚠️ 机器人未连接，无法发送消息');
            }
        }
    });

    return bot;
}

// 优雅关闭
function gracefulShutdown() {
    console.log('🛑 正在关闭机器人...');
    if (bot) {
        try {
            bot.quit('控制面板关闭');
        } catch (error) {
            console.log('关闭时出现错误:', error);
        }
    }
    process.exit(0);
}

// 信号处理
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// 启动机器人
console.log('🚀 启动机器人控制系统...');
createBot();

// 导出API供外部调用
module.exports = {
    getBot: () => bot,
    isConnected: () => isConnected,
    sendCommand: (command) => {
        if (bot && isConnected) {
            bot.chat(command);
            return true;
        }
        return false;
    },
    sendMessage: (message) => {
        if (bot && isConnected) {
            bot.chat(message);
            return true;
        }
        return false;
    }
};