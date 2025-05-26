
// 修改版的aterbot启动器，禁用web服务
const fs = require('fs');
const path = require('path');

// 读取aterbot的入口文件
const aterbotIndexPath = './node_modules/aterbot/src/index.ts';
const aterbotWebPath = './node_modules/aterbot/src/web.ts';

// 创建禁用web服务的补丁
function patchAterbot() {
    try {
        // 检查web.ts文件是否存在
        if (fs.existsSync(aterbotWebPath)) {
            console.log('禁用aterbot的web服务...');
            
            // 读取web.ts内容
            let webContent = fs.readFileSync(aterbotWebPath, 'utf8');
            
            // 如果还没有被修改过，就修改它
            if (!webContent.includes('// PATCHED BY CONTROL PANEL')) {
                // 在文件开头添加早期返回，跳过web服务启动
                const patchedContent = `// PATCHED BY CONTROL PANEL - 禁用web服务
export default function() {
    console.log('Web服务已被控制面板禁用');
    return Promise.resolve();
}

// 原始代码被注释
/*
${webContent}
*/`;
                
                fs.writeFileSync(aterbotWebPath, patchedContent);
                console.log('成功禁用aterbot的web服务');
            }
        }
        
        // 启动aterbot
        const { spawn } = require('child_process');
        
        const env = {
            ...process.env,
            FAKE_MODS: process.env.FAKE_MODS || '[]',
            ADAPTIVE_MODS: process.env.ADAPTIVE_MODS || 'false'
        };
        
        console.log('启动已修补的aterbot...');
        const botProcess = spawn('npx', ['tsx', './node_modules/aterbot/src/index.ts'], {
            stdio: 'inherit',
            env: env
        });
        
        process.on('SIGINT', () => {
            botProcess.kill();
            process.exit();
        });
        
        process.on('SIGTERM', () => {
            botProcess.kill();
            process.exit();
        });
        
    } catch (error) {
        console.error('修补aterbot失败:', error);
        process.exit(1);
    }
}

// 运行修补程序
patchAterbot();
