
// API service for backend communication
// Use environment variable or detect current host for network access
let API_BASE_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  // If accessing from network IP, use network backend URL
  if (typeof window !== 'undefined' && window.location.hostname === '192.168.0.102') {
    API_BASE_URL = 'http://192.168.0.102:5001';
  } else {
    API_BASE_URL = 'http://localhost:5001';
  }
}

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
    console.log('🔧 ApiService initialized with token:', !!this.token);
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

    // Add auth token for all endpoints
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
      console.log('API: Added auth token to request');
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors',
        credentials: 'include',
      });

      console.log(`API: Response status ${response.status} for ${endpoint}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API: Error response:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log(`API: Success response for ${endpoint}:`, data);
      console.log(`API: Data is array?`, Array.isArray(data), 'Length:', data?.length);
      return data;
    } catch (error: any) {
      console.error(`API: Request failed for ${endpoint}:`, error);
      
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Failed to fetch - Backend server might not be running');
      }
      
      // If we get a 401 error, clear the invalid token
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        console.log('API: Clearing invalid token due to 401 error');
        this.token = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
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
    try {
      const result = await this.request<User[]>(`/users/search?q=${encodeURIComponent(query)}`);
      console.log('API: Search users result:', result);
      console.log('API: Result type:', typeof result, 'Array?', Array.isArray(result));
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('API: Search users error:', error);
      return [];
    }
  }

  // Chat endpoints
  async getConversations() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id;
    console.log('API: Getting conversations for user:', userId);
    return this.request<Conversation[]>(`/conversations?userId=${userId}`);
  }

  async getMessages(conversationId: string, cursor?: string) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id;
    console.log('API: Getting messages for conversation:', conversationId, 'user:', userId);
    const query = cursor ? `?cursor=${cursor}&userId=${userId}` : `?userId=${userId}`;
    return this.request<{ messages: Message[]; hasMore: boolean }>(`/conversations/${conversationId}/messages${query}`);
  }

  async sendMessage(conversationId: string, messageData: {
    originalText: string;
    sourceLang: string;
    receiverId: string;
  }) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const senderId = currentUser.id;
    
    console.log('API: Sending message to conversation:', conversationId, 'from:', senderId, 'to:', messageData.receiverId);
    return this.request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        ...messageData,
        senderId: senderId
      }),
    });
  }

  async createConversation(userId: string) {
    console.log('API: Creating conversation with user ID:', userId);
    try {
      const result = await this.request<Conversation>('/conversations', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      console.log('API: Conversation created successfully:', result);
      return result;
    } catch (error) {
      console.error('API: Failed to create conversation:', error);
      throw error;
    }
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
