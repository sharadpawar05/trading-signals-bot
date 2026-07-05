const fetch = require('node-fetch');
const BaseExchange = require('./base');
const { NSE_STOCKS, BSE_STOCKS, INDICES } = require('../india-symbols');

const YAHOO_BASE = 'https://query2.finance.yahoo.com/v8/finance/chart';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

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

  async fetchWithRetry(url, retries = 5) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(url, { headers: HEADERS });
        if (res.status === 429) {
          await delay(5000 * (attempt + 1));
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        if (attempt < retries - 1) {
          await delay(3000 * (attempt + 1));
        } else {
          throw e;
        }
      }
    }
  }

  async getKlines(symbol, interval = '1d', limit = 100) {
    const yahooSymbol = this.normalizeSymbol(symbol);
    const yfInterval = INTERVAL_MAP[interval] || '1d';

    const cacheKey = `klines_${yahooSymbol}_${yfInterval}_${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    let range;
    if (['1m', '5m', '15m', '30m', '60m'].includes(yfInterval)) {
      range = '60d';
    } else {
      range = '6mo';
    }

    const url = `${YAHOO_BASE}/${yahooSymbol}?interval=${yfInterval}&range=${range}`;
    const data = await this.fetchWithRetry(url);

    if (!data.chart || !data.chart.result || !data.chart.result[0]) {
      throw new Error(`No data found for ${yahooSymbol}`);
    }

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

    const url = `${YAHOO_BASE}/${yahooSymbol}?interval=1d&range=1d`;
    const data = await this.fetchWithRetry(url);

    if (!data.chart || !data.chart.result || !data.chart.result[0]) {
      throw new Error(`No data found for ${yahooSymbol}`);
    }

    const meta = data.chart.result[0].meta;
    const price = meta.regularMarketPrice;

    setCache(cacheKey, price);
    return price;
  }

  async get24hStats(symbol) {
    const yahooSymbol = this.normalizeSymbol(symbol);

    const cacheKey = `stats_${yahooSymbol}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const url = `${YAHOO_BASE}/${yahooSymbol}?interval=1d&range=5d`;
    const data = await this.fetchWithRetry(url);

    if (!data.chart || !data.chart.result || !data.chart.result[0]) {
      throw new Error(`No data found for ${yahooSymbol}`);
    }

    const meta = data.chart.result[0].meta;
    const quotes = data.chart.result[0].indicators.quote[0];
    const timestamps = data.chart.result[0].timestamp;

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
