# 🚀 Account Provisioning Integration Guide

## Overview

Account Provisioning is the **automated flow** that allows users to connect their MT5/MT4 accounts directly through Impulse Hub without manual setup.

**The Magic:** Your website becomes a "middleman" that securely bridges users' MetaTrader accounts to MetaApi's cloud infrastructure.

---

## Architecture

```
User (Impulse Hub UI)
     ↓
Frontend Form (AccountProvisioningForm.tsx)
     ↓
Express API (accountProvisioning.js)
     ↓
MetaApi SDK
     ↓
MT5/MT4 Account (Deployed on Cloud)
```

---

## Two Methods Explained

### **Method 1: Direct Method** ⚡
- **What Happens:** User enters password → You send to MetaApi → Account created
- **Speed:** Immediate
- **Security:** Password sent via HTTPS, deleted after
- **Trust:** Lower (user fears password handling)

### **Method 2: Draft Mode** 🔐 (Recommended)
- **What Happens:** User enters name/server only → You create account → Send secure link → User enters password on MetaApi's official site
- **Speed:** Takes 10 seconds longer
- **Security:** Higher (password never touches your server)
- **Trust:** Higher (password entered on MetaApi's site, not yours)

---

## Setup Steps

### Step 1: Get Your MetaApi Token

1. Go to https://www.metaapi.cloud
2. Login to your account
3. Go to **Settings → API Access**
4. Copy your **API Access Token**

### Step 2: Install Dependencies

```bash
# In your frontend directory
npm install lucide-react axios

# In your backend directory
npm install express metaapi.cloud-sdk
```

### Step 3: Environment Variables

**.env file (Frontend)**
```
VITE_METAAPI_TOKEN=your_token_here
VITE_API_BASE_URL=http://localhost:3000
```

**.env file (Backend)**
```
METAAPI_TOKEN=your_token_here
NODE_ENV=development
PORT=3000
```

### Step 4: Backend Integration

Add this to your `server.js`:

```javascript
const express = require('express');
const { router: accountProvisioningRouter, initializeMetaApiProvisioning } = require('./api/routes/accountProvisioning');

const app = express();

// Initialize MetaApi provisioning on startup
const apiToken = process.env.METAAPI_TOKEN;
if (!apiToken) {
  throw new Error('METAAPI_TOKEN not set in .env');
}

initializeMetaApiProvisioning(apiToken);
console.log('✅ MetaApi provisioning initialized');

// Mount the provisioning routes
app.use('/api/accounts', accountProvisioningRouter);

// Your other routes...

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Step 5: Frontend Integration

Add the form to your RightSidebar or create a modal:

```tsx
import { AccountProvisioningForm } from './components/AccountProvisioningForm';

export function YourComponent() {
  const [showProvisioningModal, setShowProvisioningModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowProvisioningModal(true)}>
        Connect MT5 Account
      </button>

      {showProvisioningModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full mx-4">
            <AccountProvisioningForm
              isDark={false}
              onSuccess={(accountId) => {
                console.log('Account created:', accountId);
                setShowProvisioningModal(false);
              }}
              onError={(error) => {
                console.error('Failed:', error);
              }}
              onClose={() => setShowProvisioningModal(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
```

---

## API Endpoints

### **1. Create Account (Direct Method)**

```bash
POST /api/accounts/provision/direct
Content-Type: application/json

{
  "fullName": "John Trader",
  "mt5Login": "123456",
  "mt5Password": "password123",
  "mt5Server": "ICMarketsSC-Demo",
  "userId": "user_xyz" // optional, for tracking
}
```

**Response:**
```json
{
  "success": true,
  "accountId": "abc123def456",
  "status": "DEPLOYING",
  "message": "Account created and deploying..."
}
```

### **2. Create Account (Draft Mode)**

```bash
POST /api/accounts/provision/draft
Content-Type: application/json

{
  "fullName": "John Trader",
  "mt5Server": "ICMarketsSC-Demo",
  "userId": "user_xyz"
}
```

**Response:**
```json
{
  "success": true,
  "accountId": "abc123def456",
  "configurationLink": "https://metaapi.cloud/accounts/abc123.../configure",
  "message": "User should click configurationLink to set password"
}
```

### **3. Check Deployment Status**

```bash
GET /api/accounts/abc123def456/status
```

**Response:**
```json
{
  "success": true,
  "accountId": "abc123def456",
  "status": "DEPLOYING",
  "dataCenter": "London (LD4)",
  "estimatedLatency": 22
}
```

Statuses:
- `UNDEPLOYED` - Just created, not started
- `DEPLOYING` - Cloud server spinning up (2-30 seconds)
- `DEPLOYED` - Ready to trade! ✅
- `DISCONNECTED` - Connection lost
- `ERROR` - Something went wrong

### **4. Get Account Stats**

```bash
GET /api/accounts/abc123def456/stats
```

**Response:**
```json
{
  "success": true,
  "balance": 10000.00,
  "equity": 9875.50,
  "currency": "USD"
}
```

### **5. List All Accounts**

```bash
GET /api/accounts/list
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "accounts": [
    {
      "id": "account1",
      "name": "John's Account",
      "state": "DEPLOYED",
      "login": "123456"
    }
  ]
}
```

---

## Frontend Flow (Direct Method)

```
1. User clicks "Connect MT5"
   ↓
2. Form appears with mode selection
   ↓
3. User chooses "Direct Method"
   ↓
4. User fills:
   - Full Name
   - MT5 Login
   - MT5 Password
   - MT5 Server
   ↓
5. Clicks "Connect Account"
   ↓
6. Frontend shows: "Creating your MT5 account..." (loading bar 0-40%)
   ↓
7. Backend calls MetaApi API
   ↓
8. Account created, starts deploying
   ↓
9. Frontend shows: "Deploying to cloud servers..." (loading bar 40-90%)
   ↓
10. Frontend polls /api/accounts/:id/status every 3 seconds
    ↓
11. Account reaches "DEPLOYED"
    ↓
12. Success! Show:
    - ✅ Checkmark
    - 📍 Data Center: London (LD4)
    - ⚡ Latency: 22ms
    ↓
13. onSuccess callback fired
```

---

## Frontend Flow (Draft Mode)

```
1. User clicks "Connect MT5"
   ↓
2. Form appears with mode selection
   ↓
3. User chooses "Draft Mode" (more secure)
   ↓
4. User fills:
   - Full Name
   - MT5 Server
   ↓
5. Clicks "Create Secure Link"
   ↓
6. Frontend shows: "Creating secure account..." (loading bar 0-30%)
   ↓
7. Backend calls MetaApi API WITHOUT PASSWORD
   ↓
8. Account created (still locked)
   ↓
9. Backend returns: configurationLink
   ↓
10. Frontend shows:
    - ✅ Checkmark
    - 📍 Data Center: London (LD4)
    - ⚡ Latency: 22ms
    - 🔗 Button: "Securely Connect to Impulse Hub"
    ↓
11. User clicks button
    ↓
12. Opens MetaApi's official secure page
    ↓
13. User enters their MT5 login and password
    ↓
14. MetaApi verifies credentials
    ↓
15. Account automatically deploys on MetaApi's server
    ↓
16. Account is now active and ready to trade
```

---

## Error Handling

### Common Errors

**Invalid MT5 Credentials**
```json
{
  "success": false,
  "error": "Invalid login or password for this MT5 account"
}
```

**Solution:** User should verify their credentials in their MT5 terminal

**Server Not Found**
```json
{
  "success": false,
  "error": "Server 'ICMarketsSC-XYZ' not found. Available servers: [list]"
}
```

**Solution:** Show dropdown of available servers instead of text input

**Network Timeout**
```json
{
  "success": false,
  "error": "MetaApi timeout - try again in a few seconds"
}
```

**Solution:** Implement retry button

---

## User Experience Tips

### ✅ DO

- ✅ Show loading bar with progress %
- ✅ Display success state with data center info
- ✅ Show latency badge (builds confidence)
- ✅ Use Draft Mode by default (more secure)
- ✅ Provide help text for each field
- ✅ Show which servers are available
- ✅ Allow copy-paste of credentials

### ❌ DON'T

- ❌ Don't store passwords in localStorage
- ❌ Don't show password in logs
- ❌ Don't make user wait without feedback
- ❌ Don't ask for unnecessary fields
- ❌ Don't fail silently (always show error messages)
- ❌ Don't require account info before provisioning

---

## Security Best Practices

### Passwords

```javascript
// ❌ DON'T: Store password
localStorage.setItem('password', userPassword);

// ✅ DO: Send only when creating account
const result = await api.post('/api/accounts/provision/direct', {
  password: userPassword
});
// Then forget it
```

### Draft Mode Advantage

```
Direct:  User Password → Your Server → MetaApi
Draft:   User Password → MetaApi Only ✅
```

### Environment Variables

```bash
# ❌ DON'T: Hardcode token
const token = 'abc123xyz789';

# ✅ DO: Use environment variables
const token = process.env.METAAPI_TOKEN;
```

---

## Testing

### Test Direct Method

```bash
curl -X POST http://localhost:3000/api/accounts/provision/direct \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "mt5Login": "123456",
    "mt5Password": "testpass",
    "mt5Server": "ICMarketsSC-Demo"
  }'
```

### Test Draft Mode

```bash
curl -X POST http://localhost:3000/api/accounts/provision/draft \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "mt5Server": "ICMarketsSC-Demo"
  }'
```

### Test Status Check

```bash
curl -X GET http://localhost:3000/api/accounts/abc123def456/status
```

---

## Database Schema (Optional)

If you want to track accounts in your database:

```sql
CREATE TABLE provisioned_accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  mt5_login VARCHAR(255),
  mt5_server VARCHAR(255),
  method ENUM('direct', 'draft'),
  status VARCHAR(50),
  configuration_link TEXT,
  data_center VARCHAR(255),
  estimated_latency INT,
  created_at TIMESTAMP,
  deployed_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Monitoring

### What to Track

```javascript
// After account is deployed:
console.log({
  accountId,
  deploymentTime: statusResponse.lastSyncTime,
  dataCenter: 'London (LD4)',
  latency: 22,
  success: true
});
```

### Dashboard Metrics

- Total accounts provisioned
- Average deployment time
- Success rate
- Common error types
- User retention (did they keep the account?)

---

## Next Steps

1. ✅ Copy MetaApi token to .env
2. ✅ Install dependencies
3. ✅ Integrate backend routes
4. ✅ Add frontend form to your UI
5. ✅ Test with demo MT5 account
6. ✅ Monitor real deployments
7. ✅ Gather user feedback

---

## Support

For MetaApi issues:
- Docs: https://metaapi.cloud/docs
- Support: support@metaapi.cloud

For Impulse Hub issues:
- Check if account is DEPLOYED
- Verify credentials are correct
- Check latency (if > 500ms, might be network issue)
