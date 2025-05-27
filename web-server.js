const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let botProcess = null;
let currentConfig = null;



// 日志管理
class LogManager {
    constructor() {
        this.lastStatus = null;
        this.statusCount = 0;
        this.logBuffer = [];
        this.maxLogSize = 1000; // 最大日志条数
        this.lastError = null; // 存储最近的错误信息

        // 每5分钟清理一次日志
        setInterval(() => {
            this.cleanLogs();
        }, 5 * 60 * 1000);
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();

        // 检测重复状态请求
        if (message.includes('GET /api/bot/status')) {
            if (this.lastStatus === 'GET /api/bot/status') {
                this.statusCount++;
                return; // 不记录重复状态
            } else {
                if (this.statusCount > 0) {
                    this.logBuffer.push({
                        timestamp,
                        message: `状态请求重复 x${this.statusCount}`,
                        type: 'compressed'
                    });
                    this.statusCount = 0;
                }
                this.lastStatus = 'GET /api/bot/status';
            }
        } else {
            // 输出之前压缩的状态日志
            if (this.statusCount > 0) {
                this.logBuffer.push({
                    timestamp,
                    message: `状态请求重复 x${this.statusCount}`,
                    type: 'compressed'
                });
                this.statusCount = 0;
            }
            this.lastStatus = null;
        }

        this.logBuffer.push({
            timestamp,
            message,
            type
        });

        console.log(`[${timestamp}] ${message}`);

        // 限制日志大小
        if (this.logBuffer.length > this.maxLogSize) {
            this.logBuffer = this.logBuffer.slice(-this.maxLogSize);
        }
    }

    cleanLogs() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        const originalLength = this.logBuffer.length;
        this.logBuffer = this.logBuffer.filter(log => {
            return new Date(log.timestamp) > oneHourAgo;
        });

        const cleaned = originalLength - this.logBuffer.length;
        if (cleaned > 0) {
            console.log(`清理了 ${cleaned} 条过期日志，当前日志条数: ${this.logBuffer.length}`);
        }
    }

    getLogs() {
        return this.logBuffer;
    }

    setError(error) {
        this.lastError = error;
        this.log(`错误: ${error}`, 'error');
    }

    getLastError() {
        return this.lastError;
    }

    clearError() {
        this.lastError = null;
    }
}

const logger = new LogManager();

// 根据模式获取配置文件名
function getConfigFile(mode) {
    return mode === 'bedrock' ? 'config-bedrock.json' : 'config-java.json';
}

// 读取配置文件
function loadConfig(mode = null) {
    try {
        if (mode) {
            // 如果指定了模式，直接读取对应配置
            const configFile = getConfigFile(mode);
            const configData = fs.readFileSync(configFile, 'utf8');
            currentConfig = JSON.parse(configData);
            console.log(`加载${mode}模式配置:`, currentConfig.client);
            return currentConfig;
        }

        // 如果没有指定模式，返回当前配置或默认Java配置
        if (currentConfig) {
            return currentConfig;
        }

        // 默认加载Java配置
        const javaConfigData = fs.readFileSync('config-java.json', 'utf8');
        currentConfig = JSON.parse(javaConfigData);
        return currentConfig;
    } catch (error) {
        console.error('读取配置文件失败:', error);
        return null;
    }
}

// 保存配置文件
function saveConfig(config) {
    try {
        const mode = config.client?.mode || 'java';
        const configFile = getConfigFile(mode);
        fs.writeFileSync(configFile, JSON.stringify(config, null, 4));
        currentConfig = config;
        return true;
    } catch (error) {
        console.error('保存配置文件失败:', error);
        return false;
    }
}

// 启动机器人
function startBot(mode = null) {
    if (botProcess) {
        stopBot();
    }

    const config = loadConfig(mode);

    try {
        console.log('启动Java模式机器人...');

        // 准备环境变量，避免端口冲突
        const env = { 
            ...process.env, 
            PORT: '3001',  // 使用3001端口避免与控制面板的5000端口冲突
            WEB_PORT: '3001',  // 确保aterbot的web服务使用3001端口
            ATERBOT_WEB_PORT: '3001',  // aterbot专用的web端口环境变量
            NODE_ENV: 'production'  // 设置为生产环境，避免默认端口冲突
        };

        // 传递mod配置
        if (config && config.client && config.client.mods && config.client.mods.length > 0) {
            env.FAKE_MODS = JSON.stringify(config.client.mods);
            console.log('配置假mod列表:', config.client.mods);
        }

        // 传递自适应mod配置
        if (config && config.client && config.client.adaptiveMods !== undefined) {
            env.ADAPTIVE_MODS = config.client.adaptiveMods ? 'true' : 'false';
            console.log('自适应mod模式:', config.client.adaptiveMods);
        }

        console.log('使用修补版aterbot避免端口冲突');

        // 启动修补版的Java机器人 - 禁用web服务
        botProcess = spawn('node', ['aterbot-no-web.js'], {
            stdio: 'pipe',
            env: env
        });

        if (botProcess) {
            botProcess.stdout.on('data', (data) => {
                console.log(`Bot输出: ${data}`);
            });

            botProcess.stderr.on('data', (data) => {
                const errorMsg = data.toString();
                console.error(`Bot错误: ${errorMsg}`);
                logger.setError(`启动失败: ${errorMsg}`);
            });

            botProcess.on('close', (code) => {
        console.log(`Bot进程退出，退出码: ${code}`);

        // 无论退出码是什么，都应该清理进程状态
        const wasRunning = botProcess !== null;
        botProcess = null;

        // 如果不是手动停止（退出码0通常表示正常退出，但在被踢出时也可能是0）
        if (wasRunning) {
            if (code !== 0 && code !== null) {
                logger.setError(`机器人异常退出，退出码: ${code}`);
            } else {
                // 即使退出码是0，如果是意外断开也需要记录
                const currentTime = Date.now();
                if (!global.lastManualStop || currentTime - global.lastManualStop > 5000) {
                    logger.setError(`机器人意外断开连接（可能被踢出或网络问题）`);
                }
            }
        }
    });

            botProcess.on('error', (error) => {
                console.error('Bot进程启动失败:', error);
                logger.setError(`进程启动失败: ${error.message}`);
                botProcess = null;
            });
        }

        return { success: true, message: 'Java模式机器人启动成功' };
    } catch (error) {
        console.error('启动机器人失败:', error);
        logger.setError(`启动机器人失败: ${error.message}`);
        return { success: false, message: `启动失败: ${error.message}` };
    }
}

// 停止机器人
function stopBot() {
    if (botProcess) {
        // 记录手动停止的时间
        global.lastManualStop = Date.now();
        botProcess.kill();
        botProcess = null;
    }
}

const server = http.createServer((req, res) => {
    // 添加CORS头部
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    logger.log(`收到请求: ${req.method} ${req.url}`);

    if (req.method === 'GET' && req.url === '/') {
        // 返回主页面
        try {
            const html = fs.readFileSync('control-panel.html', 'utf8');
            res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
            res.end(html);
        } catch (error) {
            console.error('读取HTML文件失败:', error);
            res.writeHead(500, {'Content-Type': 'text/plain'});
            res.end('Internal Server Error');
        }
    } else if (req.method === 'GET' && req.url.startsWith('/api/config')) {
        // 返回当前配置
        const config = loadConfig();
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(config));
    } else if (req.method === 'POST' && req.url === '/api/config') {
        // 更新配置
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const newConfig = JSON.parse(body);
                if (saveConfig(newConfig)) {
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({success: true, message: '配置已保存'}));
                } else {
                    res.writeHead(500, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({success: false, message: '保存配置失败'}));
                }
            } catch (error) {
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({success: false, message: '无效的JSON格式'}));
            }
        });
    } else if (req.method === 'POST' && req.url === '/api/bot/start') {
        // 启动机器人
        logger.clearError(); // 清除之前的错误
        startBot();
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({success: true, message: '机器人已启动'}));
    } else if (req.method === 'POST' && req.url === '/api/bot/stop') {
        // 停止机器人
        stopBot();
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({success: true, message: '机器人已停止'}));
    } else if (req.method === 'GET' && req.url === '/api/bot/status') {
        // 获取机器人状态
        try {
            const status = {
                running: botProcess !== null && botProcess.exitCode === null,
                error: logger.getLastError()
            };
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(status));
        } catch (error) {
            console.error('获取状态失败:', error);
            res.writeHead(500, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                running: false,
                error: `状态获取失败: ${error.message}`
            }));
        }
    } else if (req.method === 'GET' && req.url === '/api/logs') {
        // 获取日志
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
            logs: logger.getLogs(),
            totalCount: logger.logBuffer.length
        }));
    } else if (req.method === 'POST' && req.url === '/api/logs/clear') {
        // 清除日志
        logger.logBuffer = [];
        logger.statusCount = 0;
        logger.lastStatus = null;
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({success: true, message: '日志已清除'}));

    } else if (req.method === 'POST' && req.url === '/api/bot/command') {
        // 执行命令
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { command } = JSON.parse(body);

                if (botProcess && botProcess.exitCode === null) {
                    // 确保命令格式正确
                    const cleanCommand = command.trim();
                    const finalCommand = cleanCommand.startsWith('/') ? cleanCommand : `/${cleanCommand}`;

                    // 发送命令到机器人进程
                    console.log(`[API] 发送命令到机器人: ${finalCommand}`);
                    botProcess.stdin.write(`COMMAND:${finalCommand}\n`);

                    logger.log(`✅ 执行命令: ${finalCommand}`);
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({
                        success: true,
                        message: `命令已发送: ${finalCommand}`
                    }));
                } else {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({
                        success: false,
                        message: '机器人未运行'
                    }));
                }
            } catch (error) {
                console.error('命令执行失败:', error);
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({
                    success: false,
                    message: error.message
                }));
            }
        });

    } else if (req.method === 'POST' && req.url === '/api/bot/chat') {
        // 发送聊天消息
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { message } = JSON.parse(body);

                if (!botProcess) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({success: false, message: '机器人未运行'}));
                    return;
                }

                if (!message || typeof message !== 'string') {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({success: false, message: '无效的消息'}));
                    return;
                }

                try {
                    // 向机器人进程发送聊天消息
                    botProcess.stdin.write(`CHAT:${message}\n`);
                    logger.log(`通过控制面板发送聊天: ${message}`);

                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({success: true, message: '消息已发送'}));
                } catch (error) {
                    logger.log(`聊天发送失败: ${error.message}`, 'error');
                    res.writeHead(500, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({success: false, message: '消息发送失败'}));
                }
            } catch (error) {
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({success: false, message: '无效的JSON格式'}));
            }
        });

    } else {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Not Found');
    }
});

// 处理端口冲突，尝试多个端口
function startServer(port = 5000) {
    // 防止重复启动
    if (server.listening) {
        console.log('服务器已经在运行中，跳过启动');
        return;
    }

    server.listen(port, '0.0.0.0', () => {
        console.log(`Aterbot控制面板启动在 http://0.0.0.0:${port}`);
        console.log('请访问: https://你的repl域名 或者在Replit中点击Webview');
        loadConfig();
    });

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE' && port < 5010) {
            console.log(`端口 ${port} 被占用，尝试端口 ${port + 1}...`);
            // 延迟一下再尝试下一个端口，避免快速重复
            setTimeout(() => {
                startServer(port + 1);
            }, 100);
        } else {
            console.error('服务器启动失败:', error);
            process.exit(1);
        }
    });
}

// 防止重复调用
if (!global.serverStarted) {
    global.serverStarted = true;
    startServer();
}



// 优雅处理未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
});