
import { spawn } from 'child_process';

console.log('启动 aterbot...');

// 使用 tsx 来运行 TypeScript 文件
const child = spawn('npx', ['tsx', './node_modules/aterbot/src/index.ts'], {
  stdio: 'inherit'
});

child.on('close', (code) => {
  console.log(`aterbot 进程退出，退出码: ${code}`);
});
