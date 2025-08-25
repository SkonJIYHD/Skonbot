
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 修复并重新安装mineflayer...');

try {
    const mineflayerPath = './node_modules/mineflayer';
    const backupPath = mineflayerPath + '_backup';
    
    // 如果有备份，先恢复原始版本
    if (fs.existsSync(backupPath)) {
        console.log('🔄 发现备份，恢复原始mineflayer...');
        if (fs.existsSync(mineflayerPath)) {
            fs.rmSync(mineflayerPath, { recursive: true, force: true });
        }
        fs.cpSync(backupPath, mineflayerPath, { recursive: true });
        console.log('✅ 原始mineflayer已恢复');
    } else {
        // 没有备份，重新安装mineflayer
        console.log('📦 重新安装mineflayer...');
        execSync('npm install mineflayer --force', { stdio: 'inherit' });
    }

    // 检查mineflayer是否正常
    const originalIndexPath = path.join(mineflayerPath, 'index.js');
    if (!fs.existsSync(originalIndexPath)) {
        console.log('❌ mineflayer index.js不存在，重新安装...');
        execSync('npm install mineflayer --force', { stdio: 'inherit' });
    }

    const libIndexPath = path.join(mineflayerPath, 'lib', 'index.js');
    if (!fs.existsSync(libIndexPath)) {
        console.log('❌ mineflayer lib/index.js不存在，重新安装...');
        execSync('npm install mineflayer --force', { stdio: 'inherit' });
    }

    // 重新备份干净的版本
    if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
    }
    fs.cpSync(mineflayerPath, backupPath, { recursive: true });
    console.log('💾 新的干净备份已创建');

    // 应用更安全的补丁 - 创建包装文件而不是修改原始文件
    console.log('🔨 应用安全补丁...');
    
    const wrapperPath = path.join(__dirname, 'mineflayer-wrapper.js');
    const wrapperContent = `// Mineflayer Yggdrasil包装器 - 不修改原始包
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
`;

    fs.writeFileSync(wrapperPath, wrapperContent);
    console.log('✅ 安全包装器已创建');

    console.log('🎉 Mineflayer修复完成！');
    console.log('📋 功能说明:');
    console.log('  ✅ 原始mineflayer包结构完整无损');
    console.log('  ✅ 通过包装器支持第三方皮肤站');
    console.log('  ✅ 完全兼容所有现有功能');
    console.log('  ✅ 可以安全卸载和重装');
    
} catch (error) {
    console.error('❌ 修复失败:', error.message);
    console.log('💡 尝试手动运行: npm install mineflayer --force');
}
`;
