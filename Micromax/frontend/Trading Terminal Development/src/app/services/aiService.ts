import { serverFunctionBaseUrl } from './supabaseConfig';

// AI Model Types
export type AIModel = 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3-opus' | 'claude-3-sonnet' | 'micromax';

// Configuration interface
export interface AIConfig {
  openaiApiKey?: string;
}

// Message interface
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

// Rate limiting interface
interface RateLimitData {
  messageCount: number;
  tokenCount: number;
  lastReset: number;
}

class AIService {
  private config: AIConfig = {};
  private googleApiKey: string = '';
  private workingModel: string = '';
  
  // Rate limiting constants (free tier limits)
  private readonly MAX_MESSAGES_PER_DAY = 50;
  private readonly MAX_TOKENS_PER_DAY = 25000;
  private readonly RATE_LIMIT_RESET_MS = 24 * 60 * 60 * 1000; // 24 hours
  
  // Models to try in order (latest available models)
  private readonly MODELS_TO_TRY = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-pro-latest',
  ];

  constructor() {
    // Get API key from environment
    this.googleApiKey = import.meta.env.VITE_GOOGLE_API_KEY || '';
    if (this.googleApiKey) {
      console.log('✅ Google Gemini API key loaded successfully');
    } else {
      console.warn('⚠️ Google Gemini API key not found in environment');
    }
    
    // Try to load cached working model
    const cached = localStorage.getItem('micromax_working_gemini_model');
    if (cached) {
      this.workingModel = cached;
      console.log(`📦 Using cached Gemini model: ${this.workingModel}`);
    }
  }

  private normalizeText(text: string): string {
    return text
      .replace(/âœ…/g, '✅')
      .replace(/âš ï¸/g, '⚠️')
      .replace(/âŒ/g, '❌')
      .replace(/ðŸ‘‹/g, '👋')
      .replace(/ðŸ“Š/g, '📊')
      .replace(/ðŸ“¸/g, '📸')
      .replace(/ðŸŽ¯/g, '🎯')
      .replace(/ðŸ“‹/g, '📋')
      .replace(/ðŸ“ˆ/g, '📈')
      .replace(/ðŸŸ¢/g, '🟢')
      .replace(/ðŸ’¡/g, '💡')
      .replace(/â€¢/g, '•')
      .replace(/â‰ˆ/g, '≈');
  }

  // Rate limiting check
  private checkRateLimit(): { allowed: boolean; message?: string; remaining?: { messages: number; tokens: number } } {
    const rateLimitData = this.getRateLimitData();
    const now = Date.now();
    
    // Reset if 24 hours have passed
    if (now - rateLimitData.lastReset > this.RATE_LIMIT_RESET_MS) {
      this.resetRateLimit();
      return { 
        allowed: true, 
        remaining: { 
          messages: this.MAX_MESSAGES_PER_DAY, 
          tokens: this.MAX_TOKENS_PER_DAY 
        } 
      };
    }
    
    // Check limits
    if (rateLimitData.messageCount >= this.MAX_MESSAGES_PER_DAY) {
      const hoursUntilReset = Math.ceil((this.RATE_LIMIT_RESET_MS - (now - rateLimitData.lastReset)) / (60 * 60 * 1000));
      return { 
        allowed: false, 
        message: `Daily message limit reached (${this.MAX_MESSAGES_PER_DAY}). Resets in ${hoursUntilReset} hours.` 
      };
    }
    
    if (rateLimitData.tokenCount >= this.MAX_TOKENS_PER_DAY) {
      const hoursUntilReset = Math.ceil((this.RATE_LIMIT_RESET_MS - (now - rateLimitData.lastReset)) / (60 * 60 * 1000));
      return { 
        allowed: false, 
        message: `Daily token limit reached (${this.MAX_TOKENS_PER_DAY}). Resets in ${hoursUntilReset} hours.` 
      };
    }
    
    return { 
      allowed: true,
      remaining: {
        messages: this.MAX_MESSAGES_PER_DAY - rateLimitData.messageCount,
        tokens: this.MAX_TOKENS_PER_DAY - rateLimitData.tokenCount
      }
    };
  }

  private getRateLimitData(): RateLimitData {
    const stored = localStorage.getItem('rate_limit_data');
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      messageCount: 0,
      tokenCount: 0,
      lastReset: Date.now()
    };
  }

  private updateRateLimit(tokensUsed: number) {
    const data = this.getRateLimitData();
    data.messageCount += 1;
    data.tokenCount += tokensUsed;
    localStorage.setItem('rate_limit_data', JSON.stringify(data));
  }

  private resetRateLimit() {
    const data: RateLimitData = {
      messageCount: 0,
      tokenCount: 0,
      lastReset: Date.now()
    };
    localStorage.setItem('rate_limit_data', JSON.stringify(data));
  }

  public getRateLimitStatus() {
    return this.checkRateLimit();
  }

  // Update API keys
  public setApiKey(provider: 'openai' | 'anthropic' | 'micromax', apiKey: string) {
    switch (provider) {
      case 'openai':
        this.config.openaiApiKey = apiKey;
        break;
      default:
        throw new Error(`${provider} is handled by the server configuration.`);
    }
  }

  // Check if API keys are configured
  public hasApiKey(provider: 'openai' | 'anthropic' | 'micromax'): boolean {
    switch (provider) {
      case 'openai':
      case 'anthropic':
      case 'micromax':
        return true;
    }
  }

  // Main chat completion method
  public async chat(
    messages: AIMessage[],
    model: AIModel = 'gpt-3.5-turbo',
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<string> {
    // Check rate limits first
    const rateLimitCheck = this.checkRateLimit();
    if (!rateLimitCheck.allowed) {
      throw new Error(rateLimitCheck.message);
    }

    const systemPrompt = options?.systemPrompt || 
      "You are Micromax, an expert AI trading assistant. You specialize in technical analysis, chart patterns, trading signals, and risk management. Provide concise, actionable insights for traders.";

    const allMessages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    try {
      const response = this.normalizeText(await this.chatWithServer(allMessages, model, options));
      
      // Estimate tokens used (rough approximation: 1 token ≈ 4 characters)
      const tokensUsed = Math.ceil((response.length + JSON.stringify(messages).length) / 4);
      this.updateRateLimit(tokensUsed);
      
      return response;
    } catch (error) {
      console.error('AI Service Error:', error);
      
      // Still update rate limit for failed attempts
      this.updateRateLimit(100);
      
      // Fallback to mock response if API fails
      return this.normalizeText(this.getMockResponse(messages[messages.length - 1]?.content?.toString() || ''));
    }
  }

  private async chatWithServer(
    messages: AIMessage[],
    model: AIModel,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    // Use Google Gemini API directly if API key is available
    if (this.googleApiKey) {
      console.log('🚀 Calling Google Gemini API directly...');
      return this.callGoogleGeminiAPI(messages, options);
    }

    console.log('⚠️ Google Gemini API key not available, falling back to mock response');
    
    // Fallback to mock response
    return this.normalizeText(this.getMockResponse(messages[messages.length - 1]?.content?.toString() || ''));
  }

  private async callGoogleGeminiAPI(
    messages: AIMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    try {
      // Convert messages to Google format, excluding system messages
      const contents = messages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ 
            text: typeof msg.content === 'string' ? msg.content : 
                  Array.isArray(msg.content) ? msg.content.map(c => c.text || c.type).join('\n') : '' 
          }],
        }));

      // Ensure we have at least one user message
      if (contents.length === 0) {
        return this.normalizeText(this.getMockResponse('No message to send'));
      }

      const requestBody = {
        contents: contents,
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 1400,
        },
      };

      console.log('📤 Sending to Google Gemini:', { messageCount: messages.length, apiKeyExists: !!this.googleApiKey });

      // Try cached model first, then fallback to trying all models
      const modelsToTry = this.workingModel 
        ? [this.workingModel, ...this.MODELS_TO_TRY.filter(m => m !== this.workingModel)]
        : this.MODELS_TO_TRY;

      let allFailed = true;
      let lastError: string = '';
      
      for (const model of modelsToTry) {
        try {
          console.log(`🔄 Trying model: ${model}`);
          
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.googleApiKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(10000), // 10 second timeout
            }
          );

          const payload = await response.json();
          
          if (!response.ok) {
            const errorMsg = payload?.error?.message || `API failed with status ${response.status}`;
            console.warn(`⚠️ Model ${model} failed: ${errorMsg}`);
            lastError = errorMsg;
            continue; // Try next model
          }

          // Success! Cache this model
          allFailed = false;
          this.workingModel = model;
          localStorage.setItem('micromax_working_gemini_model', model);
          console.log(`✅ Model ${model} works! Cached for next time.`);
          
          const responseText = this.normalizeText(payload.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated');
          console.log('✅ Google Gemini Response:', responseText.substring(0, 150) + '...');
          
          return responseText;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.warn(`⚠️ Model ${model} error: ${errorMsg}`);
          lastError = errorMsg;
          continue; // Try next model
        }
      }

      // All models failed - try to diagnose the issue
      if (allFailed) {
        console.error('❌ All Gemini models failed. Attempting to diagnose...');
        
        // Try to list available models to diagnose the issue
        try {
          const listResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${this.googleApiKey}`,
            { method: 'GET', signal: AbortSignal.timeout(5000) }
          );
          const listPayload = await listResponse.json();
          
          if (listResponse.ok && listPayload.models) {
            console.log('📋 Available models:', listPayload.models.map((m: any) => m.name));
            // Try the first available model
            const firstModel = listPayload.models[0]?.name?.split('/')?.pop();
            if (firstModel) {
              console.log(`🔄 Trying first available model: ${firstModel}`);
              const retryResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${firstModel}:generateContent?key=${this.googleApiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestBody),
                  signal: AbortSignal.timeout(10000),
                }
              );
              const retryPayload = await retryResponse.json();
              if (retryResponse.ok) {
                this.workingModel = firstModel;
                localStorage.setItem('micromax_working_gemini_model', firstModel);
                const responseText = this.normalizeText(retryPayload.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated');
                console.log(`✅ Model ${firstModel} works!`);
                return responseText;
              }
            }
          } else {
            console.error('❌ API Key Issue - ListModels failed:', listPayload?.error?.message || 'Unknown error');
            console.error('💡 Verify your Google Gemini API key is valid and enabled');
          }
        } catch (diagError) {
          console.error('❌ Diagnosis failed:', diagError instanceof Error ? diagError.message : String(diagError));
        }
      }

      // Final fallback to mock response
      console.log('📦 Using mock response (API unavailable or invalid key)');
      console.log('💡 To fix: 1) Verify API key in .env, 2) Enable Generative AI API in Google Cloud Console, 3) Ensure quota/billing is active');
      
      return this.normalizeText(this.getMockResponse(messages[messages.length - 1]?.content?.toString() || ''));
    } catch (error) {
      console.error('❌ Google Gemini API Call Failed:', error);
      console.log('📦 Using mock response');
      return this.normalizeText(this.getMockResponse(messages[messages.length - 1]?.content?.toString() || ''));
    }
  }

  // Mock response for fallback or demo
  private getMockResponse(userInput: string, isMicromax: boolean = false): string {
    const lowerInput = userInput.toLowerCase();

    if (lowerInput.includes('screenshot') || lowerInput.includes('chart') || lowerInput.includes('analyze')) {
      return `📸 Chart Analysis:\n\n• Pattern: Bullish divergence forming on RSI\n• Price Action: Lower lows vs RSI higher lows\n• Momentum: Building upward pressure\n• Key Level: Strong support at $70,500\n• Signal: Potential long entry at $71,200\n• Target: $73,500 (3.2% gain)\n• Stop Loss: $69,800 (-2.0%)\n• Risk/Reward: 1:1.6\n• Confidence: 76%\n\n⚠️ Wait for confirmation above $71,500 with volume spike.`;
    }

    if (lowerInput.includes('signal') || lowerInput.includes('trade') || lowerInput.includes('buy') || lowerInput.includes('sell')) {
      return `📊 ${isMicromax ? 'Micromax' : 'Trading'} Signal:\n\n🟢 BUY Signal Detected\n\nSymbol: BTC/USDT\nEntry: $71,270\nTargets:\n• TP1: $72,800 (+2.1%)\n• TP2: $73,500 (+3.1%)\n• TP3: $74,900 (+5.1%)\n\nStop Loss: $69,800 (-2.1%)\nPosition Size: 2-3% of portfolio\nTimeframe: 4H\nConfidence: ${isMicromax ? '82%' : '76%'}\n\n✅ Indicators aligned: RSI(55), MACD bullish crossover, Volume increasing`;
    }

    if (lowerInput.includes('support') || lowerInput.includes('resistance') || lowerInput.includes('level')) {
      return `🎯 Key Levels Analysis:\n\nSupport Zones:\n• S1: $70,500 (Strong)\n• S2: $69,200 (Medium)\n• S3: $68,000 (Weekly)\n\nResistance Zones:\n• R1: $72,800 (Current test)\n• R2: $74,500 (Major)\n• R3: $76,200 (ATH proximity)\n\nCurrent Price: Testing R1\nBias: Bullish above $70,500\nBreakout target: $76,000+`;
    }

    if (lowerInput.includes('risk') || lowerInput.includes('position') || lowerInput.includes('size')) {
      return `⚖️ Risk Management:\n\nRecommended Position Sizing:\n• Conservative: 1-2% per trade\n• Moderate: 2-3% per trade\n• Aggressive: 3-5% per trade\n\nCurrent Market Conditions:\n• Volatility: Moderate (14%)\n• Trend: Bullish short-term\n• Risk Level: Medium\n\n💡 Never risk more than 1% on a single trade. Use stop losses always.`;
    }

    if (lowerInput.includes('strategy') || lowerInput.includes('plan')) {
      return `📋 Trading Strategy:\n\n1. Wait for Setup\n   • Confluence of 2+ indicators\n   • Volume confirmation\n   • Key level approach\n\n2. Entry Rules\n   • Buy: Break & retest\n   • Sell: Rejection at resistance\n   • Scale in: 50%-30%-20%\n\n3. Exit Strategy\n   • Take partial profits at TP1\n   • Move SL to breakeven\n   • Trail stop for remaining position\n\n4. Risk Management\n   • Max 3 concurrent positions\n   • 2:1 minimum R/R ratio`;
    }

    return `I'm ${isMicromax ? 'Micromax, your specialized trading AI' : 'your AI assistant'}. I can help you with:\n\n📊 Trade signals & analysis\n📈 Chart pattern recognition\n🎯 Support/resistance levels\n⚖️ Risk management advice\n📋 Strategy development\n📸 Screenshot analysis\n\nWhat would you like to explore?`;
  }

  // Analyze screenshot using Google Gemini Vision API
  public async analyzeChartScreenshot(
    imageBase64: string,
    userQuery?: string
  ): Promise<string> {
    // Check rate limits
    const rateLimitCheck = this.checkRateLimit();
    if (!rateLimitCheck.allowed) {
      throw new Error(rateLimitCheck.message);
    }

    if (!this.googleApiKey) {
      throw new Error('Chart analysis is unavailable because the Gemini API key is missing.');
    }

    try {
      console.log('🚀 Analyzing chart screenshot with Google Gemini Vision API...');

      // Prepare the request with image data
      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: userQuery || 'Please analyze this trading chart. Tell me what you see: chart patterns, technical levels, support/resistance, any drawings or analysis visible, price action, indicators, and any trading signals.'
              },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageBase64.replace(/^data:image\/jpeg;base64,/, '').replace(/^data:image\/png;base64,/, '')
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        }
      };

      console.log('📤 Sending image to Google Gemini Vision API...');

      // Try cached model first
      const modelsToTry = this.workingModel 
        ? [this.workingModel, ...this.MODELS_TO_TRY.filter(m => m !== this.workingModel)]
        : this.MODELS_TO_TRY;
      let lastVisionError = 'Chart analysis is temporarily unavailable. Please try again in a moment.';

      for (const model of modelsToTry) {
        try {
          console.log(`🔄 Trying vision model: ${model}`);
          
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.googleApiKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(30000), // 30 second timeout for image processing
            }
          );

          const payload = await response.json();
          
          if (!response.ok) {
            const errorMsg = payload?.error?.message || `API failed with status ${response.status}`;
            lastVisionError = this.getChartAnalysisErrorMessage(errorMsg, response.status);
            console.warn(`⚠️ Model ${model} failed: ${errorMsg}`);
            continue;
          }

          // Success!
          this.workingModel = model;
          localStorage.setItem('micromax_working_gemini_model', model);
          console.log(`✅ Vision model ${model} works!`);
          
          const analysisText = this.normalizeText(payload.candidates?.[0]?.content?.parts?.[0]?.text || 'Analysis failed');
          const finishReason = payload.candidates?.[0]?.finishReason || 'UNKNOWN';
          console.log('✅ Chart Analysis Finish Reason:', finishReason);
          console.log('✅ Chart Analysis Length:', analysisText.length);
          console.log('✅ Chart Analysis Preview:', analysisText.slice(0, 400));
          
          // Update rate limit with token estimate
          this.updateRateLimit(Math.ceil(analysisText.length / 4) + 300);
          
          return analysisText;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          lastVisionError = this.getChartAnalysisErrorMessage(errorMsg);
          console.warn(`⚠️ Vision model ${model} error: ${errorMsg}`);
          continue;
        }
      }

      // All models failed
      console.error('❌ All vision models failed');
      throw new Error(lastVisionError);

    } catch (error) {
      console.error('Screenshot analysis error:', error);
      throw error instanceof Error
        ? error
        : new Error('Chart analysis failed. Please try again.');
    }
  }

  private getChartAnalysisErrorMessage(message: string, status?: number): string {
    const normalized = message.toLowerCase();

    if (normalized.includes('timed out') || normalized.includes('timeout')) {
      return 'The AI chart analysis took too long to respond. Please try again in a few moments.';
    }

    if (
      status === 429 ||
      normalized.includes('quota exceeded') ||
      normalized.includes('too many requests') ||
      normalized.includes('rate limit')
    ) {
      return 'The AI chart analysis limit has been reached right now. Please wait a bit and try again.';
    }

    if (normalized.includes('api key')) {
      return 'The AI chart analysis service is not configured correctly right now.';
    }

    return 'The AI chart analysis service is unavailable right now. Please try again shortly.';
  }

  // Parse trading strategy description and convert to code logic
  public async parseStrategyDescription(strategyDescription: string, strategyName?: string): Promise<{
    name: string;
    description: string;
    code: string;
    entryRules: string[];
    exitRules: string[];
    riskRules: string[];
  }> {
    try {
      const prompt = `You are a trading strategy expert. Analyze this trading strategy description and convert it to code logic structure.

Strategy Description: "${strategyDescription}"

Provide a JSON response with:
{
  "name": "Strategy Name (auto-generated if not provided)",
  "entryRules": ["rule 1", "rule 2", ...],
  "exitRules": ["rule 1", "rule 2", ...],
  "riskRules": ["rule 1", "rule 2", ...],
  "code": "JavaScript-like pseudocode for the strategy"
}

Make sure the code is clear, commented, and implementable.`;

      const response = await this.sendMessage(
        [
          {
            role: 'system',
            content: 'You are a trading strategy expert that converts strategy descriptions into code logic and rules.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        'gemini-2.5-flash'
      );

      // Parse the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse strategy response');
      }

      const strategyData = JSON.parse(jsonMatch[0]);
      return {
        name: strategyName || strategyData.name || 'Custom Strategy',
        description: strategyDescription,
        code: strategyData.code,
        entryRules: strategyData.entryRules || [],
        exitRules: strategyData.exitRules || [],
        riskRules: strategyData.riskRules || [],
      };
    } catch (error) {
      console.error('Error parsing strategy:', error);
      // Return a structured default response for fallback
      return {
        name: strategyName || 'Custom Strategy',
        description: strategyDescription,
        code: `// ${strategyName || 'Custom'} Strategy\nmodule.exports = {\n  name: "${strategyName || 'Custom Strategy'}",\n  onTick(symbol, price, indicators) {\n    // Implement your strategy logic here\n    return null;\n  }\n};`,
        entryRules: ['Setup: Describe your entry conditions'],
        exitRules: ['Exit: Describe your exit conditions'],
        riskRules: ['Risk: Define your risk management rules'],
      };
    }
  }
}

// Export singleton instance
export const aiService = new AIService();
