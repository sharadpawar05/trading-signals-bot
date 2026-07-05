function calculateVolumeProfile(klines, numBins = 20) {
  if (klines.length < 10) return null;

  const prices = klines.map(k => ({ high: k.high, low: k.low, close: k.close, volume: k.volume }));
  const allHighs = prices.map(p => p.high);
  const allLows = prices.map(p => p.low);

  const maxPrice = Math.max(...allHighs);
  const minPrice = Math.min(...allLows);
  const range = maxPrice - minPrice;

  if (range === 0) return null;

  const binSize = range / numBins;
  const bins = [];

  for (let i = 0; i < numBins; i++) {
    const binLow = minPrice + i * binSize;
    const binHigh = binLow + binSize;
    const binMid = (binLow + binHigh) / 2;

    let totalVolume = 0;
    for (const k of klines) {
      const kMid = (k.high + k.low) / 2;
      if (kMid >= binLow && kMid < binHigh) {
        totalVolume += k.volume;
      }
    }

    bins.push({ low: binLow, high: binHigh, mid: binMid, volume: totalVolume });
  }

  const maxVolume = Math.max(...bins.map(b => b.volume));
  const poc = bins.reduce((max, b) => b.volume > max.volume ? b : max, bins[0]);

  const totalVolume = bins.reduce((sum, b) => sum + b.volume, 0);
  let valueAreaVolume = 0;
  const valueAreaBins = [];

  const sortedBins = [...bins].sort((a, b) => b.volume - a.volume);
  for (const bin of sortedBins) {
    if (valueAreaVolume >= totalVolume * 0.7) break;
    valueAreaBins.push(bin);
    valueAreaVolume += bin.volume;
  }

  const valueAreaHigh = Math.max(...valueAreaBins.map(b => b.high));
  const valueAreaLow = Math.min(...valueAreaBins.map(b => b.low));

  return {
    poc,
    valueArea: { high: valueAreaHigh, low: valueAreaLow },
    bins,
  };
}

function analyzeVolumeProfile(klines, currentPrice) {
  const profile = calculateVolumeProfile(klines);
  if (!profile) return { score: 0, reasons: [], profile: null };

  let score = 0;
  const reasons = [];

  const distToPoc = ((currentPrice - profile.poc.mid) / currentPrice) * 100;

  if (Math.abs(distToPoc) < 0.5) {
    reasons.push(`At POC ($${profile.poc.mid.toFixed(2)}) - high activity zone`);
  } else if (distToPoc > 0 && distToPoc < 2) {
    score += 1;
    reasons.push(`Above POC ($${profile.poc.mid.toFixed(2)}) - bullish`);
  } else if (distToPoc < 0 && distToPoc > -2) {
    score -= 1;
    reasons.push(`Below POC ($${profile.poc.mid.toFixed(2)}) - bearish`);
  }

  if (currentPrice > profile.valueArea.high) {
    score += 2;
    reasons.push('Price above value area (premium zone)');
  } else if (currentPrice < profile.valueArea.low) {
    score -= 2;
    reasons.push('Price below value area (discount zone)');
  } else {
    reasons.push('Price in value area (fair value)');
  }

  const binsAbove = profile.bins.filter(b => b.mid > currentPrice);
  const binsBelow = profile.bins.filter(b => b.mid < currentPrice);

  const volAbove = binsAbove.reduce((sum, b) => sum + b.volume, 0);
  const volBelow = binsBelow.reduce((sum, b) => sum + b.volume, 0);

  if (volBelow > volAbove * 1.5) {
    score += 1;
    reasons.push('More volume below (support)');
  } else if (volAbove > volBelow * 1.5) {
    score -= 1;
    reasons.push('More volume above (resistance)');
  }

  return {
    score,
    reasons,
    profile: {
      poc: profile.poc.mid.toFixed(2),
      valueAreaHigh: profile.valueArea.high.toFixed(2),
      valueAreaLow: profile.valueArea.low.toFixed(2),
    },
  };
}

module.exports = { calculateVolumeProfile, analyzeVolumeProfile };
