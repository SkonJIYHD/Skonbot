
import { spawn } from 'child_process';

console.log('启动 Aterbot 控制面板...');

// 启动网页控制服务器
const webServer = spawn('node', ['web-server.js'], {
  stdio: 'inherit'
});

webServer.on('close', (code) => {
  console.log(`网页控制服务器退出，退出码: ${code}`);
});

console.log('Aterbot 控制面板已启动在 http://localhost:5000');
console.log('请在浏览器中打开该地址进行配置和控制');
