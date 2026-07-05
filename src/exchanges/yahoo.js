const fetch = require('node-fetch');
const BaseExchange = require('./base');
const { NSE_STOCKS, BSE_STOCKS, INDICES } = require('../india-symbols');

const cache = new Map();
const CACHE_TTL = 60000;

function getCached(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.data;
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, time: Date.now() });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function buildYahooHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
  };
}

async function getYahooSession() {
  try {
    const res = await fetch('https://fc.yahoo.com', {
      headers: buildYahooHeaders(),
      redirect: 'manual',
    });
    const setCookies = res.headers.raw ? res.headers.raw()['set-cookie'] : [];
    if (setCookies && setCookies.length > 0) {
      return setCookies.map(c => c.split(';')[0]).join('; ');
    }
  } catch (e) {}
  return null;
}

async function fetchYahooChart(symbol, interval, range) {
  const sessionCookie = await getYahooSession();
  const headers = buildYahooHeaders();
  if (sessionCookie) headers['Cookie'] = sessionCookie;

  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
  ];

  for (const url of urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { headers });
        if (res.status === 429) {
          await delay(5000 * (attempt + 1));
          continue;
        }
        if (!res.ok) continue;
        const data = await res.json();
        if (data.chart && data.chart.result && data.chart.result[0]) {
          return data;
        }
      } catch (e) {
        if (attempt < 2) await delay(2000 * (attempt + 1));
      }
    }
  }
  throw new Error(`Failed to fetch data for ${symbol}`);
}

const INTERVAL_MAP = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '60m',
  '4h': '1d',
  '1d': '1d',
  '1wk': '1wk',
};

class YahooExchange extends BaseExchange {
  constructor(exchange = 'NSE') {
    super('yahoo');
    this.exchange = exchange.toUpperCase();
  }

  normalizeSymbol(symbol) {
    const upper = symbol.toUpperCase();
    if (upper.startsWith('^')) return upper;

    if (this.exchange === 'BSE') {
      const stock = BSE_STOCKS[upper];
      if (stock && stock.yahoo) return stock.yahoo;
      return upper.endsWith('.BO') ? upper : `${upper}.BO`;
    }

    const stock = NSE_STOCKS[upper];
    if (stock && stock.yahoo) return stock.yahoo;
    return upper.endsWith('.NS') ? upper : `${upper}.NS`;
  }

  getSupportedSymbols() {
    if (this.exchange === 'BSE') {
      return [...Object.keys(BSE_STOCKS), ...Object.keys(INDICES)];
    }
    return [...Object.keys(NSE_STOCKS), ...Object.keys(INDICES)];
  }

  async getKlines(symbol, interval = '1d', limit = 100) {
    const yahooSymbol = this.normalizeSymbol(symbol);
    const yfInterval = INTERVAL_MAP[interval] || '1d';

    const cacheKey = `klines_${yahooSymbol}_${yfInterval}_${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const range = ['1m', '5m', '15m', '30m', '60m'].includes(yfInterval) ? '60d' : '6mo';
    const data = await fetchYahooChart(yahooSymbol, yfInterval, range);

    const quotes = data.chart.result[0].indicators.quote[0];
    const timestamps = data.chart.result[0].timestamp;

    const klines = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.open[i] != null && quotes.close[i] != null) {
        klines.push({
          open: quotes.open[i],
          high: quotes.high[i],
          low: quotes.low[i],
          close: quotes.close[i],
          volume: quotes.volume[i] || 0,
          time: timestamps[i] * 1000,
        });
      }
    }

    const result = klines.slice(-limit);
    setCache(cacheKey, result);
    return result;
  }

  async getPrice(symbol) {
    const yahooSymbol = this.normalizeSymbol(symbol);

    const cacheKey = `price_${yahooSymbol}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const data = await fetchYahooChart(yahooSymbol, '1d', '1d');
    const price = data.chart.result[0].meta.regularMarketPrice;

    setCache(cacheKey, price);
    return price;
  }

  async get24hStats(symbol) {
    const yahooSymbol = this.normalizeSymbol(symbol);

    const cacheKey = `stats_${yahooSymbol}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const data = await fetchYahooChart(yahooSymbol, '1d', '5d');
    const meta = data.chart.result[0].meta;
    const quotes = data.chart.result[0].indicators.quote[0];

    const currentPrice = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || currentPrice;
    const change = ((currentPrice - prevClose) / prevClose) * 100;

    const highs = quotes.high.filter(h => h != null);
    const lows = quotes.low.filter(l => l != null);
    const volumes = quotes.volume.filter(v => v != null);

    const stats = {
      price: currentPrice,
      change: parseFloat(change.toFixed(2)),
      high: highs.length > 0 ? Math.max(...highs) : currentPrice,
      low: lows.length > 0 ? Math.min(...lows) : currentPrice,
      volume: volumes.reduce((a, b) => a + b, 0),
    };

    setCache(cacheKey, stats);
    return stats;
  }

  async getOrderBook(symbol, limit = 20) {
    return { bids: [], asks: [], lastUpdateId: 0 };
  }

  async getMultiplePrices() {
    const result = {};
    const symbols = this.getSupportedSymbols().slice(0, 20);

    for (const sym of symbols) {
      try {
        result[sym] = await this.getPrice(sym);
        await delay(500);
      } catch (e) {
        console.error(`Error fetching price for ${sym}:`, e.message);
      }
    }
    return result;
  }

  async getVolatility(symbol) {
    try {
      return await super.getVolatility(symbol);
    } catch (e) {
      return { hourlyVol: 0, annualizedVol: 0, regime: 'normal' };
    }
  }
}

module.exports = YahooExchange;
