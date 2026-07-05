require('dotenv').config();
const { setupBot } = require('./src/bot');
const { startOutcomeChecker } = require('./src/history');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set in .env');
  process.exit(1);
}

const bot = setupBot(TOKEN);

bot.launch();
console.log('🚀 Crypto Signals Bot started!');

startOutcomeChecker(60);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
