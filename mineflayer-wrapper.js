// Mineflayer Yggdrasil包装器 - 不修改原始包
const originalMineflayer = require('./node_modules/mineflayer');

// 保存原始createBot函数
const originalCreateBot = originalMineflayer.createBot;

// 增强createBot以支持第三方皮肤站
function enhancedCreateBot(options) {
    // 如果有第三方认证信息，进行特殊处理
    if (options.session && options.session.accessToken && options.sessionServer) {
        console.log('🔧 检测到第三方皮肤站认证，应用兼容性处理');
        
        // 创建增强选项
        const enhancedOptions = {
            ...options,
            auth: 'offline', // 使用离线模式避开Mojang验证
            profileKeysSignatureValidation: false,
            skipValidation: true,
            checkTimeoutInterval: 30000
        };
        
        // 保持用户名从session中获取
        if (options.session.selectedProfile && options.session.selectedProfile.name) {
            enhancedOptions.username = options.session.selectedProfile.name;
        }
        
        return originalCreateBot(enhancedOptions);
    }
    
    // 普通情况，直接使用原始函数
    return originalCreateBot(options);
}

// 导出增强版本，保持完全兼容性
module.exports = {
    ...originalMineflayer,
    createBot: enhancedCreateBot
};
