const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 简单的WebSocket替代方案 - 使用Server-Sent Events
const clients = new Set();

function broadcastMessage(message) {
    console.log('🔥 broadcastMessage被调用，参数:', message);
    
    if (clients.size === 0) {
        console.log('📡 没有连接的客户端，跳过消息广播');
        return;
    }

    // 确保消息格式完整
    const messageData = {
        type: message.type || 'chat',
        message: message.message || '',
        timestamp: message.timestamp || new Date().toISOString()
    };

    console.log('🔧 处理后的消息数据:', messageData);

    // 验证消息内容不为空
    if (!messageData.message || messageData.message.trim() === '') {
        console.log('⚠️ 消息内容为空，跳过广播，原始message:', message);
        return;
    }

    const data = `data: ${JSON.stringify(messageData)}\n\n`;
    console.log(`📡 向 ${clients.size} 个客户端广播消息 [${messageData.type}]:`, messageData.message);
    console.log('📦 发送的完整SSE数据:', data.trim());

    const toRemove = [];
    let successCount = 0;
    clients.forEach(client => {
        try {
            if (client.writable && !client.destroyed) {
                client.write(data);
                successCount++;
                console.log(`✅ 消息发送到客户端成功 (${successCount}/${clients.size})`);
            } else {
                console.log('⚠️ 客户端连接已断开，标记移除');
                toRemove.push(client);
            }
        } catch (error) {
            console.error('❌ 向客户端发送消息失败:', error);
            toRemove.push(client);
        }
    });

    // 清理无效连接
    toRemove.forEach(client => {
        clients.delete(client);
        console.log('🧹 已移除无效客户端连接');
    });
}

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
                const output = data.toString().trim();
                console.log(`Bot输出: ${output}`);
                
                // 检查CHAT_MESSAGE的所有可能格式 - 强制优先处理
                if (output.includes('CHAT_MESSAGE:')) {
                    console.log('🚨 发现CHAT_MESSAGE输出，立即处理！');
                    console.log('🔍 输出详细分析:');
                    console.log('  - 原始长度:', output.length);
                    console.log('  - 完整输出:', JSON.stringify(output));
                    console.log('  - startsWith检测结果:', output.startsWith('CHAT_MESSAGE:'));
                    console.log('  - 是否包含前缀:', output.includes('CHAT_MESSAGE:'));
                    
                    // 强制提取CHAT_MESSAGE内容，不管格式如何
                    const chatIndex = output.indexOf('CHAT_MESSAGE:');
                    console.log('  - CHAT_MESSAGE:索引位置:', chatIndex);
                    
                    if (chatIndex >= 0) {
                        const chatMessage = output.substring(chatIndex + 'CHAT_MESSAGE:'.length).trim();
                        console.log('🎯 强制提取聊天消息内容:', `"${chatMessage}"`);
                        console.log('  - 提取消息长度:', chatMessage.length);
                        console.log('  - 消息是否为空:', chatMessage === '');
                        
                        if (chatMessage && chatMessage.length > 0) {
                            console.log('✅ 聊天消息有效，开始处理和广播');
                            logger.log(`💬 聊天消息: ${chatMessage}`, 'chat');

                            const messageData = {
                                type: 'chat',
                                message: chatMessage,
                                timestamp: new Date().toISOString()
                            };

                            console.log('📡 准备广播强制提取的聊天消息:', messageData);
                            broadcastMessage(messageData);
                            console.log('✅ 强制提取的聊天消息已通过SSE广播完成');
                        } else {
                            console.log('⚠️ 强制提取的消息为空，跳过广播');
                        }
                        return; // 处理完成后返回，阻止进入下面的其他处理逻辑
                    } else {
                        console.log('❌ 未找到CHAT_MESSAGE:前缀位置');
                    }
                }

                // 优先处理标准消息前缀（如果上面的强制提取没有处理的话）
                if (output.startsWith('CHAT_MESSAGE:')) {
                    const chatMessage = output.substring(13).trim();
                    console.log('🎯 检测到标准CHAT_MESSAGE前缀，消息内容:', chatMessage);

                    if (chatMessage && chatMessage.length > 0) {
                        console.log('✅ 标准格式聊天消息有效，开始处理和广播');
                        logger.log(`💬 聊天消息: ${chatMessage}`, 'chat');

                        const messageData = {
                            type: 'chat',
                            message: chatMessage,
                            timestamp: new Date().toISOString()
                        };

                        console.log('📡 准备广播标准格式聊天消息数据:', messageData);
                        
                        // 立即广播聊天消息
                        broadcastMessage(messageData);
                        console.log('✅ 标准格式聊天消息已通过SSE广播完成');
                    } else {
                        console.log('⚠️ 标准格式聊天消息为空，跳过广播');
                    }
                    return; // 重要：处理完成后立即返回，避免重复处理
                } else if (output.startsWith('SYSTEM_MESSAGE:')) {
                    const systemMessage = output.substring(15).trim();
                    console.log('🎯 检测到SYSTEM_MESSAGE前缀，消息内容:', systemMessage);

                    if (systemMessage && systemMessage.length > 0) {
                        logger.log(`🔧 系统消息: ${systemMessage}`, 'system');

                        const messageData = {
                            type: 'system',
                            message: systemMessage,
                            timestamp: new Date().toISOString()
                        };

                        broadcastMessage(messageData);
                    } else {
                        console.log('⚠️ 系统消息为空，跳过广播');
                    }
                    return; // 处理完成后立即返回
                    
                } else if (output.startsWith('SERVER_MESSAGE:')) {
                    const serverMessage = output.substring(15).trim();
                    console.log('🎯 检测到SERVER_MESSAGE前缀，消息内容:', serverMessage);

                    if (serverMessage && serverMessage.length > 0) {
                        logger.log(`📋 服务器反馈: ${serverMessage}`, 'server');

                        const messageData = {
                            type: 'server',
                            message: serverMessage,
                            timestamp: new Date().toISOString()
                        };

                        broadcastMessage(messageData);
                    } else {
                        console.log('⚠️ 服务器消息为空，跳过广播');
                    }
                    return; // 处理完成后立即返回
                } else if (output.startsWith('GAME_MESSAGE:')) {
                    const gameMessage = output.substring(13).trim();
                    console.log('🎯 检测到GAME_MESSAGE前缀，消息内容:', gameMessage);

                    if (gameMessage && gameMessage.length > 0) {
                        logger.log(`🎮 游戏信息: ${gameMessage}`, 'game');

                        const messageData = {
                            type: 'game',
                            message: gameMessage,
                            timestamp: new Date().toISOString()
                        };

                        broadcastMessage(messageData);
                    } else {
                        console.log('⚠️ 游戏消息为空，跳过广播');
                    }
                    return; // 处理完成后立即返回
                    
                } else if (output.startsWith('ACTIONBAR_MESSAGE:')) {
                    const actionBarMessage = output.substring(18).trim();
                    console.log('🎯 检测到ACTIONBAR_MESSAGE前缀，消息内容:', actionBarMessage);

                    if (actionBarMessage && actionBarMessage.length > 0) {
                        logger.log(`📊 操作栏: ${actionBarMessage}`, 'actionbar');

                        const messageData = {
                            type: 'actionbar',
                            message: actionBarMessage,
                            timestamp: new Date().toISOString()
                        };

                        broadcastMessage(messageData);
                    }
                    return; // 处理完成后立即返回
                    
                } else if (output.startsWith('TITLE_MESSAGE:')) {
                    const titleMessage = output.substring(14).trim();
                    console.log('🎯 检测到TITLE_MESSAGE前缀，消息内容:', titleMessage);

                    if (titleMessage && titleMessage.length > 0) {
                        logger.log(`📺 标题: ${titleMessage}`, 'title');

                        const messageData = {
                            type: 'title',
                            message: titleMessage,
                            timestamp: new Date().toISOString()
                        };

                        broadcastMessage(messageData);
                    }
                    return; // 处理完成后立即返回
                    
                } else if (output.startsWith('PACKET_MESSAGE:')) {
                    const packetMessage = output.substring(15).trim();
                    console.log('🎯 检测到PACKET_MESSAGE前缀，消息内容:', packetMessage);

                    if (packetMessage && packetMessage.length > 0) {
                        logger.log(`📦 数据包消息: ${packetMessage}`, 'packet');

                        const messageData = {
                            type: 'packet',
                            message: packetMessage,
                            timestamp: new Date().toISOString()
                        };

                        broadcastMessage(messageData);
                    }
                    return; // 处理完成后立即返回
                }

                // 也检查其他可能的系统消息
                if (output.includes('机器人已成功进入服务器')) {
                    broadcastMessage({
                        type: 'system',
                        message: '🎉 机器人已成功连接到服务器！',
                        timestamp: new Date().toISOString()
                    });
                }

                if (output.includes('机器人被踢出')) {
                    broadcastMessage({
                        type: 'system',
                        message: '⚠️ 机器人被服务器踢出',
                        timestamp: new Date().toISOString()
                    });
                }
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

    } else if (req.method === 'GET' && req.url === '/api/events') {
        // Server-Sent Events端点，用于实时推送服务器消息
        // 减少连接日志输出
        if (clients.size === 0) {
            console.log('🔗 新的SSE连接建立');
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
            'X-Accel-Buffering': 'no' // 禁用nginx缓冲
        });

        clients.add(res);

        // 减少日志输出 - 只在连接数变化较大时输出
        if (clients.size % 5 === 1 || clients.size <= 3) {
            console.log(`📊 当前SSE连接数: ${clients.size}`);
        }

        // 发送连接确认
        const welcomeMsg = JSON.stringify({
            type: "connected",
            message: "已连接到消息流，开始监控服务器消息",
            timestamp: new Date().toISOString()
        });

        try {
            res.write(`data: ${welcomeMsg}\n\n`);
            // 只在第一个连接时显示确认日志
            if (clients.size === 1) {
                console.log('✅ 发送SSE连接确认消息');
            }
        } catch (error) {
            console.error('❌ 发送SSE连接确认失败:', error);
            clients.delete(res);
        }

        // 设置keepalive心跳，避免连接超时
        const heartbeat = setInterval(() => {
            if (res.writable && !res.destroyed) {
                try {
                    res.write(`data: ${JSON.stringify({type: "heartbeat", timestamp: new Date().toISOString()})}\n\n`);
                } catch (error) {
                    clearInterval(heartbeat);
                    clients.delete(res);
                }
            } else {
                clearInterval(heartbeat);
                clients.delete(res);
            }
        }, 30000); // 30秒心跳

        req.on('close', () => {
            clearInterval(heartbeat);
            clients.delete(res);
            // 减少断开连接的日志输出
            if (clients.size % 5 === 0 || clients.size <= 2) {
                console.log(`🔌 SSE连接断开，当前连接数: ${clients.size}`);
            }
        });

        req.on('error', (error) => {
            clearInterval(heartbeat);
            clients.delete(res);
            // 减少错误日志频率
            if (Math.random() < 0.1) { // 只有10%的错误会被记录
                console.error('❌ SSE连接错误:', error.code || error.message);
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

// 防止端口冲突和重复启动
function startServer(port = 5000) {
    // 强制防止重复启动
    if (server.listening || global.serverInstance) {
        console.log('服务器已经在运行中，跳过重复启动');
        return;
    }

    global.serverInstance = server;

    server.listen(port, '0.0.0.0', () => {
        console.log(`Aterbot控制面板启动在 http://0.0.0.0:${port}`);
        console.log('请访问: https://你的repl域名 或者在Replit中点击Webview');
        loadConfig();
    });

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE' && port < 5005) {
            console.log(`端口 ${port} 被占用，尝试端口 ${port + 1}...`);
            // 重置全局标记，允许下一个端口尝试
            global.serverInstance = null;
            setTimeout(() => {
                startServer(port + 1);
            }, 200);
        } else {
            console.error('服务器启动失败:', error);
            global.serverInstance = null;
            process.exit(1);
        }
    });
}

// 严格防止重复调用
if (!global.serverStarted && !global.serverInstance) {
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