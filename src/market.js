const BinanceExchange = require('./exchanges/binance');
const YahooExchange = require('./exchanges/yahoo');

const binance = new BinanceExchange();
const yahooNSE = new YahooExchange('NSE');
const yahooBSE = new YahooExchange('BSE');

const exchanges = {
  binance,
  nse: yahooNSE,
  bse: yahooBSE,
};

function getExchange(name) {
  return exchanges[name.toLowerCase()] || binance;
}

function detectExchange(symbol) {
  const upper = symbol.toUpperCase();
  if (upper.startsWith('^') || upper.endsWith('.NS') || upper.endsWith('.BO')) {
    return 'nse';
  }
  if (['NIFTY', 'BANKNIFTY', 'NIFTY_BANK'].includes(upper)) {
    return 'nse';
  }
  return 'binance';
}

async function getKlines(symbol, interval = '1h', limit = 100, exchangeName) {
  const exchange = exchangeName ? getExchange(exchangeName) : getExchange(detectExchange(symbol));
  return exchange.getKlines(symbol, interval, limit);
}

async function getPrice(symbol, exchangeName) {
  const exchange = exchangeName ? getExchange(exchangeName) : getExchange(detectExchange(symbol));
  return exchange.getPrice(symbol);
}

async function get24hStats(symbol, exchangeName) {
  const exchange = exchangeName ? getExchange(exchangeName) : getExchange(detectExchange(symbol));
  return exchange.get24hStats(symbol);
}

async function getOrderBook(symbol, limit = 20, exchangeName) {
  const exchange = exchangeName ? getExchange(exchangeName) : getExchange(detectExchange(symbol));
  return exchange.getOrderBook(symbol, limit);
}

async function getMultiplePrices(exchangeName) {
  const exchange = exchangeName ? getExchange(exchangeName) : binance;
  return exchange.getMultiplePrices();
}

async function getVolatility(symbol, exchangeName) {
  const exchange = exchangeName ? getExchange(exchangeName) : getExchange(detectExchange(symbol));
  return exchange.getVolatility(symbol);
}

const PAIRS = binance.getSupportedSymbols();

module.exports = {
  getKlines,
  getPrice,
  get24hStats,
  getMultiplePrices,
  getOrderBook,
  getVolatility,
  PAIRS,
  getExchange,
  detectExchange,
  exchanges,
};
