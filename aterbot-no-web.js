// 修改版的aterbot启动器，创建支持命令执行的机器人
const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');
const LittleSkinAPI = require('./littleskin-api.js');

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
                    // 执行命令 - 先过滤消息
                    const cleanCommand = sanitizeMessage(`/${command}`);
                    bot.chat(cleanCommand);
                } catch (error) {
                    console.error('命令执行失败:', error);
                    const cleanError = sanitizeMessage(`命令执行失败: ${error.message}`);
                    bot.chat(cleanError);
                }
            }
        });

        // 发送启用通知 - 移除颜色代码和特殊字符
        setTimeout(() => {
            if (bot && isConnected) {
                bot.chat('[机器人] 命令模式已自动启用！使用 !<命令> 来执行指令');
            }
        }, 2000);
    }
};

// 创建机器人
function createBot() {
    // 读取配置
    const config = loadConfig();

    // 验证并清理用户名 - 超严格模式
    let username = config.username.toString().trim();
    
    console.log('🔍 超严格用户名检查:');
    console.log('  原始用户名:', `"${username}"`);
    console.log('  原始字节:', username.split('').map(c => `${c}(${c.charCodeAt(0)})`).join(' '));
    
    // 检查每个字符的Unicode值
    let hasProblems = false;
    const charAnalysis = username.split('').map(c => {
        const code = c.charCodeAt(0);
        const isValid = (code >= 48 && code <= 57) || // 0-9
                       (code >= 65 && code <= 90) || // A-Z
                       (code >= 97 && code <= 122);  // a-z
        if (!isValid) hasProblems = true;
        return `${c}(${code}${isValid ? '✓' : '❌'})`;
    });
    
    console.log('  字符分析:', charAnalysis.join(' '));
    
    if (hasProblems || username.length > 16) {
        console.log('🚨 检测到用户名问题，强制使用纯数字用户名');
        // 如果这个服务器太挑剔，就用最简单的纯数字用户名
        const timestamp = Date.now().toString().slice(-8); // 取时间戳后8位
        config.username = 'Bot' + timestamp;
        console.log('🔧 强制修改为超安全用户名:', config.username);
    }
    
    // 最终验证
    const finalCheck = config.username.split('').every(c => {
        const code = c.charCodeAt(0);
        return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    });
    
    console.log('✅ 最终用户名:', `"${config.username}"`);
    console.log('  长度:', config.username.length);
    console.log('  超严格检查:', finalCheck ? '完全通过' : '仍有问题');
    
    if (!finalCheck) {
        // 如果还有问题，直接用纯数字
        config.username = 'Bot' + Math.floor(Math.random() * 100000000);
        console.log('🎲 紧急生成纯数字用户名:', config.username);
    }

    if (!config) {
        console.error('❌ 无法获取有效配置');
        return;
    }

    console.log('🤖 创建新的机器人实例...');
    console.log('配置信息:', {
        host: config.host,
        port: config.port,
        username: config.username,
        version: config.version
    });

    // 准备机器人配置
    const botConfig = {
        host: config.host,
        port: parseInt(config.port) || 25565,
        username: config.username || 'aterbot',
        version: config.version || '1.21.1',
        auth: config.auth || 'offline',
        hideErrors: false
    };

    // LittleSkin皮肤站支持
    if (config.skinMode === 'littleskin') {
        console.log('🌟 使用LittleSkin皮肤站');
        const littleSkinAPI = new LittleSkinAPI();
        
        if (config.enableLittleskinAuth && config.littleskinPassword && config.littleskinUsername) {
            console.log('🔐 启用LittleSkin Yggdrasil认证');
            
            try {
                // 尝试加载已保存的认证信息
                let authData = littleSkinAPI.loadAuthData(config.littleskinUsername);
                
                // 如果没有认证信息或认证信息无效，重新认证
                if (!authData || !(await littleSkinAPI.validate(authData.accessToken, authData.clientToken)).success) {
                    console.log('🔄 正在进行LittleSkin认证...');
                    const authResult = await littleSkinAPI.authenticate(config.littleskinUsername, config.littleskinPassword);
                    
                    if (authResult.success) {
                        authData = authResult;
                        littleSkinAPI.saveAuthData(authData, config.littleskinUsername);
                        console.log('✅ LittleSkin认证成功！');
                    } else {
                        console.error('❌ LittleSkin认证失败:', authResult.message);
                        console.log('⚠️ 回退到离线模式');
                    }
                }
                
                if (authData && authData.success !== false) {
                    // 配置Yggdrasil认证
                    botConfig.auth = 'offline'; // 暂时使用离线模式，因为mineflayer可能不直接支持自定义Yggdrasil
                    botConfig.username = config.littleskinUsername;
                    
                    console.log('🎮 LittleSkin认证已配置:', {
                        username: config.littleskinUsername,
                        uuid: authData.selectedProfile?.id
                    });
                    
                    // 获取皮肤信息用于日志
                    const skinInfo = await littleSkinAPI.getUserSkin(config.littleskinUsername);
                    if (skinInfo.success) {
                        console.log('🎨 皮肤信息:', {
                            skinUrl: skinInfo.skinUrl ? '✅ 有皮肤' : '❌ 无皮肤',
                            capeUrl: skinInfo.capeUrl ? '✅ 有披风' : '❌ 无披风'
                        });
                    }
                }
                
            } catch (error) {
                console.error('🚨 LittleSkin认证过程出错:', error.message);
                console.log('⚠️ 回退到离线模式');
            }
            
        } else if (config.littleskinUsername) {
            console.log(`🎨 使用LittleSkin用户 "${config.littleskinUsername}" 的皮肤 (离线模式)`);
            
            // 在离线模式下，某些服务器支持通过用户名获取LittleSkin皮肤
            // 获取皮肤信息用于展示
            try {
                const skinInfo = await littleSkinAPI.getUserSkin(config.littleskinUsername);
                if (skinInfo.success) {
                    console.log('🎨 找到LittleSkin皮肤:', {
                        用户名: skinInfo.username,
                        UUID: skinInfo.uuid,
                        皮肤: skinInfo.skinUrl ? '✅' : '❌',
                        披风: skinInfo.capeUrl ? '✅' : '❌'
                    });
                } else {
                    console.log('⚠️ 未找到LittleSkin用户皮肤信息');
                }
            } catch (error) {
                console.log('⚠️ 获取LittleSkin皮肤信息失败:', error.message);
            }
        }
    }

    // 如果配置了自定义皮肤URL，添加到配置中
    if (config.skinUrl && config.skinMode === 'url') {
        console.log('🎨 配置自定义皮肤:', config.skinUrl);
        // 注意：不是所有服务器都支持自定义皮肤URL
        // 这主要是为了将来可能的扩展
    }

    if (config.skinMode === 'premium') {
        console.log('👑 使用正版账号模式 (皮肤将自动同步)');
    }

    bot = mineflayer.createBot(botConfig);

    // 连接成功事件
    bot.on('spawn', () => {
        isConnected = true;
        console.log('🎉 机器人已成功进入服务器！');
        console.log(`当前位置: ${bot.entity.position}`);

        // 启用管理员检测
        adminDetection.checkAdminStatus(bot);

        // 发送进入通知 - 移除可能导致问题的颜色代码
        setTimeout(() => {
            bot.chat('[机器人] 已连接到服务器，控制面板可用！');
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

    // 消息过滤器 - 确保消息符合Minecraft聊天规范
    function sanitizeMessage(message) {
        // 移除Minecraft颜色代码 (§ 和 & 开头的代码)
        let clean = message.replace(/[§&][0-9a-fk-or]/gi, '');
        
        // 移除可能的控制字符
        clean = clean.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        
        // 确保只包含基本的可打印字符
        clean = clean.replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '');
        
        // 限制长度（Minecraft聊天通常限制为256字符）
        if (clean.length > 256) {
            clean = clean.substring(0, 253) + '...';
        }
        
        return clean.trim();
    }

    // 监听标准输入，处理控制面板命令
    process.stdin.on('data', (data) => {
        const input = data.toString().trim();

        if (input.startsWith('COMMAND:')) {
            const command = input.replace('COMMAND:', '');
            if (bot && isConnected) {
                try {
                    const cleanCommand = sanitizeMessage(command);
                    console.log(`📤 执行命令: ${cleanCommand}`);
                    bot.chat(cleanCommand);
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
                    const cleanMessage = sanitizeMessage(message);
                    console.log(`💬 发送消息: ${cleanMessage}`);
                    bot.chat(cleanMessage);
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