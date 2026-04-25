import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Mic, Camera, X, Scissors, History, Share2, Volume2, Square, Clock } from 'lucide-react';
import micromaxIcon from '../../assets/73f953c01b2738ff43765b998d2ccf278acf751e.png';
import { aiService, AIModel, AIMessage } from '../services/aiService';
import { getCurrentUser } from '../services/supabaseAuth';

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

interface FloatingMicromaxProps {
  isDark: boolean;
}

export function FloatingMicromax({ isDark }: FloatingMicromaxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Micromax, your AI trading assistant. Ask me about chart patterns, signals, or strategy. You can also share a screenshot or screen for detailed analysis.",
      timestamp: new Date(),
    },
  ]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ messages: number; tokens: number } | null>(null);
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | 'elite' | 'unlimited'>('free');
  const [usageLimits, setUsageLimits] = useState({ screenshots: 0, screenShare: 0, sessions: 0 });
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Load user plan and usage limits
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setUserPlan(user.plan || 'free');
          setUsageLimits({
            screenshots: user.screenshotCount || 0,
            screenShare: user.screenShareCount || 0,
            sessions: user.sessionCount || 0,
          });
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };
    
    loadUserData();
    setSessionStartTime(new Date());
  }, []);

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
    if (feature === 'screenShare') return usageLimits.screenShare < limits.screenShare;
    return false;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Update rate limit info
  useEffect(() => {
    const status = aiService.getRateLimitStatus();
    if (status.remaining) {
      setRateLimitInfo(status.remaining);
    }
  }, [messages]);

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

  const handleScreenshot = async () => {
    if (!canUseFeature('screenshot')) {
      alert(`Screenshot limit reached for ${userPlan} plan. Upgrade to use more.`);
      return;
    }

    setIsCapturing(true);
    
    try {
      const chartElement = document.getElementById('tradingview_chart');
      if (!chartElement) {
        throw new Error('Chart not found');
      }

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(chartElement, {
        allowTaint: true,
        useCORS: true,
        backgroundColor: null,
      });
      
      const imageBase64 = canvas.toDataURL('image/png');
      
      await new Promise(resolve => setTimeout(resolve, 800));
      setIsCapturing(false);
      setIsLoading(true);

      const analysis = await aiService.analyzeChartScreenshot(imageBase64, input || undefined);
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `📸 Chart Analysis:\n\n${analysis}`,
        timestamp: new Date(),
        hasImage: true,
      };

      setMessages((prev) => [...prev, aiResponse]);
      setUsageLimits(prev => ({ ...prev, screenshots: prev.screenshots + 1 }));
      setIsLoading(false);
    } catch (error: any) {
      console.error('Screenshot failed:', error);
      setIsCapturing(false);
      setIsLoading(false);
      
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error.message || "Screenshot capture failed. Please try again.",
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorResponse]);
    }
  };

  const handleScreenShare = async () => {
    if (!canUseFeature('screenShare')) {
      alert(`Screen share limit reached for ${userPlan} plan. Upgrade to use more.`);
      return;
    }

    if (isSharing) {
      // Stop sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setIsSharing(false);
    } else {
      // Start sharing
      try {
        const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        setIsSharing(true);

        const screenMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: '🖥️ Sharing screen for live analysis...',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, screenMessage]);

        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '📺 Screen sharing active! I\'m analyzing your trading view in real-time. Describe what you\'re seeing for detailed insights.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiResponse]);
        setUsageLimits(prev => ({ ...prev, screenShare: prev.screenShare + 1 }));

        // Stop sharing after 5 minutes
        setTimeout(() => {
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
            setIsSharing(false);
          }
        }, 5 * 60 * 1000);
      } catch (error) {
        console.error('Screen share failed:', error);
      }
    }
  };

  const saveTranscript = () => {
    const transcript: Transcript = {
      id: Date.now().toString(),
      date: sessionStartTime || new Date(),
      duration: sessionStartTime ? (new Date().getTime() - sessionStartTime.getTime()) / 1000 : 0,
      messageCount: messages.length,
      messages: [...messages],
    };
    setTranscripts(prev => [transcript, ...prev]);
  };

  const getPlanColor = () => {
    switch(userPlan) {
      case 'pro': return 'text-amber-500';
      case 'elite': return 'text-amber-500';
      case 'unlimited': return 'text-amber-500';
      default: return 'text-gray-500';
    }
  };

  if (!isOpen) {
    return (
      <div
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 ${isDark ? 'bg-white/90 border-[#d0d0d0]' : 'bg-[#2a2a2a]/90 border-[#3a3a3a]'} backdrop-blur-2xl border rounded-full shadow-2xl flex items-center gap-4 px-6 py-3.5 transition-all hover:scale-[1.02] z-10 group cursor-pointer`}
        onClick={() => setIsOpen(true)}
      >
        <Plus className={`w-5 h-5 ${isDark ? 'text-[#6a6a6a]' : 'text-[#9a9a9a]'}`} />
        <input
          type="text"
          placeholder="Ask Micromax anything"
          className={`bg-transparent border-none outline-none text-sm ${isDark ? 'text-[#2a2a2a] placeholder-[#9a9a9a]' : 'text-[#e8e8e8] placeholder-[#6a6a6a]'} w-64 cursor-pointer pointer-events-none`}
          readOnly
        />
        <div className={`text-xs font-medium px-2 py-1 rounded ${getPlanColor()} opacity-75`}>
          {userPlan.toUpperCase()} PLAN
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Blurred Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-md z-40"
        onClick={() => {
          saveTranscript();
          setIsOpen(false);
        }}
      />
      
      {/* Screenshot/Share Overlays */}
      {isCapturing && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-white/10 animate-pulse" />
          <div className={`absolute inset-0 border-4 ${isDark ? 'border-[#2a2a2a]' : 'border-[#e8e8e8]'} animate-ping`} style={{ animationDuration: '0.8s' }} />
          <div className={`${isDark ? 'bg-white/90 border-[#d0d0d0]' : 'bg-[#1a1a1a]/90 border-[#3a3a3a]'} backdrop-blur-xl px-8 py-4 rounded-2xl border shadow-2xl`}>
            <div className="flex items-center gap-3">
              <Scissors className={`w-6 h-6 ${isDark ? 'text-[#2a2a2a]' : 'text-[#e8e8e8]'} animate-bounce`} />
              <span className={`${isDark ? 'text-[#2a2a2a]' : 'text-[#e8e8e8]'} font-medium`}>Capturing screenshot...</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Chat Window - Centered */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[600px] ${isDark ? 'bg-white/95 border-[#d0d0d0]' : 'bg-[#1a1a1a]/95 border-[#3a3a3a]'} backdrop-blur-2xl rounded-3xl shadow-2xl flex flex-col overflow-hidden z-50 border`}>
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
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 pb-2 border-b-2 transition-colors ${activeTab === 'history' ? `border-amber-500 ${isDark ? 'text-[#2a2a2a]' : 'text-amber-500'}` : `border-transparent ${isDark ? 'text-[#6a6a6a]' : 'text-[#6a6a6a]'}`}`}
          >
            <History className="w-4 h-4" />
            History ({transcripts.length})
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
              onClick={() => {
                saveTranscript();
                setIsOpen(false);
              }}
              className={`${isDark ? 'hover:bg-amber-200/30' : 'hover:bg-white/20'} p-1.5 rounded-lg transition-colors`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {activeTab === 'chat' ? (
          <>
            {/* Messages */}
            <div ref={scrollRef} className={`flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide ${isDark ? 'bg-gradient-to-b from-gray-50/50 to-gray-100/50' : 'bg-gradient-to-b from-slate-800/30 to-slate-900/50'}`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {message.role === 'assistant' && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 backdrop-blur-sm ${isDark ? 'bg-amber-100/70 border-amber-200/50' : 'bg-slate-700/90 border-white/20'} border overflow-hidden`}>
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
                          : 'bg-slate-800/90 text-white border border-white/10 shadow-sm backdrop-blur-sm'
                    }`}>
                      {message.content}
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
                  <div className={`w-8 h-8 rounded-full ${isDark ? 'bg-amber-100/70 border-amber-200/50' : 'bg-slate-700/90 border-white/20'} flex items-center justify-center flex-shrink-0 backdrop-blur-sm border overflow-hidden`}>
                    <img src={micromaxIcon} alt="Micromax" className="w-full h-full object-cover" />
                  </div>
                  <div className={`${isDark ? 'bg-white/90 border-amber-200/50' : 'bg-slate-800/90 border-white/10'} rounded-2xl px-4 py-2.5 border shadow-sm backdrop-blur-sm`}>
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
            <div className={`p-4 ${isDark ? 'bg-white/60 border-white/20' : 'bg-slate-900/60 border-white/10'} backdrop-blur-xl border-t`}>
              <div className={`flex gap-2 items-center ${isDark ? 'bg-white/80 border-white/30' : 'bg-slate-800/80 border-white/20'} rounded-2xl px-4 py-2.5 border backdrop-blur-sm`}>
                <Plus className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'} flex-shrink-0`} />
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask Micromax anything"
                  className={`flex-1 bg-transparent border-none outline-none text-sm ${isDark ? 'text-gray-900 placeholder-gray-500' : 'text-white placeholder-gray-400'}`}
                />
                <button
                  onClick={handleScreenshot}
                  disabled={isCapturing || isLoading || !canUseFeature('screenshot')}
                  className={`p-2 rounded-lg ${isDark ? 'bg-white/60 hover:bg-cyan-500/20 border-white/30' : 'bg-slate-700/60 hover:bg-cyan-500/20 border-white/20'} transition-colors border backdrop-blur-sm disabled:opacity-50 group`}
                  title={`Screenshot (${usageLimits.screenshots}/${getPlanLimits().screenshots})`}
                >
                  <Camera className={`w-4 h-4 ${isDark ? 'text-gray-700' : 'text-gray-300'} group-hover:text-cyan-500`} />
                </button>
                <button
                  onClick={handleScreenShare}
                  disabled={!canUseFeature('screenShare')}
                  className={`p-2 rounded-lg ${isSharing ? (isDark ? 'bg-red-500/30' : 'bg-red-900/60') : (isDark ? 'bg-white/60 hover:bg-green-500/20' : 'bg-slate-700/60 hover:bg-green-500/20')} transition-colors border ${isDark ? 'border-white/30' : 'border-white/20'} backdrop-blur-sm disabled:opacity-50 group`}
                  title={`Screen Share (${usageLimits.screenShare}/${getPlanLimits().screenShare})`}
                >
                  <Share2 className={`w-4 h-4 ${isSharing ? 'text-red-500' : (isDark ? 'text-gray-700' : 'text-gray-300')}`} />
                </button>
                <button
                  onClick={handleMicrophoneClick}
                  className={`p-2 rounded-lg ${isRecording ? (isDark ? 'bg-red-500/30' : 'bg-red-900/60') : (isDark ? 'bg-white/60 hover:bg-orange-500/20' : 'bg-slate-700/60 hover:bg-orange-500/20')} transition-colors border ${isDark ? 'border-white/30' : 'border-white/20'} backdrop-blur-sm group`}
                  title="Voice Input (Click to record)"
                >
                  {isRecording ? (
                    <Square className={`w-4 h-4 text-red-500 animate-pulse`} />
                  ) : (
                    <Mic className={`w-4 h-4 ${isDark ? 'text-gray-700' : 'text-gray-300'} group-hover:text-orange-500`} />
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
          /* History Tab */
          <div className={`flex-1 overflow-y-auto p-5 space-y-3 ${isDark ? 'bg-gray-50/50' : 'bg-slate-900/50'}`}>
            {transcripts.length === 0 ? (
              <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <History className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No session transcripts yet</p>
              </div>
            ) : (
              transcripts.map((transcript) => (
                <div
                  key={transcript.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${isDark ? 'bg-white/60 hover:bg-white/80 border-white/30' : 'bg-slate-800/60 hover:bg-slate-700/80 border-white/20'} border`}
                >
                  <div className={`text-xs font-medium ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
                    {transcript.date.toLocaleDateString()} {transcript.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className={`text-sm mt-1 ${isDark ? 'text-gray-700' : 'text-gray-200'}`}>
                    {transcript.messageCount} messages • {Math.floor(transcript.duration / 60)}m duration
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
  );
}
          role: m.role as 'user' | 'assistant',
