function detectSwingPoints(closes, lookback = 5) {
  const swingHighs = [];
  const swingLows = [];

  for (let i = lookback; i < closes.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= lookback; j++) {
      if (closes[i] <= closes[i - j] || closes[i] <= closes[i + j]) isHigh = false;
      if (closes[i] >= closes[i - j] || closes[i] >= closes[i + j]) isLow = false;
    }

    if (isHigh) swingHighs.push({ index: i, price: closes[i] });
    if (isLow) swingLows.push({ index: i, price: closes[i] });
  }

  return { swingHighs, swingLows };
}

function analyzeMarketStructure(closes) {
  const { swingHighs, swingLows } = detectSwingPoints(closes);

  let score = 0;
  const reasons = [];
  let structure = 'Unknown';
  let trend = 'Unknown';

  if (swingHighs.length >= 2 && swingLows.length >= 2) {
    const recentHighs = swingHighs.slice(-2);
    const recentLows = swingLows.slice(-2);

    const higherHigh = recentHighs[1].price > recentHighs[0].price;
    const higherLow = recentLows[1].price > recentLows[0].price;
    const lowerHigh = recentHighs[1].price < recentHighs[0].price;
    const lowerLow = recentLows[1].price < recentLows[0].price;

    if (higherHigh && higherLow) {
      structure = 'Uptrend';
      trend = 'Bullish';
      score += 3;
      reasons.push('Higher Highs + Higher Lows (uptrend)');
    } else if (lowerHigh && lowerLow) {
      structure = 'Downtrend';
      trend = 'Bearish';
      score -= 3;
      reasons.push('Lower Highs + Lower Lows (downtrend)');
    } else if (higherHigh && lowerLow) {
      structure = 'Range Expansion';
      trend = 'Volatile';
      reasons.push('Range expansion (high volatility)');
    } else if (lowerHigh && higherLow) {
      structure = 'Symmetrical Triangle';
      trend = 'Consolidation';
      reasons.push('Symmetrical triangle (breakout imminent)');
    }

    const currentPrice = closes[closes.length - 1];
    const lastSwingHigh = swingHighs[swingHighs.length - 1];
    const lastSwingLow = swingLows[swingLows.length - 1];

    const distToHigh = ((lastSwingHigh.price - currentPrice) / currentPrice) * 100;
    const distToLow = ((currentPrice - lastSwingLow.price) / currentPrice) * 100;

    if (distToHigh < 1) {
      score -= 1;
      reasons.push(`Near swing high ($${lastSwingHigh.price.toFixed(2)})`);
    }
    if (distToLow < 1) {
      score += 1;
      reasons.push(`Near swing low ($${lastSwingLow.price.toFixed(2)})`);
    }
  }

  if (closes.length >= 50) {
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
    const currentPrice = closes[closes.length - 1];

    const sma20Prev = closes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
    const sma50Prev = closes.slice(-51, -1).reduce((a, b) => a + b, 0) / 50;

    if (sma20Prev < sma50Prev && sma20 > sma50) {
      score += 2;
      reasons.push('SMA 20/50 Golden Cross');
    } else if (sma20Prev > sma50Prev && sma20 < sma50) {
      score -= 2;
      reasons.push('SMA 20/50 Death Cross');
    }

    if (currentPrice > sma20 && sma20 > sma50) {
      score += 1;
      reasons.push('Price > SMA20 > SMA50 (strong uptrend)');
    } else if (currentPrice < sma20 && sma20 < sma50) {
      score -= 1;
      reasons.push('Price < SMA20 < SMA50 (strong downtrend)');
    }
  }

  return {
    score,
    reasons,
    structure,
    trend,
    swingHighs: swingHighs.slice(-3),
    swingLows: swingLows.slice(-3),
  };
}

module.exports = { analyzeMarketStructure, detectSwingPoints };
