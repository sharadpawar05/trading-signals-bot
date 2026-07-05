const { RSI, MACD } = require('technicalindicators');

function findSwingPoints(closes, window = 5) {
  const highs = [];
  const lows = [];

  for (let i = window; i < closes.length - window; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= window; j++) {
      if (closes[i] <= closes[i - j] || closes[i] <= closes[i + j]) isHigh = false;
      if (closes[i] >= closes[i - j] || closes[i] >= closes[i + j]) isLow = false;
    }

    if (isHigh) highs.push({ index: i, value: closes[i] });
    if (isLow) lows.push({ index: i, value: closes[i] });
  }

  return { highs, lows };
}

function detectDivergence(closes, indicatorValues, type = 'bullish') {
  const { highs, lows } = findSwingPoints(closes);

  if (type === 'bullish') {
    if (lows.length < 2) return null;

    const recentLows = lows.slice(-2);
    const price1 = recentLows[0].value;
    const price2 = recentLows[1].value;
    const ind1 = indicatorValues[recentLows[0].index];
    const ind2 = indicatorValues[recentLows[1].index];

    if (ind1 === undefined || ind2 === undefined) return null;

    if (price2 < price1 && ind2 > ind1) {
      return {
        type: 'Bullish Divergence',
        priceLow1: price1,
        priceLow2: price2,
        indVal1: ind1,
        indVal2: ind2,
        strength: Math.abs((ind2 - ind1) / ind1) * 100,
      };
    }
  } else {
    if (highs.length < 2) return null;

    const recentHighs = highs.slice(-2);
    const price1 = recentHighs[0].value;
    const price2 = recentHighs[1].value;
    const ind1 = indicatorValues[recentHighs[0].index];
    const ind2 = indicatorValues[recentHighs[1].index];

    if (ind1 === undefined || ind2 === undefined) return null;

    if (price2 > price1 && ind2 < ind1) {
      return {
        type: 'Bearish Divergence',
        priceHigh1: price1,
        priceHigh2: price2,
        indVal1: ind1,
        indVal2: ind2,
        strength: Math.abs((ind2 - ind1) / ind1) * 100,
      };
    }
  }

  return null;
}

function detectAllDivergences(closes) {
  let score = 0;
  const reasons = [];
  const divergences = [];

  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const macdResult = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const macdValues = macdResult.map(m => m.MACD);

  const paddedRsi = new Array(closes.length - rsiValues.length).fill(null).concat(rsiValues);
  const paddedMacd = new Array(closes.length - macdValues.length).fill(null).concat(macdValues);

  const rsiBullDiv = detectDivergence(closes, paddedRsi, 'bullish');
  const rsiBearDiv = detectDivergence(closes, paddedRsi, 'bearish');
  const macdBullDiv = detectDivergence(closes, paddedMacd, 'bullish');
  const macdBearDiv = detectDivergence(closes, paddedMacd, 'bearish');

  if (rsiBullDiv) {
    score += 3;
    divergences.push(rsiBullDiv);
    reasons.push(`RSI Bullish Divergence (strength: ${rsiBullDiv.strength.toFixed(1)}%)`);
  }

  if (rsiBearDiv) {
    score -= 3;
    divergences.push(rsiBearDiv);
    reasons.push(`RSI Bearish Divergence (strength: ${rsiBearDiv.strength.toFixed(1)}%)`);
  }

  if (macdBullDiv) {
    score += 2;
    divergences.push(macdBullDiv);
    reasons.push('MACD Bullish Divergence');
  }

  if (macdBearDiv) {
    score -= 2;
    divergences.push(macdBearDiv);
    reasons.push('MACD Bearish Divergence');
  }

  return { score, reasons, divergences };
}

module.exports = { detectAllDivergences, detectDivergence, findSwingPoints };
