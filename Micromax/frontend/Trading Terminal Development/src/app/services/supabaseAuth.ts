import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const SUPABASE_URL = `https://${projectId}.supabase.co`;
const AUTH_BASE_URL = `${SUPABASE_URL}/auth/v1`;
const SESSION_STORAGE_KEY = 'micromax_supabase_session';
const USER_INFO_KEY = 'micromax_user_info';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  telegramId: string;
  createdAt?: string;  plan: 'free' | 'pro' | 'elite' | 'unlimited';
  sessionCount: number;
  screenshotCount: number;
  screenShareCount: number;
  totalSessions: number;}

interface AuthMetadata {
  full_name?: string;
  phone?: string;
  telegram_id?: string;
}

interface SupabaseUserResponse {
  id: string;
  email?: string;
  user_metadata?: AuthMetadata;
  created_at?: string;
  app_metadata?: Record<string, any>;
}

interface SessionResponse {
  access_token: string;
  refresh_token: string;
  user: SupabaseUserResponse;
  expires_in?: number;
}

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

interface AuthRequestOptions extends RequestInit {
  accessToken?: string;
}

// Error handling utilities
class AuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AuthError';
  }
}

interface AuthRequestOptions extends RequestInit {
  accessToken?: string;
}

async function authRequest<T>(path: string, options: AuthRequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('apikey', publicAnonKey);
  headers.set('Content-Type', 'application/json');

  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  try {
    console.log('📤 Auth Request:', { path, method: options.method || 'GET' });
    const response = await fetch(`${AUTH_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));
    
    console.log('📥 Auth Response:', { 
      path, 
      status: response.status, 
      ok: response.ok,
      fullResponse: JSON.stringify(data, null, 2)
    });

    if (!response.ok) {
      const errorMsg = data?.msg || data?.error_description || data?.message || data?.error || 'Authentication failed';
      const errorCode = data?.error || data?.error_code;
      console.error('❌ Auth Error Details:', { 
        path, 
        errorMsg, 
        errorCode, 
        status: response.status,
        fullData: data
      });
      throw new AuthError(errorMsg, errorCode);
    }

    return data as T;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Network/Parse Error:', msg, error);
    throw new AuthError(`Network error: ${msg}`);
  }
}

function mapUser(user: SupabaseUserResponse | undefined): AuthUser {
  if (!user?.id) {
    throw new AuthError('Invalid user data: missing id');
  }

  return {
    id: user.id,
    email: user.email || '',
    fullName: user.user_metadata?.full_name || '',
    phone: user.user_metadata?.phone || '',
    telegramId: user.user_metadata?.telegram_id || '',
    createdAt: user.created_at,
  };
}

function storeSession(session: StoredSession | null) {
  if (!session) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(USER_INFO_KEY);
    return;
  }

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(session.user));
}

function getStoredSession(): StoredSession | null {
  const sessionStr = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionStr) return null;

  try {
    const session: StoredSession = JSON.parse(sessionStr);
    
    // Check if session is expired
    if (session.expiresAt && Date.now() > session.expiresAt) {
      console.log('⏰ Session expired');
      storeSession(null);
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Failed to parse stored session:', error);
    storeSession(null);
    return null;
  }
}

export interface SignUpPayload {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  telegramId: string;
}

export interface SignInPayload {
  email: string;
  password: string;
}

export const supabaseAuth = {
  async signUp(payload: SignUpPayload): Promise<AuthUser> {
    if (!payload.email || !payload.password) {
      throw new AuthError('Email and password are required');
    }

    if (payload.password.length < 6) {
      throw new AuthError('Password must be at least 6 characters long');
    }

    console.log('� Attempting Supabase signup for:', payload.email);
    
    try {
      const session = await authRequest<SessionResponse>('/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          data: {
            full_name: payload.fullName,
            phone: payload.phone,
            telegram_id: payload.telegramId,
          },
        }),
      });

      console.log('📨 Full Signup Response:', JSON.stringify(session, null, 2));

      // Check if we have a valid user with an id FIRST
      if (!session?.user?.id) {
        // No user id in response, use fallback
        if (session?.access_token && payload.email) {
          console.log('ℹ️ Warning: Supabase signup returned no user ID, using fallback');
          const fallbackUser: AuthUser = {
            id: `user_${Date.now()}`,
            email: payload.email,
            fullName: payload.fullName,
            phone: payload.phone,
            telegramId: payload.telegramId,
          };

          storeSession({
            accessToken: session.access_token,
            refreshToken: session.refresh_token || '',
            expiresAt: Date.now() + ((session.expires_in || 3600) * 1000),
            user: fallbackUser,
          });

          console.log('✅ Signup successful (fallback):', fallbackUser.email);
          return fallbackUser;
        }
        throw new AuthError('Signup failed: Supabase returned no user data or tokens');
      }

      // We have a valid user, now map it
      const user = mapUser(session.user);

      if (session.access_token && session.refresh_token) {
        storeSession({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: Date.now() + ((session.expires_in || 3600) * 1000),
          user,
        });
        console.log('✅ Signup successful:', user.email);
      }

      return user;
    } catch (error) {
      console.error('❌ Signup failed:', error);
      throw error;
    }
  },

  async signIn(payload: SignInPayload): Promise<AuthUser> {
    if (!payload.email || !payload.password) {
      throw new AuthError('Email and password are required');
    }

    console.log('🔑 Attempting Supabase signin for:', payload.email);
    
    try {
      const session = await authRequest<SessionResponse>('/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
        }),
      });

      const user = mapUser(session?.user);

      if (!user?.id) {
        throw new AuthError('Invalid response from Supabase: user data missing');
      }

      storeSession({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: Date.now() + ((session.expires_in || 3600) * 1000),
        user,
      });
      console.log('✅ Signin successful:', user.email);
      return user;
    } catch (error) {
      console.error('❌ Signin failed:', error);
      throw error;
    }
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    const session = getStoredSession();
    if (!session?.accessToken) {
      console.log('ℹ️ No stored session found');
      return null;
    }

    try {
      const user = await authRequest<{ user: SupabaseUserResponse }>('/user', {
        method: 'GET',
        accessToken: session.accessToken,
      });

      // If we have stored user data, use that as fallback
      if (!user?.user?.id && session?.user?.id) {
        console.log('✅ Current user loaded (from cache):', session.user);
        return session.user;
      }

      const mappedUser = mapUser(user?.user);

      if (!mappedUser?.id) {
        throw new AuthError('Invalid response from Supabase: user data missing');
      }

      storeSession({
        ...session,
        user: mappedUser,
      });
      console.log('✅ Current user loaded:', mappedUser);
      return mappedUser;
    } catch (error) {
      console.error('❌ Failed to get current user:', error);
      // Return stored user as fallback instead of null
      if (session?.user?.id) {
        console.log('✅ Using cached user:', session.user);
        return session.user;
      }
      return null;
    }
  },

  getSession() {
    return getStoredSession();
  },

  async updateProfile(updates: Partial<Pick<AuthUser, 'fullName' | 'phone' | 'telegramId'>>): Promise<AuthUser> {
    const session = getStoredSession();
    if (!session?.accessToken) {
      throw new AuthError('Please sign in first.');
    }

    console.log('🔄 Updating profile with:', updates);
    
    try {
      const user = await authRequest<SupabaseUserResponse>('/user', {
        method: 'PUT',
        accessToken: session.accessToken,
        body: JSON.stringify({
          data: {
            full_name: updates.fullName ?? session.user.fullName,
            phone: updates.phone ?? session.user.phone,
            telegram_id: updates.telegramId ?? session.user.telegramId,
          },
        }),
      });

      const mappedUser = mapUser(user);
      storeSession({
        ...session,
        user: mappedUser,
      });
      console.log('✅ Profile updated successfully:', mappedUser);
      return mappedUser;
    } catch (error) {
      console.error('❌ Profile update failed:', error);
      throw error;
    }
  },

  async updateTelegramId(telegramId: string): Promise<AuthUser> {
    if (!telegramId || !telegramId.trim()) {
      throw new AuthError('Telegram ID is required');
    }

    if (!/^\d+$/.test(telegramId)) {
      throw new AuthError('Telegram ID must be numeric');
    }

    console.log('📱 Updating Telegram ID...');
    return this.updateProfile({ telegramId });
  },

  async signOut() {
    const session = getStoredSession();

    if (session?.accessToken) {
      try {
        console.log('🚪 Attempting to sign out from Supabase...');
        await authRequest('/logout', {
          method: 'POST',
          accessToken: session.accessToken,
        });
      } catch (error) {
        // Clear the local session even if the server-side signout fails.
        console.warn('⚠️ Server-side logout failed, clearing local session:', error);
      }
    }

    storeSession(null);
    console.log('✅ Signed out successfully');
  },

  async refreshSession(): Promise<AuthUser | null> {
    const session = getStoredSession();
    if (!session?.refreshToken) {
      console.log('ℹ️ No refresh token available');
      return null;
    }

    try {
      console.log('🔄 Refreshing session...');
      const response = await authRequest<SessionResponse>('/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({
          refresh_token: session.refreshToken,
        }),
      });

      const user = mapUser(response.user);
      storeSession({
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        expiresAt: Date.now() + ((response.expires_in || 3600) * 1000),
        user,
      });
      console.log('✅ Session refreshed successfully');
      return user;
    } catch (error) {
      console.error('❌ Session refresh failed:', error);
      storeSession(null);
      return null;
    }
  },

  async initializeSession(): Promise<AuthUser | null> {
    console.log('⚙️ Initializing session...');
    const session = getStoredSession();
    
    if (!session) {
      console.log('ℹ️ No session to initialize');
      return null;
    }

    // Check if token needs refresh (5 minute buffer)
    const timeUntilExpiry = (session.expiresAt || 0) - Date.now();
    const REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes in milliseconds

    if (timeUntilExpiry < REFRESH_BUFFER) {
      console.log('🔄 Token expiring soon, refreshing...');
      return this.refreshSession();
    }

    // Validate current session
    return this.getCurrentUser();
  },
};
