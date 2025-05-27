import { createServer } from 'http';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('启动 Aterbot 控制面板...');

// 确保配置文件存在
const configPath = './config-java.json';
if (!existsSync(configPath)) {
    const defaultConfig = {
        client: {
            host: 'localhost',
            port: '25565',
            username: 'BotSkon',
            version: '1.21.1',
            auth: 'offline',
            mode: 'java',
            mods: [],
            adaptiveMods: false,
            skinMode: 'default'
        }
    };
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log('创建默认配置文件');
}

// 启动Web服务器
import('./web-server.js').then(module => {
    console.log('Aterbot 控制面板正在启动...');
    console.log('请在浏览器中打开Webview进行配置和控制');
}).catch(error => {
    console.error('启动失败:', error);
});