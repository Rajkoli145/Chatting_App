import { io, Socket } from 'socket.io-client';

const CHAT_SERVER_URL = 'http://localhost:5001';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  originalText: string;
  translatedText?: string;
  sourceLang: string;
  targetLang?: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
}

class ChatService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private onUserStatusChange?: (data: { userId: string; isOnline: boolean }) => void;

  connect(token: string) {
    if (this.socket?.connected) {
      console.log('💬 Already connected to chat');
      return;
    }

    console.log('💬 Connecting to chat WebSocket...');
    this.socket = io(CHAT_SERVER_URL, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to chat server');
      
      // Notify server that user is online
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (currentUser.id) {
        this.socket?.emit('userOnline', { userId: currentUser.id });
      }
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from chat server');
      
      // Notify server that user is offline
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (currentUser.id) {
        this.socket?.emit('userOffline', { userId: currentUser.id });
      }
    });

    this.socket.on('messageError', (error) => {
      console.error('💬 Message error:', error);
    });

    // Listen for user status changes
    this.socket.on('userStatusChanged', (data: { userId: string; isOnline: boolean }) => {
      console.log('👤 User status changed:', data);
      if (this.onUserStatusChange) {
        this.onUserStatusChange(data);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinConversation(conversationId: string) {
    if (this.socket) {
      this.socket.emit('joinConversation', { conversationId });
      console.log(`💬 Joined conversation: ${conversationId}`);
    }
  }

  leaveConversation(conversationId: string) {
    if (this.socket) {
      this.socket.emit('leaveConversation', { conversationId });
      console.log(`💬 Left conversation: ${conversationId}`);
    }
  }

  sendMessage(data: {
    conversationId: string;
    receiverId: string;
    originalText: string;
    sourceLang: string;
    targetLang?: string;
  }) {
    if (this.socket) {
      this.socket.emit('sendMessage', data);
      console.log('💬 Sent message:', data.originalText);
    }
  }

  onNewMessage(callback: (message: Message) => void) {
    if (this.socket) {
      this.socket.on('newMessage', callback);
    }
  }

  onMessageStatusUpdate(callback: (data: { messageId: string; status: string }) => void) {
    if (this.socket) {
      this.socket.on('messageStatusUpdate', callback);
    }
  }

  onUserTyping(callback: (data: { userId: string; isTyping: boolean }) => void) {
    if (this.socket) {
      this.socket.on('userTyping', callback);
    }
  }

  onUserStatusChanged(callback: (data: { userId: string; isOnline: boolean }) => void) {
    this.onUserStatusChange = callback;
  }

  onUserOnline(callback: (data: { userId: string }) => void) {
    if (this.socket) {
      this.socket.on('userOnline', callback);
    }
  }

  onUserOffline(callback: (data: { userId: string }) => void) {
    if (this.socket) {
      this.socket.on('userOffline', callback);
    }
  }

  sendTyping(conversationId: string, isTyping: boolean) {
    if (this.socket) {
      this.socket.emit('typing', { conversationId, isTyping });
    }
  }

  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

export const chatService = new ChatService();
export type { Message };
