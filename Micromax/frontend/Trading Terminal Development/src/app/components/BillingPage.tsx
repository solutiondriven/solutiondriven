import { useState, useEffect } from 'react';
import { supabaseAuth } from '../services/supabaseAuth';

interface BillingPageProps {
  isDark: boolean;
  onClose: () => void;
}

interface PlanDetails {
  name: string;
  price: number;
  description: string;
  features: string[];
  limits: {
    screenshots: number;
    screenShare: number;
    messagesPerDay: number;
  };
  popular?: boolean;
}

const PLANS: Record<string, PlanDetails> = {
  free: {
    name: 'Free',
    price: 0,
    description: 'Perfect for getting started',
    popular: false,
    features: [
      'Chat with Micromax AI',
      '3 Screenshots per day',
      '1 Screen share session',
      '50 messages per day',
      'Basic trading analysis'
    ],
    limits: { screenshots: 3, screenShare: 1, messagesPerDay: 50 }
  },
  basic: {
    name: 'Basic Bot',
    price: 99,
    description: 'For casual traders',
    popular: false,
    features: [
      'Chat with Micromax AI',
      '10 Screenshots per day',
      '5 Screen share sessions',
      '100 messages per day',
      'Standard trading analysis',
      'Email support'
    ],
    limits: { screenshots: 10, screenShare: 5, messagesPerDay: 100 }
  },
  pro: {
    name: 'Pro Bot',
    price: 249,
    description: 'For serious traders',
    features: [
      'Unlimited chat access',
      '20 Screenshots per day',
      '10 Screen share sessions',
      '200 messages per day',
      'Advanced technical analysis',
      'Priority support'
    ],
    limits: { screenshots: 20, screenShare: 10, messagesPerDay: 200 }
  },
  elite: {
    name: 'Elite Bot',
    price: 499,
    description: 'For professional traders',
    popular: true,
    features: [
      'Unlimited everything',
      '100 Screenshots per day',
      '50 Screen share sessions',
      '1000 messages per day',
      'Expert-level analysis',
      'Real-time alerts',
      '24/7 premium support',
      'Custom trading strategies'
    ],
    limits: { screenshots: 100, screenShare: 50, messagesPerDay: 1000 }
  },
  unlimited: {
    name: 'Unlimited Bot',
    price: 999,
    description: 'Enterprise solution',
    features: [
      'Unlimited access to all features',
      'Unlimited screenshots',
      'Unlimited screen shares',
      'Unlimited messages',
      'Enterprise-grade analysis',
      'Dedicated account manager',
      'API access',
      'Custom integrations'
    ],
    limits: { screenshots: -1, screenShare: -1, messagesPerDay: -1 }
  }
};

export function BillingPage({ isDark, onClose }: BillingPageProps) {
  const [currentPlan, setCurrentPlan] = useState<string>('free');

  useEffect(() => {
    const loadUserPlan = async () => {
      try {
        const user = await supabaseAuth.getCurrentUser();
        if (user?.plan) {
          setCurrentPlan(user.plan);
        }
      } catch (error) {
        console.error('Failed to load user plan:', error);
      }
    };
    loadUserPlan();
  }, []);

  const handleUpgrade = async (planId: string) => {
    if (planId === 'free') {
      alert('You are already on the Free plan');
      return;
    }

    const flutterWaveLinks: Record<string, string> = {
      basic: 'https://flutterwave.com/pay/basicbot',
      pro: 'https://flutterwave.com/pay/probot',
      elite: 'https://flutterwave.com/pay/elitebot',
      unlimited: 'https://flutterwave.com/pay/unlimitedbot',
      verified: 'https://flutterwave.com/pay/impulseverified'
    };

    const link = flutterWaveLinks[planId];
    if (link) {
      window.open(link, '_blank');
    }
  };

  return (
    <div className={`fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4`}>
      <div className={`${isDark ? 'bg-black' : 'bg-white'} rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-auto`}>
        {/* Close Button */}
        <div className="flex justify-end p-4">
          <button
            onClick={onClose}
            className={`text-2xl font-light transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'}`}
          >
            ×
          </button>
        </div>

        {/* Plans Grid */}
        <div className={`px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6`}>
          {Object.entries(PLANS).filter(([id]) => id !== 'free').map(([planId, plan]) => {
            const badges: Record<string, string> = {
              basic: 'Entry Level',
              pro: 'Professional',
              elite: 'Advanced',
              unlimited: 'Enterprise'
            };
            
            return (
              <div
                key={planId}
                className={`rounded-2xl border transition-all ${
                  isDark ? 'border-[#3a3a3a] bg-[#1a1a1a]' : 'border-[#d0d0d0] bg-white'
                }`}
              >
                {/* Badge */}
                <div className={`px-6 py-4 border-b ${isDark ? 'border-[#e0e0e0]' : 'border-[#4a4a4a]'}`}>
                  <div className={`text-xs font-medium tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    {badges[planId] || 'PLAN'}
                  </div>
                </div>

                {/* Plan Content */}
                <div className="p-6 space-y-4">
                  <div>
                    <h3 className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {plan.name}
                    </h3>
                  </div>

                  {/* Price */}
                  <div>
                    <span className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      ${plan.price}
                    </span>
                  </div>

                  {/* Referral Info */}
                  <div className="space-y-2 py-4">
                    <div className={`text-sm ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                      <span className={`font-medium ${isDark ? 'text-[#d6d6d6]' : 'text-[#2a2a2a]'}`}>Direct Referrals:</span>
                      <span className={`ml-2 font-bold ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>Up to {
                        planId === 'basic' ? '10' : planId === 'pro' ? '50' : planId === 'elite' ? '200' : 'Unlimited'
                      }</span>
                    </div>
                    <div className={`text-sm ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                      <span className={`font-medium ${isDark ? 'text-[#d6d6d6]' : 'text-[#2a2a2a]'}`}>Indirect Referrals:</span>
                      <span className={`ml-2 font-bold ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>Up to {
                        planId === 'basic' ? '25' : planId === 'pro' ? '150' : planId === 'elite' ? '1,000' : 'Unlimited'
                      }</span>
                    </div>
                    <div className={`text-sm ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                      <span className={`font-medium ${isDark ? 'text-[#d6d6d6]' : 'text-[#2a2a2a]'}`}>Total Followers:</span>
                      <span className={`ml-2 font-bold ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>Up to {
                        planId === 'basic' ? '50' : planId === 'pro' ? '300' : planId === 'elite' ? '2,500' : 'Unlimited'
                      }</span>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleUpgrade(planId)}
                    disabled={currentPlan === planId}
                    className={`w-full py-3 rounded-lg font-semibold mt-6 transition-colors ${
                      currentPlan === planId
                        ? `${isDark ? 'bg-gray-200 text-gray-600' : 'bg-gray-700 text-gray-300'} cursor-not-allowed`
                        : `${isDark ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black hover:bg-gray-100'}`
                    } disabled:opacity-60`}
                  >
                    {currentPlan === planId ? 'Active' : 'Select Plan'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
