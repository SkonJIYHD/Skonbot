
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let botProcess = null;
let currentConfig = null;

// 读取配置文件
function loadConfig() {
    try {
        const configData = fs.readFileSync('config.json', 'utf8');
        currentConfig = JSON.parse(configData);
        return currentConfig;
    } catch (error) {
        console.error('读取配置文件失败:', error);
        return null;
    }
}

// 保存配置文件
function saveConfig(config) {
    try {
        fs.writeFileSync('config.json', JSON.stringify(config, null, 4));
        currentConfig = config;
        return true;
    } catch (error) {
        console.error('保存配置文件失败:', error);
        return false;
    }
}

// 启动机器人
function startBot() {
    if (botProcess) {
        stopBot();
    }
    
    const config = loadConfig();
    
    if (config && config.client && config.client.mode === 'bedrock') {
        // 启动基岩版机器人
        botProcess = spawn('node', ['bedrock-bot.js'], {
            stdio: 'pipe'
        });
    } else {
        // 启动Java版机器人
        botProcess = spawn('npx', ['tsx', './node_modules/aterbot/src/index.ts'], {
            stdio: 'pipe'
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
    
    console.log(`收到请求: ${req.method} ${req.url}`);
    
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
    } else if (req.method === 'GET' && req.url === '/api/config') {
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
