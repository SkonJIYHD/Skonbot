
import { spawn } from 'child_process';

console.log('启动 Aterbot 控制面板...');

// 检查是否已经有进程在运行
if (global.webServerProcess) {
    console.log('Web服务器已经在运行中');
    process.exit(0);
}

// 启动网页控制服务器
const webServer = spawn('node', ['web-server.js'], {
  stdio: 'inherit'
});

global.webServerProcess = webServer;

webServer.on('close', (code) => {
  console.log(`网页控制服务器退出，退出码: ${code}`);
  global.webServerProcess = null;
});

webServer.on('error', (error) => {
  console.error('Web服务器启动失败:', error);
  global.webServerProcess = null;
});

console.log('Aterbot 控制面板正在启动...');
console.log('请在浏览器中打开Webview进行配置和控制');
