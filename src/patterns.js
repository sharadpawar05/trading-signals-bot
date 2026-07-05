function detectCandlestickPatterns(klines) {
  if (klines.length < 5) return { score: 0, reasons: [], patterns: [] };

  const patterns = [];
  let score = 0;
  const reasons = [];

  const curr = klines[klines.length - 1];
  const prev = klines[klines.length - 2];
  const prev2 = klines[klines.length - 3];

  const currBody = Math.abs(curr.close - curr.open);
  const currRange = curr.high - curr.low;
  const currUpperWick = curr.high - Math.max(curr.open, curr.close);
  const currLowerWick = Math.min(curr.open, curr.close) - curr.low;
  const currIsBullish = curr.close > curr.open;

  const prevBody = Math.abs(prev.close - prev.open);
  const prevRange = prev.high - prev.low;
  const prevIsBullish = prev.close > prev.open;

  // Hammer / Inverted Hammer
  if (currLowerWick > currBody * 2 && currUpperWick < currBody * 0.5 && currBody > 0) {
    if (currIsBullish) {
      score += 2;
      patterns.push('Hammer');
      reasons.push('Hammer pattern (bullish reversal)');
    } else {
      score += 1;
      patterns.push('Hanging Man');
      reasons.push('Hanging Man pattern (watch for reversal)');
    }
  }

  if (currUpperWick > currBody * 2 && currLowerWick < currBody * 0.5 && currBody > 0) {
    if (!currIsBullish) {
      score -= 2;
      patterns.push('Shooting Star');
      reasons.push('Shooting Star pattern (bearish reversal)');
    } else {
      score -= 1;
      patterns.push('Inverted Hammer');
      reasons.push('Inverted Hammer pattern (watch for reversal)');
    }
  }

  // Doji
  if (currBody < currRange * 0.05 && currRange > 0) {
    if (prevIsBullish && !currIsBullish) {
      score -= 1;
      patterns.push('Doji');
      reasons.push('Doji at top (indecision/bearish)');
    } else if (!prevIsBullish && currIsBullish) {
      score += 1;
      patterns.push('Doji');
      reasons.push('Doji at bottom (indecision/bullish)');
    }
  }

  // Engulfing
  if (currBody > prevBody * 1.5 && currRange > prevRange) {
    if (!prevIsBullish && currIsBullish) {
      score += 3;
      patterns.push('Bullish Engulfing');
      reasons.push('Bullish Engulfing (strong reversal)');
    } else if (prevIsBullish && !currIsBullish) {
      score -= 3;
      patterns.push('Bearish Engulfing');
      reasons.push('Bearish Engulfing (strong reversal)');
    }
  }

  // Morning/Evening Star (3-candle patterns)
  if (klines.length >= 3) {
    const prev2Body = Math.abs(prev2.close - prev2.open);
    const prev2IsBullish = prev2.close > prev2.open;

    const smallBody = Math.min(prevBody, currBody);
    const largeBody = prev2Body;

    if (!prev2IsBullish && prevBody < prev2Body * 0.3 && currIsBullish && currBody > prev2Body * 0.5) {
      score += 3;
      patterns.push('Morning Star');
      reasons.push('Morning Star (strong bullish reversal)');
    }

    if (prev2IsBullish && prevBody < prev2Body * 0.3 && !currIsBullish && currBody > prev2Body * 0.5) {
      score -= 3;
      patterns.push('Evening Star');
      reasons.push('Evening Star (strong bearish reversal)');
    }
  }

  // Three White Soldiers / Three Black Crows
  if (klines.length >= 3) {
    const last3 = klines.slice(-3);
    const allBullish = last3.every(k => k.close > k.open);
    const allBearish = last3.every(k => k.close < k.open);
    const rising = last3[2].close > last3[1].close && last3[1].close > last3[0].close;
    const falling = last3[2].close < last3[1].close && last3[1].close < last3[0].close;

    if (allBullish && rising) {
      score += 2;
      patterns.push('Three White Soldiers');
      reasons.push('Three White Soldiers (strong uptrend)');
    }

    if (allBearish && falling) {
      score -= 2;
      patterns.push('Three Black Crows');
      reasons.push('Three Black Crows (strong downtrend)');
    }
  }

  // Tweezer Top/Bottom
  if (Math.abs(curr.high - prev.high) < currRange * 0.05 && Math.abs(curr.low - prev.low) > currRange * 0.3) {
    if (prevIsBullish && !currIsBullish) {
      score -= 2;
      patterns.push('Tweezer Top');
      reasons.push('Tweezer Top (resistance)');
    } else if (!prevIsBullish && currIsBullish) {
      score += 2;
      patterns.push('Tweezer Bottom');
      reasons.push('Tweezer Bottom (support)');
    }
  }

  // Harami
  if (currBody < prevBody * 0.5 && currBody > 0) {
    if (prevIsBullish && !currIsBullish && curr.close > prev.open && curr.open < prev.close) {
      score -= 1;
      patterns.push('Bearish Harami');
      reasons.push('Bearish Harami (weak reversal)');
    } else if (!prevIsBullish && currIsBullish && curr.close < prev.open && curr.open > prev.close) {
      score += 1;
      patterns.push('Bullish Harami');
      reasons.push('Bullish Harami (weak reversal)');
    }
  }

  // Piercing Line / Dark Cloud Cover
  if (prevRange > 0 && currRange > 0) {
    const prevMidpoint = (prev.open + prev.close) / 2;

    if (!prevIsBullish && currIsBullish && curr.open < prev.low && curr.close > prevMidpoint && curr.close < prev.open) {
      score += 2;
      patterns.push('Piercing Line');
      reasons.push('Piercing Line (bullish reversal)');
    }

    if (prevIsBullish && !currIsBullish && curr.open > prev.high && curr.close < prevMidpoint && curr.close > prev.open) {
      score -= 2;
      patterns.push('Dark Cloud Cover');
      reasons.push('Dark Cloud Cover (bearish reversal)');
    }
  }

  // Volume confirmation
  if (klines.length > 20) {
    const avgVol = klines.slice(-20).reduce((s, k) => s + k.volume, 0) / 20;
    if (curr.volume > avgVol * 2 && patterns.length > 0) {
      score = score > 0 ? score + 1 : score - 1;
      reasons.push(`Pattern confirmed with volume (${(curr.volume / avgVol).toFixed(1)}x avg)`);
    }
  }

  return { score, reasons, patterns };
}

module.exports = { detectCandlestickPatterns };
