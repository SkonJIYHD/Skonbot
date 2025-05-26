
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
    
    if (config && config.client && config.client.mode === 'bedrock') {
        console.log('启动基岩版机器人...');
        // 启动基岩版机器人
        botProcess = spawn('node', ['bedrock-bot.js'], {
            stdio: 'pipe'
        });
    } else {
        console.log('启动Java版机器人...');
        
        // 准备假mod列表环境变量
        const env = { ...process.env, PORT: '5001' };
        
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
        
        // 启动Java版机器人 - 设置不同的端口避免冲突
        botProcess = spawn('npx', ['tsx', './node_modules/aterbot/src/index.ts'], {
            stdio: 'pipe',
            env: env
        });
    }
    
    botProcess.stdout.on('data', (data) => {
        console.log(`Bot输出: ${data}`);
    });
    
    botProcess.stderr.on('data', (data) => {
        console.error(`Bot错误: ${data}`);
    });
    
    botProcess.on('close', (code) => {
        console.log(`Bot进程退出，退出码: ${code}`);
        botProcess = null;
    });
}

// 停止机器人
function stopBot() {
    if (botProcess) {
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
        const url = new URL(req.url, `http://${req.headers.host}`);
        const mode = url.searchParams.get('mode');
        const config = loadConfig(mode);
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
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({running: botProcess !== null}));
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
    
    } else {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Not Found');
    }
});

server.listen(5000, '0.0.0.0', () => {
    console.log('Aterbot控制面板启动在 http://0.0.0.0:5000');
    console.log('请访问: https://你的repl域名 或者在Replit中点击Webview');
    loadConfig();
});

server.on('error', (error) => {
    console.error('服务器启动失败:', error);
});



// 优雅处理未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
});
