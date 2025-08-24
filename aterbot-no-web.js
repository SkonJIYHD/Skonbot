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
        auth: 'offline',
        logLevel: ['error', 'log'] // 默认只显示错误和重要日志，不包含debug
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
                    text.includes('You no longer an operator') ||
                    text.includes('Deopped') ||
                    text.includes('已移除管理员权限')) {

                    if (this.isAdmin) {
                        this.isAdmin = false;
                        this.commandMode = false;
                        console.log('⚠️ 检测到机器人管理员权限已被移除');
                    }
                }
            });

            // 禁用定期权限检测，避免自动发送命令
            console.log('权限检测已禁用，避免自动命令执行');

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

        // 静默启用命令模式，不发送通知
        console.log('✅ 命令模式已静默启用');
    }
};

// 创建机器人
async function createBot() {
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
        auth: config.auth || 'offline', // 使用配置的认证方式，默认离线
        hideErrors: true, // 隐藏Fabric相关的协议错误
        // 增加协议兼容性设置
        checkTimeoutInterval: 30000, // 30秒超时检查
        keepAlive: true,
        // 添加更宽松的协议处理，特别适合Fabric服务器
        protocolVersion: null, // 让mineflayer自动检测
        skipValidation: true, // 跳过一些严格的验证
        profileKeysSignatureValidation: false, // 禁用配置文件密钥签名验证
        // Fabric mod服务器兼容性设置
        disableModInfo: true, // 禁用mod信息处理
        ignoreParseErrors: true, // 忽略解析错误
        // 更宽松的错误处理
        fatalErrors: ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'],
        errorTimeout: 30000
    };

    // 正版Microsoft登录支持
    if (config.auth === 'microsoft') {
        console.log('🔐 使用Microsoft正版登录');
        botConfig.auth = 'microsoft';

        // 如果配置了Microsoft认证信息
        if (config.microsoftEmail) {
            console.log('📧 Microsoft账户:', config.microsoftEmail);
            // mineflayer会自动处理Microsoft认证流程
        } else {
            console.log('⚠️ 未配置Microsoft账户，将使用交互式登录');
        }

        // 设置Microsoft认证的额外选项
        botConfig.profileKeysSignatureValidation = true;
        botConfig.checkTimeoutInterval = 60000; // 增加超时时间给认证流程
        console.log('✅ Microsoft正版认证已配置');
    }

    // 通用Yggdrasil皮肤站支持
    if (config.skinMode === 'yggdrasil' || process.env.ENABLE_YGGDRASIL_AUTH === 'true') {
        console.log('🌟 使用通用Yggdrasil皮肤站');

        // 从环境变量获取配置
        const yggdrasilUrl = process.env.YGGDRASIL_URL || config.yggdrasilServer;
        const yggdrasilUsername = process.env.YGGDRASIL_USERNAME || config.yggdrasilUsername;
        const yggdrasilPassword = process.env.YGGDRASIL_PASSWORD || config.yggdrasilPassword;

        if (!yggdrasilUrl) {
            console.error('❌ 缺少Yggdrasil服务器地址配置');
            return;
        }

        const YggdrasilAPI = require('./yggdrasil-api.js');
        const yggdrasilAPI = new YggdrasilAPI(yggdrasilUrl);

        if (yggdrasilPassword && yggdrasilUsername) {
            console.log('🔐 启用Yggdrasil认证');
            console.log('📧 认证地址:', yggdrasilUrl);
            console.log('👤 用户名:', yggdrasilUsername);

            try {
                // 根据Yggdrasil规范，username字段应该是邮箱
                // 但某些皮肤站可能允许用户名登录，需要尝试两种方式
                let authUsername = yggdrasilUsername;
                
                // 如果看起来不像邮箱，可能需要添加域名后缀
                if (!yggdrasilUsername.includes('@')) {
                    console.log('⚠️ 用户名不是邮箱格式，尝试添加默认域名');
                    // 尝试常见的域名后缀
                    const domain = new URL(yggdrasilUrl).hostname;
                    authUsername = `${yggdrasilUsername}@${domain}`;
                }
                
                const cacheKey = yggdrasilUsername; // 缓存键还是用原始用户名

                console.log('📧 认证账户（邮箱格式）:', authUsername);

                // 尝试加载已保存的认证信息
                let authData = yggdrasilAPI.loadAuthData(cacheKey);

                // 如果没有认证信息或认证信息无效，重新认证
                let validationResult = { success: false };
                if (authData) {
                    validationResult = await yggdrasilAPI.validate(authData.accessToken, authData.clientToken);
                }

                if (!validationResult.success) {
                    console.log('🔄 正在进行Yggdrasil认证...');
                    authData = await yggdrasilAPI.authenticate(authUsername, yggdrasilPassword);

                    // 如果邮箱格式认证失败，尝试原始用户名
                    if (!authData.success && authUsername !== yggdrasilUsername) {
                        console.log('⚠️ 邮箱格式认证失败，尝试原始用户名认证');
                        authData = await yggdrasilAPI.authenticate(yggdrasilUsername, yggdrasilPassword);
                    }

                    if (authData.success) {
                        yggdrasilAPI.saveAuthData(authData, cacheKey);
                        console.log('✅ Yggdrasil认证成功！');
                        console.log('📋 认证详情:', {
                            使用的用户名: authData.user?.username || '未知',
                            角色名: authData.selectedProfile?.name || '未知',
                            UUID: authData.selectedProfile?.id || '未知'
                        });
                    } else {
                        console.error('❌ Yggdrasil认证失败:', authData.message);
                        console.error('🔍 认证详情:');
                        console.error('  尝试的认证地址:', yggdrasilUrl);
                        console.error('  尝试的用户名:', [authUsername, yggdrasilUsername].filter((v, i, a) => a.indexOf(v) === i));
                        console.error('  密码长度:', yggdrasilPassword.length);
                    }
                } else {
                    console.log('✅ 使用已保存的Yggdrasil认证信息');
                }

                if (authData && authData.success && authData.selectedProfile) {
                    console.log('🎮 Yggdrasil认证已配置:', {
                        username: authData.selectedProfile.name,
                        uuid: authData.selectedProfile.id
                    });

                    // 尝试使用在线Yggdrasil认证模式
                    console.log('🌐 尝试配置在线Yggdrasil认证模式');
                    botConfig.auth = 'mojang'; // 使用mojang认证模式，但指向第三方服务器
                    botConfig.username = authData.selectedProfile.name;
                    botConfig.accessToken = authData.accessToken;
                    botConfig.clientToken = authData.clientToken;
                    
                    // 配置第三方Yggdrasil服务器地址
                    botConfig.authServer = yggdrasilUrl + '/authserver';
                    botConfig.sessionServer = yggdrasilUrl + '/sessionserver';
                    
                    // 禁用Mojang特有的功能
                    botConfig.profileKeysSignatureValidation = false;
                    botConfig.checkTimeoutInterval = 60000; // 增加超时时间
                    
                    // 如果在线认证失败，准备回退到离线模式
                    botConfig._fallbackToOffline = true;
                    botConfig._offlineUsername = authData.selectedProfile.name;
                    
                    console.log('✅ 已配置第三方Yggdrasil认证信息（离线模式+认证数据）');
                    console.log('🔑 AccessToken:', authData.accessToken.substring(0, 20) + '...');
                    console.log('🎮 用户名:', authData.selectedProfile.name);
                    console.log('🆔 UUID:', authData.selectedProfile.id);
                } else {
                    console.log('⚠️ Yggdrasil认证信息无效，回退到离线模式');
                }
            } catch (error) {
                console.error('❌ Yggdrasil认证过程中发生错误:', error);
            }
        }

        // 获取皮肤信息
        if (yggdrasilUsername) {
            try {
                const skinResult = await yggdrasilAPI.getUserSkin(yggdrasilUsername);
                if (skinResult.success && skinResult.skinUrl) {
                    console.log('✅ 成功获取Yggdrasil皮肤:', skinResult.skinUrl);
                    skinUrl = skinResult.skinUrl;
                    if (skinResult.capeUrl) {
                        console.log('✅ 成功获取Yggdrasil披风:', skinResult.capeUrl);
                        capeUrl = skinResult.capeUrl;
                    }
                } else if (!skinResult.silent) {
                    console.log('⚠️ 无法获取Yggdrasil皮肤:', skinResult.message);
                }
            } catch (error) {
                console.error('❌ 获取Yggdrasil皮肤失败:', error);
            }
        }
    }

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
                let validationResult = { success: false };
                if (authData) {
                    validationResult = await littleSkinAPI.validate(authData.accessToken, authData.clientToken);
                }

                if (!authData || !validationResult.success) {
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
                    // 配置Yggdrasil认证 - 使用离线模式避免Mojang服务器问题
                    botConfig.auth = 'offline';
                    botConfig.username = config.littleskinUsername;
                    
                    // 保存LittleSkin认证信息
                    botConfig._littleskinAuth = {
                        accessToken: authData.accessToken,
                        clientToken: authData.clientToken,
                        selectedProfile: authData.selectedProfile,
                        sessionServer: 'https://littleskin.cn/api/yggdrasil/sessionserver',
                        authServer: 'https://littleskin.cn/api/yggdrasil/authserver'
                    };
                    botConfig.profileKeysSignatureValidation = false;

                    console.log('🎮 LittleSkin认证已配置（离线模式+认证数据）:', {
                        username: config.littleskinUsername,
                        uuid: authData.selectedProfile?.id,
                        accessToken: authData.accessToken?.substring(0, 20) + '...'
                    });

                    // 获取皮肤信息用于日志
                    const skinInfo = await littleSkinAPI.getUserSkin(config.littleskinUsername);
                    if (skinInfo.success) {
                        console.log('🎨 皮肤信息:', {
                            skinUrl: skinInfo.skinUrl ? '✅ 有皮肤' : '❌ 无皮肤',
                            capeUrl: skinInfo.capeUrl ? '✅ 有披风' : '❌ 无披风'
                        });
                    }
                    // 完全静默404错误
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
                } else if (!skinInfo.silent) {
                    console.log('⚠️ 未找到LittleSkin用户皮肤信息');
                }
            } catch (error) {
                // 完全屏蔽404错误
                if (!error.message.includes('HTTP 404')) {
                    console.log('⚠️ 获取LittleSkin皮肤信息失败:', error.message);
                }
            }
        }
    }

    // 如果配置了自定义皮肤URL，添加到配置中
    if (config.skinUrl && config.skinMode === 'url') {
        console.log('🎨 配置自定义皮肤:', config.skinUrl);
        // 注意：不是所有服务器都支持自定义皮肤URL
        // 这主要是为了将来可能的扩展
    }



    if (config.skinMode === 'yggdrasil') {
        console.log('🌟 使用Yggdrasil皮肤站模式');
        console.log('  皮肤站服务器:', config.yggdrasilServer);
        console.log('  皮肤站用户名:', config.yggdrasilUsername);

        if (config.yggdrasilServer && config.yggdrasilUsername) {
            // 设置Yggdrasil认证服务器
            botConfig.sessionServer = config.yggdrasilServer;
            botConfig.profileKeysSignatureValidation = false; // 兼容第三方皮肤站

            // 尝试从皮肤站获取皮肤信息
            console.log('🔍 正在从皮肤站获取皮肤信息...');
            fetchYggdrasilProfile(config.yggdrasilServer, config.yggdrasilUsername)
                .then(profile => {
                    if (profile) {
                        console.log('✅ 成功获取皮肤站配置文件:', profile.name);
                        // 可以在这里处理皮肤信息
                    }
                })
                .catch(err => {
                    console.log('⚠️ 获取皮肤站信息失败:', err.message);
                });
        }
    }

    bot = mineflayer.createBot(botConfig);

    // 添加原始数据包处理器，忽略Fabric mod相关的问题数据包
    bot._client.on('packet', (data, meta) => {
        // 完全静默数据包输出，避免数字刷屏
        // 只在发生重要事件时记录
        if (config.logLevel && config.logLevel.includes('debug')) {
            const criticalPackets = ['disconnect', 'kick_disconnect'];
            if (criticalPackets.includes(meta.name)) {
                console.log(`收到关键数据包: ${meta.name}`);
            }
        }
    });

    // 连接成功事件
    bot.on('spawn', () => {
        isConnected = true;
        console.log('🎉 机器人已成功进入服务器！');
        console.log(`当前位置: ${bot.entity.position}`);

        // 禁用自动管理员检测，避免命令冲突
        console.log('✅ 已禁用自动管理员检测，避免命令冲突');

        // 静默进入，不发送通知消息
        console.log('✅ 机器人已静默进入服务器');
    });

    // 增强消息监听 - 捕获所有可能的服务器反馈
    bot.on('message', (jsonMsg, position) => {
        const message = jsonMsg.toString();

        // 详细记录所有消息类型，便于调试
        console.log(`📨 收到消息 [类型:${position || 'unknown'}]: ${message}`);

        // 检查是否包含命令相关关键字
        const isCommandResponse = message.includes('种子') ||
                                 message.includes('Seed') ||
                                 message.includes('seed:') ||
                                 message.includes('在线玩家') ||
                                 message.includes('players online') ||
                                 message.includes('There are') ||
                                 message.includes('当前有') ||
                                 message.includes('list:') ||
                                 message.includes('gamemode') ||
                                 message.includes('模式') ||
                                 message.includes('tp') ||
                                 message.includes('传送') ||
                                 message.includes('time') ||
                                 message.includes('时间') ||
                                 message.includes('weather') ||
                                 message.includes('天气');

        if (isCommandResponse) {
            console.log(`🎯 检测到命令反馈: ${message}`);
        }

        // 处理不同类型的消息
        if (position === 'chat') {
            console.log(`💬 聊天消息: ${message}`);
            try {
                process.stdout.write(`CHAT_MESSAGE:${message}\n`);
                // 立即刷新输出缓冲区，确保消息被立即发送
                process.stdout.uncork();
            } catch (error) {
                console.error('发送聊天消息到控制面板失败:', error);
            }
        } else if (position === 'system') {
            console.log(`🔧 系统消息: ${message}`);
            try {
                process.stdout.write(`SYSTEM_MESSAGE:${message}\n`);
            } catch (error) {
                console.error('发送系统消息到控制面板失败:', error);
            }
        } else if (position === 'game_info') {
            console.log(`🎮 游戏信息: ${message}`);
            try {
                process.stdout.write(`GAME_MESSAGE:${message}\n`);
            } catch (error) {
                console.error('发送游戏信息到控制面板失败:', error);
            }
        } else {
            // 所有其他消息类型 - 包括命令反馈
            console.log(`📋 服务器反馈 [${position || 'unknown'}]: ${message}`);

            // 检查是否是公聊消息（常见格式：<玩家名> 消息内容）
            if (message.match(/^<[\w\u4e00-\u9fa5]+>\s*.+/)) {
                console.log(`🗣️ 检测到公聊消息格式: ${message}`);
                try {
                    process.stdout.write(`CHAT_MESSAGE:${message}\n`);
                    process.stdout.uncork();
                } catch (error) {
                    console.error('发送公聊消息到控制面板失败:', error);
                }
            } else {
                // 发送到控制面板作为服务器消息
                try {
                    process.stdout.write(`SERVER_MESSAGE:${message}\n`);
                } catch (error) {
                    console.error('发送服务器消息到控制面板失败:', error);
                }
            }
        }
    });

    // 增强事件监听器 - 特别针对Forge服务器
    bot.on('windowOpen', (window) => {
        console.log(`🪟 窗口打开: ${window.type || '未知'} - ${window.title || '无标题'}`);
    });

    bot.on('actionBar', (message) => {
        const actionBarText = message.toString();
        console.log(`📊 操作栏消息: ${actionBarText}`);
        try {
            process.stdout.write(`ACTIONBAR_MESSAGE:${actionBarText}\n`);
        } catch (error) {
            console.error('发送操作栏消息失败:', error);
        }
    });

    // 监听标题消息（有些服务器通过标题发送反馈）
    bot.on('title', (text) => {
        const titleText = text.toString();
        console.log(`📺 标题消息: ${titleText}`);
        try {
            process.stdout.write(`TITLE_MESSAGE:${titleText}\n`);
        } catch (error) {
            console.error('发送标题消息失败:', error);
        }
    });

    // 监听子标题消息
    bot.on('subtitle', (text) => {
        const subtitleText = text.toString();
        console.log(`📺 子标题消息: ${subtitleText}`);
        try {
            process.stdout.write(`SUBTITLE_MESSAGE:${subtitleText}\n`);
        } catch (error) {
            console.error('发送子标题消息失败:', error);
        }
    });

    // 增强数据包监听 - 只关注真正重要的消息，避免数字刷屏
    bot._client.on('packet', (data, meta) => {
        // 只监听真正重要的数据包，避免过多输出
        if (meta.name && (
            meta.name.includes('chat') ||
            meta.name.includes('message') ||
            meta.name === 'disconnect'
        )) {
            // 如果是可能包含文本的数据包，尝试提取文本（不输出原始数据）
            if (data && typeof data === 'object') {
                const possibleText = extractTextFromData(data);
                if (possibleText && possibleText.length > 3) { // 只处理有意义的文本
                    console.log(`📝 提取的文本: ${possibleText}`);
                    try {
                        process.stdout.write(`PACKET_MESSAGE:${possibleText}\n`);
                    } catch (error) {
                        console.error('发送数据包消息失败:', error);
                    }
                }
            }
        }
    });

    // 错误处理
    bot.on('error', (err) => {
        console.error('🚨 机器人错误:', err.message);
        
        // 特殊处理认证服务器错误
        if (err.message.includes('authservers_down') || err.message.includes('authentication')) {
            console.log('🔄 检测到认证服务器问题，尝试重新连接...');
            
            // 如果配置了回退模式，切换到离线模式重试
            if (botConfig._fallbackToOffline) {
                console.log('🔄 回退到离线模式重新连接');
                setTimeout(() => {
                    try {
                        const fallbackConfig = { ...botConfig };
                        fallbackConfig.auth = 'offline';
                        fallbackConfig.username = botConfig._offlineUsername;
                        delete fallbackConfig.accessToken;
                        delete fallbackConfig.clientToken;
                        delete fallbackConfig._fallbackToOffline;
                        
                        console.log('🔄 使用离线模式重新创建机器人');
                        bot = mineflayer.createBot(fallbackConfig);
                        setupBotEvents(bot); // 需要重新设置事件监听器
                    } catch (retryError) {
                        console.error('❌ 离线模式重连也失败:', retryError.message);
                    }
                }, 5000);
                return; // 不要立即设置isConnected = false
            }
        }

        // 特殊处理协议错误
        if (err.message.includes('PartialReadError') || err.message.includes('Read error')) {
            console.log('🔄 检测到协议解析错误，可能是以下原因：');
            console.log('  1. Fabric mod服务器协议问题 (常见)');
            console.log('  2. 服务器发送的mod数据包过大或格式异常');
            console.log('  3. 网络传输问题');
            console.log('💡 这是Fabric mod服务器的已知问题，机器人功能通常不受影响');
            console.log('✅ 机器人已成功连接，错误可以忽略');

            // 不要断开连接，因为这只是数据包解析问题
            return;
        }

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

    // 监听机器人位置变化 - 减少输出频率
    let lastPositionLog = 0;
    bot.on('move', () => {
        const now = Date.now();
        // 每10秒最多输出一次位置信息
        if (now - lastPositionLog > 10000) {
            console.log(`当前位置: (${bot.entity.position.x.toFixed(1)}, ${bot.entity.position.y.toFixed(1)}, ${bot.entity.position.z.toFixed(1)})`);
            lastPositionLog = now;
        }
    });

    // 从数据包中提取可能的文本内容
    function extractTextFromData(data) {
        if (!data || typeof data !== 'object') return null;

        // 递归搜索可能的文本字段
        function searchForText(obj, depth = 0) {
            if (depth > 3) return null; // 限制递归深度

            for (const key in obj) {
                const value = obj[key];

                // 检查常见的文本字段名
                if ((key === 'text' || key === 'message' || key === 'content' ||
                     key === 'translate' || key === 'extra') &&
                    typeof value === 'string' && value.trim()) {
                    return value.trim();
                }

                // 递归检查嵌套对象
                if (typeof value === 'object' && value !== null) {
                    const result = searchForText(value, depth + 1);
                    if (result) return result;
                }
            }
            return null;
        }

        return searchForText(data);
    }

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

    // Yggdrasil皮肤站API支持
    async function fetchYggdrasilProfile(yggdrasilServer, username) {
        try {
            // 标准Yggdrasil API流程
            // 1. 获取用户UUID
            const profileUrl = `${yggdrasilServer}/sessionserver/session/minecraft/profile`;
            const usernameUrl = `${yggdrasilServer}/api/profiles/minecraft`;

            console.log('🔍 查询用户UUID:', username);

            // 一些皮肤站使用不同的API结构，尝试多种方式
            const possibleUrls = [
                `${yggdrasilServer}/sessionserver/session/minecraft/profile/${username}`,
                `${yggdrasilServer}/api/profiles/minecraft/${username}`,
                `${yggdrasilServer}/sessionserver/session/minecraft/hasJoined?username=${username}`,
            ];

            for (const url of possibleUrls) {
                try {
                    const fetch = require('node-fetch');
                    const response = await fetch(url);
                    if (response.ok) {
                        const data = await response.json();
                        console.log('✅ 成功从皮肤站获取配置文件');
                        return data;
                    }
                } catch (e) {
                    // 继续尝试下一个URL
                }
            }

            console.log('⚠️ 无法从皮肤站获取用户信息，将使用默认配置');
            return null;
        } catch (error) {
            console.log('⚠️ Yggdrasil API请求失败:', error.message);
            return null;
        }
    }

    // 监听标准输入，处理控制面板命令
    process.stdin.on('data', (data) => {
        const input = data.toString().trim();
        console.log(`[控制面板] 收到输入: ${input}`);

        if (input.startsWith('COMMAND:')) {
            const command = input.replace('COMMAND:', '');
            console.log(`[控制面板] 解析命令: "${command}"`);

            if (bot && isConnected) {
                try {
                    const cleanCommand = sanitizeMessage(command);
                    console.log(`📤 准备执行命令: "${cleanCommand}"`);
                    console.log(`🤖 机器人状态: 已连接=${isConnected}, 实体存在=${!!bot.entity}`);

                    // 检查是否是需要权限的命令
                    if (cleanCommand.startsWith('/list') || cleanCommand.startsWith('/seed') ||
                        cleanCommand.startsWith('/gamemode') || cleanCommand.startsWith('/tp') ||
                        cleanCommand.startsWith('/time') || cleanCommand.startsWith('/weather')) {
                        console.log(`⚠️ 注意: "${cleanCommand}" 通常需要管理员权限`);
                        console.log(`💡 如果没有收到反馈，请在服务器控制台执行: /op BotSkon`);
                    }

                    // 设置监听超时，如果3秒内没有收到任何消息，提示可能的问题
                    let responseTimeout = setTimeout(() => {
                        console.log(`⏰ 命令 "${cleanCommand}" 执行3秒后无响应`);
                        console.log(`🔍 可能原因:`);
                        console.log(`   1. 机器人没有执行此命令的权限`);
                        console.log(`   2. 服务器未返回反馈消息`);
                        console.log(`   3. 消息过滤器有问题`);
                        console.log(`💡 建议: 尝试执行 /help 或发送普通聊天消息测试`);
                    }, 3000);

                    // 临时消息监听器，监听这个命令的响应
                    const commandResponseListener = (jsonMsg, position) => {
                        const message = jsonMsg.toString();
                        if (message.toLowerCase().includes('seed') ||
                            message.toLowerCase().includes('online') ||
                            message.toLowerCase().includes('permission') ||
                            message.toLowerCase().includes('权限') ||
                            message.toLowerCase().includes('种子') ||
                            message.toLowerCase().includes('玩家')) {
                            console.log(`🎯 检测到命令相关响应: ${message}`);
                            clearTimeout(responseTimeout);
                            bot.removeListener('message', commandResponseListener);
                        }
                    };

                    bot.on('message', commandResponseListener);

                    // 直接使用bot.chat发送命令
                    bot.chat(cleanCommand);
                    console.log(`✅ 命令已发送到服务器: ${cleanCommand}`);
                } catch (error) {
                    console.error('❌ 命令执行失败:', error);
                }
            } else {
                console.log('⚠️ 机器人未连接，无法执行命令');
                console.log(`🔍 调试信息: bot=${!!bot}, isConnected=${isConnected}`);
            }
        } else if (input.startsWith('CHAT:')) {
            const message = input.replace('CHAT:', '');
            console.log(`[控制面板] 解析聊天消息: "${message}"`);

            if (bot && isConnected) {
                try {
                    const cleanMessage = sanitizeMessage(message);
                    console.log(`💬 发送消息: ${cleanMessage}`);
                    bot.chat(cleanMessage);
                    console.log(`✅ 消息已发送到服务器: ${cleanMessage}`);
                } catch (error) {
                    console.error('❌ 消息发送失败:', error);
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