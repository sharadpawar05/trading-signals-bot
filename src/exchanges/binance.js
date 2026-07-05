const fetch = require('node-fetch');
const BaseExchange = require('./base');

const BINANCE_BASE = 'https://api.binance.com/api/v3';

const PAIRS = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
  BNB: 'BNBUSDT',
  XRP: 'XRPUSDT',
  ADA: 'ADAUSDT',
  DOGE: 'DOGEUSDT',
  DOT: 'DOTUSDT',
  AVAX: 'AVAXUSDT',
  LINK: 'LINKUSDT',
};

class BinanceExchange extends BaseExchange {
  constructor() {
    super('binance');
  }

  normalizeSymbol(symbol) {
    return PAIRS[symbol.toUpperCase()] || `${symbol.toUpperCase()}USDT`;
  }

  getSupportedSymbols() {
    return Object.keys(PAIRS);
  }

  async getKlines(symbol, interval = '1h', limit = 100) {
    const pair = this.normalizeSymbol(symbol);
    const url = `${BINANCE_BASE}/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance API error: ${res.status}`);

    const data = await res.json();
    return data.map(k => ({
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      time: k[0],
    }));
  }

  async getPrice(symbol) {
    const pair = this.normalizeSymbol(symbol);
    const url = `${BINANCE_BASE}/ticker/price?symbol=${pair}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance API error: ${res.status}`);

    const data = await res.json();
    return parseFloat(data.price);
  }

  async get24hStats(symbol) {
    const pair = this.normalizeSymbol(symbol);
    const url = `${BINANCE_BASE}/ticker/24hr?symbol=${pair}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance API error: ${res.status}`);

    const data = await res.json();
    return {
      price: parseFloat(data.lastPrice),
      change: parseFloat(data.priceChangePercent),
      high: parseFloat(data.highPrice),
      low: parseFloat(data.lowPrice),
      volume: parseFloat(data.quoteVolume),
    };
  }

  async getOrderBook(symbol, limit = 20) {
    const pair = this.normalizeSymbol(symbol);
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

  async getMultiplePrices() {
    const url = `${BINANCE_BASE}/ticker/price`;
    const res = await fetch(url);
    const data = await res.json();

    const result = {};
    for (const [name, pair] of Object.entries(PAIRS)) {
      const found = data.find(d => d.symbol === pair);
      if (found) result[name] = parseFloat(found.price);
    }
    return result;
  }
}

module.exports = BinanceExchange;
