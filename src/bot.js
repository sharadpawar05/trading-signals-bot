const { Telegraf, Markup } = require('telegraf');
const { generateSignal, scanAllSignals } = require('./signals');
const { registerUser, isPremium, incrementUsage, setPremium, getStats, setMinConfidence, getMinConfidence } = require('./users');
const { getMultiplePrices, getExchange } = require('./market');
const { backtestSignal, formatBacktestResult } = require('./backtest');
const { NSE_STOCKS, BSE_STOCKS, INDICES, FNO_SYMBOLS, ALIASES } = require('./india-symbols');
const { saveSignal, getSignalHistory, getAccuracyStats, getSignalStats } = require('./history');

const FREE_SIGNALS_PER_DAY = 3;
const PREMIUM_PRICE_USD = 15;
const PREMIUM_DAYS = 30;

function formatSignal(signal) {
  const emoji = signal.signal.includes('BUY') ? '🟢' : signal.signal.includes('SELL') ? '🔴' : '⚪';
  const volEmoji = signal.volatility === 'high' ? '⚡' : signal.volatility === 'low' ? '😴' : '📊';

  const isIndian = signal.exchange === 'nse' || signal.exchange === 'bse';
  const currencySymbol = isIndian ? '₹' : '$';
  const pairSuffix = isIndian ? '' : '/USDT';

  const confluenceBar = signal.confluence.bullish > signal.confluence.bearish
    ? `🟢`.repeat(signal.confluence.bullish) + `⚪`.repeat(8 - signal.confluence.bullish)
    : `🔴`.repeat(signal.confluence.bearish) + `⚪`.repeat(8 - signal.confluence.bearish);

  const patternsText = signal.patterns.length > 0
    ? `\n*Patterns:* ${signal.patterns.join(', ')}`
    : '';

  const divergencesText = signal.divergences.length > 0
    ? `\n*Divergences:* ${signal.divergences.map(d => d.type).join(', ')}`
    : '';

  const fibText = signal.fibonacci
    ? `\n*Fibonacci:*
  23.6%: ${currencySymbol}${signal.fibonacci['23.6%']?.toFixed(2)}
  38.2%: ${currencySymbol}${signal.fibonacci['38.2%']?.toFixed(2)}
  50.0%: ${currencySymbol}${signal.fibonacci['50.0%']?.toFixed(2)}
  61.8%: ${currencySymbol}${signal.fibonacci['61.8%']?.toFixed(2)}`
    : '';

  const levelsText = signal.levels
    ? `\n*Buy Zone:*
  ${currencySymbol}${signal.levels.buyZone.low} - ${currencySymbol}${signal.levels.buyZone.high}
  (${signal.levels.buyZone.lowPercent}% to ${signal.levels.buyZone.highPercent}%)

*Stop Loss:*
  ${currencySymbol}${signal.levels.stopLoss.price} (${signal.levels.stopLoss.percent}%)

*Targets:*
${signal.levels.targets.map((t, i) => `  TP${i + 1}: ${currencySymbol}${t.price} (+${t.percent}%) [${t.label}]`).join('\n')}
  Risk:Reward = 1:${signal.levels.riskReward}`
    : '';

  const orderBookText = signal.orderBook
    ? `\n*Order Book:*
  Bid/Ask Ratio: ${signal.orderBook.bidAskRatio}
  Spread: ${currencySymbol}${signal.orderBook.spread} (${signal.orderBook.spreadPercent}%)
  Bid Wall: ${currencySymbol}${signal.orderBook.bidWall.price} (${signal.orderBook.bidWall.qty})
  Ask Wall: ${currencySymbol}${signal.orderBook.askWall.price} (${signal.orderBook.askWall.qty})`
    : '';

  return `
${emoji} *${signal.symbol}${pairSuffix}* ${signal.strength} ${volEmoji}

*Signal:* ${signal.signal}
*Confidence:* ${signal.confidence}
*Score:* ${signal.score}
*Confluence:* ${signal.confluence.bullish}B / ${signal.confluence.bearish}R
${confluenceBar}

*Price:* ${currencySymbol}${signal.price.toLocaleString()}
*24h:* ${signal.change24h > 0 ? '+' : ''}${signal.change24h.toFixed(2)}% | H: ${currencySymbol}${signal.high24h.toLocaleString()} L: ${currencySymbol}${signal.low24h.toLocaleString()}

*Timeframes:*
  1H: ${signal.timeframeScores['1H']} | 4H: ${signal.timeframeScores['4H']} | 1D: ${signal.timeframeScores['1D']}

*Key Indicators:*
  RSI: ${signal.indicators['1H']?.rsi} / ${signal.indicators['4H']?.rsi}
  MACD: ${signal.indicators['4H']?.macd}
  Stoch: K=${signal.indicators['4H']?.stochK} D=${signal.indicators['4H']?.stochD}
  ADX: ${signal.indicators['4H']?.adx}
  BB: ${signal.indicators['4H']?.bbLower} - ${signal.indicators['4H']?.bbUpper}
${levelsText}
${fibText}
${orderBookText}
${patternsText}
${divergencesText}

*Analysis:*
${signal.reasons.slice(0, 10).map(r => `  • ${r}`).join('\n')}

_${signal.timestamp}_
`.trim();
}

function formatScanResults(signals) {
  let msg = `📊 *Market Scan* - ${new Date().toLocaleString()}\n\n`;

  for (const s of signals.slice(0, 10)) {
    const emoji = s.signal.includes('BUY') ? '🟢' : s.signal.includes('SELL') ? '🔴' : '⚪';
    const vol = s.volatility === 'high' ? '⚡' : s.volatility === 'low' ? '😴' : '';
    msg += `${emoji} *${s.symbol}*: ${s.signal} (${s.confidence}) | $${s.price.toLocaleString()} | ${s.change24h > 0 ? '+' : ''}${s.change24h.toFixed(2)}% ${vol}\n`;
  }

  return msg;
}

function getDailyUsage(userId) {
  const key = `usage_${userId}_${new Date().toISOString().split('T')[0]}`;
  const stored = globalThis.__usageCache || {};
  return stored[key] || 0;
}

function incrementDailyUsage(userId) {
  const key = `usage_${userId}_${new Date().toISOString().split('T')[0]}`;
  if (!globalThis.__usageCache) globalThis.__usageCache = {};
  globalThis.__usageCache[key] = (globalThis.__usageCache[key] || 0) + 1;
}

function setupBot(token) {
  const bot = new Telegraf(token);

  bot.start((ctx) => {
    const user = registerUser(
      ctx.from.id,
      ctx.from.username,
      ctx.from.first_name
    );

    const welcome = `🚀 *Welcome to Crypto Signals Bot v2!*

Advanced multi-timeframe analysis with 12+ indicators, order book data, candlestick patterns, Fibonacci levels, and confluence scoring.

*Free tier:* ${FREE_SIGNALS_PER_DAY} signals/day
*Premium:* Unlimited signals + full analysis

*Crypto Commands:*
/signal <coin> - Get signal (e.g., /signal BTC)
/scan - Scan all coins for best opportunities
/price - Quick prices for top coins
/backtest <coin> - See historical accuracy

*Indian Market Commands:*
/nse <stock> - NSE stock signal (e.g., /nse RELIANCE)
/bse <stock> - BSE stock signal (e.g., /bse TCS)
/india - NIFTY 50 + Bank Nifty overview
/indiascan - Scan top NSE stocks

*Account:*
/premium - Upgrade for unlimited access
/status - Check your usage
/activate <code> - Activate premium
/help - Show this message

*Crypto:* BTC, ETH, SOL, BNB, XRP, ADA, DOGE, DOT, AVAX, LINK
*Indian:* RELIANCE, TCS, INFY, HDFCBANK, SBIN, ITC, +20 more`;

    ctx.reply(welcome, { parse_mode: 'Markdown' });
  });

  bot.help((ctx) => {
    ctx.reply(
      `*Crypto Commands:*
/signal BTC - Full signal analysis
/scan - Best opportunities across all coins
/price - Quick price overview
/backtest BTC - Backtest results

*Indian Market Commands:*
/nse RELIANCE - NSE stock signal
/bse TCS - BSE stock signal
/india - NIFTY 50 + Bank Nifty overview
/indiascan - Scan top NSE stocks

*Tracking & Filters:*
/history - View your signal history
/accuracy - Check your win rate
/accuracy BTC - Check accuracy for specific symbol
/setconfidence 78 - Set minimum confidence filter

*Account:*
/premium - Upgrade to premium
/status - Your account info
/activate CODE - Activate premium`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('signal', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    const symbol = args[1]?.toUpperCase();

    if (!symbol) {
      return ctx.reply('Usage: /signal BTC\n\nAvailable: BTC, ETH, SOL, BNB, XRP, ADA, DOGE, DOT, AVAX, LINK');
    }

    const validSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'DOT', 'AVAX', 'LINK'];
    if (!validSymbols.includes(symbol)) {
      return ctx.reply(`Invalid symbol. Available: ${validSymbols.join(', ')}`);
    }

    if (!isPremium(userId)) {
      const used = getDailyUsage(userId);
      if (used >= FREE_SIGNALS_PER_DAY) {
        return ctx.reply(
          `⚠️ *Daily limit reached!*\n\nYou've used ${FREE_SIGNALS_PER_DAY}/${FREE_SIGNALS_PER_DAY} free signals today.\n\nUpgrade to premium for unlimited access:`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url('Upgrade Premium 💎', 'https://your-payment-link.com')],
            ]),
          }
        );
      }
    }

    try {
      await ctx.reply('⏳ Running full analysis...');
      const minConfidence = getMinConfidence(userId);
      const signal = await generateSignal(symbol, null, minConfidence);

      if (!signal) {
        return ctx.reply(`⚠️ Signal doesn't meet your minimum confidence threshold (${minConfidence}%). Use /setconfidence to adjust.`);
      }

      saveSignal(userId, signal);
      incrementDailyUsage(userId);
      incrementUsage(userId);

      const keyboard = isPremium(userId)
        ? {}
        : Markup.inlineKeyboard([
            [Markup.button.url('Get Premium 🔓', 'https://your-payment-link.com')],
          ]);

      ctx.reply(formatSignal(signal), {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } catch (error) {
      ctx.reply(`❌ Error: ${error.message}`);
    }
  });

  bot.command('scan', async (ctx) => {
    const userId = ctx.from.id;

    if (!isPremium(userId)) {
      const used = getDailyUsage(userId);
      if (used >= FREE_SIGNALS_PER_DAY) {
        return ctx.reply(
          `⚠️ *Daily limit reached!*\n\nScan is a premium feature.`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url('Upgrade Premium 💎', 'https://your-payment-link.com')],
            ]),
          }
        );
      }
    }

    try {
      await ctx.reply('🔍 Scanning all coins...');
      const signals = await scanAllSignals();
      incrementDailyUsage(userId);
      incrementUsage(userId);

      ctx.reply(formatScanResults(signals), { parse_mode: 'Markdown' });
    } catch (error) {
      ctx.reply(`❌ Error: ${error.message}`);
    }
  });

  bot.command('backtest', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const symbol = args[1]?.toUpperCase();

    if (!symbol) {
      return ctx.reply('Usage: /backtest BTC');
    }

    try {
      await ctx.reply(`⏳ Running backtest for ${symbol}...`);
      const result = await backtestSignal(symbol, '1h', 500, 6);
      ctx.reply(formatBacktestResult(result), { parse_mode: 'Markdown' });
    } catch (error) {
      ctx.reply(`❌ Error: ${error.message}`);
    }
  });

  bot.command('price', async (ctx) => {
    try {
      const prices = await getMultiplePrices();
      let msg = '💰 *Live Prices*\n\n';

      for (const [symbol, price] of Object.entries(prices)) {
        msg += `*${symbol}*: $${price.toLocaleString()}\n`;
      }

      ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (error) {
      ctx.reply(`❌ Error: ${error.message}`);
    }
  });

  bot.command('premium', (ctx) => {
    const user = ctx.from.id;
    const isUserPremium = isPremium(user);

    if (isUserPremium) {
      return ctx.reply('✅ You are already a premium member!');
    }

    ctx.reply(
      `💎 *Premium Membership*

*What you get:*
  • Unlimited signals per day
  • Full market scan (all coins)
  • Order book analysis
  • Candlestick patterns
  • Fibonacci levels
  • Divergence detection
  • Backtest results
  • Priority alerts

*Price:* $${PREMIUM_PRICE_USD}/month (30 days)

*Payment:*
Send $${PREMIUM_PRICE_USD} and reply with your transaction ID.

Or use the button below:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.url('Pay with Card 💳', 'https://your-stripe-link.com')],
          [Markup.button.callback('I paid (enter TX ID)', 'confirm_payment')],
        ]),
      }
    );
  });

  bot.action('confirm_payment', (ctx) => {
    ctx.reply(
      'Please send your transaction ID or screenshot of payment.\n\nAn admin will verify and activate your premium within 24 hours.',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('status', (ctx) => {
    const user = ctx.from.id;
    const userData = require('./users').getUser(user);
    const dailyUsed = getDailyUsage(user);
    const premium = isPremium(user);

    const msg = `📋 *Your Status*

*Account:* ${ctx.from.username || ctx.from.first_name}
*Premium:* ${premium ? '✅ Active' : '❌ Free tier'}
${premium ? `*Expires:* ${new Date(userData.premiumExpiresAt).toLocaleDateString()}` : ''}
*Signals used today:* ${dailyUsed}/${premium ? '∞' : FREE_SIGNALS_PER_DAY}
*Total signals used:* ${userData?.signalsUsed || 0}
*Member since:* ${userData ? new Date(userData.registeredAt).toLocaleDateString() : 'N/A'}`;

    ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  bot.command('activate', (ctx) => {
    const args = ctx.message.text.split(' ');
    const code = args[1];

    if (!code) {
      return ctx.reply('Usage: /activate YOUR_ACTIVATION_CODE');
    }

    const ACTIVATION_CODES = process.env.ACTIVATION_CODES?.split(',') || [];
    if (ACTIVATION_CODES.includes(code)) {
      setPremium(ctx.from.id, PREMIUM_DAYS);
      ctx.reply('✅ Premium activated! Enjoy unlimited signals.');
    } else {
      ctx.reply('❌ Invalid activation code.');
    }
  });

  bot.command('nse', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    const inputSymbol = args[1]?.toUpperCase();

    if (!inputSymbol) {
      const stockList = Object.keys(NSE_STOCKS).slice(0, 15).join(', ');
      return ctx.reply(`Usage: /nse RELIANCE\n\nPopular NSE stocks:\n${stockList}\n\nYou can also use any NSE symbol: /nse DRREDDY, /nse COALINDIA, etc.`);
    }

    const symbol = ALIASES[inputSymbol] || inputSymbol;

    // Allow any valid NSE symbol (from list or dynamic lookup)
    const isValidNSE = NSE_STOCKS[symbol] || INDICES[symbol] || (symbol.length > 0 && !symbol.includes(' '));
    if (!isValidNSE) {
      return ctx.reply(`Invalid symbol. Try: /nse RELIANCE or /nse DRREDDY`);
    }

    if (!isPremium(userId)) {
      const used = getDailyUsage(userId);
      if (used >= FREE_SIGNALS_PER_DAY) {
        return ctx.reply(
          `⚠️ *Daily limit reached!*\n\nYou've used ${FREE_SIGNALS_PER_DAY}/${FREE_SIGNALS_PER_DAY} free signals today.\n\nUpgrade to premium for unlimited access:`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url('Upgrade Premium 💎', 'https://your-payment-link.com')],
            ]),
          }
        );
      }
    }

    try {
      await ctx.reply('⏳ Analyzing NSE stock...');
      const minConfidence = getMinConfidence(userId);
      const signal = await generateSignal(symbol, 'nse', minConfidence);

      if (!signal) {
        return ctx.reply(`⚠️ Signal doesn't meet your minimum confidence threshold (${minConfidence}%). Use /setconfidence to adjust.`);
      }

      saveSignal(userId, signal);
      incrementDailyUsage(userId);
      incrementUsage(userId);

      const keyboard = isPremium(userId)
        ? {}
        : Markup.inlineKeyboard([
            [Markup.button.url('Get Premium 🔓', 'https://your-payment-link.com')],
          ]);

      ctx.reply(formatSignal(signal), {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } catch (error) {
      ctx.reply(`❌ Error: ${error.message}`);
    }
  });

  bot.command('bse', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    const inputSymbol = args[1]?.toUpperCase();

    if (!inputSymbol) {
      const stockList = Object.keys(BSE_STOCKS).slice(0, 10).join(', ');
      return ctx.reply(`Usage: /bse TCS\n\nAvailable BSE stocks:\n${stockList}`);
    }

    const symbol = ALIASES[inputSymbol] || inputSymbol;

    if (!BSE_STOCKS[symbol]) {
      return ctx.reply(`Invalid symbol. Available BSE stocks: ${Object.keys(BSE_STOCKS).slice(0, 10).join(', ')}`);
    }

    if (!isPremium(userId)) {
      const used = getDailyUsage(userId);
      if (used >= FREE_SIGNALS_PER_DAY) {
        return ctx.reply(
          `⚠️ *Daily limit reached!*\n\nYou've used ${FREE_SIGNALS_PER_DAY}/${FREE_SIGNALS_PER_DAY} free signals today.\n\nUpgrade to premium for unlimited access:`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url('Upgrade Premium 💎', 'https://your-payment-link.com')],
            ]),
          }
        );
      }
    }

    try {
      await ctx.reply('⏳ Analyzing BSE stock...');
      const minConfidence = getMinConfidence(userId);
      const signal = await generateSignal(symbol, 'bse', minConfidence);

      if (!signal) {
        return ctx.reply(`⚠️ Signal doesn't meet your minimum confidence threshold (${minConfidence}%). Use /setconfidence to adjust.`);
      }

      saveSignal(userId, signal);
      incrementDailyUsage(userId);
      incrementUsage(userId);

      const keyboard = isPremium(userId)
        ? {}
        : Markup.inlineKeyboard([
            [Markup.button.url('Get Premium 🔓', 'https://your-payment-link.com')],
          ]);

      ctx.reply(formatSignal(signal), {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } catch (error) {
      ctx.reply(`❌ Error: ${error.message}`);
    }
  });

  bot.command('india', async (ctx) => {
    try {
      await ctx.reply('⏳ Fetching Indian market data...');

      const nifty = await generateSignal('^NSEI', 'nse');
      const bankNifty = await generateSignal('^NSEBANK', 'nse');

      let msg = `🇮🇳 *Indian Market Overview*\n\n`;

      const formatMiniSignal = (s) => {
        const emoji = s.signal.includes('BUY') ? '🟢' : s.signal.includes('SELL') ? '🔴' : '⚪';
        return `${emoji} *${s.symbol}*: ${s.signal} | ₹${s.price.toLocaleString()} | ${s.change24h > 0 ? '+' : ''}${s.change24h.toFixed(2)}%`;
      };

      msg += formatMiniSignal(nifty) + '\n';
      msg += formatMiniSignal(bankNifty) + '\n\n';

      msg += `*Top NSE Stocks:*\n`;
      const topStocks = Object.keys(NSE_STOCKS).slice(0, 5);
      for (const stock of topStocks) {
        try {
          const price = await getExchange('nse').getPrice(stock);
          msg += `${stock}: ₹${price.toLocaleString()}\n`;
        } catch (e) {
          msg += `${stock}: N/A\n`;
        }
      }

      ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (error) {
      ctx.reply(`❌ Error: ${error.message}`);
    }
  });

  bot.command('indiascan', async (ctx) => {
    const userId = ctx.from.id;

    if (!isPremium(userId)) {
      const used = getDailyUsage(userId);
      if (used >= FREE_SIGNALS_PER_DAY) {
        return ctx.reply(
          `⚠️ *Daily limit reached!*\n\nIndia scan is a premium feature.`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url('Upgrade Premium 💎', 'https://your-payment-link.com')],
            ]),
          }
        );
      }
    }

    try {
      await ctx.reply('🔍 Scanning top NSE stocks...');
      const signals = await scanAllSignals('nse');
      incrementDailyUsage(userId);
      incrementUsage(userId);

      let msg = `📊 *India Market Scan* - ${new Date().toLocaleString()}\n\n`;

      for (const s of signals.slice(0, 10)) {
        const emoji = s.signal.includes('BUY') ? '🟢' : s.signal.includes('SELL') ? '🔴' : '⚪';
        msg += `${emoji} *${s.symbol}*: ${s.signal} (${s.confidence}) | ₹${s.price.toLocaleString()} | ${s.change24h > 0 ? '+' : ''}${s.change24h.toFixed(2)}%\n`;
      }

      ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (error) {
      ctx.reply(`❌ Error: ${error.message}`);
    }
  });

  bot.command('history', (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    const limit = parseInt(args[1]) || 10;

    const history = getSignalHistory(userId, limit);

    if (history.length === 0) {
      return ctx.reply('📊 No signal history yet. Start using /signal to track your trades.');
    }

    let msg = `📊 *Signal History* (Last ${limit})\n\n`;

    for (const s of history) {
      const emoji = s.signal.includes('BUY') ? '🟢' : s.signal.includes('SELL') ? '🔴' : '⚪';
      const outcome = s.outcome ? (s.outcome === 'WIN' ? '✅' : s.outcome === 'LOSS' ? '❌' : '➖') : '⏳';
      const pnl = s.pnl ? ` (${s.pnl > 0 ? '+' : ''}${s.pnl}%)` : '';
      msg += `${emoji} ${s.symbol} @ $${s.price.toLocaleString()} ${outcome}${pnl}\n`;
    }

    ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  bot.command('accuracy', (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    const symbol = args[1]?.toUpperCase();

    const stats = getAccuracyStats(userId, symbol);

    if (stats.total === 0) {
      return ctx.reply('📈 No completed signals yet. Signals are checked after 6 hours.');
    }

    let msg = `📈 *Accuracy Stats${symbol ? ` (${symbol})` : ''}*\n\n`;

    msg += `*Overall:* ${stats.winRate}% (${stats.wins}/${stats.total})\n`;
    msg += `*Average PnL:* ${stats.avgPnl > 0 ? '+' : ''}${stats.avgPnl}%\n\n`;

    if (Object.keys(stats.bySymbol).length > 1) {
      msg += `*By Symbol:*\n`;
      for (const [sym, data] of Object.entries(stats.bySymbol)) {
        const winRate = data.total > 0 ? ((data.wins / data.total) * 100).toFixed(0) : 0;
        msg += `  ${sym}: ${winRate}% (${data.wins}/${data.total})\n`;
      }
      msg += '\n';
    }

    if (Object.keys(stats.bySignal).length > 0) {
      msg += `*By Signal Type:*\n`;
      for (const [signal, data] of Object.entries(stats.bySignal)) {
        const winRate = data.total > 0 ? ((data.wins / data.total) * 100).toFixed(0) : 0;
        msg += `  ${signal}: ${winRate}% (${data.wins}/${data.total})\n`;
      }
    }

    ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  bot.command('setconfidence', (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    const level = parseInt(args[1]);

    if (!level || ![0, 55, 70, 78, 85, 92].includes(level)) {
      return ctx.reply(
        `*Usage:* /setconfidence <level>\n\n*Available levels:*\n` +
        `0 - Show all signals (default)\n` +
        `55 - Basic filtering\n` +
        `70 - Moderate confidence\n` +
        `78 - High confidence\n` +
        `85 - Very high confidence\n` +
        `92 - Maximum confidence\n\n` +
        `*Current:* ${getMinConfidence(userId)}%`,
        { parse_mode: 'Markdown' }
      );
    }

    setMinConfidence(userId, level);
    ctx.reply(`✅ Minimum confidence set to ${level}%\n\nSignals below this threshold will be filtered out.`);
  });

  return bot;
}

module.exports = { setupBot };
