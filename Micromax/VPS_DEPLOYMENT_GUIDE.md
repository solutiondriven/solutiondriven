# VPS DEPLOYMENT & REVENUE TRACKING GUIDE

## Overview
This guide walks you through deploying the Micromax copy-trading platform to a VPS and setting up revenue tracking. Once deployed, your platform can accept real traders and generate revenue from their profits.

---

## PART 1: VPS DEPLOYMENT (30 minutes)

### 1. Choose & Launch VPS
**Recommended Providers:**
- DigitalOcean (fastest setup)
- Linode ($5-10/month)
- AWS EC2 (free tier available)
- Hetzner Cloud

**Recommended Specs:**
- OS: Ubuntu 22.04 LTS
- CPU: 2 vCPU
- RAM: 2GB minimum
- Disk: 20GB SSD
- Location: Closest to your brokers (Frankfurt for EU, Singapore for Asia)

### 2. SSH into VPS
```bash
# From your local machine
ssh root@<your_vps_ip>

# First time setup
sudo apt update
sudo apt upgrade -y
```

### 3. Install Dependencies
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs npm

# Python 3.10+
sudo apt install -y python3 python3-pip python3-venv

# Git
sudo apt install -y git

# PM2 (to run server in background)
sudo npm install -g pm2

# Nginx (reverse proxy)
sudo apt install -y nginx
```

### 4. Clone & Setup Project
```bash
# Clone your repo
cd /home
sudo mkdir -p micromax
cd micromax
git clone <your_repo_url> .

# Install Node dependencies
npm install

# Create .env.json with real credentials
nano .env.json
# Paste your MT5/Binance/Bitget credentials here
# SAVE: Ctrl+X, Y, Enter
```

### 5. Python Bridge Setup
```bash
cd api/services

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install -r ../../requirements.txt

# Deactivate
deactivate
```

### 6. Start Real Execution Server with PM2
```bash
cd /home/micromax

# Start server
pm2 start api/server-real.js --name "micromax-server"

# Enable auto-restart on reboot
pm2 startup
pm2 save

# Monitor
pm2 logs micromax-server
```

### 7. Setup Nginx Reverse Proxy
```bash
sudo nano /etc/nginx/sites-available/micromax
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect HTTP to HTTPS (if you have SSL)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Content-Type';
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/micromax /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 8. Setup SSL Certificate (Let's Encrypt)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d yourdomain.com

# Auto-renew
sudo systemctl enable certbot.timer
```

### 9. Verify Server Health
```bash
# Check API
curl http://localhost:3000/api/health

# Check logs
pm2 logs micromax-server

# Expected response:
# {
#   "status": "ok",
#   "service": "Micromax Real Execution Server",
#   "brokers": { ...broker statuses... }
# }
```

---

## PART 2: REVENUE MODEL SETUP (15 minutes)

### Revenue Tracking Structure
```
User Profit / Loss → Micromax Takes X% Cut → Platform Revenue
```

### 1. Create Revenue Configuration
**File: `api/revenue-config.json`**
```json
{
  "revenue_model": "performance_based",
  "tiers": [
    {
      "users": "1-10",
      "micromax_profit_share": 0.25,
      "description": "25% on profits"
    },
    {
      "users": "11-50",
      "micromax_profit_share": 0.20,
      "description": "20% on profits"
    },
    {
      "users": "51+",
      "micromax_profit_share": 0.15,
      "description": "15% on profits"
    }
  ],
  "flat_fee_option": {
    "enabled": true,
    "monthly_fee_usd": 49,
    "description": "Monthly subscription instead of profit share"
  }
}
```

### 2. Create Revenue Tracking Module
**File: `api/revenue-tracker.js`**
```javascript
const fs = require('fs');
const path = require('path');

const REVENUE_LOG_PATH = path.join(__dirname, '..', 'data', 'revenue_log.json');

class RevenueTracker {
  constructor() {
    this.ensureLogExists();
  }

  ensureLogExists() {
    const dir = path.dirname(REVENUE_LOG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(REVENUE_LOG_PATH)) {
      fs.writeFileSync(REVENUE_LOG_PATH, JSON.stringify([], null, 2));
    }
  }

  recordTrade(userId, brokerType, tradeData, profitLoss) {
    try {
      const record = {
        timestamp: new Date().toISOString(),
        userId,
        brokerType,
        symbol: tradeData.symbol,
        entryPrice: tradeData.entry_price,
        exitPrice: tradeData.exit_price,
        volume: tradeData.volume,
        profitLoss: profitLoss,
        micromax_share: this.calculateMicromaxShare(profitLoss),
        status: profitLoss > 0 ? 'PROFIT' : 'LOSS',
      };

      const logs = JSON.parse(fs.readFileSync(REVENUE_LOG_PATH, 'utf8'));
      logs.push(record);
      fs.writeFileSync(REVENUE_LOG_PATH, JSON.stringify(logs, null, 2));

      return record;
    } catch (error) {
      console.error('Failed to record trade:', error);
      return null;
    }
  }

  calculateMicromaxShare(profitLoss, sharePercentage = 0.20) {
    return Math.max(0, profitLoss * sharePercentage);
  }

  getRevenueStats() {
    try {
      const logs = JSON.parse(fs.readFileSync(REVENUE_LOG_PATH, 'utf8'));
      
      const totalProfits = logs
        .filter(l => l.status === 'PROFIT')
        .reduce((sum, l) => sum + l.profitLoss, 0);

      const micromax_revenue = logs
        .reduce((sum, l) => sum + l.micromax_share, 0);

      const totalTrades = logs.length;
      const winRate = logs.filter(l => l.status === 'PROFIT').length / totalTrades;

      return {
        total_trades: totalTrades,
        total_user_profit: totalProfits,
        micromax_revenue: micromax_revenue,
        win_rate: (winRate * 100).toFixed(2) + '%',
        average_profit_per_trade: (totalProfits / totalTrades).toFixed(2),
      };
    } catch (error) {
      return {
        total_trades: 0,
        total_user_profit: 0,
        micromax_revenue: 0,
        win_rate: '0%',
      };
    }
  }

  getRevenueByUser(userId) {
    try {
      const logs = JSON.parse(fs.readFileSync(REVENUE_LOG_PATH, 'utf8'));
      const userTrades = logs.filter(l => l.userId === userId);

      const revenue = userTrades.reduce((sum, l) => sum + l.micromax_share, 0);
      const profit = userTrades.reduce((sum, l) => sum + l.profitLoss, 0);

      return {
        user_id: userId,
        trades: userTrades.length,
        user_profit: profit,
        micromax_share: revenue,
      };
    } catch (error) {
      return null;
    }
  }
}

module.exports = RevenueTracker;
```

### 3. Add Revenue Endpoints to Server
**Add to `api/server-real.js`:**
```javascript
const RevenueTracker = require('./revenue-tracker');
const revenueTracker = new RevenueTracker();

// ... existing code ...

// Add revenue endpoints before 404 handler:

if (pathname === '/api/revenue/stats' && method === 'GET') {
  const stats = revenueTracker.getRevenueStats();
  sendJson(res, 200, {
    success: true,
    ...stats,
  });
  return;
}

if (pathname === '/api/revenue/user' && method === 'GET') {
  const queryParams = new url.URL(req.url, `http://${req.headers.host}`).searchParams;
  const userId = queryParams.get('userId');

  if (!userId) {
    sendJson(res, 400, { success: false, error: 'Missing userId parameter' });
    return;
  }

  const userRevenue = revenueTracker.getRevenueByUser(userId);
  sendJson(res, 200, { success: true, ...userRevenue });
  return;
}

// Record trade for revenue calculation
// Call this after each trade execution
// revenueTracker.recordTrade(userId, brokerType, tradeData, profitLoss);
```

---

## PART 3: MONITORING & SCALING (Ongoing)

### 1. Server Health Checks
```bash
# SSH into VPS
ssh root@<vps_ip>

# Check server status
pm2 status

# Check logs
pm2 logs micromax-server

# Check disk space
df -h

# Check memory
free -h
```

### 2. Auto-scale Python Bridges (Multiple Workers)
```javascript
// Modify server-real.js to spawn multiple Python bridge processes
const { spawn } = require('child_process');

class WorkerPool {
  constructor(workerCount = 4) {
    this.workers = [];
    for (let i = 0; i < workerCount; i++) {
      const worker = spawn('python', ['path/to/bridge_worker.py']);
      this.workers.push(worker);
    }
  }

  async execute(brokerType, operation, credentials, params) {
    const worker = this.workers[Math.floor(Math.random() * this.workers.length)];
    // Send work to worker, get result
  }
}
```

### 3. Database Backup (Critical!)
```bash
# Daily backup script
cat > /home/micromax/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backup/micromax_$DATE.tar.gz /home/micromax/data /home/micromax/.env.json
# Upload to cloud storage
# aws s3 cp /backup/micromax_$DATE.tar.gz s3://your-backup-bucket/
EOF

chmod +x backup.sh

# Schedule with cron
crontab -e
# Add: 0 2 * * * /home/micromax/backup.sh
```

---

## PART 4: GETTING YOUR FIRST TRADERS

### 1. Create User Registration Endpoint
```javascript
// In api/server-real.js or separate endpoints file
if (pathname === '/api/users/register' && method === 'POST') {
  const body = await readBody(req);
  const { email, full_name, broker_type, broker_account } = body;

  // Register user in Supabase
  // Create user profile
  // Send welcome email

  sendJson(res, 200, {
    success: true,
    user_id: newUserId,
    dashboard_url: 'https://yourdomain.com/dashboard',
  });
  return;
}
```

### 2. Marketing Setup
- Create landing page explaining the platform
- Add pricing page showing profit share model
- Create testimonials section (start with your own trades)
- Setup email notifications for new users

### 3. Affiliate Program (Optional but Recommended)
```javascript
// Tracking referrals for affiliate commissions
const AFFILIATE_COMMISSION = 0.10; // 10% of referred user's revenue goes to affiliate

// Track referral
// When referrer_id is provided, give them % of referred user's profits
```

---

## PART 5: MONITORING DASHBOARDS

### Grafana Setup (Advanced)
```bash
sudo apt install -y grafana-server
sudo systemctl start grafana-server

# Access at http://localhost:3000 (after port mapping)
# Create dashboards for:
# - Revenue by user
# - Trade success rate
# - VPS resource usage
# - Broker connection health
```

---

## CRITICAL BEFORE GOING LIVE

- [ ] Test real trades with small amounts ($100-500)
- [ ] Verify all 3 brokers are live and responding
- [ ] Set up automated backups
- [ ] Enable 2FA on all broker accounts
- [ ] Create API keys with limited permissions (no withdraw)
- [ ] Test failover scenarios (broker down, network issue)
- [ ] Setup error alerts and logging
- [ ] Document all processes

---

## NEXT STEPS FROM HERE

**Week 1 (Live Deployment):**
- Deploy this guide exactly
- Execute test trades
- Verify revenue tracking works

**Week 2 (First Users):**
- Get 5-10 beta users
- Collect feedback
- Iterate on strategy builder

**Week 3+ (Scale):**
- Onboard paying users
- Optimize for higher volume
- Add analytics dashboard

---

## REVENUE PROJECTIONS

Assuming:
- 50 active traders
- $100,000 avg account size
- 10% monthly return = $1.67M profits
- 20% Micromax share = **$333,000/month**

Reality check: 50 traders with consistent 10% monthly returns might take 3-6 months to achieve, but the model shows explosive potential once traction starts.

---

## SUPPORT & TROUBLESHOOTING

**Server won't start?**
```bash
pm2 logs micromax-server
# Check for .env.json missing or invalid credentials
```

**Trades not executing?**
```bash
curl http://localhost:3000/api/health
# Check if brokers statuses show "READY"
```

**High latency trades?**
- Move VPS closer to brokers geographically
- Upgrade VPS specs
- Pool multiple Python workers

---

**Let's make this live. Your copy-trading empire starts here. 🚀**
