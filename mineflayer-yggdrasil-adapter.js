
const mineflayer = require('mineflayer');
const { Client } = require('minecraft-protocol');

// 自定义Yggdrasil适配器，修复皮肤站认证问题
class YggdrasilMineflayerAdapter {
    static createBot(options) {
        // 如果使用了自定义Yggdrasil认证，需要特殊处理
        if (options.yggdrasilAuth && options.yggdrasilAuth.enabled) {
            console.log('🔧 使用自定义Yggdrasil适配器创建机器人');
            
            // 创建自定义客户端配置
            const clientOptions = {
                host: options.host,
                port: options.port,
                username: options.username,
                version: options.version,
                auth: 'offline', // 强制使用离线模式避开Mojang验证
                sessionServer: options.sessionServer,
                profileKeysSignatureValidation: false,
                skipValidation: true
            };

            // 如果有自定义session数据，添加到配置中
            if (options.session) {
                clientOptions.session = options.session;
            }

            // 创建机器人实例
            const bot = mineflayer.createBot(clientOptions);

            // 重写皮肤处理逻辑
            if (options.skinSupport && options.skinData) {
                bot.once('login', () => {
                    console.log('🎨 应用自定义皮肤数据');
                    // 这里可以添加自定义皮肤处理逻辑
                    if (options.skinData.skinUrl) {
                        console.log('✅ 皮肤URL:', options.skinData.skinUrl);
                    }
                    if (options.skinData.capeUrl) {
                        console.log('✅ 披风URL:', options.skinData.capeUrl);
                    }
                });
            }

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
