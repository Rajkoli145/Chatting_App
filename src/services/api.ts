
// API service for backend communication
// Use environment variable or fallback to localhost:5000
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

interface User {
  id: string;
  mobile: string;
  name: string;
  preferredLanguage: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  user: User;
  lastMessage?: {
    text: string;
    timestamp: string;
    isOwn: boolean;
  };
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  originalText: string;
  sourceLang: string;
  translatedText?: string;
  targetLang?: string;
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('authToken');
  }

  setAuthToken(token: string) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    console.log(`API: Making ${options.method || 'GET'} request to ${url}`);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
      console.log('API: Added auth token to request');
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log(`API: Response status ${response.status} for ${endpoint}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API: Error response:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log(`API: Success response for ${endpoint}:`, data);
      return data;
    } catch (error: any) {
      console.error(`API: Request failed for ${endpoint}:`, error);
      
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Failed to fetch - Backend server might not be running');
      }
      
      throw error;
    }
  }

  // Auth endpoints
  async register(mobile: string, name: string, preferredLanguage: string) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mobile, name, preferredLanguage }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw { response: { data: error } };
    }
    
    return response.json();
  }

  async login(mobile: string) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mobile }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw { response: { data: error } };
    }
    
    return response.json();
  }

  async verifyOTP(mobile: string, otp: string) {
    console.log('API: Verifying OTP for mobile:', mobile, 'OTP:', otp);
    
    const response = await this.request<{ accessToken: string; user: User }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile, otp }),
    });
    
    this.token = response.accessToken;
    localStorage.setItem('authToken', this.token);
    console.log('API: Stored auth token');
    
    return response;
  }

  async getCurrentUser() {
    return this.request<User>('/users/me');
  }

  async updateProfile(data: { name?: string; preferredLanguage?: string }) {
    return this.request<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async searchUsers(query: string) {
    // Refresh token from localStorage in case it was updated
    this.token = localStorage.getItem('authToken');
    console.log('API: Searching users with query:', query);
    console.log('API: Current token:', this.token ? 'Present' : 'Missing');
    
    return this.request<User[]>(`/users/search?q=${encodeURIComponent(query)}`);
  }

  // Chat endpoints
  async getConversations() {
    return this.request<Conversation[]>('/conversations');
  }

  async createConversation(userId: string) {
    return this.request<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async getMessages(conversationId: string, cursor?: string) {
    const query = cursor ? `?cursor=${cursor}` : '';
    return this.request<{ messages: Message[]; hasMore: boolean }>(`/conversations/${conversationId}/messages${query}`);
  }

  logout() {
    console.log('API: Logging out - clearing token and user data');
    this.token = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }
}

export const apiService = new ApiService();
export type { User, Conversation, Message };
