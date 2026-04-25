# Telegram Notification Integration Guide

Complete guide for integrating Telegram notifications into the Micromax Trading Bot.

## Overview

Users can receive real-time trading alerts directly on their Telegram account through a dedicated bot. This guide covers:

1. **Setting up a Telegram Bot** with BotFather
2. **Configuring Supabase** with Telegram bot token
3. **Deploying the Edge Function** to handle notifications
4. **Testing the integration** with the frontend UI

---

## Part 1: Create Telegram Bot (5 minutes)

### Step 1.1: Open BotFather

1. Open Telegram
2. Search for **@BotFather** (official Telegram bot creator)
3. Click the verified checkmark result
4. Click "START" button

### Step 1.2: Create New Bot

1. Type `/newbot` in the BotFather chat
2. Follow the prompts:
   - **Bot Display Name**: e.g., "Micromax Trading Bot"
   - **Bot Username**: e.g., "micromax_trading_bot" (must be unique and end with "bot")
   - Store the token BotFather provides

### Step 1.3: Copy Bot Token

BotFather will respond with:
```
Done! Congratulations on your new bot. 
You will find it at t.me/your_bot_name. 
You can now add a description, about section and commands.

Use this token to access the HTTP API:
1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh

Keep your token secure and store it safely!
```

**Save this token** - you'll need it for Supabase configuration.

### Step 1.4: Optional - Configure Bot Settings

In BotFather chat, you can configure:

- `/setcommands` - Add bot commands like `/myid` to show user's Telegram ID
- `/setdescription` - Add bot description
- `/setabouttext` - Information about the bot

---

## Part 2: Configure Supabase (10 minutes)

### Step 2.1: Add Bot Token to Supabase Secrets

1. Go to your Supabase dashboard
2. Navigate to **Settings > Edge Functions > Secrets**
3. Click "New Secret"
4. Configure:
   - **Name**: `TELEGRAM_BOT_TOKEN`
   - **Value**: Paste the token from BotFather (1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh)
   - Click "Add secret"

### Step 2.2: Verify Environment Variables

Ensure these variables are set in Supabase (most are default):
- `TELEGRAM_BOT_TOKEN` - Your bot token (just added)
- `SUPABASE_URL` - Your project URL (automatic)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (automatic)

---

## Part 3: Deploy Edge Function (5 minutes)

### Step 3.1: Install Supabase CLI

```bash
npm install -g supabase
```

### Step 3.2: Link Your Supabase Project

```bash
cd path/to/project
supabase login
supabase link --project-ref your_project_id
```

### Step 3.3: Deploy Edge Function

The file is located at: `supabase/functions/send-telegram-notification/index.ts`

Deploy it:

```bash
supabase functions deploy send-telegram-notification
```

Expected output:
```
✓ Function deployed successfully
  Endpoint: https://your_project_id.supabase.co/functions/v1/send-telegram-notification
```

### Step 3.4: Create Notification Logs Table (Optional)

For auditing, create a table in your Supabase database:

```sql
CREATE TABLE notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id VARCHAR NOT NULL,
  notification_type VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own logs
CREATE POLICY "Users can view their own logs" ON notification_logs
  FOR SELECT USING (auth.uid() = user_id);
```

---

## Part 4: Frontend Integration

### Step 4.1: Telegram ID Retrieval Flow

Users follow this process:

1. **Click "Open Telegram Bot"** button
2. **Chat with Micromax Bot** and type `/myid`
3. **Copy the numeric user ID** the bot returns (e.g., `123456789`)
4. **Paste ID** in the Telegram ID input field
5. **Save configuration** - notifications are now enabled

### Step 4.2: Components Used

**During Signup (LoginModal.tsx):**
- User enters Telegram ID as part of registration
- Real-time validation shows if ID is valid
- Success confirmation after account creation

**After Login (TelegramNotificationManager.tsx):**
- Users can view their current Telegram ID status
- Update Telegram ID anytime
- Send test notification to verify setup
- View notification history (if logs table exists)

---

## Part 5: Testing

### Step 5.1: Manual Test via Frontend

1. **Sign up a test account** with a Telegram ID
2. **Click "Send Test Notification"** button
3. Check your Telegram to receive the test message (should arrive in seconds)

### Step 5.2: Test via cURL (Direct API Test)

```bash
# Get your JWT token from Supabase Auth
TOKEN="your_auth_token_here"

curl -X POST \
  'https://your_project_id.supabase.co/functions/v1/send-telegram-notification' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "telegramId": "your_telegram_id",
    "message": "🧪 Test message from Micromax!",
    "type": "status"
  }'
```

Expected response:
```json
{
  "success": true,
  "messageId": 123456,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Step 5.3: Troubleshooting

**No message received:**
- ✓ Verify Telegram ID is correct (get it from `/myid` in bot)
- ✓ Check `TELEGRAM_BOT_TOKEN` is set in Supabase secrets
- ✓ Ensure bot token has no extra spaces
- ✓ You must have a Telegram account and have started the bot

**401 Unauthorized error:**
- ✓ Check if the JWT token is valid
- ✓ Verify user is authenticated before sending notification

**500 Internal Server Error:**
- ✓ Check Edge Function logs in Supabase dashboard (Logs tab)
- ✓ Verify bot token is correct
- ✓ Ensure message is not empty

---

## Part 6: Using Telegram Notifications in Code

### Send Trade Alert

```typescript
import { telegramNotificationService } from '@/services/telegramNotificationService';

const user = await supabaseAuth.getCurrentUser();
if (user?.telegramId) {
  await telegramNotificationService.sendTradeAlert(user.telegramId, {
    symbol: 'BTC/USD',
    action: 'BUY',
    price: 45250,
    quantity: 0.5,
    confidence: 0.85,
  });
}
```

### Send Price Alert

```typescript
await telegramNotificationService.sendPriceAlert(user.telegramId, {
  symbol: 'ETH/USD',
  currentPrice: 2850,
  targetPrice: 3000,
  priceChange: 5.3,
});
```

### Send Custom Message

```typescript
await telegramNotificationService.sendNotification({
  telegramId: user.telegramId,
  message: '🟢 Opportunity detected!\n\nSymbol: BTC/USD\nPrice: $45,250',
  type: 'trade-alert',
});
```

---

## Part 7: Production Checklist

Before going live:

- [ ] Telegram bot created and token secured
- [ ] `TELEGRAM_BOT_TOKEN` secret configured in Supabase
- [ ] Edge Function deployed successfully
- [ ] Test notification sent and received
- [ ] Notification logs table created (optional)
- [ ] Error handling working correctly
- [ ] User can see Telegram ID in settings
- [ ] Rate limiting configured (optional - add to Edge Function)
- [ ] Monitoring and alerts set up (optional)
- [ ] Privacy policy updated mentioning Telegram integration

---

## Part 8: User Experience Flow

### For New Users (Signup)

```
1. User enters email, password, name, phone
2. Prompted to enable Telegram notifications
3. Clicks "Open Telegram Bot" → opens t.me/your_bot
4. Types /myid in bot chat
5. Copies numeric ID (e.g., 123456789)
6. Pastes ID in signup form
7. Sees "✅ Valid Telegram ID - Notifications enabled!"
8. Completes signup
9. Receives welcome message on Telegram
```

### For Existing Users (Settings)

```
1. User clicks "Telegram Notifications" in settings
2. Can view current Telegram ID status
3. Option to update Telegram ID
4. Can send test notification
5. Receives confirmation message on Telegram
```

---

## Part 9: FAQ

**Q: Can I send messages to multiple Telegram chats?**
A: Yes, store multiple IDs in the user metadata and loop through them.

**Q: Are there rate limits?**
A: Telegram Bot API allows ~30-40 messages/second per bot. Consider adding rate limiting in the Edge Function.

**Q: Can users disable notifications?**
A: Yes, they can remove their Telegram ID from settings at anytime.

**Q: What if a user loses their Telegram account?**
A: They can get a new ID with `/myid` command and update settings.

**Q: How long do messages take to arrive?**
A: Usually instant (< 1 second), unless Telegram API has issues.

**Q: Can I customize the message formatting?**
A: Yes, the telegramNotificationService has methods for different message types. Customize HTML formatting as needed.

---

## Support & Resources

- **Telegram Bot Documentation**: https://core.telegram.org/bots/api
- **BotFather Help**: Search "BotFather" on Telegram
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **Supabase CLI**: https://supabase.com/docs/guides/cli
