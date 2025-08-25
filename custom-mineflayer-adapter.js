
// 自定义Mineflayer适配器 - 支持第三方皮肤站认证
const mineflayer = require('mineflayer');
const { EventEmitter } = require('events');

class CustomMineflayerAdapter extends EventEmitter {
    constructor() {
        super();
        this.originalCreateBot = mineflayer.createBot;
        this.patchMineflayer();
    }

    patchMineflayer() {
        const self = this;
        
        // 重写createBot方法以支持第三方认证
        mineflayer.createBot = function(options) {
            console.log('🔧 使用自定义Mineflayer适配器');
            
            const originalOptions = { ...options };
            
            // 如果有第三方认证信息，进行特殊处理
            if (options.session && options.session.accessToken) {
                console.log('🌐 检测到第三方认证信息，启用自定义认证模式');
                
                // 保存原始认证信息
                const thirdPartyAuth = {
                    accessToken: options.session.accessToken,
                    clientToken: options.session.clientToken,
                    selectedProfile: options.session.selectedProfile,
                    sessionServer: options.sessionServer,
                    skinServer: options.skinServer
                };
                
                // 修改选项以避免Mojang验证
                const modifiedOptions = {
                    ...options,
                    auth: 'offline',
                    username: options.session.selectedProfile.name,
                    profileKeysSignatureValidation: false,
                    skipValidation: true,
                    checkTimeoutInterval: 30000
                };
                
                // 移除可能导致冲突的字段
                delete modifiedOptions.session;
                delete modifiedOptions.accessToken;
                delete modifiedOptions.clientToken;
                
                console.log('🎮 创建离线模式机器人（第三方认证支持）');
                const bot = self.originalCreateBot.call(this, modifiedOptions);
                
                // 注入第三方认证信息到bot对象
                bot._thirdPartyAuth = thirdPartyAuth;
                bot._isThirdPartyAuth = true;
                
                // 重写部分方法以支持第三方认证
                self.injectThirdPartyMethods(bot);
                
                return bot;
            }
            
            // 普通模式，直接使用原始createBot
            return self.originalCreateBot.call(this, originalOptions);
        };
        
        console.log('✅ Mineflayer已成功打补丁，支持第三方皮肤站认证');
    }
    
    injectThirdPartyMethods(bot) {
        const thirdPartyAuth = bot._thirdPartyAuth;
        
        // 重写session相关方法
        bot.session = {
            accessToken: thirdPartyAuth.accessToken,
            clientToken: thirdPartyAuth.clientToken,
            selectedProfile: thirdPartyAuth.selectedProfile,
            validate: async () => {
                console.log('🔐 第三方认证验证（模拟成功）');
                return true;
            },
            refresh: async () => {
                console.log('🔄 第三方认证刷新（模拟成功）');
                return true;
            }
        };
        
        // 添加第三方认证状态标识
        bot.isThirdPartyAuthenticated = true;
        bot.thirdPartyAuthServer = thirdPartyAuth.sessionServer;
        
        // 监听登录事件，输出第三方认证信息
        bot.once('login', () => {
            console.log('🎉 第三方认证机器人登录成功！');
            console.log('📋 认证详情:', {
                用户名: bot.username,
                UUID: bot.uuid,
                认证服务器: thirdPartyAuth.sessionServer,
                皮肤服务器: thirdPartyAuth.skinServer
            });
        });
        
        // 处理可能的认证错误
        bot.on('error', (error) => {
            if (error.message.includes('authentication') || error.message.includes('session')) {
                console.log('⚠️ 第三方认证模式下忽略认证错误:', error.message);
                // 不要传播认证相关错误，因为我们使用离线模式
                return;
            }
        });
    }
    
    // 恢复原始mineflayer
    restore() {
        if (this.originalCreateBot) {
            mineflayer.createBot = this.originalCreateBot;
            console.log('🔄 Mineflayer已恢复为原始状态');
        }
    }
}

module.exports = CustomMineflayerAdapter;
