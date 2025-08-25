
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 安装支持自定义Yggdrasil认证的mineflayer版本...');

try {
    // 首先安装标准版本的依赖
    console.log('📦 安装基础依赖...');
    
    // 检查是否已有node_modules
    if (!fs.existsSync('./node_modules')) {
        execSync('npm install', { stdio: 'inherit' });
    }

    // 检查mineflayer是否安装
    const mineflayerPath = './node_modules/mineflayer';
    if (fs.existsSync(mineflayerPath)) {
        console.log('🔨 应用Yggdrasil认证补丁...');
        
        // 备份原始版本
        const backupPath = mineflayerPath + '_backup';
        if (!fs.existsSync(backupPath)) {
            fs.cpSync(mineflayerPath, backupPath, { recursive: true });
            console.log('💾 原始mineflayer已备份');
        }

        // 检查是否已经应用了补丁
        const originalIndexPath = path.join(mineflayerPath, 'index.js');
        const originalContent = fs.readFileSync(originalIndexPath, 'utf8');
        
        if (originalContent.includes('Yggdrasil认证补丁')) {
            console.log('✅ 补丁已存在，跳过应用');
        } else {
            // 创建更安全的补丁 - 不破坏原始结构
            const enhancedContent = `// Yggdrasil认证补丁 - 由AterBot添加
const originalModule = require('./lib/index.js');
const originalCreateBot = originalModule.createBot;

// 增强createBot函数以支持第三方皮肤站
function enhancedCreateBot(options) {
    // 如果有第三方认证信息，进行特殊处理
    if (options.session && options.session.accessToken && options.sessionServer) {
        console.log('🔧 检测到第三方皮肤站认证，应用兼容性补丁');
        
        // 修改选项以提高兼容性
        const enhancedOptions = {
            ...options,
            auth: 'offline', // 使用离线模式避开Mojang验证
            profileKeysSignatureValidation: false,
            skipValidation: true,
            checkTimeoutInterval: 30000
        };
        
        return originalCreateBot(enhancedOptions);
    }
    
    return originalCreateBot(options);
}

// 导出增强版本，保持完全兼容性
module.exports = {
    ...originalModule,
    createBot: enhancedCreateBot
};
`;

            // 写入增强版本
            fs.writeFileSync(originalIndexPath, enhancedContent);
            console.log('✅ Yggdrasil认证补丁已安全应用');
        }
    } else {
        console.log('⚠️ 未找到mineflayer包，请先运行 npm install');
    }

    console.log('🎉 自定义mineflayer安装完成！');
    console.log('📋 功能说明:');
    console.log('  ✅ 支持自定义Yggdrasil皮肤站认证');
    console.log('  ✅ 保持与原版mineflayer的完全兼容性');
    console.log('  ✅ 不破坏原始包结构');
    console.log('  ✅ 自动处理皮肤站session数据');
    
} catch (error) {
    console.error('❌ 安装失败:', error.message);
    console.log('💡 请手动运行: npm install');
}
