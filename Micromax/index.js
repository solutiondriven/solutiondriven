const axios = require("axios");
const fs = require("fs");
const path = require("path");
const RiskManager = require("./core/riskManager");
const TemiStrategy = require("./strategies/TemiStrategy");
const CryptoAdapter = require("./exchanges/CryptoAdapter");
const ForexAdapter = require("./exchanges/ForexAdapter");

const CACHE_FILE = path.join(__dirname, "coins.json");
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const BATCH_SIZE = 250;
const DELAY_MS = 1000;

const riskManager = new RiskManager();
let trades = [];

// --- Cache functions ---
function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const raw = fs.readFileSync(CACHE_FILE, "utf8");
      const data = JSON.parse(raw);
      data.coins = data.coins || [];
      data.prices = data.prices || {};
      data.lastBatchIndex = data.lastBatchIndex || 0;
      return data;
    } catch {}
  }
  return { coins: [], prices: {}, timestamp: 0, lastBatchIndex: 0 };
}

function saveCache(data) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

// --- Fetch functions ---
async function fetchCoinPrice(coinId) {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
    const response = await axios.get(url);
    if (response.data[coinId]) return response.data[coinId].usd;
  } catch {}
  return null;
}

async function fetchFullCoinList() {
  try {
    const response = await axios.get("https://api.coingecko.com/api/v3/coins/list");
    return response.data;
  } catch {
    return [];
  }
}

// Background fetch for caching
async function fetchAllPricesBackground(coins, startBatch = 0) {
  let cache = loadCache();
  for (let i = startBatch * BATCH_SIZE; i < coins.length; i += BATCH_SIZE) {
    const batch = coins.slice(i, i + BATCH_SIZE);
    const ids = batch.map(c => c.id).join(",");
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
      const response = await axios.get(url);
      batch.forEach(c => {
        if (response.data[c.id]) {
          cache.prices[c.id] = response.data[c.id].usd;
        }
      });
      cache.lastBatchIndex = i / BATCH_SIZE + 1;
      cache.timestamp = Date.now();
      saveCache(cache);
    } catch {}
    await new Promise(res => setTimeout(res, DELAY_MS));
  }
}

// --- Utility functions ---
function filterOnlySymbol(symbol) {
  return symbol.toUpperCase();
}

function updateCacheWithCoin(matchId, symbol, price) {
  const cache = loadCache();
  if (!cache.coins.some(c => c.id === matchId)) {
    cache.coins.push({ id: matchId, symbol: symbol.toLowerCase() });
  }
  cache.prices[matchId] = price;
  cache.timestamp = Date.now();
  saveCache(cache);
}

// --- Main bot ---
async function runBot() {
  console.log("Hello, I am Micromax!");

  const userInput = process.argv[2];
  if (!userInput) {
    console.log('👉 Please type a coin symbol or forex pair, e.g.: node index.js eth or eurusd');
  } else {
    const symbolLower = userInput.toLowerCase();
    let cache = loadCache();

    // Step 1: Check cache first
    let match = cache.coins.find(c => c.symbol === symbolLower);
    if (match && cache.prices[match.id] !== undefined && Date.now() - cache.timestamp < CACHE_DURATION) {
      const symbolOnly = filterOnlySymbol(userInput);
      console.log(`💰 ${symbolOnly} Price: $${cache.prices[match.id]}`);
    } else {
      // Step 2: First-time coin, live fetch
      console.log("⏳ Finding unapproximated coin price, wait a minute...");
      const allCoins = await fetchFullCoinList();
      match = allCoins.find(c => c.symbol.toLowerCase() === symbolLower);

      if (match) {
        const price = await fetchCoinPrice(match.id);
        if (price !== null) {
          const symbolOnly = filterOnlySymbol(userInput);
          console.log(`💰 ${symbolOnly} Price: $${price}`);
          updateCacheWithCoin(match.id, userInput, price);

          // Step 3: Execute strategy on tick
          const tradeOrder = TemiStrategy.onTick({ symbol: symbolOnly, price }, null);
          if (tradeOrder) {
            tradeOrder.entryPrice = price;
            trades.push(tradeOrder);

            // Evaluate trade via RiskManager immediately
            riskManager.evaluateTrade(tradeOrder, price);
          }
        } else {
          console.log(`❌ Coin or Forex pair "${userInput}" not found.`);
        }
      } else {
        console.log(`❌ Coin or Forex pair "${userInput}" not found.`);
      }
    }

    // Step 4: Background fetch (non-blocking)
    (async () => {
      const allCoins = await fetchFullCoinList();
      await fetchAllPricesBackground(allCoins, cache.lastBatchIndex);
    })();
  }

  // --- Real-time tick subscriptions ---
  const cryptoAdapter = new CryptoAdapter();
  const forexAdapter = new ForexAdapter();

  cryptoAdapter.connect();
  forexAdapter.connect();

  function handleTick(tick) {
    const tradeOrder = TemiStrategy.onTick(tick, null);
    if (tradeOrder) {
      tradeOrder.entryPrice = tick.price;
      trades.push(tradeOrder);
      riskManager.evaluateTrade(tradeOrder, tick.price);
      console.log(`💹 Trade executed: ${tradeOrder.symbol} at ${tradeOrder.entryPrice}`);
    }
  }

  cryptoAdapter.onTick(handleTick);
  forexAdapter.onTick(handleTick);

  console.log("🚀 Micromax connected to real-time ticks (crypto + forex)");
}

runBot();
