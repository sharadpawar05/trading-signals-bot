class BaseExchange {
  constructor(name) {
    this.name = name;
  }

  async getKlines(symbol, interval = '1h', limit = 100) {
    throw new Error('getKlines not implemented');
  }

  async getPrice(symbol) {
    throw new Error('getPrice not implemented');
  }

  async get24hStats(symbol) {
    throw new Error('get24hStats not implemented');
  }

  async getOrderBook(symbol, limit = 20) {
    throw new Error('getOrderBook not implemented');
  }

  async getMultiplePrices() {
    throw new Error('getMultiplePrices not implemented');
  }

  async getVolatility(symbol) {
    const klines = await this.getKlines(symbol, '1h', 24);
    const returns = [];
    for (let i = 1; i < klines.length; i++) {
      returns.push(Math.log(klines[i].close / klines[i - 1].close));
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const hourlyVol = Math.sqrt(variance);
    const annualizedVol = hourlyVol * Math.sqrt(8760);

    let regime;
    if (annualizedVol < 0.3) regime = 'low';
    else if (annualizedVol < 0.6) regime = 'normal';
    else regime = 'high';

    return { hourlyVol, annualizedVol, regime };
  }

  getSupportedSymbols() {
    throw new Error('getSupportedSymbols not implemented');
  }

  normalizeSymbol(symbol) {
    throw new Error('normalizeSymbol not implemented');
  }
}

module.exports = BaseExchange;
