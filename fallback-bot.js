
const mineflayer = require('mineflayer');

const bot = mineflayer.createBot({
    host: process.env.SERVER_HOST || 'localhost',
    port: parseInt(process.env.SERVER_PORT) || 25565,
    username: process.env.BOT_USERNAME || 'aterbot',
    auth: 'offline'
});

bot.on('spawn', () => {
    console.log('🤖 机器人已进入服务器');
});

bot.on('message', (message) => {
    console.log('聊天消息:', message.toString());
});

bot.on('error', (err) => {
    console.error('机器人错误:', err);
});
