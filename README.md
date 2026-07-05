# Crypto Trading Signals Bot

Telegram bot that provides real-time crypto trading signals using technical analysis (RSI, MACD, Volume).

## Features

- **Real-time signals** for BTC, ETH, SOL, BNB, XRP, ADA, DOGE, DOT, AVAX, LINK
- **Technical analysis** using RSI, MACD, SMA, EMA, and volume
- **Free tier**: 3 signals per day
- **Premium tier**: Unlimited signals + full market scan
- **Market scan**: Find best opportunities across all coins

## Quick Start

### 1. Create Telegram Bot

1. Open Telegram, search for `@BotFather`
2. Send `/newbot`
3. Name your bot (e.g., "Crypto Signals Pro")
4. Copy the bot token

### 2. Setup

```bash
# Clone or copy this project
cd trading-signals-bot

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your bot token
```

### 3. Configure .env

```
TELEGRAM_BOT_TOKEN=your_token_here
ACTIVATION_CODES=PREM-123,PREM-456,PREM-789
```

### 4. Run

```bash
npm start
```

### 5. Host for Free (24/7)

**Railway (recommended):**
1. Push to GitHub
2. Go to railway.app
3. New Project > Deploy from GitHub
4. Add env vars
5. Done - runs 24/7 for free

**Or use a $5 VPS:**
```bash
# On your VPS
npm install pm2 -g
pm2 start index.js
pm2 save
pm2 startup
```

## Making Money

### Free Tier Strategy
- 3 free signals/day gets users hooked
- Every 4th signal shows upgrade prompt
- Users see value before paying

### Premium Pricing
- $15/month is standard for signal bots
- Some charge $50-100/month for "whale" alerts
- Start at $15, increase as you grow

### Payment Options

**Option 1: Manual (easiest start)**
- Users pay via PayPal/Venmo/CashApp
- You send them an activation code
- Bot activates premium with `/activate CODE`

**Option 2: Stripe (automated)**
- Create Stripe Payment Link
- Update button URLs in bot.js
- Webhook confirms payment automatically

**Option 3: Telegram Payments**
- Built into Telegraf
- Supports Stripe, Stripe, and more

### Growth Tactics

1. **Twitter/X**: Post daily signals, link to bot
2. **Reddit**: Share in r/cryptocurrency, r/cryptosignals
3. **Discord**: Join crypto servers, provide value
4. **Content**: Post signal results ("BTC signaled BUY at $60k, now $65k")
5. **Referrals**: Give 1 week free for referrals

### Revenue Potential

- 100 free users → ~5-10 premium conversions
- 10 premium users × $15 = $150/month
- 50 premium users × $15 = $750/month
- 200 premium users × $15 = $3,000/month

## Customization

### Add More Coins

Edit `src/market.js` PAIRS object:
```js
const PAIRS = {
  BTC: 'BTCUSDT',
  YOUR_COIN: 'YOURCOINUSDT',
};
```

### Adjust Free Limits

Edit `src/bot.js`:
```js
const FREE_SIGNALS_PER_DAY = 5; // Change this
```

### Add More Indicators

Edit `src/signals.js` to add:
- Bollinger Bands
- Stochastic RSI
- Volume Profile
- Support/Resistance levels

## Files

```
trading-signals-bot/
├── index.js           # Entry point
├── src/
│   ├── bot.js         # Telegram bot commands
│   ├── market.js      # Binance API data
│   ├── signals.js     # Technical analysis
│   └── users.js       # User/premium management
├── data/
│   └── users.json     # User database (auto-created)
├── .env.example       # Environment template
└── package.json
```

## Important Notes

- **Not financial advice**: Add disclaimer to bot
- **No guarantees**: Trading signals are analysis, not predictions
- **Start small**: Test with friends first
- **Scale gradually**: Grow users organically
- **Stay compliant**: Check local regulations
