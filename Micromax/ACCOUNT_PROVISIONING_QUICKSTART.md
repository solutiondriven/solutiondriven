# Account Provisioning - Quick Start (5 Minutes)

## 🚀 What You Get

An **automated flow** where users can:
1. Click "Connect MT5 Account"
2. Choose security method (Direct or Draft Mode)
3. Enter credentials or click secure link
4. Account automatically deploys to MetaApi's cloud
5. Ready to copy trade **in < 1 minute**

---

## 📋 Prerequisites

- MetaApi token (from dashboard)
- Node.js backend
- React frontend
- Existing user authentication

---

## ⚡ 5-Minute Setup

### Step 1: Get MetaApi Token (1 min)

1. Go to https://metaapi.cloud
2. Login → Settings → API Access
3. Copy API Token
4. Save to `.env`:
```
METAAPI_TOKEN=abc123xyz...
```

### Step 2: Backend Setup (2 min)

**In your `server.js` or `index.js`:**

```javascript
// 1. Import
const { router: accountRouter, initializeMetaApiProvisioning } = 
  require('./api/routes/accountProvisioning');

// 2. Initialize on startup
initializeMetaApiProvisioning(process.env.METAAPI_TOKEN);

// 3. Mount routes
app.use('/api/accounts', accountRouter);

// 4. Done! Routes available at /api/accounts/*
```

### Step 3: Frontend Setup (2 min)

**In your component (e.g., RightSidebar.tsx):**

```tsx
// 1. Import
import { AccountProvisioningForm } from './components/AccountProvisioningForm';

// 2. Add state
const [showForm, setShowForm] = useState(false);

// 3. Add button
<button onClick={() => setShowForm(true)}>
  Connect MT5 Account
</button>

// 4. Add modal
{showForm && (
  <AccountProvisioningForm
    isDark={isDark}
    onSuccess={(accountId) => {
      console.log('✅ Account created:', accountId);
      setShowForm(false);
    }}
    onError={(error) => console.error(error)}
    onClose={() => setShowForm(false)}
  />
)}
```

---

## ✅ Test It

### Test Direct Method
```bash
curl -X POST http://localhost:3000/api/accounts/provision/direct \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "mt5Login": "12345678",
    "mt5Password": "testpass123",
    "mt5Server": "ICMarketsSC-Demo"
  }'
```

### Check Status
```bash
curl http://localhost:3000/api/accounts/abc123/status
```

---

## 🎨 UI Components

### Direct Method (20 seconds to trade)
```
┌─────────────────────────────────┐
│ Connect MT5 Account             │
├─────────────────────────────────┤
│ ◉ Direct Method                 │
│ ○ Draft Mode                    │
│                                 │
│ Full Name: [_____________]      │
│ MT5 Login: [_____________]      │
│ Password:  [_____________] 👁   │
│ Server:    [ICMarkets Demo ▼]   │
│                                 │
│ [Connect Account]               │
│                                 │
│ ⏳ Creating account... [====--] │
│ ⏳ Deploying...        [======] │
│ ✅ Connected to London (LD4)    │
│    Latency: 22ms                │
└─────────────────────────────────┘
```

### Draft Mode (More Secure)
```
┌─────────────────────────────────┐
│ Connect MT5 Account             │
├─────────────────────────────────┤
│ ○ Direct Method                 │
│ ◉ Draft Mode                    │
│                                 │
│ Full Name: [_____________]      │
│ Server:    [ICMarkets Demo ▼]   │
│                                 │
│ [Create Secure Link]            │
│                                 │
│ ✅ Account created              │
│    [Securely Connect] → MetaApi │
│    Connected to London (LD4)    │
│    Latency: 22ms                │
└─────────────────────────────────┘
```

---

## 📊 What Happens Behind the Scenes

```
Direct Method:
User enters:
├─ Name: "John Trader"
├─ Login: "123456"
├─ Password: "pass123"
└─ Server: "ICMarketsSC-Demo"
  ↓
[POST /api/accounts/provision/direct]
  ↓
MetaApi creates account
  ↓
Account deploys to cloud (LD4 server)
  ↓
Account is DEPLOYED
  ↓
✅ Ready to trade
```

```
Draft Mode:
User enters:
├─ Name: "John Trader"
└─ Server: "ICMarketsSC-Demo"
  ↓
[POST /api/accounts/provision/draft]
  ↓
Account created (no password yet)
  ↓
Secure link sent to user
  ↓
User clicks link
  ↓
User enters password on MetaApi.cloud
  ↓
MetaApi verifies & deploys
  ↓
✅ Ready to trade
```

---

## 🔐 Security

### Direct Method
✅ Password sent over HTTPS  
✅ Password deleted after account creation  
❌ You momentarily handle password  

### Draft Mode (Recommended)
✅ Password never touches your server  
✅ Password entered on MetaApi's official site  
✅ Maximum user trust  
✅ Meets compliance standards  

---

## 🛠️ Key Files

| File | Purpose |
|------|---------|
| `MetaApiProvisioning.js` | Node.js SDK wrapper |
| `accountProvisioning.js` | Express API routes |
| `AccountProvisioningForm.tsx` | React UI component |
| `metaApiProvisioning.ts` | Frontend service |

---

## 📱 API Endpoints

### Create Account (Direct)
```
POST /api/accounts/provision/direct
Content-Type: application/json

{
  "fullName": "User Name",
  "mt5Login": "123456",
  "mt5Password": "password",
  "mt5Server": "ICMarketsSC-Demo",
  "userId": "user_123" (optional)
}

Returns: { success, accountId, status: "DEPLOYING" }
```

### Create Account (Draft)
```
POST /api/accounts/provision/draft
Content-Type: application/json

{
  "fullName": "User Name",
  "mt5Server": "ICMarketsSC-Demo",
  "userId": "user_123" (optional)
}

Returns: { success, accountId, configurationLink }
```

### Check Status
```
GET /api/accounts/abc123/status

Returns: { 
  accountId,
  status: "UNDEPLOYED" | "DEPLOYING" | "DEPLOYED" | "ERROR",
  dataCenter: "London (LD4)",
  estimatedLatency: 22
}
```

### Get Account List
```
GET /api/accounts/list

Returns: {
  success,
  count: 3,
  accounts: [{ id, name, state, login }, ...]
}
```

---

## ⚙️ Environment Variables

```bash
# .env
METAAPI_TOKEN=your_token_here
NODE_ENV=development
PORT=3000

# Frontend
VITE_METAAPI_TOKEN=your_token_here (optional, for client-side)
VITE_API_BASE_URL=http://localhost:3000
```

---

## 🚨 Common Issues & Fixes

### "Invalid MetaApi token"
**Problem:** Token is wrong or expired  
**Fix:** Get fresh token from MetaApi dashboard

### "Server not found"
**Problem:** User entered non-existent server  
**Fix:** Show dropdown of available servers instead of text input

### "Deployment timeout"
**Problem:** Account taking > 2 minutes  
**Fix:** Retry or contact MetaApi support

### "Invalid login or password"
**Problem:** User gave wrong MT5 credentials  
**Fix:** Show error and let user try again

---

## 📈 Next Steps

After implementing provisioning:

1. **Track deployments** - Monitor success rates
2. **Add database** - Store account info (accountId, userId, createdAt)
3. **Email confirmation** - Send user confirmation when deployed
4. **Analytics** - How long does deployment take? Success rate?
5. **Fallback servers** - If one server fails, try another

---

## 🎯 Expected User Journey

```
1. User clicks "Connect Account" (2 sec)
   ↓
2. Form appears with 2 options (instant)
   ↓
3a. Direct: User enters credentials (30 sec)
   OR
3b. Draft: User enters name only (10 sec)
   ↓
4. Account created & deploying (5-30 sec)
   ↓
5. ✅ Account ready! (total: ~1 minute)
   ↓
6. User can copy trades immediately
```

---

## 📞 Support

- **MetaApi Docs:** https://metaapi.cloud/docs
- **MetaApi Support:** support@metaapi.cloud
- **Your Backend:** Uses provisioning service

---

## 🎉 That's It!

You now have a professional account provisioning system that:
- ✅ Automates MT5 account connection
- ✅ Secures user passwords (Draft Mode)
- ✅ Shows real-time deployment status
- ✅ Displays latency & data center info
- ✅ Integrates seamlessly with Impulse Hub

**Next:** Add this to your RightSidebar and test with your MT5 demo account!
