const fetch = require('node-fetch');

const BINANCE_BASE = 'https://api.binance.com/api/v3';

async function getOrderBook(symbol, limit = 20) {
  const pair = `${symbol.toUpperCase()}USDT`;
  const url = `${BINANCE_BASE}/depth?symbol=${pair}&limit=${limit}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Order book API error: ${res.status}`);

  const data = await res.json();
  return {
    bids: data.bids.map(([price, qty]) => ({ price: parseFloat(price), qty: parseFloat(qty) })),
    asks: data.asks.map(([price, qty]) => ({ price: parseFloat(price), qty: parseFloat(qty) })),
    lastUpdateId: data.lastUpdateId,
  };
}

function analyzeOrderBook(book) {
  if (!book || !book.bids || !book.asks || book.bids.length === 0 || book.asks.length === 0) {
    return {
      score: 0,
      reasons: [],
      data: null,
    };
  }

  const totalBidQty = book.bids.reduce((sum, b) => sum + b.qty, 0);
  const totalAskQty = book.asks.reduce((sum, a) => sum + a.qty, 0);

  const bidAskRatio = totalBidQty / totalAskQty;

  const bidWall = book.bids.reduce((max, b) => b.qty > max.qty ? b : max, book.bids[0]);
  const askWall = book.asks.reduce((max, a) => a.qty > max.qty ? a : max, book.asks[0]);

  const midPrice = (book.bids[0].price + book.asks[0].price) / 2;
  const spread = book.asks[0].price - book.bids[0].price;
  const spreadPercent = (spread / midPrice) * 100;

  const bidDepth1pct = book.bids
    .filter(b => b.price >= midPrice * 0.99)
    .reduce((sum, b) => sum + b.qty, 0);
  const askDepth1pct = book.asks
    .filter(a => a.price <= midPrice * 1.01)
    .reduce((sum, a) => sum + a.qty, 0);

  const nearbyBidPressure = book.bids.slice(0, 5).reduce((sum, b) => sum + b.qty, 0);
  const nearbyAskPressure = book.asks.slice(0, 5).reduce((sum, a) => sum + a.qty, 0);

  let score = 0;
  const reasons = [];

  if (bidAskRatio > 1.5) {
    score += 2;
    reasons.push(`Strong buy pressure (bid/ask: ${bidAskRatio.toFixed(2)})`);
  } else if (bidAskRatio > 1.2) {
    score += 1;
    reasons.push(`Moderate buy pressure (bid/ask: ${bidAskRatio.toFixed(2)})`);
  } else if (bidAskRatio < 0.67) {
    score -= 2;
    reasons.push(`Strong sell pressure (bid/ask: ${bidAskRatio.toFixed(2)})`);
  } else if (bidAskRatio < 0.83) {
    score -= 1;
    reasons.push(`Moderate sell pressure (bid/ask: ${bidAskRatio.toFixed(2)})`);
  }

  if (bidWall.qty > askWall.qty * 2) {
    score += 1;
    reasons.push(`Bid wall at $${bidWall.price.toFixed(2)} (${bidWall.qty.toFixed(2)} BTC)`);
  } else if (askWall.qty > bidWall.qty * 2) {
    score -= 1;
    reasons.push(`Ask wall at $${askWall.price.toFixed(2)} (${askWall.qty.toFixed(2)} BTC)`);
  }

  if (nearbyBidPressure > nearbyAskPressure * 1.5) {
    score += 1;
    reasons.push('Strong nearby bid support');
  } else if (nearbyAskPressure > nearbyBidPressure * 1.5) {
    score -= 1;
    reasons.push('Strong nearby ask resistance');
  }

  return {
    score,
    reasons,
    data: {
      bidAskRatio: bidAskRatio.toFixed(3),
      spread: spread.toFixed(2),
      spreadPercent: spreadPercent.toFixed(4),
      bidWall: { price: bidWall.price, qty: bidWall.qty.toFixed(4) },
      askWall: { price: askWall.price, qty: askWall.qty.toFixed(4) },
      bidDepth1pct: bidDepth1pct.toFixed(4),
      askDepth1pct: askDepth1pct.toFixed(4),
    },
  };
}

module.exports = { getOrderBook, analyzeOrderBook };
