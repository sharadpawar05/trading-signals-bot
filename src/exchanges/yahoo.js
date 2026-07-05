const YahooFinance = require('yahoo-finance2').default;
const BaseExchange = require('./base');
const { NSE_STOCKS, BSE_STOCKS, INDICES } = require('../india-symbols');

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

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

    let period1;
    if (['1m', '5m', '15m', '30m', '60m'].includes(yfInterval)) {
      period1 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    } else {
      const days = limit * (yfInterval === '1wk' ? 7 : yfInterval === '1mo' ? 30 : 1);
      period1 = new Date(Date.now() - Math.max(days, 200) * 24 * 60 * 60 * 1000);
    }

    let result;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await yf.chart(yahooSymbol, { period1, interval: yfInterval });
        break;
      } catch (e) {
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        else throw e;
      }
    }

    const klines = result.quotes
      .filter(q => q.open != null && q.close != null)
      .map(q => ({
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume || 0,
        time: q.date.getTime(),
      }))
      .slice(-limit);

    setCache(cacheKey, klines);
    return klines;
  }

  async getPrice(symbol) {
    const yahooSymbol = this.normalizeSymbol(symbol);

    const cacheKey = `price_${yahooSymbol}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    let quote;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        quote = await yf.quote(yahooSymbol);
        break;
      } catch (e) {
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        else throw e;
      }
    }

    const price = quote.regularMarketPrice;
    setCache(cacheKey, price);
    return price;
  }

  async get24hStats(symbol) {
    const yahooSymbol = this.normalizeSymbol(symbol);

    const cacheKey = `stats_${yahooSymbol}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    let quote;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        quote = await yf.quote(yahooSymbol);
        break;
      } catch (e) {
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        else throw e;
      }
    }

    const stats = {
      price: quote.regularMarketPrice,
      change: quote.regularMarketChangePercent || 0,
      high: quote.regularMarketDayHigh || quote.regularMarketPrice,
      low: quote.regularMarketDayLow || quote.regularMarketPrice,
      volume: quote.regularMarketVolume || 0,
    };

    setCache(cacheKey, stats);
    return stats;
  }

  async getOrderBook(symbol, limit = 20) {
    return {
      bids: [],
      asks: [],
      lastUpdateId: 0,
    };
  }

  async getMultiplePrices() {
    const result = {};
    const symbols = this.getSupportedSymbols().slice(0, 20);

    for (const sym of symbols) {
      try {
        result[sym] = await this.getPrice(sym);
        await new Promise(r => setTimeout(r, 200));
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
