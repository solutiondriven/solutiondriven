/**
 * Supabase Edge Function: send-telegram-notification
 * 
 * This function handles sending messages to users via Telegram Bot API.
 * It runs on Supabase's Edge Functions (Deno runtime).
 * 
 * Setup Instructions:
 * 1. Place this file at: supabase/functions/send-telegram-notification/index.ts
 * 2. Set the TELEGRAM_BOT_TOKEN environment variable in Supabase
 * 3. Deploy with: supabase functions deploy send-telegram-notification
 * 
 * Get Telegram Bot Token:
 * - Chat with @BotFather on Telegram
 * - Use /newbot command
 * - Follow instructions to create bot
 * - Copy and provide token to Supabase secrets
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_API_URL = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN;

interface NotificationRequest {
  telegramId: string;
  message: string;
  type: 'trade-alert' | 'price-alert' | 'status' | 'error';
  metadata?: Record<string, any>;
}

interface NotificationResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
}

/**
 * Validates the Telegram user ID format
 */
function validateTelegramId(id: string): boolean {
  return /^\d{5,}$/.test(id.toString());
}

/**
 * Sends a message via Telegram Bot API
 */
async function sendTelegramMessage(
  chatId: string,
  message: string
): Promise<{ messageId: string; ok: boolean }> {
  const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Telegram API error:', error);
    throw new Error(error.description || 'Failed to send Telegram message');
  }

  const data = await response.json();
  return {
    messageId: data.result.message_id,
    ok: data.ok,
  };
}

/**
 * Logs notification to Supabase for auditing
 */
async function logNotification(
  supabaseClient: any,
  userId: string,
  telegramId: string,
  notificationType: string,
  status: 'sent' | 'failed',
  error?: string
): Promise<void> {
  try {
    await supabaseClient
      .from('notification_logs')
      .insert({
        user_id: userId,
        telegram_id: telegramId,
        notification_type: notificationType,
        status,
        error,
        sent_at: new Date().toISOString(),
      });
  } catch (logError) {
    console.error('Failed to log notification:', logError);
  }
}

/**
 * Main handler for the Edge Function
 */
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('OK', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    // Validate bot token
    if (!TELEGRAM_BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN not configured');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Telegram bot not configured',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const body: NotificationRequest = await req.json();
    const { telegramId, message, type } = body;

    console.log('Processing notification:', { telegramId, type });

    // Validate input
    if (!telegramId || !message || !type) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: telegramId, message, type',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate Telegram ID format
    if (!validateTelegramId(telegramId)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid Telegram ID format',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract user ID from JWT token (if available)
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        // Decode JWT (simple decode - in production, validate the signature)
        const parts = token.split('.');
        if (parts.length === 3) {
          const decoded = JSON.parse(
            atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
          );
          userId = decoded.sub;
        }
      } catch (decodeError) {
        console.warn('Failed to extract user ID from token:', decodeError);
      }
    }

    // Send Telegram message
    const result = await sendTelegramMessage(telegramId, message);
    console.log('✅ Message sent to Telegram:', result.messageId);

    // Initialize Supabase client for logging (optional)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl && supabaseServiceKey && userId) {
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
      await logNotification(
        supabaseClient,
        userId,
        telegramId,
        type,
        'sent'
      );
    }

    // Return success response
    const response: NotificationResponse = {
      success: true,
      messageId: result.messageId,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('❌ Error in send-telegram-notification:', error);

    const response: NotificationResponse = {
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
