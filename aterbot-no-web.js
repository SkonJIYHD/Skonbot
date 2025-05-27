
// 修改版的aterbot启动器，禁用web服务并添加管理员权限检测
const fs = require('fs');
const path = require('path');

// 创建管理员权限检测补丁
function createAdminDetectionPatch() {
    const patchContent = `
// 管理员权限检测模块
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
                if (bot && bot.chat) {
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
                console.log(\`执行来自 \${player} 的命令: \${command}\`);
                
                try {
                    // 执行命令
                    bot.chat(\`/\${command}\`);
                } catch (error) {
                    console.error('命令执行失败:', error);
                    bot.chat(\`命令执行失败: \${error.message}\`);
                }
            }
        });
        
        // 发送启用通知
        setTimeout(() => {
            if (bot && bot.chat) {
                bot.chat('§a[机器人] 命令模式已自动启用！使用 !<命令> 来执行指令');
            }
        }, 2000);
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = adminDetection;
}
`;
    
    return patchContent;
}

// 创建禁用web服务的补丁
function patchAterbot() {
    try {
        // 检查web.ts文件是否存在
        const aterbotWebPath = './node_modules/aterbot/src/web.ts';
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
        
        // 修补主入口文件以添加管理员检测
        const aterbotIndexPath = './node_modules/aterbot/src/index.ts';
        if (fs.existsSync(aterbotIndexPath)) {
            console.log('添加管理员权限检测功能...');
            
            let indexContent = fs.readFileSync(aterbotIndexPath, 'utf8');
            
            // 如果还没有被修改过，就修改它
            if (!indexContent.includes('// ADMIN DETECTION PATCH')) {
                // 创建管理员检测代码
                const adminDetectionCode = createAdminDetectionPatch();
                
                // 在文件开头添加管理员检测
                const patchedIndexContent = `// ADMIN DETECTION PATCH
${adminDetectionCode}

// 在机器人连接后启用管理员检测
const originalContent = \`
${indexContent}
\`;

// 修改后的内容，添加管理员检测
${indexContent.replace(
    /bot\.on\('spawn',.*?\{/g,
    `bot.on('spawn', () => {
        console.log('🤖 机器人已进入服务器，开始检测管理员权限...');
        adminDetection.checkAdminStatus(bot);`
)}`;
                
                fs.writeFileSync(aterbotIndexPath, patchedIndexContent);
                console.log('成功添加管理员权限检测功能');
            }
        }
        
        // 启动aterbot
        const { spawn } = require('child_process');
        
        const env = {
            ...process.env,
            FAKE_MODS: process.env.FAKE_MODS || '[]',
            ADAPTIVE_MODS: process.env.ADAPTIVE_MODS || 'false'
        };
        
        console.log('启动已修补的aterbot（包含管理员检测）...');
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
