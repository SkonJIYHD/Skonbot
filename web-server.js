
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const querystring = require('querystring');

let botProcess = null;
let currentConfig = null;

// 微软认证相关
let microsoftAuthData = {
    authenticated: false,
    accessToken: null,
    refreshToken: null,
    userInfo: null,
    expiresAt: null
};

// 微软应用配置 - 你需要在微软Azure中创建应用
// 临时测试配置 - 请替换为你自己的Azure应用配置
const MICROSOFT_CONFIG = {
    clientId: process.env.MICROSOFT_CLIENT_ID || '00000000-0000-0000-0000-000000000000', // 替换为你的应用ID
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'your-client-secret', // 替换为你的应用密钥  
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'https://你的repl域名/api/auth/microsoft/callback',
    scopes: 'XboxLive.signin offline_access',
    authUrl: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
    xboxAuthUrl: 'https://user.auth.xboxlive.com/user/authenticate',
    xboxXstsUrl: 'https://xsts.auth.xboxlive.com/xsts/authorize',
    minecraftUrl: 'https://api.minecraftservices.com/authentication/login_with_xbox'
};

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
        // 启动Java版机器人 - 设置不同的端口避免冲突
        const env = { ...process.env, PORT: '5001' };
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
    } else if (req.method === 'GET' && req.url === '/api/auth/microsoft/status') {
        // 获取微软认证状态
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
            authenticated: microsoftAuthData.authenticated,
            username: microsoftAuthData.userInfo?.name,
            email: microsoftAuthData.userInfo?.preferred_username
        }));
    } else if (req.method === 'GET' && req.url === '/api/auth/microsoft/login') {
        // 开始微软OAuth流程
        const state = crypto.randomBytes(16).toString('hex');
        const authParams = {
            client_id: MICROSOFT_CONFIG.clientId,
            response_type: 'code',
            redirect_uri: MICROSOFT_CONFIG.redirectUri,
            scope: MICROSOFT_CONFIG.scopes,
            state: state,
            response_mode: 'query'
        };
        
        const authUrl = `${MICROSOFT_CONFIG.authUrl}?${querystring.stringify(authParams)}`;
        res.writeHead(302, { Location: authUrl });
        res.end();
    } else if (req.method === 'GET' && req.url.startsWith('/api/auth/microsoft/callback')) {
        // 处理微软OAuth回调
        handleMicrosoftCallback(req, res);
    } else if (req.method === 'POST' && req.url === '/api/auth/microsoft/logout') {
        // 注销微软账户
        microsoftAuthData = {
            authenticated: false,
            accessToken: null,
            refreshToken: null,
            userInfo: null,
            expiresAt: null
        };
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({success: true, message: '已注销微软账户'}));
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

// 处理微软OAuth回调
async function handleMicrosoftCallback(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        
        if (error) {
            const errorDesc = url.searchParams.get('error_description') || error;
            logger.log(`微软认证错误: ${error} - ${errorDesc}`, 'error');
            res.writeHead(400, {'Content-Type': 'text/html; charset=utf-8'});
            res.end(`<script>alert("认证失败: ${errorDesc}"); window.close();</script>`);
            return;
        }
        
        if (!code) {
            res.writeHead(400, {'Content-Type': 'text/html; charset=utf-8'});
            res.end('<script>window.close();</script>');
            return;
        }
        
        // 交换授权码获取访问令牌
        const tokenData = await exchangeCodeForToken(code);
        if (tokenData) {
            // 获取Minecraft令牌
            const minecraftToken = await getMinecraftToken(tokenData.access_token);
            if (minecraftToken) {
                microsoftAuthData = {
                    authenticated: true,
                    accessToken: minecraftToken.access_token,
                    refreshToken: tokenData.refresh_token,
                    userInfo: await getUserInfo(tokenData.access_token),
                    expiresAt: Date.now() + (tokenData.expires_in * 1000),
                    minecraftProfile: minecraftToken.username
                };
                
                logger.log(`微软认证成功: ${microsoftAuthData.userInfo?.preferred_username}`, 'info');
                res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
                res.end('<script>alert("登录成功！"); window.close();</script>');
            } else {
                res.writeHead(400, {'Content-Type': 'text/html; charset=utf-8'});
                res.end('<script>alert("获取Minecraft令牌失败！"); window.close();</script>');
            }
        } else {
            res.writeHead(400, {'Content-Type': 'text/html; charset=utf-8'});
            res.end('<script>alert("获取访问令牌失败！"); window.close();</script>');
        }
    } catch (error) {
        logger.log(`微软认证回调处理错误: ${error.message}`, 'error');
        res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
        res.end('<script>alert("认证过程出错！"); window.close();</script>');
    }
}

// 交换授权码获取访问令牌
async function exchangeCodeForToken(code) {
    const https = require('https');
    
    const postData = querystring.stringify({
        client_id: MICROSOFT_CONFIG.clientId,
        client_secret: MICROSOFT_CONFIG.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: MICROSOFT_CONFIG.redirectUri
    });
    
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'login.microsoftonline.com',
            path: '/consumers/oauth2/v2.0/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const tokenData = JSON.parse(data);
                    if (tokenData.access_token) {
                        resolve(tokenData);
                    } else {
                        logger.log(`令牌交换失败: ${data}`, 'error');
                        resolve(null);
                    }
                } catch (error) {
                    logger.log(`解析令牌响应失败: ${error.message}`, 'error');
                    resolve(null);
                }
            });
        });
        
        req.on('error', (error) => {
            logger.log(`令牌请求错误: ${error.message}`, 'error');
            resolve(null);
        });
        
        req.write(postData);
        req.end();
    });
}

// 获取用户信息
async function getUserInfo(accessToken) {
    const https = require('https');
    
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'graph.microsoft.com',
            path: '/v1.0/me',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    resolve(null);
                }
            });
        });
        
        req.on('error', () => resolve(null));
        req.end();
    });
}

// 获取Minecraft令牌（Xbox Live认证链）
async function getMinecraftToken(msAccessToken) {
    try {
        // 第一步：Xbox Live认证
        const xblToken = await authenticateXboxLive(msAccessToken);
        if (!xblToken) return null;
        
        // 第二步：XSTS认证
        const xstsToken = await authenticateXSTS(xblToken.Token);
        if (!xstsToken) return null;
        
        // 第三步：Minecraft认证
        const mcToken = await authenticateMinecraft(xstsToken.Token, xstsToken.DisplayClaims.xui[0].uhs);
        return mcToken;
    } catch (error) {
        logger.log(`Minecraft令牌获取失败: ${error.message}`, 'error');
        return null;
    }
}

// Xbox Live认证
async function authenticateXboxLive(accessToken) {
    const https = require('https');
    
    const postData = JSON.stringify({
        Properties: {
            AuthMethod: 'RPS',
            SiteName: 'user.auth.xboxlive.com',
            RpsTicket: `d=${accessToken}`
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT'
    });
    
    return new Promise((resolve) => {
        const options = {
            hostname: 'user.auth.xboxlive.com',
            path: '/user/authenticate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    resolve(null);
                }
            });
        });
        
        req.on('error', () => resolve(null));
        req.write(postData);
        req.end();
    });
}

// XSTS认证
async function authenticateXSTS(xblToken) {
    const https = require('https');
    
    const postData = JSON.stringify({
        Properties: {
            SandboxId: 'RETAIL',
            UserTokens: [xblToken]
        },
        RelyingParty: 'rp://api.minecraftservices.com/',
        TokenType: 'JWT'
    });
    
    return new Promise((resolve) => {
        const options = {
            hostname: 'xsts.auth.xboxlive.com',
            path: '/xsts/authorize',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    resolve(null);
                }
            });
        });
        
        req.on('error', () => resolve(null));
        req.write(postData);
        req.end();
    });
}

// Minecraft认证
async function authenticateMinecraft(xstsToken, userHash) {
    const https = require('https');
    
    const postData = JSON.stringify({
        identityToken: `XBL3.0 x=${userHash};${xstsToken}`
    });
    
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.minecraftservices.com',
            path: '/authentication/login_with_xbox',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    resolve(null);
                }
            });
        });
        
        req.on('error', () => resolve(null));
        req.write(postData);
        req.end();
    });
}

// 优雅处理未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
});
