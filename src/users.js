const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'users.json');

function loadUsers() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading users:', e.message);
  }
  return {};
}

function saveUsers(users) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
}

function getUser(userId) {
  const users = loadUsers();
  return users[userId] || null;
}

function registerUser(userId, username, firstName) {
  const users = loadUsers();
  if (!users[userId]) {
    users[userId] = {
      id: userId,
      username: username || firstName || 'unknown',
      registeredAt: new Date().toISOString(),
      premium: false,
      premiumExpiresAt: null,
      signalsUsed: 0,
      referredBy: null,
      minConfidence: 0,
    };
    saveUsers(users);
  }
  return users[userId];
}

function setPremium(userId, days) {
  const users = loadUsers();
  if (!users[userId]) return null;

  const now = new Date();
  const existing = users[userId].premiumExpiresAt
    ? new Date(users[userId].premiumExpiresAt)
    : now;

  const start = existing > now ? existing : now;
  start.setDate(start.getDate() + days);

  users[userId].premium = true;
  users[userId].premiumExpiresAt = start.toISOString();
  saveUsers(users);
  return users[userId];
}

function isPremium(userId) {
  const user = getUser(userId);
  if (!user || !user.premium) return false;
  return new Date(user.premiumExpiresAt) > new Date();
}

function incrementUsage(userId) {
  const users = loadUsers();
  if (users[userId]) {
    users[userId].signalsUsed = (users[userId].signalsUsed || 0) + 1;
    saveUsers(users);
  }
}

function getStats() {
  const users = loadUsers();
  const all = Object.values(users);
  const premium = all.filter(u => u.premium && new Date(u.premiumExpiresAt) > new Date());
  return {
    totalUsers: all.length,
    premiumUsers: premium.length,
    totalSignalsUsed: all.reduce((sum, u) => sum + (u.signalsUsed || 0), 0),
  };
}

function setMinConfidence(userId, minConfidence) {
  const users = loadUsers();
  if (!users[userId]) return null;

  users[userId].minConfidence = minConfidence;
  saveUsers(users);
  return users[userId];
}

function getMinConfidence(userId) {
  const user = getUser(userId);
  return user ? user.minConfidence || 0 : 0;
}

module.exports = { getUser, registerUser, setPremium, isPremium, incrementUsage, getStats, setMinConfidence, getMinConfidence };
