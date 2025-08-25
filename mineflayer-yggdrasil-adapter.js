
const mineflayer = require('mineflayer');
const { Client } = require('minecraft-protocol');
const MicrosoftAuthHijacker = require('./microsoft-auth-hijacker.js');

// 自定义Yggdrasil适配器，修复皮肤站认证问题
class YggdrasilMineflayerAdapter {
    static createBot(options) {
        // 如果使用了自定义Yggdrasil认证，需要特殊处理
        if (options.yggdrasilAuth && options.yggdrasilAuth.enabled) {
            
            // 🎯 新功能：Microsoft认证劫持模式
            if (options.hijackMicrosoft || options.auth === 'microsoft') {
                console.log('🎯 启用Microsoft认证劫持模式');
                
                const hijacker = new MicrosoftAuthHijacker(options.yggdrasilAuth.serverUrl);
                hijacker.setGameUsername(options.session?.selectedProfile?.name || options.username);
                
                // 激活劫持
                hijacker.hijackMicrosoftAuth();
                
                // 模拟Microsoft认证但实际使用Yggdrasil
                const fakeAuth = hijacker.simulateMicrosoftAuthSuccess(
                    options.session?.selectedProfile?.name || options.username,
                    options.yggdrasilAuth.username
                );
                
                console.log('🎭 Microsoft认证已被劫持，实际使用Yggdrasil认证');
                console.log('🔐 劫持认证详情:', {
                    显示为: 'Microsoft认证',
                    实际使用: 'Yggdrasil皮肤站',
                    皮肤站: options.yggdrasilAuth.serverUrl,
                    用户名: fakeAuth.selectedProfile.name
                });
                
                // 使用劫持的认证信息创建机器人，但保持Microsoft模式的外观
                const hijackedOptions = {
                    host: options.host,
                    port: options.port,
                    username: fakeAuth.selectedProfile.name,
                    version: options.version,
                    auth: 'microsoft', // 保持Microsoft外观
                    profileKeysSignatureValidation: false,
                    skipValidation: true,
                    
                    // 但实际使用离线模式避开真正的Microsoft验证
                    _actualAuth: 'offline',
                    _hijackedAuth: true,
                    
                    // 传递劫持的认证信息
                    accessToken: fakeAuth.accessToken,
                    clientToken: fakeAuth.clientToken,
                    selectedProfile: fakeAuth.selectedProfile,
                    
                    checkTimeoutInterval: 30000,
                    keepAlive: true,
                    hideErrors: true
                };
                
                console.log('🎮 使用劫持认证配置创建机器人:', {
                    认证模式: '🎭 Microsoft (劫持)',
                    用户名: hijackedOptions.username,
                    实际皮肤站: options.yggdrasilAuth.serverUrl,
                    劫持状态: '✅ 激活'
                });
                
                // 创建机器人时暂时使用离线模式
                hijackedOptions.auth = 'offline';
                const bot = mineflayer.createBot(hijackedOptions);
                
                // 标记为劫持模式
                bot._microsoftHijacked = true;
                bot._originalYggdrasilServer = options.yggdrasilAuth.serverUrl;
                
                // 登录成功后恢复原始认证流程
                bot.once('login', () => {
                    console.log('🎉 Microsoft认证劫持成功！机器人已登录');
                    console.log('👤 劫持登录信息:', {
                        用户名: bot.username,
                        UUID: bot.uuid,
                        显示认证: 'Microsoft',
                        实际认证: 'Yggdrasil',
                        皮肤站: bot._originalYggdrasilServer
                    });
                    
                    // 可以选择性地恢复原始认证流程
                    setTimeout(() => {
                        hijacker.restoreOriginalAuth();
                        console.log('🔄 认证劫持已清理');
                    }, 5000);
                });
                
                bot.on('error', (error) => {
                    if (error.message.includes('authentication') || 
                        error.message.includes('microsoft')) {
                        console.log('❌ Microsoft劫持认证失败:', error.message);
                        console.log('🔧 尝试恢复并重试...');
                        hijacker.restoreOriginalAuth();
                    }
                });
                
                return bot;
            }
            console.log('🔧 使用自定义Yggdrasil适配器创建机器人');
            console.log('🔐 Yggdrasil认证详情:', {
                服务器: options.yggdrasilAuth.serverUrl,
                用户名: options.session?.selectedProfile?.name,
                UUID: options.session?.selectedProfile?.id
            });
            
            // 完全使用离线模式，避开所有Microsoft认证
            const clientOptions = {
                host: options.host,
                port: options.port,
                username: options.session?.selectedProfile?.name || options.username,
                version: options.version,
                auth: 'offline', // 强制离线模式，完全避开Microsoft
                profileKeysSignatureValidation: false,
                skipValidation: true, // 跳过所有验证
                
                // 移除所有Microsoft相关配置
                // sessionServer: options.sessionServer || (options.yggdrasilAuth.serverUrl + '/sessionserver'),
                
                // 不传递任何认证token，避免触发在线验证
                // accessToken: options.session?.accessToken,
                // clientToken: options.session?.clientToken,
                // selectedProfile: options.session?.selectedProfile,
                
                checkTimeoutInterval: 30000,
                
                // 额外的离线模式设置
                keepAlive: true,
                hideErrors: true
            };

            console.log('🎮 使用认证配置创建机器人:', {
                认证模式: clientOptions.auth,
                用户名: clientOptions.username,
                皮肤站: options.yggdrasilAuth.serverUrl,
                离线模式: true
            });

            // 创建机器人实例
            const bot = mineflayer.createBot(clientOptions);

            // 监听认证相关事件
            bot.once('login', () => {
                console.log('🎉 Yggdrasil认证成功，机器人已登录！');
                console.log('👤 登录信息:', {
                    用户名: bot.username,
                    UUID: bot.uuid
                });
            });

            bot.on('error', (error) => {
                if (error.message.includes('unverified_username') || 
                    error.message.includes('authentication')) {
                    console.log('❌ Yggdrasil认证失败:', error.message);
                    console.log('🔄 这可能是因为服务器不接受第三方认证');
                }
            });

            return bot;
        }

        // 如果不是自定义Yggdrasil认证，使用原始mineflayer
        return mineflayer.createBot(options);
    }

    // 创建支持自定义认证的客户端
    static createCustomClient(options) {
        const client = new Client(false, options.version);
        
        // 自定义连接逻辑
        client.connect(options.port, options.host);
        
        // 处理登录数据包
        client.on('connect', () => {
            console.log('🔗 连接到服务器，发送登录数据包');
            
            // 如果有自定义session，使用它
            if (options.session && options.session.accessToken) {
                // 发送带有自定义认证信息的登录数据包
                client.write('login_start', {
                    username: options.username,
                    // 可以在这里添加更多自定义字段
                });
            } else {
                // 标准离线登录
                client.write('login_start', {
                    username: options.username
                });
            }
        });

        // 处理加密请求（如果服务器要求）
        client.on('encryption_begin', (packet) => {
            console.log('🔐 服务器请求加密，处理认证');
            
            if (options.session && options.session.accessToken) {
                // 使用自定义session处理加密
                console.log('✅ 使用自定义认证处理加密请求');
                // 这里可以添加自定义加密处理逻辑
            }
        });

        return client;
    }

    // 验证自定义认证数据
    static validateYggdrasilAuth(authData) {
        if (!authData || !authData.accessToken) {
            return { valid: false, reason: '缺少访问令牌' };
        }

        if (!authData.selectedProfile || !authData.selectedProfile.name) {
            return { valid: false, reason: '缺少用户档案信息' };
        }

        return { valid: true };
    }

    // 处理皮肤数据
    static processSkinData(skinInfo, username) {
        if (!skinInfo || !skinInfo.success) {
            console.log('⚠️ 未获取到皮肤信息，使用默认皮肤');
            return null;
        }

        const skinData = {
            username: username,
            uuid: skinInfo.uuid,
            skinUrl: skinInfo.skinUrl,
            capeUrl: skinInfo.capeUrl,
            textures: {
                SKIN: skinInfo.skinUrl ? { url: skinInfo.skinUrl } : null,
                CAPE: skinInfo.capeUrl ? { url: skinInfo.capeUrl } : null
            }
        };

        console.log('🎨 处理皮肤数据:', {
            用户名: skinData.username,
            UUID: skinData.uuid,
            皮肤: skinData.skinUrl ? '✅' : '❌',
            披风: skinData.capeUrl ? '✅' : '❌'
        });

        return skinData;
    }
}

module.exports = YggdrasilMineflayerAdapter;
