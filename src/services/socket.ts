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
      // Remove all listeners before disconnecting
      this.socket.removeAllListeners();
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
      // Remove any existing listeners first
      this.socket.off('newMessage');
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
      this.socket.off('userTyping');
      this.socket.on('userTyping', callback);
    }
  }

  // Presence events
  onUserStatusChanged(callback: (data: { userId: string; isOnline: boolean }) => void) {
    if (this.socket) {
      this.socket.off('userStatusChanged');
      this.socket.on('userStatusChanged', callback);
    }
  }

  getUserStatus(userId: string) {
    if (this.socket) {
      this.socket.emit('getUserStatus', { userId });
    }
  }

  onUserStatusResponse(callback: (data: { userId: string; isOnline: boolean }) => void) {
    if (this.socket) {
      this.socket.off('userStatusResponse');
      this.socket.on('userStatusResponse', callback);
    }
  }

  getOnlineUsers() {
    if (this.socket) {
      this.socket.emit('getOnlineUsers');
    }
  }

  onOnlineUsersResponse(callback: (data: { onlineUsers: string[] }) => void) {
    if (this.socket) {
      this.socket.on('onlineUsersResponse', callback);
    }
  }

  // Delete message
  deleteMessage(messageId: string, conversationId: string) {
    if (this.socket) {
      this.socket.emit('deleteMessage', { messageId, conversationId });
    }
  }

  onMessageDeleted(callback: (data: { messageId: string; conversationId: string }) => void) {
    if (this.socket) {
      this.socket.off('messageDeleted');
      this.socket.on('messageDeleted', callback);
    }
  }

  onDeleteMessageError(callback: (data: { error: string }) => void) {
    if (this.socket) {
      this.socket.off('deleteMessageError');
      this.socket.on('deleteMessageError', callback);
    }
  }

  // Clear conversation
  clearConversation(conversationId: string) {
    if (this.socket) {
      this.socket.emit('clearConversation', { conversationId });
    }
  }

  onConversationCleared(callback: (data: { conversationId: string; clearedBy: string }) => void) {
    if (this.socket) {
      this.socket.off('conversationCleared');
      this.socket.on('conversationCleared', callback);
    }
  }

  onClearConversationError(callback: (data: { error: string }) => void) {
    if (this.socket) {
      this.socket.off('clearConversationError');
      this.socket.on('clearConversationError', callback);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Method to clean up all listeners
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

export const socketService = new SocketService();
export type { SocketMessage };