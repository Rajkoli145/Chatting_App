import { io, Socket } from 'socket.io-client';

interface SocketMessage {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  originalText: string;
  sourceLang: string;
  translatedText?: string;
  targetLang?: string;
  timestamp: string | Date;
  status: string;
}

interface SocketEvents {
  // Outgoing events
  'message:send': (data: { conversationId: string; text: string; sourceLang: string; targetLang: string }) => void;
  'typing:start': (data: { conversationId: string }) => void;
  'typing:stop': (data: { conversationId: string }) => void;
  'message:mark-read': (data: { conversationId: string; messageId: string }) => void;
  
  // Incoming events
  'message:new': (data: SocketMessage) => void;
  'message:delivered': (data: { messageId: string; deliveredAt: string }) => void;
  'message:read': (data: { messageId: string; readAt: string }) => void;
  'typing:update': (data: { conversationId: string; userId: string; isTyping: boolean }) => void;
  'presence:update': (data: { userId: string; online: boolean }) => void;
}

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string) {
    this.token = token;
    
    // Use environment variable or detect current host for network access
    let socketUrl = import.meta.env.VITE_API_URL;
    
    if (!socketUrl) {
      // If accessing from network IP, use network backend URL
      if (window.location.hostname === '192.168.0.102') {
        socketUrl = 'http://192.168.0.102:5001';
      } else {
        socketUrl = 'http://localhost:5001';
      }
    }
    
    this.socket = io(`${socketUrl}/chat`, {
      auth: {
        token: token,
      },
      withCredentials: true,
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Message events
  sendMessage(conversationId: string, text: string, sourceLang: string, targetLang: string, receiverId: string) {
    if (this.socket) {
      this.socket.emit('sendMessage', { 
        conversationId, 
        originalText: text, 
        sourceLang, 
        targetLang,
        receiverId
      });
    }
  }

  onNewMessage(callback: (message: SocketMessage) => void) {
    if (this.socket) {
      this.socket.on('newMessage', callback);
    }
  }

  onMessageDelivered(callback: (data: { messageId: string; deliveredAt: string }) => void) {
    if (this.socket) {
      this.socket.on('message:delivered', callback);
    }
  }

  onMessageRead(callback: (data: { messageId: string; readAt: string }) => void) {
    if (this.socket) {
      this.socket.on('message:read', callback);
    }
  }

  markMessageRead(conversationId: string, messageId: string) {
    if (this.socket) {
      this.socket.emit('message:mark-read', { conversationId, messageId });
    }
  }

  // Conversation management
  joinConversation(conversationId: string) {
    if (this.socket) {
      this.socket.emit('joinConversation', { conversationId });
    }
  }

  leaveConversation(conversationId: string) {
    if (this.socket) {
      this.socket.emit('leaveConversation', { conversationId });
    }
  }

  // Typing events
  startTyping(conversationId: string) {
    if (this.socket) {
      this.socket.emit('typing', { conversationId, isTyping: true });
    }
  }

  stopTyping(conversationId: string) {
    if (this.socket) {
      this.socket.emit('typing', { conversationId, isTyping: false });
    }
  }

  onTypingUpdate(callback: (data: { conversationId: string; userId: string; isTyping: boolean }) => void) {
    if (this.socket) {
      this.socket.on('userTyping', callback);
    }
  }

  // Presence events
  onPresenceUpdate(callback: (data: { userId: string; online: boolean }) => void) {
    if (this.socket) {
      this.socket.on('presence:update', callback);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
export type { SocketMessage };