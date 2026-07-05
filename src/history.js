const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'signals.json');

function loadSignals() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading signals:', e.message);
  }
  return {};
}

function saveSignals(signals) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(signals, null, 2));
}

function generateSignalId() {
  return `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function saveSignal(userId, signal) {
  const signals = loadSignals();
  const signalId = generateSignalId();

  signals[signalId] = {
    id: signalId,
    userId,
    symbol: signal.symbol,
    exchange: signal.exchange || 'binance',
    signal: signal.signal,
    score: signal.score,
    confidence: signal.confidence,
    price: signal.price,
    timestamp: signal.timestamp || new Date().toISOString(),
    outcome: null,
    exitPrice: null,
    pnl: null,
    checkedAt: null,
  };

  saveSignals(signals);
  return signalId;
}

function getSignalHistory(userId, limit = 10) {
  const signals = loadSignals();
  const userSignals = Object.values(signals)
    .filter(s => s.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
  return userSignals;
}

function getSignalById(signalId) {
  const signals = loadSignals();
  return signals[signalId] || null;
}

function updateSignalOutcome(signalId, outcome) {
  const signals = loadSignals();
  if (!signals[signalId]) return null;

  signals[signalId].outcome = outcome.outcome;
  signals[signalId].exitPrice = outcome.exitPrice;
  signals[signalId].pnl = outcome.pnl;
  signals[signalId].checkedAt = outcome.checkedAt || new Date().toISOString();

  saveSignals(signals);
  return signals[signalId];
}

function getPendingSignals(olderThanHours = 6) {
  const signals = loadSignals();
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

  return Object.values(signals).filter(s => {
    if (s.outcome !== null) return false;
    const signalTime = new Date(s.timestamp);
    return signalTime < cutoff;
  });
}

function getAccuracyStats(userId = null, symbol = null) {
  const signals = loadSignals();
  let allSignals = Object.values(signals).filter(s => s.outcome !== null);

  if (userId) {
    allSignals = allSignals.filter(s => s.userId === userId);
  }
  if (symbol) {
    allSignals = allSignals.filter(s => s.symbol.toUpperCase() === symbol.toUpperCase());
  }

  const total = allSignals.length;
  if (total === 0) {
    return {
      total: 0,
      wins: 0,
      losses: 0,
      winRate: '0',
      avgPnl: '0',
      bySymbol: {},
      bySignal: {},
    };
  }

  const wins = allSignals.filter(s => s.outcome === 'WIN').length;
  const losses = allSignals.filter(s => s.outcome === 'LOSS').length;
  const winRate = ((wins / total) * 100).toFixed(1);

  const totalPnl = allSignals.reduce((sum, s) => sum + (parseFloat(s.pnl) || 0), 0);
  const avgPnl = (totalPnl / total).toFixed(2);

  const bySymbol = {};
  for (const s of allSignals) {
    if (!bySymbol[s.symbol]) {
      bySymbol[s.symbol] = { total: 0, wins: 0, losses: 0 };
    }
    bySymbol[s.symbol].total++;
    if (s.outcome === 'WIN') bySymbol[s.symbol].wins++;
    if (s.outcome === 'LOSS') bySymbol[s.symbol].losses++;
  }

  const bySignal = {};
  for (const s of allSignals) {
    if (!bySignal[s.signal]) {
      bySignal[s.signal] = { total: 0, wins: 0, losses: 0 };
    }
    bySignal[s.signal].total++;
    if (s.outcome === 'WIN') bySignal[s.signal].wins++;
    if (s.outcome === 'LOSS') bySignal[s.signal].losses++;
  }

  return {
    total,
    wins,
    losses,
    winRate,
    avgPnl,
    bySymbol,
    bySignal,
  };
}

function getSignalStats() {
  const signals = loadSignals();
  const all = Object.values(signals);
  const pending = all.filter(s => s.outcome === null).length;
  const completed = all.filter(s => s.outcome !== null).length;

  return {
    total: all.length,
    pending,
    completed,
  };
}

async function checkPendingOutcomes() {
  const { getPrice } = require('./market');
  const pending = getPendingSignals(6);

  let checked = 0;
  let wins = 0;
  let losses = 0;

  for (const signal of pending) {
    try {
      const currentPrice = await getPrice(signal.symbol, signal.exchange);
      const isBuy = signal.signal.includes('BUY');
      const pnl = isBuy
        ? ((currentPrice - signal.price) / signal.price) * 100
        : ((signal.price - currentPrice) / signal.price) * 100;

      const outcome = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'NEUTRAL';

      updateSignalOutcome(signal.id, {
        outcome,
        exitPrice: currentPrice,
        pnl: pnl.toFixed(2),
        checkedAt: new Date().toISOString(),
      });

      checked++;
      if (outcome === 'WIN') wins++;
      if (outcome === 'LOSS') losses++;

      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`Error checking outcome for ${signal.symbol}:`, e.message);
    }
  }

  return { checked, wins, losses };
}

function startOutcomeChecker(intervalMinutes = 60) {
  setInterval(async () => {
    console.log('Checking pending signal outcomes...');
    try {
      const result = await checkPendingOutcomes();
      if (result.checked > 0) {
        console.log(`Checked ${result.checked} signals: ${result.wins} wins, ${result.losses} losses`);
      }
    } catch (e) {
      console.error('Error in outcome checker:', e.message);
    }
  }, intervalMinutes * 60 * 1000);
}

module.exports = {
  saveSignal,
  getSignalHistory,
  getSignalById,
  updateSignalOutcome,
  getPendingSignals,
  getAccuracyStats,
  getSignalStats,
  checkPendingOutcomes,
  startOutcomeChecker,
};
