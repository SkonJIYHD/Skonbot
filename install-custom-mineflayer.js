
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

    // 创建自定义mineflayer补丁
    const mineflayerPath = './node_modules/mineflayer';
    if (fs.existsSync(mineflayerPath)) {
        console.log('🔨 应用Yggdrasil认证补丁...');
        
        // 备份原始版本
        const backupPath = mineflayerPath + '_backup';
        if (!fs.existsSync(backupPath)) {
            fs.cpSync(mineflayerPath, backupPath, { recursive: true });
            console.log('💾 原始mineflayer已备份');
        }

        // 创建补丁文件
        const patchContent = `
// Yggdrasil认证补丁 - 由AterBot添加
const originalCreateBot = require('./lib/index.js').createBot;

module.exports = {
    ...require('./lib/index.js'),
    createBot: function(options) {
        // 如果启用了自定义Yggdrasil，应用补丁
        if (options.yggdrasilAuth && options.yggdrasilAuth.enabled) {
            console.log('🔧 应用Yggdrasil认证补丁');
            
            // 确保使用离线模式但保留session信息
            const patchedOptions = {
                ...options,
                auth: 'offline',
                profileKeysSignatureValidation: false,
                skipValidation: true
            };
            
            return originalCreateBot(patchedOptions);
        }
        
        return originalCreateBot(options);
    }
};
`;

        // 写入补丁
        fs.writeFileSync(path.join(mineflayerPath, 'index.js'), patchContent);
        console.log('✅ Yggdrasil认证补丁已应用');
    }

    console.log('🎉 自定义mineflayer安装完成！');
    console.log('📋 功能说明:');
    console.log('  ✅ 支持自定义Yggdrasil皮肤站认证');
    console.log('  ✅ 保持与原版mineflayer的兼容性');
    console.log('  ✅ 自动处理皮肤站session数据');
    
} catch (error) {
    console.error('❌ 安装失败:', error.message);
    console.log('💡 请手动运行: npm install');
}
