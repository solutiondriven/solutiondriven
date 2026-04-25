import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Send, Plus, Mic, Camera, X, Scissors, Monitor, Volume2, Square, FileText } from 'lucide-react';
import micromaxIcon from '../../assets/73f953c01b2738ff43765b998d2ccf278acf751e.png';
import { aiService, AIMessage } from '../services/aiService';
import { supabaseAuth } from '../services/supabaseAuth';
import { ScreenShareService } from '../services/screenShareService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  hasImage?: boolean;
}

interface Transcript {
  id: string;
  date: Date;
  duration: number;
  messageCount: number;
  messages: Message[];
}

interface StoredTranscript {
  id: string;
  date: string;
  duration: number;
  messageCount: number;
  messages: Array<Omit<Message, 'timestamp'> & { timestamp: string }>;
}

interface FloatingMicromaxProps {
  isDark: boolean;
}

// Chart Capture Overlay Component - renders animation directly on the trading chart viewport
// Uses React Portal to render at document root level, completely outside the modal z-stacking context
function ChartCaptureOverlay({ isCapturing, isDark }: { isCapturing: boolean; isDark: boolean }) {
  const [chartElement, setChartElement] = useState<HTMLElement | null>(null);
  const [chartRect, setChartRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const updateChartMetrics = () => {
      const chart = document.getElementById('tradingview_chart');
      setChartElement(chart);
      setChartRect(chart ? chart.getBoundingClientRect() : null);
    };

    updateChartMetrics();
    window.addEventListener('resize', updateChartMetrics);
    window.addEventListener('scroll', updateChartMetrics, true);

    return () => {
      window.removeEventListener('resize', updateChartMetrics);
      window.removeEventListener('scroll', updateChartMetrics, true);
    };
  }, [isCapturing]);

  if (!isCapturing || !chartElement || !chartRect) {
    return null;
  }
  
  const overlay = (
    <>
      {/* Portal-like div to ensure overlay is truly above everything on the viewport */}
      <div
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          inset: 0,
          zIndex: 99999,
        }}
      >
        <div
          style={{
            position: 'fixed',
            top: chartRect.top,
            left: chartRect.left,
            width: chartRect.width,
            height: chartRect.height,
            zIndex: 99999,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {/* Overlay background */}
          <div className="absolute inset-0 bg-white/10 animate-pulse" />
          
          {/* Pulsing border */}
          <div 
            className={`absolute inset-0 border-4 ${isDark ? 'border-[#2a2a2a]' : 'border-[#e8e8e8]'} animate-ping`} 
            style={{ animationDuration: '0.8s' }}
          />
          
          {/* Center text - Show on entire chart viewport */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`${isDark ? 'bg-white/90 border-[#d0d0d0]' : 'bg-[#1a1a1a]/90 border-[#3a3a3a]'} backdrop-blur-xl px-8 py-4 rounded-2xl border shadow-2xl`}>
              <div className="flex items-center gap-3">
                <Scissors className={`w-6 h-6 ${isDark ? 'text-[#2a2a2a]' : 'text-[#e8e8e8]'} animate-bounce`} />
                <span className={`${isDark ? 'text-[#2a2a2a]' : 'text-[#e8e8e8]'} font-medium`}>Capturing chart...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // Render overlay using React Portal to ensure it's at document root level
  // This ensures it appears ABOVE the chat modal, not inside it
  return createPortal(overlay, document.body);
}

function sanitizeClonedTree(source: HTMLElement, clone: HTMLElement) {
  const sourceNodes = [source, ...Array.from(source.querySelectorAll<HTMLElement>('*'))];
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];

  sourceNodes.forEach((sourceNode, index) => {
    const cloneNode = cloneNodes[index];
    if (!cloneNode) return;

    const computed = window.getComputedStyle(sourceNode);
    const safeStyles: string[] = [];

    for (const property of Array.from(computed)) {
      const value = computed.getPropertyValue(property);
      if (!value || value.includes('oklch(')) continue;
      safeStyles.push(`${property}: ${value};`);
    }

    cloneNode.style.cssText = safeStyles.join(' ');
  });
}

function normalizeLegacyText(text: string) {
  return text
    .replace(/ðŸ‘‹/g, '👋')
    .replace(/ðŸ“Š/g, '📊')
    .replace(/ðŸ“¸/g, '📸')
    .replace(/ðŸŽ¯/g, '🎯')
    .replace(/ðŸ“‹/g, '📋')
    .replace(/ðŸ“ˆ/g, '📈')
    .replace(/ðŸŸ¢/g, '🟢')
    .replace(/ðŸ’¡/g, '💡')
    .replace(/â€¢/g, '•')
    .replace(/âœ…/g, '✅')
    .replace(/â¹ï¸/g, '⏹️');
}

function formatMessageText(text: string) {
  return normalizeLegacyText(text)
    .replace(/ðŸ‘‹/g, '\u{1F44B}')
    .replace(/ðŸ“Š/g, '\u{1F4CA}')
    .replace(/ðŸ“¸/g, '\u{1F4F8}')
    .replace(/ðŸŽ¯/g, '\u{1F3AF}')
    .replace(/ðŸ“‹/g, '\u{1F4CB}')
    .replace(/ðŸ“ˆ/g, '\u{1F4C8}')
    .replace(/ðŸŸ¢/g, '\u{1F7E2}')
    .replace(/ðŸ’¡/g, '\u{1F4A1}')
    .replace(/â€¢/g, '\u2022')
    .replace(/âœ…/g, '\u2705')
    .replace(/â¹ï¸/g, '\u23F9\uFE0F');
}

const createWelcomeMessage = (): Message => ({
  id: '1',
  role: 'assistant',
  content: "Hi! I'm Micromax, your AI trading assistant. ðŸ‘‹\n\nðŸ“Š I can analyze your trading charts in real-time. Click the Monitor button (ðŸ“Š) to share your screen, and I'll continuously watch for:\nâ€¢ Technical patterns & trends\nâ€¢ Support & resistance levels\nâ€¢ Chart patterns & signals\nâ€¢ Price movements\n\nYou can also ask me about chart patterns, strategies, or share a screenshot for one-time analysis.",
  timestamp: new Date(),
});

const createFreshMessages = (): Message[] => [createWelcomeMessage()];

export function FloatingMicromax({ isDark }: FloatingMicromaxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'transcript'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Micromax, your AI trading assistant. 👋\n\n📊 I can analyze your trading charts in real-time. Click the Monitor button (📊) to share your screen, and I'll continuously watch for:\n• Technical patterns & trends\n• Support & resistance levels\n• Chart patterns & signals\n• Price movements\n\nYou can also ask me about chart patterns, strategies, or share a screenshot for one-time analysis.",
      timestamp: new Date(),
    },
  ]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ messages: number; tokens: number } | null>(null);
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | 'elite' | 'unlimited'>('free');
  const [usageLimits, setUsageLimits] = useState({ screenshots: 0, screenShare: 0, sessions: 0 });
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [windowSize, setWindowSize] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 1024, height: typeof window !== 'undefined' ? window.innerHeight : 768 });
  const [streamingStats, setStreamingStats] = useState({ fps: 0, sent: 0, total: 0 });
  const [widgetPosition, setWidgetPosition] = useState({ x: typeof window !== 'undefined' ? (window.innerWidth / 2 - 150) : 512, y: typeof window !== 'undefined' ? window.innerHeight - 95 : 673 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [currentUserId, setCurrentUserId] = useState('guest');
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const screenShareServiceRef = useRef<ScreenShareService | null>(null);
  const transcriptStorageKey = `micromax_transcripts_${currentUserId}`;

  // Drag handler using useCallback
  const handleWidgetMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return;
    }
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - widgetPosition.x,
      y: e.clientY - widgetPosition.y
    });
  }, [widgetPosition]);

  // Handle window resize and orientation changes
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Load user plan and usage limits
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = await supabaseAuth.getCurrentUser();
        if (user) {
          setCurrentUserId(user.id);
          setUserPlan(user.plan || 'free');
          setUsageLimits({
            screenshots: user.screenshotCount || 0,
            screenShare: user.screenShareCount || 0,
            sessions: user.sessionCount || 0,
          });
        } else {
          setCurrentUserId('guest');
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };
    
    loadUserData();
    setSessionStartTime(new Date());
  }, []);

  useEffect(() => {
    const storedTranscripts = localStorage.getItem(transcriptStorageKey);
    if (!storedTranscripts) {
      setTranscripts([]);
      setSelectedTranscriptId(null);
      return;
    }

    try {
      const parsed = JSON.parse(storedTranscripts) as StoredTranscript[];
      const hydratedTranscripts: Transcript[] = parsed.map((transcript) => ({
        ...transcript,
        date: new Date(transcript.date),
        messages: transcript.messages.map((message) => ({
          ...message,
          timestamp: new Date(message.timestamp),
        })),
      }));

      setTranscripts(hydratedTranscripts);
      setSelectedTranscriptId(hydratedTranscripts[0]?.id || null);
    } catch (error) {
      console.error('Failed to load transcripts:', error);
      setTranscripts([]);
      setSelectedTranscriptId(null);
    }
  }, [transcriptStorageKey]);

  useEffect(() => {
    const serialized: StoredTranscript[] = transcripts.map((transcript) => ({
      ...transcript,
      date: transcript.date.toISOString(),
      messages: transcript.messages.map((message) => ({
        ...message,
        timestamp: message.timestamp.toISOString(),
      })),
    }));

    localStorage.setItem(transcriptStorageKey, JSON.stringify(serialized));
  }, [transcripts, transcriptStorageKey]);

  // Get limits based on plan
  const getPlanLimits = () => {
    const limits = {
      free: { screenshots: 3, screenShare: 1, messagesPerDay: 50 },
      pro: { screenshots: 20, screenShare: 10, messagesPerDay: 200 },
      elite: { screenshots: 100, screenShare: 50, messagesPerDay: 1000 },
      unlimited: { screenshots: -1, screenShare: -1, messagesPerDay: -1 },
    };
    return limits[userPlan];
  };

  // Check if feature is available
  const canUseFeature = (feature: 'screenshot' | 'screenShare') => {
    const limits = getPlanLimits();
    if (limits[feature as keyof typeof limits] === -1) return true; // Unlimited plan
    if (feature === 'screenshot') return usageLimits.screenshots < limits.screenshots;
    if (feature === 'screenShare') return true;
    return false;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const stopScreenShare = useCallback((reason: 'manual' | 'ended' = 'manual') => {
    if (screenShareServiceRef.current) {
      screenShareServiceRef.current.stopStreaming();
      screenShareServiceRef.current.stopCapture(reason);
      screenShareServiceRef.current = null;
    }

    setIsSharing(false);
    setIsAnalyzing(false);
    setStreamingStats({ fps: 0, sent: 0, total: 0 });

    if (reason === 'ended') {
      const endMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Screen sharing ended.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, endMsg]);
    }
  }, []);

  // Update rate limit info
  useEffect(() => {
    const status = aiService.getRateLimitStatus();
    if (status.remaining) {
      setRateLimitInfo(status.remaining);
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (screenShareServiceRef.current) {
        screenShareServiceRef.current.stopStreaming();
        screenShareServiceRef.current.stopCapture('manual');
        screenShareServiceRef.current = null;
      }
    };
  }, []);

  // Voice to text functionality
  const handleMicrophoneClick = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        const chunks: BlobPart[] = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          // Use Web Speech API for transcription (free)
          handleAudioTranscription(blob);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Microphone access denied:', error);
        alert('Please allow microphone access to use voice feature');
      }
    }
  };

  // Simple audio transcription using Web Speech API
  const handleAudioTranscription = (blob: Blob) => {
    const recognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!recognition) {
      alert('Speech recognition not supported in your browser');
      return;
    }

    const recognizer = new recognition();
    recognizer.continuous = false;
    recognizer.interimResults = false;
    recognizer.lang = 'en-US';

    recognizer.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript) {
        setInput(transcript);
      }
    };

    recognizer.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
    };

    // Start listening from the audio blob
    const reader = new FileReader();
    reader.onload = () => {
      recognizer.start();
    };
    reader.readAsArrayBuffer(blob);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const aiMessages: AIMessage[] = messages
        .slice(-10)
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      
      aiMessages.push({
        role: 'user',
        content: input,
      });

      const response = await aiService.chat(aiMessages, 'gpt-4');

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiResponse]);
    } catch (error: any) {
      console.error('AI Error:', error);
      
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error.message || "I'm having trouble processing your request. Please try again later.",
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const captureChartSnapshot = async (): Promise<string> => {
    const chartElement = document.getElementById('tradingview_chart');
    if (!chartElement) {
      throw new Error('Chart element not found');
    }
    const chartRect = chartElement.getBoundingClientRect();
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'browser',
        frameRate: 30,
      } as MediaTrackConstraints,
      audio: false,
      preferCurrentTab: true as any,
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    try {
      await video.play();
      await new Promise((resolve) => {
        if (video.readyState >= 2) {
          resolve(true);
          return;
        }
        video.onloadedmetadata = () => resolve(true);
      });

      const scaleX = video.videoWidth / window.innerWidth;
      const scaleY = video.videoHeight / window.innerHeight;
      const sourceX = Math.max(0, Math.floor(chartRect.left * scaleX));
      const sourceY = Math.max(0, Math.floor(chartRect.top * scaleY));
      const sourceWidth = Math.max(1, Math.floor(chartRect.width * scaleX));
      const sourceHeight = Math.max(1, Math.floor(chartRect.height * scaleY));

      const canvas = document.createElement('canvas');
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Unable to initialize screenshot canvas');
      }

      ctx.drawImage(
        video,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sourceWidth,
        sourceHeight
      );

      return canvas.toDataURL('image/png');
    } finally {
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
  };

  const handleScreenshot = async () => {
    if (!canUseFeature('screenshot')) {
      alert(`Screenshot limit reached for ${userPlan} plan. Upgrade to use more.`);
      return;
    }
    
    try {
      // Ask the browser for the current tab first so the permission preview is clean.
      const imageBase64 = await captureChartSnapshot();
      setIsCapturing(true);
      setIsLoading(true);

      const analysis = await aiService.analyzeChartScreenshot(imageBase64, input || undefined);
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Chart Analysis:\n\n${analysis}`,
        timestamp: new Date(),
        hasImage: true,
      };

      setMessages((prev) => [...prev, aiResponse]);
      setUsageLimits(prev => ({ ...prev, screenshots: prev.screenshots + 1 }));
      setIsOpen(true);
    } catch (error: any) {
      console.error('Screenshot failed:', error);
      
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error?.name === 'NotAllowedError'
          ? 'Screenshot capture was cancelled. Choose the current browser tab when prompted so I can capture only the chart.'
          : error.message || "Screenshot capture failed. Please try again.",
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorResponse]);
      setIsOpen(true);
    } finally {
      setIsCapturing(false);
      setIsLoading(false);
    }
  };

  const handleScreenShare = async () => {
    if (!isSharing && !canUseFeature('screenShare')) {
      alert(`Screen share limit reached for ${userPlan} plan. Upgrade to use more.`);
      return;
    }

    if (isSharing) {
      stopScreenShare('manual');
      
      const endMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⏹️ Screen sharing stopped.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, endMsg]);
    } else {
      // Start sharing using getDisplayMedia() API
      try {
        setIsSharing(true);

        const screenMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: '📊 Starting screen sharing...',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, screenMessage]);

        // Initialize screen share service
        screenShareServiceRef.current = new ScreenShareService({
          frameInterval: 1000,
          quality: 0.7,
          diffThreshold: 0.05,
          roiMode: 'chart',
        });

        const service = screenShareServiceRef.current;

        // Start capture (user will see browser permission dialog)
        await service.startCapture();
        console.log('[Screen Share] Capture started');

        // Setup stats callback
        service.setStatsCallback((stats) => {
          setStreamingStats(stats);
        });

        service.setStopCallback((reason) => {
          screenShareServiceRef.current = null;
          setIsSharing(false);
          setIsAnalyzing(false);
          setStreamingStats({ fps: 0, sent: 0, total: 0 });

          if (reason === 'ended') {
            const endMsg: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: 'Screen sharing ended.',
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, endMsg]);
          }
        });

        // Start streaming (capture frames in background)
        service.startStreaming();

        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '✅ Screen sharing active!\n\n🎯 Now you can:\n1. Draw & analyze on your chart\n2. Click "Analyze Screen" button to get AI insights\n3. I\'ll see exactly what you\'ve drawn and analyzed',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiResponse]);
      } catch (error: any) {
        console.error('Screen share failed:', error);
        setIsSharing(false);
        if (screenShareServiceRef.current) {
          screenShareServiceRef.current.stopCapture('manual');
          screenShareServiceRef.current = null;
        }
        
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: error.message?.includes('NotAllowedError') 
            ? '❌ Screen capture permission denied. Please allow access and try again.'
            : `❌ Screen share failed: ${error.message || 'Unknown error'}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    }
  };

  const handleAnalyzeScreen = async () => {
    if (!isSharing || !screenShareServiceRef.current) {
      alert('Please start screen sharing first by clicking the Monitor button');
      return;
    }

    setIsAnalyzing(true);
    
    try {
      // Capture current frame from the active stream
      const service = screenShareServiceRef.current;
      
      // Get the video element and canvas from the service
      const { canvas, ctx, video } = service.getCaptureElements();

      if (!canvas || !ctx || !video) {
        throw new Error('Screen capture not properly initialized');
      }

      // Capture current frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

      // Show analyzing message
      const analyzingMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: '🔍 Analyzing your screen...',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, analyzingMsg]);

      // Send to AI for analysis
      setIsLoading(true);
      const analysis = await aiService.analyzeChartScreenshot(
        imageBase64,
        'Please analyze this trading chart. Tell me what you see: chart patterns, technical levels, support/resistance, any drawings or analysis I made, price action, and any trading signals.'
      );

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Screen Analysis:\n\n${analysis}`,
        timestamp: new Date(),
        hasImage: true,
      };

      setMessages((prev) => [...prev, aiResponse]);
      setIsLoading(false);
      setIsAnalyzing(false);
      
      // Open chat after analysis is complete
      setIsOpen(true);
    } catch (error: any) {
      console.error('Screen analysis failed:', error);
      setIsLoading(false);
      setIsAnalyzing(false);
      
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error.message || 'Failed to analyze screen. Please try again.',
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorResponse]);
      
      // Open chat even on error to show the message
      setIsOpen(true);
    }
  };

  const saveTranscript = () => {
    const hasConversation = messages.some((message, index) => index > 0 || message.role === 'user');
    if (!hasConversation) {
      return null;
    }

    const transcriptId = sessionStartTime?.getTime().toString() || Date.now().toString();
    const transcript: Transcript = {
      id: transcriptId,
      date: sessionStartTime || new Date(),
      duration: sessionStartTime ? (new Date().getTime() - sessionStartTime.getTime()) / 1000 : 0,
      messageCount: messages.length,
      messages: [...messages],
    };
    setTranscripts(prev => {
      const existingIndex = prev.findIndex((item) => item.id === transcript.id);
      if (existingIndex === -1) {
        return [transcript, ...prev];
      }

      const next = [...prev];
      next[existingIndex] = transcript;
      return next;
    });
    setSelectedTranscriptId(transcript.id);
    return transcript;
  };

  const selectedTranscript = transcripts.find((transcript) => transcript.id === selectedTranscriptId) || null;

  useEffect(() => {
    const hasConversation = messages.some((message, index) => index > 0 || message.role === 'user');
    if (!hasConversation) {
      return;
    }

    saveTranscript();
  }, [messages]);

  const closeAndArchiveSession = () => {
    saveTranscript();
    setIsOpen(false);
    setActiveTab('chat');
    setMessages(createFreshMessages());
    setInput('');
    setSessionStartTime(new Date());
  };

  const getPlanColor = () => {
    switch(userPlan) {
      case 'pro': return 'text-gray-600';
      case 'elite': return 'text-gray-600';
      case 'unlimited': return 'text-gray-600';
      default: return 'text-gray-500';
    }
  };

  // Drag effect - must be before any conditional returns
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setWidgetPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <>
      {/* Chart Capture Overlay - Shows animation directly on the trading chart */}
      <ChartCaptureOverlay isCapturing={isCapturing} isDark={isDark} />
      {!isOpen ? (
        <div
          style={{
            position: 'fixed',
            left: `${widgetPosition.x}px`,
            top: `${widgetPosition.y}px`,
            zIndex: 10,
            touchAction: 'none',
            cursor: isDragging ? 'grabbing' : 'grab',
            transition: isDragging ? 'none' : 'transform 0.2s ease-out'
          }}
          onMouseDown={handleWidgetMouseDown}
          className="flex gap-2 items-start"
        >
          <div
            className={`${isDark ? 'bg-white/90 border-[#d0d0d0]' : 'bg-[#2a2a2a]/90 border-[#3a3a3a]'} backdrop-blur-2xl border rounded-full shadow-2xl flex items-center gap-3 px-5 py-3 transition-all hover:scale-[1.02] group pointer-events-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            {!isSharing ? (
              <div onClick={() => setIsOpen(true)} className="flex items-center gap-3 cursor-pointer flex-1">
                <img src={micromaxIcon} alt="Micromax" className="w-5 h-5 rounded-full" />
                <input
                  type="text"
                  placeholder="Ask Micromax anything"
                  className={`bg-transparent border-none outline-none text-sm ${isDark ? 'text-[#2a2a2a] placeholder-[#9a9a9a]' : 'text-[#e8e8e8] placeholder-[#6a6a6a]'} w-48 cursor-pointer pointer-events-none`}
                  readOnly
                />
              </div>
            ) : (
              <button
                onClick={() => {
                  setActiveTab('chat');
                  setIsOpen(true);
                }}
                className="flex items-center gap-2 flex-1 text-left"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className={`text-sm font-medium ${isDark ? 'text-green-700' : 'text-green-300'}`}>
                  Screen Sharing is Live
                </span>
              </button>
            )}
          </div>

          <div
            className={`${isDark ? 'bg-white/90 border-[#d0d0d0]' : 'bg-[#2a2a2a]/90 border-[#3a3a3a]'} backdrop-blur-2xl border rounded-full shadow-2xl flex items-center gap-2 px-3 py-3 transition-all hover:scale-[1.02] group pointer-events-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            {!isSharing ? (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleScreenshot();
                }}
                disabled={isCapturing || isLoading}
                className={`p-1.5 rounded-lg ${isDark ? 'bg-white/60 hover:bg-gray-300/40 border-white/30' : 'bg-[#3a3a3a]/60 hover:bg-gray-600/40 border-white/20'} transition-colors border backdrop-blur-sm disabled:opacity-50 group`}
                title="Screenshot"
              >
                <Camera className={`w-4 h-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
              </button>
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab('chat');
                    setIsOpen(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isDark
                      ? 'bg-white/70 hover:bg-white text-gray-900'
                      : 'bg-[#3a3a3a]/90 hover:bg-[#4a4a4a] text-white'
                  }`}
                >
                  Open Chat
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAnalyzeScreen();
                  }}
                  disabled={isAnalyzing || isLoading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isAnalyzing 
                      ? (isDark ? 'bg-gray-400/50 text-gray-800' : 'bg-gray-600/50 text-gray-100')
                      : (isDark ? 'bg-gray-700/80 hover:bg-gray-600/80 text-white' : 'bg-gray-600/80 hover:bg-gray-700/80 text-white')
                  } disabled:opacity-50`}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Screen'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-md z-40"
            onClick={closeAndArchiveSession}
          />
          
          <div 
            className={`fixed
              ${isDark ? 'bg-white/95 border-[#d0d0d0]' : 'bg-[#1a1a1a]/95 border-[#3a3a3a]'} 
              backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden z-50 border rounded-3xl`}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: windowSize.width < 640 ? 'calc(100% - 40px)' : (windowSize.width < 768 ? 'calc(100% - 60px)' : windowSize.width < 1024 ? 'calc(100% - 80px)' : 'calc(100% - 100px)'),
              maxWidth: windowSize.width < 640 ? '100%' : (windowSize.width < 768 ? '500px' : windowSize.width < 1024 ? '550px' : '600px'),
              height: windowSize.width < 640 
                ? 'calc(100vh - 80px)'
                : 'calc(100vh - 120px)',
              maxHeight: windowSize.width < 640
                ? 'calc(100vh - 80px)'
                : 'calc(100vh - 120px)',
              borderRadius: '1.875rem',
            }}
          >
        {/* Tabs */}
        <div className={`${isDark ? 'bg-[#e8e8e8] text-[#2a2a2a]' : 'bg-[#2a2a2a] text-[#e8e8e8]'} px-5 py-3 flex gap-4 border-b ${isDark ? 'border-[#d0d0d0]' : 'border-[#3a3a3a]'}`}>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 pb-2 border-b-2 transition-colors ${activeTab === 'chat' ? `border-amber-500 ${isDark ? 'text-[#2a2a2a]' : 'text-amber-500'}` : `border-transparent ${isDark ? 'text-[#6a6a6a]' : 'text-[#6a6a6a]'}`}`}
          >
            <Volume2 className="w-4 h-4" />
            Chat
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`flex items-center gap-2 pb-2 border-b-2 transition-colors ${activeTab === 'transcript' ? `border-amber-500 ${isDark ? 'text-[#2a2a2a]' : 'text-amber-500'}` : `border-transparent ${isDark ? 'text-[#6a6a6a]' : 'text-[#6a6a6a]'}`}`}
          >
            <FileText className="w-4 h-4" />
            Transcript ({transcripts.length})
          </button>
        </div>

        {/* Header */}
        <div className={`${isDark ? 'bg-[#f5f5f5] text-[#2a2a2a] border-[#d0d0d0]' : 'bg-[#2a2a2a] text-[#e8e8e8] border-[#3a3a3a]'} px-5 py-3 flex items-center justify-between border-b`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full ${isDark ? 'bg-amber-100/50 border-amber-200/50' : 'bg-white/10 border-white/20'} border flex items-center justify-center overflow-hidden`}>
              <img src={micromaxIcon} alt="Micromax" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-semibold text-sm">Micromax</div>
              <div className={`text-xs opacity-75 ${getPlanColor()}`}>{userPlan.toUpperCase()}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'chat' && rateLimitInfo && (
              <div className={`text-[10px] ${isDark ? 'text-[#6a6a6a]' : 'text-[#9a9a9a]'} text-right`}>
                <div>{rateLimitInfo.messages}/50 msgs</div>
              </div>
            )}
            <button
              onClick={closeAndArchiveSession}
              className={`${isDark ? 'hover:bg-amber-200/30' : 'hover:bg-white/20'} p-1.5 rounded-lg transition-colors`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {activeTab === 'chat' ? (
          <>
            {/* Messages */}
            <div ref={scrollRef} className={`flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide ${isDark ? 'bg-gradient-to-b from-gray-50/50 to-gray-100/50' : 'bg-gradient-to-b from-[#2a2a2a]/30 to-[#1a1a1a]/50'}`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {message.role === 'assistant' && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 backdrop-blur-sm ${isDark ? 'bg-amber-100/70 border-amber-200/50' : 'bg-[#3a3a3a]/90 border-white/20'} border overflow-hidden`}>
                      <img src={micromaxIcon} alt="Micromax" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className={`flex-1 ${message.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                    <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                      message.role === 'user'
                        ? isDark
                          ? 'bg-stone-700/90 text-white backdrop-blur-sm max-w-[85%]'
                          : 'bg-stone-800/90 text-white backdrop-blur-sm max-w-[85%]'
                        : isDark
                          ? 'bg-white/90 text-gray-900 border border-amber-200/50 shadow-sm backdrop-blur-sm'
                          : 'bg-[#2a2a2a]/90 text-white border border-white/10 shadow-sm backdrop-blur-sm'
                    }`}>
                      {formatMessageText(message.content)}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1.5 px-2`}>
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className={`w-8 h-8 rounded-full ${isDark ? 'bg-amber-100/70 border-amber-200/50' : 'bg-[#3a3a3a]/90 border-white/20'} flex items-center justify-center flex-shrink-0 backdrop-blur-sm border overflow-hidden`}>
                    <img src={micromaxIcon} alt="Micromax" className="w-full h-full object-cover" />
                  </div>
                  <div className={`${isDark ? 'bg-white/90 border-amber-200/50' : 'bg-[#2a2a2a]/90 border-white/10'} rounded-2xl px-4 py-2.5 border shadow-sm backdrop-blur-sm`}>
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className={`p-4 ${isDark ? 'bg-white/60 border-white/20' : 'bg-[#1a1a1a]/60 border-white/10'} backdrop-blur-xl border-t`}>
              <div className={`flex gap-2 items-center ${isDark ? 'bg-white/80 border-white/30' : 'bg-[#2a2a2a]/80 border-white/20'} rounded-2xl px-4 py-2.5 border backdrop-blur-sm`}>
                <Plus className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'} flex-shrink-0`} />
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask Micromax anything"
                  className={`flex-1 bg-transparent border-none outline-none text-sm ${isDark ? 'text-gray-900 placeholder-gray-500' : 'text-white placeholder-gray-400'}`}
                />
                <div className="relative">
                  <button
                    onClick={handleScreenShare}
                    disabled={!canUseFeature('screenShare')}
                    className={`p-2 rounded-lg ${isSharing ? (isDark ? 'bg-green-500/30' : 'bg-green-900/60') : (isDark ? 'bg-white/60 hover:bg-green-500/20' : 'bg-[#3a3a3a]/60 hover:bg-green-500/20')} transition-colors border ${isDark ? 'border-white/30' : 'border-white/20'} backdrop-blur-sm disabled:opacity-50 group`}
                    title={`Screen Share (${usageLimits.screenShare}/${getPlanLimits().screenShare})`}
                  >
                    <Monitor className={`w-4 h-4 ${isSharing ? 'text-green-500 animate-pulse' : (isDark ? 'text-gray-700' : 'text-gray-300')}`} />
                  </button>
                  {isSharing && (
                    <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded text-xs whitespace-nowrap ${isDark ? 'bg-white/90 text-gray-900' : 'bg-[#2a2a2a]/90 text-white'} pointer-events-none`}>
                      {streamingStats.fps.toFixed(1)} FPS • {streamingStats.sent}/{streamingStats.total}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleMicrophoneClick}
                  className={`p-2 rounded-lg ${isRecording ? (isDark ? 'bg-red-500/30' : 'bg-red-900/60') : (isDark ? 'bg-white/60 hover:bg-gray-400/40' : 'bg-[#3a3a3a]/60 hover:bg-gray-600/40')} transition-colors border ${isDark ? 'border-white/30' : 'border-white/20'} backdrop-blur-sm group`}
                  title="Voice Input (Click to record)"
                >
                  {isRecording ? (
                    <Square className={`w-4 h-4 text-red-500 animate-pulse`} />
                  ) : (
                    <Mic className={`w-4 h-4 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
                  )}
                </button>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={`px-3 py-2 ${isDark ? 'bg-stone-700/90 hover:bg-stone-600/90' : 'bg-stone-800/90 hover:bg-stone-900/90'} disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex-shrink-0 shadow-sm`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className={`flex-1 overflow-hidden ${isDark ? 'bg-gray-50/50' : 'bg-[#1a1a1a]/50'} flex`}>
            {transcripts.length === 0 ? (
              <div className={`w-full text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No session transcripts yet</p>
              </div>
            ) : (
              <>
                <div className={`w-56 border-r overflow-y-auto p-3 space-y-2 ${isDark ? 'border-[#d0d0d0]' : 'border-[#3a3a3a]'}`}>
                  {transcripts.map((transcript) => (
                    <button
                      key={transcript.id}
                      onClick={() => setSelectedTranscriptId(transcript.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors border ${
                        selectedTranscriptId === transcript.id
                          ? isDark
                            ? 'bg-amber-100/70 border-amber-200/70'
                            : 'bg-[#3a3a3a] border-amber-500/50'
                          : isDark
                            ? 'bg-white/60 hover:bg-white/80 border-white/30'
                            : 'bg-[#2a2a2a]/60 hover:bg-[#3a3a3a]/80 border-white/20'
                      }`}
                    >
                      <div className={`text-xs font-medium ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
                        {transcript.date.toLocaleDateString()} {transcript.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className={`text-sm mt-1 ${isDark ? 'text-gray-700' : 'text-gray-200'}`}>
                        {transcript.messageCount} messages • {Math.floor(transcript.duration / 60)}m duration
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedTranscript ? (
                    selectedTranscript.messages.map((message) => (
                      <div key={`${selectedTranscript.id}-${message.id}`} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        {message.role === 'assistant' && (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 backdrop-blur-sm ${isDark ? 'bg-amber-100/70 border-amber-200/50' : 'bg-[#3a3a3a]/90 border-white/20'} border overflow-hidden`}>
                            <img src={micromaxIcon} alt="Micromax" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className={`flex-1 ${message.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                          <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                            message.role === 'user'
                              ? isDark
                                ? 'bg-stone-700/90 text-white backdrop-blur-sm max-w-[85%]'
                                : 'bg-stone-800/90 text-white backdrop-blur-sm max-w-[85%]'
                              : isDark
                                ? 'bg-white/90 text-gray-900 border border-amber-200/50 shadow-sm backdrop-blur-sm'
                                : 'bg-[#2a2a2a]/90 text-white border border-white/10 shadow-sm backdrop-blur-sm'
                          }`}>
                            {formatMessageText(message.content)}
                          </div>
                          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1.5 px-2`}>
                            {message.timestamp.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Select a session to view the full conversation.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
          </div>
        </>
      )}
    </>
  );
}
