/**
 * Telegram Notification Service
 * 
 * This service handles sending notifications to users via Telegram Bot API.
 * It communicates with a Supabase Edge Function that manages the Telegram bot integration.
 * 
 * Setup Required:
 * 1. Create a Telegram Bot (@BotFather on Telegram)
 * 2. Store bot token in Supabase secrets
 * 3. Create Supabase Edge Function: supabase/functions/send-telegram-notification
 * 4. Enable CORS and configure function settings
 */

import { supabaseAuth } from './supabaseAuth';

export interface TelegramNotification {
  telegramId: string;
  message: string;
  type: 'trade-alert' | 'price-alert' | 'status' | 'error';
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

class TelegramNotificationService {
  private supabaseUrl: string;
  private supabaseAnonKey: string;

  constructor() {
    const projectId = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID;
    this.supabaseUrl = `https://${projectId}.supabase.co`;
    this.supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
  }

  /**
   * Sends a notification via Telegram to the user's registered Telegram ID
   * @param notification - The notification details
   * @returns Promise with notification result
   */
  async sendNotification(
    notification: TelegramNotification
  ): Promise<NotificationResult> {
    try {
      console.log('📱 Sending Telegram notification:', notification);

      // Validate Telegram ID
      if (!this._isValidTelegramId(notification.telegramId)) {
        throw new Error('Invalid Telegram ID format');
      }

      // Call Supabase Edge Function
      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/send-telegram-notification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.supabaseAnonKey}`,
          },
          body: JSON.stringify({
            telegramId: notification.telegramId,
            message: notification.message,
            type: notification.type,
            metadata: notification.metadata,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP ${response.status}: Failed to send notification`
        );
      }

      const data = await response.json();
      console.log('✅ Notification sent successfully:', data);

      return {
        success: true,
        messageId: data.messageId,
        timestamp: new Date(),
      };
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to send Telegram notification';
      console.error('❌ Notification error:', errorMsg);
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Sends a trade alert notification
   */
  async sendTradeAlert(
    telegramId: string,
    tradeData: {
      symbol: string;
      action: 'BUY' | 'SELL';
      price: number;
      quantity: number;
      confidence: number;
    }
  ): Promise<NotificationResult> {
    const message = this._formatTradeAlert(tradeData);
    return this.sendNotification({
      telegramId,
      message,
      type: 'trade-alert',
      metadata: tradeData,
    });
  }

  /**
   * Sends a price alert notification
   */
  async sendPriceAlert(
    telegramId: string,
    priceData: {
      symbol: string;
      currentPrice: number;
      targetPrice: number;
      priceChange: number;
    }
  ): Promise<NotificationResult> {
    const message = this._formatPriceAlert(priceData);
    return this.sendNotification({
      telegramId,
      message,
      type: 'price-alert',
      metadata: priceData,
    });
  }

  /**
   * Sends a status update notification
   */
  async sendStatusUpdate(
    telegramId: string,
    status: string
  ): Promise<NotificationResult> {
    return this.sendNotification({
      telegramId,
      message: `📊 Status Update: ${status}`,
      type: 'status',
    });
  }

  /**
   * Sends an error notification
   */
  async sendErrorNotification(
    telegramId: string,
    error: string
  ): Promise<NotificationResult> {
    return this.sendNotification({
      telegramId,
      message: `⚠️ Error: ${error}`,
      type: 'error',
    });
  }

  /**
   * Tests the Telegram connection by sending a test message
   */
  async sendTestMessage(telegramId: string): Promise<NotificationResult> {
    const testMessage = `🧪 Test Notification from Micromax Trading Bot\n\nIf you received this message, your Telegram notifications are properly configured! ✅\n\nYou'll now receive trade alerts from Micromax.`;

    return this.sendNotification({
      telegramId,
      message: testMessage,
      type: 'status',
    });
  }

  /**
   * Gets the notification status for current user
   */
  async getNotificationStatus(): Promise<{
    enabled: boolean;
    telegramId?: string;
    lastNotification?: Date;
    error?: string;
  }> {
    try {
      const user = await supabaseAuth.getCurrentUser();
      if (!user) {
        return { enabled: false, error: 'User not authenticated' };
      }

      if (!user.telegramId) {
        return { enabled: false, error: 'No Telegram ID configured' };
      }

      console.log('✅ Telegram notifications enabled for:', user.telegramId);
      return {
        enabled: true,
        telegramId: user.telegramId,
      };
    } catch (error: any) {
      console.error('❌ Error getting notification status:', error.message);
      return {
        enabled: false,
        error: error.message || 'Failed to get notification status',
      };
    }
  }

  /**
   * Validates Telegram ID format
   */
  private _isValidTelegramId(id: string): boolean {
    return /^\d{5,}$/.test(id.toString());
  }

  /**
   * Formats trade alert message
   */
  private _formatTradeAlert(data: {
    symbol: string;
    action: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    confidence: number;
  }): string {
    const emoji = data.action === 'BUY' ? '🟢' : '🔴';
    const confidence = Math.round(data.confidence * 100);
    return `${emoji} <b>Trading Alert</b>

<b>Symbol:</b> ${data.symbol}
<b>Action:</b> ${data.action}
<b>Price:</b> $${data.price.toFixed(2)}
<b>Quantity:</b> ${data.quantity}
<b>Confidence:</b> ${confidence}%

Act now while the opportunity is available!`;
  }

  /**
   * Formats price alert message
   */
  private _formatPriceAlert(data: {
    symbol: string;
    currentPrice: number;
    targetPrice: number;
    priceChange: number;
  }): string {
    const direction = data.priceChange >= 0 ? '📈' : '📉';
    const change = Math.abs(data.priceChange).toFixed(2);
    return `${direction} <b>Price Alert</b>

<b>Symbol:</b> ${data.symbol}
<b>Current Price:</b> $${data.currentPrice.toFixed(2)}
<b>Target Price:</b> $${data.targetPrice.toFixed(2)}
<b>Change:</b> ${data.priceChange >= 0 ? '+' : '-'}${change}%`;
  }
}

export const telegramNotificationService = new TelegramNotificationService();
