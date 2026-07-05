const { analyzeTimeframe } = require('./signals');
const { getKlines } = require('./market');

async function backtestSignal(symbol, period = '1h', lookbackBars = 500, holdBars = 6) {
  const klines = await getKlines(symbol, period, lookbackBars);

  if (klines.length < 100) {
    throw new Error('Not enough data for backtest');
  }

  const results = {
    totalSignals: 0,
    buySignals: 0,
    sellSignals: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    maxDrawdown: 0,
    trades: [],
  };

  let peakEquity = 1000;
  let equity = 1000;
  let maxDrawdown = 0;

  for (let i = 100; i < klines.length - holdBars; i++) {
    const window = klines.slice(i - 100, i);
    const closes = window.map(k => k.close);
    const highs = window.map(k => k.high);
    const lows = window.map(k => k.low);
    const volumes = window.map(k => k.volume);

    const analysis = analyzeTimeframe(closes, highs, lows, volumes);

    if (Math.abs(analysis.score) < 2) continue;

    const entryPrice = klines[i].close;
    const isBuy = analysis.score > 0;

    let exitPrice;
    if (isBuy) {
      exitPrice = klines[i + holdBars].close;
    } else {
      exitPrice = klines[i + holdBars].close;
    }

    const pnlPercent = isBuy
      ? ((exitPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - exitPrice) / entryPrice) * 100;

    const trade = {
      type: isBuy ? 'BUY' : 'SELL',
      entry: entryPrice,
      exit: exitPrice,
      pnl: pnlPercent,
      score: analysis.score,
      reasons: analysis.reasons.slice(0, 3),
    };

    results.trades.push(trade);
    results.totalSignals++;

    if (isBuy) results.buySignals++;
    else results.sellSignals++;

    if (pnlPercent > 0) {
      results.wins++;
      equity *= 1 + pnlPercent / 100;
    } else {
      results.losses++;
      equity *= 1 + pnlPercent / 100;
    }

    if (equity > peakEquity) peakEquity = equity;
    const drawdown = ((peakEquity - equity) / peakEquity) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  if (results.totalSignals > 0) {
    results.winRate = ((results.wins / results.totalSignals) * 100).toFixed(1);

    const winningTrades = results.trades.filter(t => t.pnl > 0);
    const losingTrades = results.trades.filter(t => t.pnl <= 0);

    results.avgWin = winningTrades.length > 0
      ? (winningTrades.reduce((s, t) => s + t.pnl, 0) / winningTrades.length).toFixed(2)
      : 0;
    results.avgLoss = losingTrades.length > 0
      ? (losingTrades.reduce((s, t) => s + t.pnl, 0) / losingTrades.length).toFixed(2)
      : 0;

    const totalWin = winningTrades.reduce((s, t) => s + t.pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((s, t) => s + t.pnl, 0));
    results.profitFactor = totalLoss > 0 ? (totalWin / totalLoss).toFixed(2) : totalWin > 0 ? '∞' : 0;
  }

  results.maxDrawdown = maxDrawdown.toFixed(2);
  results.symbol = symbol;
  results.period = period;
  results.holdBars = holdBars;
  results.dataPoints = klines.length;

  return results;
}

function formatBacktestResult(result) {
  return `
📊 *Backtest Results: ${result.symbol}*

*Period:* ${result.period} candles, hold ${result.holdBars} bars
*Data Points:* ${result.dataPoints}

*Performance:*
  Total Signals: ${result.totalSignals}
  Win Rate: ${result.winRate}%
  Profit Factor: ${result.profitFactor}
  Max Drawdown: ${result.maxDrawdown}%

*Trades:*
  Buy Signals: ${result.buySignals}
  Sell Signals: ${result.sellSignals}
  Wins: ${result.wins}
  Losses: ${result.losses}
  Avg Win: ${result.avgWin}%
  Avg Loss: ${result.avgLoss}%

*Recent Trades:*
${result.trades.slice(-5).map(t =>
  `  ${t.type === 'BUY' ? '🟢' : '🔴'} ${t.type} | Entry: $${t.entry.toFixed(2)} → Exit: $${t.exit.toFixed(2)} | PnL: ${t.pnl > 0 ? '+' : ''}${t.pnl.toFixed(2)}%`
).join('\n')}
`.trim();
}

module.exports = { backtestSignal, formatBacktestResult };
