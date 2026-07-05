const { detectSwingPoints } = require('./structure');

function calculateLevels(currentPrice, indicators, fibLevels, structure, volumeProfile, orderBook) {
  const atr4h = indicators.atr ? parseFloat(indicators.atr) : null;
  const bb = indicators.bb;

  const { swingHighs, swingLows } = structure || { swingHighs: [], swingLows: [] };

  // --- BUY ZONE ---
  const buyZoneCandidates = [];

  if (fibLevels) {
    if (fibLevels['38.2%']) buyZoneCandidates.push(fibLevels['38.2%']);
    if (fibLevels['50.0%']) buyZoneCandidates.push(fibLevels['50.0%']);
    if (fibLevels['61.8%']) buyZoneCandidates.push(fibLevels['61.8%']);
    if (fibLevels['78.6%']) buyZoneCandidates.push(fibLevels['78.6%']);
  }

  if (bb) {
    const bbLower = parseFloat(bb.lower);
    buyZoneCandidates.push(bbLower);
    const bbMiddle = parseFloat(bb.middle);
    buyZoneCandidates.push(bbLower + (bbMiddle - bbLower) * 0.3);
  }

  if (volumeProfile && volumeProfile.valueAreaLow) {
    buyZoneCandidates.push(parseFloat(volumeProfile.valueAreaLow));
  }

  if (swingLows && swingLows.length > 0) {
    for (const sl of swingLows) {
      if (sl.price < currentPrice) buyZoneCandidates.push(sl.price);
    }
  }

  if (orderBook && orderBook.bids && orderBook.bids.length > 0) {
    const bidWall = orderBook.bids.reduce((max, b) => b.qty > max.qty ? b : max, orderBook.bids[0]);
    if (bidWall && bidWall.price < currentPrice) {
      buyZoneCandidates.push(bidWall.price);
    }
  }

  const validCandidates = buyZoneCandidates.filter(p => p > 0 && p < currentPrice);
  validCandidates.sort((a, b) => a - b);

  let bestBuyPrice, buyZoneLow, buyZoneHigh;

  if (validCandidates.length >= 2) {
    // Find the tightest cluster of candidates (within 2% of each other)
    let bestCluster = [validCandidates[0]];
    let bestClusterSpread = Infinity;

    for (let i = 0; i < validCandidates.length; i++) {
      const cluster = [validCandidates[i]];
      for (let j = i + 1; j < validCandidates.length; j++) {
        const spreadPercent = (validCandidates[j] - validCandidates[i]) / validCandidates[i];
        if (spreadPercent <= 0.02) {
          cluster.push(validCandidates[j]);
        }
      }
      if (cluster.length >= 2) {
        const clusterSpread = (cluster[cluster.length - 1] - cluster[0]) / cluster[0];
        if (clusterSpread < bestClusterSpread) {
          bestCluster = cluster;
          bestClusterSpread = clusterSpread;
        }
      }
    }

    // Use the cluster's median as the best buy price
    const medianIndex = Math.floor(bestCluster.length / 2);
    bestBuyPrice = bestCluster[medianIndex];

    // Create a tight zone: -0.5% to +0.3% from best buy
    buyZoneLow = bestBuyPrice * 0.995;
    buyZoneHigh = bestBuyPrice * 1.003;
  } else if (validCandidates.length === 1) {
    bestBuyPrice = validCandidates[0];
    buyZoneLow = bestBuyPrice * 0.995;
    buyZoneHigh = bestBuyPrice * 1.005;
  } else {
    // Fallback: use ATR-based zone below current price
    bestBuyPrice = atr4h ? currentPrice - atr4h * 1 : currentPrice * 0.98;
    buyZoneLow = bestBuyPrice * 0.995;
    buyZoneHigh = bestBuyPrice * 1.005;
  }

  // --- STOP LOSS ---
  const stopLossCandidates = [];

  if (atr4h) {
    stopLossCandidates.push(currentPrice - atr4h * 1.5);
    stopLossCandidates.push(currentPrice - atr4h * 2);
  }

  if (swingLows && swingLows.length > 0) {
    const belowSwingLows = swingLows
      .filter(sl => sl.price < currentPrice)
      .sort((a, b) => b.price - a.price);
    if (belowSwingLows.length > 0) {
      stopLossCandidates.push(belowSwingLows[0].price * 0.995);
    }
  }

  if (fibLevels && fibLevels['78.6%'] && fibLevels['78.6%'] < currentPrice) {
    stopLossCandidates.push(fibLevels['78.6%'] * 0.995);
  }

  if (fibLevels && fibLevels['100.0%'] && fibLevels['100.0%'] < currentPrice) {
    stopLossCandidates.push(fibLevels['100.0%'] * 0.995);
  }

  const validStops = stopLossCandidates.filter(p => p > 0 && p < currentPrice);
  validStops.sort((a, b) => b - a);
  const stopLoss = validStops.length > 0 ? validStops[0] : currentPrice * 0.95;

  const stopLossPercent = ((stopLoss - currentPrice) / currentPrice) * 100;

  // --- TAKE PROFIT TARGETS ---
  const tpCandidates = [];

  if (atr4h) {
    tpCandidates.push({ price: currentPrice + atr4h * 1.5, label: 'ATR 1.5x' });
    tpCandidates.push({ price: currentPrice + atr4h * 2.5, label: 'ATR 2.5x' });
    tpCandidates.push({ price: currentPrice + atr4h * 4, label: 'ATR 4x' });
  }

  if (fibLevels) {
    if (fibLevels['0.0%'] && fibLevels['0.0%'] > currentPrice) {
      tpCandidates.push({ price: fibLevels['0.0%'], label: 'Fib 0%' });
    }
    if (fibLevels['23.6%'] && fibLevels['23.6%'] > currentPrice) {
      tpCandidates.push({ price: fibLevels['23.6%'], label: 'Fib 23.6%' });
    }
  }

  if (swingHighs && swingHighs.length > 0) {
    const aboveSwingHighs = swingHighs
      .filter(sh => sh.price > currentPrice)
      .sort((a, b) => a.price - b.price);
    for (const sh of aboveSwingHighs.slice(0, 2)) {
      tpCandidates.push({ price: sh.price, label: 'Swing High' });
    }
  }

  if (volumeProfile && volumeProfile.valueAreaHigh) {
    const vah = parseFloat(volumeProfile.valueAreaHigh);
    if (vah > currentPrice) {
      tpCandidates.push({ price: vah, label: 'VA High' });
    }
  }

  if (orderBook && orderBook.asks && orderBook.asks.length > 0) {
    const askWall = orderBook.asks.reduce((max, a) => a.qty > max.qty ? a : max, orderBook.asks[0]);
    if (askWall && askWall.price > currentPrice) {
      tpCandidates.push({ price: askWall.price, label: 'Ask Wall' });
    }
  }

  const validTPs = tpCandidates.filter(t => t.price > currentPrice);
  validTPs.sort((a, b) => a.price - b.price);

  const targets = [];
  const seenPrices = new Set();

  for (const tp of validTPs) {
    const rounded = Math.round(tp.price * 100) / 100;
    if (!seenPrices.has(rounded)) {
      seenPrices.add(rounded);
      const pct = ((rounded - currentPrice) / currentPrice) * 100;
      targets.push({
        price: rounded.toFixed(2),
        label: tp.label,
        percent: pct.toFixed(2),
      });
    }
    if (targets.length >= 4) break;
  }

  if (targets.length === 0) {
    const fallbackTp = currentPrice * 1.03;
    targets.push({
      price: fallbackTp.toFixed(2),
      label: 'Default',
      percent: '3.00',
    });
  }

  const riskReward = targets.length > 0
    ? (Math.abs(parseFloat(targets[0].price) - currentPrice) / Math.abs(currentPrice - stopLoss)).toFixed(2)
    : '1.00';

  return {
    buyZone: {
      low: buyZoneLow.toFixed(2),
      high: buyZoneHigh.toFixed(2),
      lowPercent: ((buyZoneLow - currentPrice) / currentPrice * 100).toFixed(2),
      highPercent: ((buyZoneHigh - currentPrice) / currentPrice * 100).toFixed(2),
    },
    stopLoss: {
      price: stopLoss.toFixed(2),
      percent: stopLossPercent.toFixed(2),
    },
    targets,
    riskReward,
  };
}

module.exports = { calculateLevels };
