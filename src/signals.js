const { RSI, MACD, SMA, EMA, BollingerBands, Stochastic, ATR, ADX } = require('technicalindicators');
const { getKlines, get24hStats, getOrderBook, getVolatility, PAIRS, getExchange, detectExchange } = require('./market');
const { detectCandlestickPatterns } = require('./patterns');
const { detectAllDivergences } = require('./divergence');
const { analyzeFibonacci } = require('./fibonacci');
const { analyzeMarketStructure } = require('./structure');
const { analyzeVolumeProfile } = require('./volumeprofile');
const { analyzeOrderBook } = require('./orderbook');
const { calculateLevels } = require('./levels');
const { NSE_STOCKS, BSE_STOCKS, INDICES } = require('./india-symbols');

function calculateAllIndicators(closes, highs, lows, volumes) {
  const rsi = RSI.calculate({ values: closes, period: 14 });

  const macd = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  const sma20 = SMA.calculate({ values: closes, period: 20 });
  const sma50 = SMA.calculate({ values: closes, period: 50 });
  const sma200 = SMA.calculate({ values: closes, period: 200 });
  const ema9 = EMA.calculate({ values: closes, period: 9 });
  const ema21 = EMA.calculate({ values: closes, period: 21 });
  const ema50 = EMA.calculate({ values: closes, period: 50 });

  const bb = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });

  const stoch = Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14,
    signalPeriod: 3,
  });

  const atr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });

  const adx = ADX.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14,
  });

  return { rsi, macd, sma20, sma50, sma200, ema9, ema21, ema50, bb, stoch, atr, adx };
}

function analyzeTimeframe(closes, highs, lows, volumes) {
  const indicators = calculateAllIndicators(closes, highs, lows, volumes);
  const { rsi, macd, sma20, sma50, sma200, ema9, ema21, ema50, bb, stoch, atr, adx } = indicators;

  const currentPrice = closes[closes.length - 1];
  const currentRSI = rsi[rsi.length - 1];
  const currentMACD = macd[macd.length - 1];
  const prevMACD = macd[macd.length - 2];
  const currentSMA20 = sma20[sma20.length - 1];
  const currentSMA50 = sma50[sma50.length - 1];
  const currentSMA200 = sma200[sma200.length - 1];
  const currentEMA9 = ema9[ema9.length - 1];
  const currentEMA21 = ema21[ema21.length - 1];
  const currentEMA50 = ema50[ema50.length - 1];
  const currentBB = bb[bb.length - 1];
  const currentStoch = stoch[stoch.length - 1];
  const currentATR = atr[atr.length - 1];
  const currentADX = adx[adx.length - 1];

  let score = 0;
  const reasons = [];

  // 1. RSI (weight: 2)
  if (currentRSI < 20) { score += 4; reasons.push(`RSI extremely oversold (${currentRSI.toFixed(1)})`); }
  else if (currentRSI < 30) { score += 2.5; reasons.push(`RSI oversold (${currentRSI.toFixed(1)})`); }
  else if (currentRSI < 40) { score += 1; reasons.push(`RSI low (${currentRSI.toFixed(1)})`); }
  else if (currentRSI > 80) { score -= 4; reasons.push(`RSI extremely overbought (${currentRSI.toFixed(1)})`); }
  else if (currentRSI > 70) { score -= 2.5; reasons.push(`RSI overbought (${currentRSI.toFixed(1)})`); }
  else if (currentRSI > 60) { score -= 1; reasons.push(`RSI high (${currentRSI.toFixed(1)})`); }

  // 2. MACD (weight: 2.5)
  if (currentMACD && prevMACD) {
    const macdCrossUp = prevMACD.MACD < prevMACD.signal && currentMACD.MACD > currentMACD.signal;
    const macdCrossDown = prevMACD.MACD > prevMACD.signal && currentMACD.MACD < currentMACD.signal;

    if (macdCrossUp) { score += 3.5; reasons.push('MACD bullish crossover'); }
    else if (macdCrossDown) { score -= 3.5; reasons.push('MACD bearish crossover'); }

    const histIncreasing = currentMACD.histogram > prevMACD.histogram;
    if (currentMACD.histogram > 0 && histIncreasing) {
      score += 1.5;
      reasons.push('MACD histogram expanding bullish');
    } else if (currentMACD.histogram < 0 && !histIncreasing) {
      score -= 1.5;
      reasons.push('MACD histogram expanding bearish');
    }
  }

  // 3. Bollinger Bands (weight: 2.5)
  if (currentBB) {
    const bbWidth = (currentBB.upper - currentBB.lower) / currentBB.middle;
    const bbPosition = (currentPrice - currentBB.lower) / (currentBB.upper - currentBB.lower);

    if (currentPrice <= currentBB.lower) {
      score += 3;
      reasons.push('Price at lower Bollinger Band');
    } else if (currentPrice < currentBB.lower + (currentBB.middle - currentBB.lower) * 0.3) {
      score += 2;
      reasons.push('Price near lower Bollinger Band');
    } else if (currentPrice >= currentBB.upper) {
      score -= 3;
      reasons.push('Price at upper Bollinger Band');
    } else if (currentPrice > currentBB.upper - (currentBB.upper - currentBB.middle) * 0.3) {
      score -= 2;
      reasons.push('Price near upper Bollinger Band');
    }

    if (bbWidth < 0.02) {
      score = score > 0 ? score + 1 : score - 1;
      reasons.push('Bollinger squeeze (breakout imminent)');
    }

    if (bbPosition !== undefined) {
      if (bbPosition < 0.2) score += 1;
      else if (bbPosition > 0.8) score -= 1;
    }
  }

  // 4. Stochastic (weight: 2)
  if (currentStoch) {
    if (currentStoch.k < 15 && currentStoch.d < 15) {
      score += 2.5;
      reasons.push(`Stochastic deeply oversold (K:${currentStoch.k.toFixed(1)})`);
    } else if (currentStoch.k < 25) {
      score += 1.5;
      reasons.push(`Stochastic oversold (K:${currentStoch.k.toFixed(1)})`);
    } else if (currentStoch.k > 85 && currentStoch.d > 85) {
      score -= 2.5;
      reasons.push(`Stochastic deeply overbought (K:${currentStoch.k.toFixed(1)})`);
    } else if (currentStoch.k > 75) {
      score -= 1.5;
      reasons.push(`Stochastic overbought (K:${currentStoch.k.toFixed(1)})`);
    }

    const prevStoch = stoch[stoch.length - 2];
    if (prevStoch && prevStoch.k < prevStoch.d && currentStoch.k > currentStoch.d && currentStoch.k < 30) {
      score += 2;
      reasons.push('Stochastic bullish crossover in oversold');
    } else if (prevStoch && prevStoch.k > prevStoch.d && currentStoch.k < currentStoch.d && currentStoch.k > 70) {
      score -= 2;
      reasons.push('Stochastic bearish crossover in overbought');
    }
  }

  // 5. Moving Averages (weight: 2)
  const trendScore = calculateTrendStrength(closes, currentSMA20, currentSMA50, currentSMA200, currentEMA21, currentEMA50);
  score += trendScore;
  if (trendScore >= 4) reasons.push('Strong uptrend (all MAs aligned)');
  else if (trendScore >= 2) reasons.push('Uptrend confirmed');
  else if (trendScore <= -4) reasons.push('Strong downtrend (all MAs aligned)');
  else if (trendScore <= -2) reasons.push('Downtrend confirmed');

  // EMA crossovers
  if (currentEMA9 && currentEMA21) {
    const prevEMA9 = ema9[ema9.length - 2];
    const prevEMA21 = ema21[ema21.length - 2];
    if (prevEMA9 < prevEMA21 && currentEMA9 > currentEMA21) {
      score += 2.5;
      reasons.push('EMA 9/21 bullish crossover');
    } else if (prevEMA9 > prevEMA21 && currentEMA9 < currentEMA21) {
      score -= 2.5;
      reasons.push('EMA 9/21 bearish crossover');
    }
  }

  // 6. ADX Trend Strength
  if (currentADX) {
    if (currentADX.adx > 25) {
      const trendDir = currentADX.pdi > currentADX.mdi ? 1 : -1;
      score += trendDir * 1.5;
      reasons.push(`Strong trend (ADX: ${currentADX.adx.toFixed(1)}, ${trendDir > 0 ? 'bullish' : 'bearish'})`);
    } else if (currentADX.adx < 15) {
      reasons.push('Weak trend (consolidation)');
    }
  }

  // 7. Volume Analysis (weight: 1.5)
  if (volumes && volumes.length > 20) {
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume;

    if (volumeRatio > 3) {
      reasons.push(`Extreme volume spike (${volumeRatio.toFixed(1)}x avg)`);
      score = score > 0 ? score + 2.5 : score - 2.5;
    } else if (volumeRatio > 2) {
      reasons.push(`High volume (${volumeRatio.toFixed(1)}x avg)`);
      score = score > 0 ? score + 1.5 : score - 1.5;
    } else if (volumeRatio < 0.5) {
      reasons.push('Low volume (weak conviction)');
    }
  }

  return {
    score,
    reasons,
    indicators: {
      rsi: currentRSI?.toFixed(1),
      macd: currentMACD?.MACD?.toFixed(4),
      macdSignal: currentMACD?.signal?.toFixed(4),
      sma20: currentSMA20?.toFixed(2),
      sma50: currentSMA50?.toFixed(2),
      sma200: currentSMA200?.toFixed(2),
      bbUpper: currentBB?.upper?.toFixed(2),
      bbLower: currentBB?.lower?.toFixed(2),
      bbMiddle: currentBB?.middle?.toFixed(2),
      stochK: currentStoch?.k?.toFixed(1),
      stochD: currentStoch?.d?.toFixed(1),
      atr: currentATR?.toFixed(2),
      adx: currentADX?.adx?.toFixed(1),
      ema9: currentEMA9?.toFixed(2),
      ema21: currentEMA21?.toFixed(2),
    },
  };
}

function calculateTrendStrength(closes, sma20, sma50, sma200, ema21, ema50) {
  let trendScore = 0;
  const currentPrice = closes[closes.length - 1];

  if (sma200) {
    if (currentPrice > sma200) trendScore += 2;
    else trendScore -= 2;
  }

  if (sma50 && sma200) {
    if (sma50 > sma200) trendScore += 1;
    else trendScore -= 1;
  }

  if (sma20 && sma50) {
    if (sma20 > sma50) trendScore += 1;
    else trendScore -= 1;
  }

  if (ema21) {
    const prevPrice = closes[closes.length - 2];
    if (prevPrice < ema21 && currentPrice > ema21) trendScore += 1;
    if (prevPrice > ema21 && currentPrice < ema21) trendScore -= 1;
  }

  if (ema50 && currentPrice > ema50) trendScore += 0.5;
  else if (ema50 && currentPrice < ema50) trendScore -= 0.5;

  return trendScore;
}

async function generateSignal(symbol, exchangeName, minConfidence = 0) {
  try {
    const exchange = exchangeName || detectExchange(symbol);

    const [klines1h, klines4h, klines1d, volatility] = await Promise.all([
      getKlines(symbol, '1h', 200, exchange),
      getKlines(symbol, '4h', 200, exchange),
      getKlines(symbol, '1d', 200, exchange),
      getVolatility(symbol, exchange),
    ]);

    function extractData(klines) {
      return {
        closes: klines.map(k => k.close),
        highs: klines.map(k => k.high),
        lows: klines.map(k => k.low),
        volumes: klines.map(k => k.volume),
      };
    }

    const h1 = extractData(klines1h);
    const h4 = extractData(klines4h);
    const d1 = extractData(klines1d);

    // Technical Analysis
    const analysis1h = analyzeTimeframe(h1.closes, h1.highs, h1.lows, h1.volumes);
    const analysis4h = analyzeTimeframe(h4.closes, h4.highs, h4.lows, h4.volumes);
    const analysis1d = analyzeTimeframe(d1.closes, d1.highs, d1.lows, d1.volumes);

    // Pattern Analysis
    const patterns1h = detectCandlestickPatterns(klines1h);
    const patterns4h = detectCandlestickPatterns(klines4h);

    // Divergence Detection
    const divergences1h = detectAllDivergences(h1.closes);
    const divergences4h = detectAllDivergences(h4.closes);

    // Fibonacci
    const currentPrice = klines1h[klines1h.length - 1].close;
    const fibAnalysis = analyzeFibonacci(d1.closes, currentPrice);

    // Market Structure
    const structureAnalysis = analyzeMarketStructure(d1.closes);

    // Volume Profile
    const vpAnalysis = analyzeVolumeProfile(klines4h, currentPrice);

    // Order Book
    let orderBookAnalysis = { score: 0, reasons: [] };
    let rawOrderBook = null;
    try {
      const orderBook = await getOrderBook(symbol, 20, exchange);
      orderBookAnalysis = analyzeOrderBook(orderBook);
      rawOrderBook = orderBook;
    } catch (e) {
      console.error('Order book error:', e.message);
    }

    // Multi-timeframe weight: 1h=20%, 4h=35%, 1d=45%
    const technicalScore =
      analysis1h.score * 0.20 +
      analysis4h.score * 0.35 +
      analysis1d.score * 0.45;

    // Pattern score (weighted lower)
    const patternScore = (patterns1h.score + patterns4h.score) * 0.5;

    // Divergence score (high weight when present)
    const divergenceScore = (divergences1h.score * 0.4 + divergences4h.score * 0.6);

    // Combine all scores with weights
    const finalScore =
      technicalScore * 0.40 +
      patternScore * 0.15 +
      divergenceScore * 0.15 +
      fibAnalysis.score * 0.10 +
      structureAnalysis.score * 0.10 +
      vpAnalysis.score * 0.05 +
      orderBookAnalysis.score * 0.05;

    // All reasons
    const allReasons = [
      ...analysis1d.reasons.map(r => `[1D] ${r}`),
      ...analysis4h.reasons.map(r => `[4H] ${r}`),
      ...analysis1h.reasons.map(r => `[1H] ${r}`),
      ...patterns1h.reasons.map(r => `[Pattern] ${r}`),
      ...patterns4h.reasons.map(r => `[Pattern 4H] ${r}`),
      ...divergences1h.reasons.map(r => `[Div] ${r}`),
      ...divergences4h.reasons.map(r => `[Div 4H] ${r}`),
      ...fibAnalysis.reasons.map(r => `[Fib] ${r}`),
      ...structureAnalysis.reasons.map(r => `[Structure] ${r}`),
      ...vpAnalysis.reasons.map(r => `[VP] ${r}`),
      ...orderBookAnalysis.reasons.map(r => `[Book] ${r}`),
    ];

    // Confluence counting
    const bullishFactors = [
      analysis1h.score > 0,
      analysis4h.score > 0,
      analysis1d.score > 0,
      patterns1h.score > 0,
      divergences1h.score > 0 || divergences4h.score > 0,
      fibAnalysis.score > 0,
      structureAnalysis.score > 0,
      orderBookAnalysis.score > 0,
    ].filter(Boolean).length;

    const bearishFactors = [
      analysis1h.score < 0,
      analysis4h.score < 0,
      analysis1d.score < 0,
      patterns1h.score < 0,
      divergences1h.score < 0 || divergences4h.score < 0,
      fibAnalysis.score < 0,
      structureAnalysis.score < 0,
      orderBookAnalysis.score < 0,
    ].filter(Boolean).length;

    // Trend agreement bonus
    const h1Dir = analysis1h.score > 0 ? 1 : analysis1h.score < 0 ? -1 : 0;
    const h4Dir = analysis4h.score > 0 ? 1 : analysis4h.score < 0 ? -1 : 0;
    const d1Dir = analysis1d.score > 0 ? 1 : analysis1d.score < 0 ? -1 : 0;

    let agreementBonus = 0;
    if (h1Dir === h4Dir && h4Dir === d1Dir && h1Dir !== 0) {
      agreementBonus = h1Dir * 3;
      allReasons.unshift(`🎯 All timeframes agree (${h1Dir > 0 ? 'BULLISH' : 'BEARISH'})`);
    }

    const totalScore = finalScore + agreementBonus;

    // Confidence based on confluence
    let confidence;
    const maxConfluence = Math.max(bullishFactors, bearishFactors);
    if (maxConfluence >= 6) confidence = 92;
    else if (maxConfluence >= 5) confidence = 85;
    else if (maxConfluence >= 4) confidence = 78;
    else if (maxConfluence >= 3) confidence = 70;
    else confidence = 55;

    // Check minimum confidence threshold
    if (confidence < minConfidence) {
      return null;
    }

    let signal, strength;
    if (totalScore >= 5) { signal = 'STRONG BUY'; strength = '🔥🔥🔥'; }
    else if (totalScore >= 2.5) { signal = 'BUY'; strength = '🔥🔥'; }
    else if (totalScore >= 1) { signal = 'WEAK BUY'; strength = '🔥'; }
    else if (totalScore <= -5) { signal = 'STRONG SELL'; strength = '📉📉📉'; }
    else if (totalScore <= -2.5) { signal = 'SELL'; strength = '📉📉'; }
    else if (totalScore <= -1) { signal = 'WEAK SELL'; strength = '📉'; }
    else { signal = 'NEUTRAL'; strength = '➡️'; }

    const stats = await get24hStats(symbol, exchange);

    const levels = calculateLevels(
      currentPrice,
      analysis4h.indicators,
      fibAnalysis.levels,
      structureAnalysis,
      vpAnalysis.profile,
      rawOrderBook
    );

    return {
      symbol: symbol.toUpperCase(),
      exchange: exchange,
      price: stats.price,
      change24h: stats.change,
      high24h: stats.high,
      low24h: stats.low,
      volume24h: stats.volume,
      signal,
      strength,
      confidence: `${confidence}%`,
      score: totalScore.toFixed(1),
      confluence: {
        bullish: bullishFactors,
        bearish: bearishFactors,
        total: maxConfluence,
      },
      reasons: allReasons.slice(0, 15),
      indicators: {
        '1H': analysis1h.indicators,
        '4H': analysis4h.indicators,
        '1D': analysis1d.indicators,
      },
      patterns: [...new Set([...patterns1h.patterns, ...patterns4h.patterns])],
      divergences: [...divergences1h.divergences, ...divergences4h.divergences],
      fibonacci: fibAnalysis.levels,
      structure: structureAnalysis.structure,
      volumeProfile: vpAnalysis.profile,
      orderBook: orderBookAnalysis.data,
      levels,
      volatility: volatility.regime,
      timeframeScores: {
        '1H': analysis1h.score.toFixed(1),
        '4H': analysis4h.score.toFixed(1),
        '1D': analysis1d.score.toFixed(1),
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(`Failed to generate signal for ${symbol}: ${error.message}`);
  }
}

async function scanAllSignals(exchangeName) {
  const results = [];
  const exchange = exchangeName || 'binance';

  let symbols;
  if (exchange === 'nse') {
    symbols = Object.keys(NSE_STOCKS).slice(0, 10);
  } else if (exchange === 'bse') {
    symbols = Object.keys(BSE_STOCKS).slice(0, 10);
  } else {
    symbols = Object.keys(PAIRS);
  }

  for (const symbol of symbols) {
    try {
      const signal = await generateSignal(symbol, exchange);
      results.push(signal);
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`Error scanning ${symbol}:`, e.message);
    }
  }

  return results.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
}

module.exports = { generateSignal, scanAllSignals, analyzeTimeframe };
