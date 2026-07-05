function calculateFibonacciLevels(high, low) {
  const diff = high - low;

  return {
    '0.0%': high,
    '23.6%': high - diff * 0.236,
    '38.2%': high - diff * 0.382,
    '50.0%': high - diff * 0.5,
    '61.8%': high - diff * 0.618,
    '78.6%': high - diff * 0.786,
    '100.0%': low,
  };
}

function analyzeFibonacci(closes, currentPrice) {
  const windowSize = Math.min(closes.length, 100);
  const window = closes.slice(-windowSize);
  const high = Math.max(...window);
  const low = Math.min(...window);

  const levels = calculateFibonacciLevels(high, low);

  let score = 0;
  const reasons = [];
  let nearestLevel = null;
  let nearestDistance = Infinity;

  for (const [label, price] of Object.entries(levels)) {
    const distance = Math.abs(currentPrice - price);
    const distancePercent = (distance / currentPrice) * 100;

    if (distancePercent < 1 && distance < nearestDistance) {
      nearestDistance = distance;
      nearestLevel = { label, price };
    }
  }

  if (nearestLevel) {
    const levelPrice = nearestLevel.price;
    const isSupport = currentPrice > levelPrice;
    const distancePercent = ((currentPrice - levelPrice) / currentPrice) * 100;

    if (isSupport && distancePercent < 0.5) {
      score += 2;
      reasons.push(`At Fib ${nearestLevel.label} support ($${levelPrice.toFixed(2)})`);
    } else if (isSupport && distancePercent < 1.5) {
      score += 1;
      reasons.push(`Near Fib ${nearestLevel.label} support ($${levelPrice.toFixed(2)})`);
    } else if (!isSupport && distancePercent < 0.5) {
      score -= 2;
      reasons.push(`At Fib ${nearestLevel.label} resistance ($${levelPrice.toFixed(2)})`);
    } else if (!isSupport && distancePercent < 1.5) {
      score -= 1;
      reasons.push(`Near Fib ${nearestLevel.label} resistance ($${levelPrice.toFixed(2)})`);
    }
  }

  const fib382 = levels['38.2%'];
  const fib618 = levels['61.8%'];
  const fib500 = levels['50.0%'];

  if (currentPrice > fib500 && currentPrice < fib382) {
    reasons.push('Price in golden pocket zone (38.2%-50%)');
  }

  return {
    score,
    reasons,
    levels,
    nearestLevel,
  };
}

module.exports = { calculateFibonacciLevels, analyzeFibonacci };
