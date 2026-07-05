const NSE_STOCKS = {
  RELIANCE: { name: 'Reliance Industries', sector: 'Oil & Gas', yahoo: 'RELIANCE.NS' },
  TCS: { name: 'Tata Consultancy Services', sector: 'IT', yahoo: 'TCS.NS' },
  HDFCBANK: { name: 'HDFC Bank', sector: 'Banking', yahoo: 'HDFCBANK.NS' },
  INFY: { name: 'Infosys', sector: 'IT', yahoo: 'INFY.NS' },
  ICICIBANK: { name: 'ICICI Bank', sector: 'Banking', yahoo: 'ICICIBANK.NS' },
  HINDUNILVR: { name: 'Hindustan Unilever', sector: 'FMCG', yahoo: 'HINDUNILVR.NS' },
  SBIN: { name: 'State Bank of India', sector: 'Banking', yahoo: 'SBIN.NS' },
  BHARTIARTL: { name: 'Bharti Airtel', sector: 'Telecom', yahoo: 'BHARTIARTL.NS' },
  ITC: { name: 'ITC Limited', sector: 'FMCG', yahoo: 'ITC.NS' },
  KOTAKBANK: { name: 'Kotak Mahindra Bank', sector: 'Banking', yahoo: 'KOTAKBANK.NS' },
  LT: { name: 'Larsen & Toubro', sector: 'Infrastructure', yahoo: 'LT.NS' },
  AXISBANK: { name: 'Axis Bank', sector: 'Banking', yahoo: 'AXISBANK.NS' },
  ASIANPAINT: { name: 'Asian Paints', sector: 'Paints', yahoo: 'ASIANPAINT.NS' },
  MARUTI: { name: 'Maruti Suzuki', sector: 'Automobile', yahoo: 'MARUTI.NS' },
  TATAMOTORS: { name: 'Tata Motors', sector: 'Automobile', yahoo: 'TMCV.NS' },
  SUNPHARMA: { name: 'Sun Pharmaceutical', sector: 'Pharma', yahoo: 'SUNPHARMA.NS' },
  TITAN: { name: 'Titan Company', sector: 'Consumer', yahoo: 'TITAN.NS' },
  ULTRACEMCO: { name: 'UltraTech Cement', sector: 'Cement', yahoo: 'ULTRACEMCO.NS' },
  NESTLEIND: { name: 'Nestle India', sector: 'FMCG', yahoo: 'NESTLEIND.NS' },
  WIPRO: { name: 'Wipro', sector: 'IT', yahoo: 'WIPRO.NS' },
  TATASTEEL: { name: 'Tata Steel', sector: 'Metals', yahoo: 'TATASTEEL.NS' },
  JSWSTEEL: { name: 'JSW Steel', sector: 'Metals', yahoo: 'JSWSTEEL.NS' },
  HCLTECH: { name: 'HCL Technologies', sector: 'IT', yahoo: 'HCLTECH.NS' },
  ADANIENT: { name: 'Adani Enterprises', sector: 'Diversified', yahoo: 'ADANIENT.NS' },
  POWERGRID: { name: 'Power Grid Corp', sector: 'Power', yahoo: 'POWERGRID.NS' },
  NTPC: { name: 'NTPC Limited', sector: 'Power', yahoo: 'NTPC.NS' },
  ONGC: { name: 'Oil & Natural Gas Corp', sector: 'Oil & Gas', yahoo: 'ONGC.NS' },
  TATACONSUM: { name: 'Tata Consumer Products', sector: 'FMCG', yahoo: 'TATACONSUM.NS' },
  APOLLOHOSP: { name: 'Apollo Hospitals', sector: 'Healthcare', yahoo: 'APOLLOHOSP.NS' },
  BAJFINANCE: { name: 'Bajaj Finance', sector: 'Finance', yahoo: 'BAJFINANCE.NS' },
};

const BSE_STOCKS = {
  RELIANCE: { name: 'Reliance Industries', sector: 'Oil & Gas', yahoo: 'RELIANCE.BO' },
  TCS: { name: 'Tata Consultancy Services', sector: 'IT', yahoo: 'TCS.BO' },
  HDFCBANK: { name: 'HDFC Bank', sector: 'Banking', yahoo: 'HDFCBANK.BO' },
  INFY: { name: 'Infosys', sector: 'IT', yahoo: 'INFY.BO' },
  ICICIBANK: { name: 'ICICI Bank', sector: 'Banking', yahoo: 'ICICIBANK.BO' },
  HINDUNILVR: { name: 'Hindustan Unilever', sector: 'FMCG', yahoo: 'HINDUNILVR.BO' },
  SBIN: { name: 'State Bank of India', sector: 'Banking', yahoo: 'SBIN.BO' },
  BHARTIARTL: { name: 'Bharti Airtel', sector: 'Telecom', yahoo: 'BHARTIARTL.BO' },
  ITC: { name: 'ITC Limited', sector: 'FMCG', yahoo: 'ITC.BO' },
  KOTAKBANK: { name: 'Kotak Mahindra Bank', sector: 'Banking', yahoo: 'KOTAKBANK.BO' },
};

const INDICES = {
  '^NSEI': { name: 'NIFTY 50', exchange: 'NSE' },
  '^NSEBANK': { name: 'BANK NIFTY', exchange: 'NSE' },
  '^BSESN': { name: 'SENSEX', exchange: 'BSE' },
};

const FNO_SYMBOLS = {
  NIFTY: { name: 'NIFTY 50', type: 'index', lotSize: 50 },
  BANKNIFTY: { name: 'BANK NIFTY', type: 'index', lotSize: 25 },
  NIFTY_BANK: { name: 'BANK NIFTY', type: 'index', lotSize: 25 },
};

const ALIASES = {
  TATA: 'TATAMOTORS',
  TATAMOTORS: 'TATAMOTORS',
  TATASTEEL: 'TATASTEEL',
  TATACONSUM: 'TATACONSUM',
  TCS: 'TCS',
  TITAN: 'TITAN',
};

module.exports = { NSE_STOCKS, BSE_STOCKS, INDICES, FNO_SYMBOLS, ALIASES };
