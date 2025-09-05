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
  isTranslated?: boolean;
}

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private isConnected: boolean = false;

  connect(token: string) {
    this.token = token;
    
    if (this.socket?.connected) {
      console.log('🔌 Socket already connected, disconnecting first...');
      this.socket.disconnect();
    }

    console.log('🔌 Connecting to WebSocket with namespace /chat...');
    
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
      auth: { token },
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to chat WebSocket');
      this.isConnected = true;
      
      // Test WebSocket connection by immediately requesting online users
      setTimeout(() => {
        console.log('🔌 Testing WebSocket connection by requesting online users...');
        this.getOnlineUsers();
      }, 1000);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from chat WebSocket:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
      this.isConnected = false;
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('❌ WebSocket reconnection error:', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ WebSocket reconnection failed completely');
    });

    // Add periodic connection health check
    setInterval(() => {
      if (this.socket && !this.socket.connected) {
        console.log('🔌 Socket disconnected, attempting to reconnect...');
        this.socket.connect();
      }
    }, 5000);

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting WebSocket...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  forceReconnect() {
    console.log('🔌 Force reconnecting WebSocket...');
    if (this.socket) {
      this.socket.disconnect();
    }
    if (this.token) {
      this.connect(this.token);
    }
  }

  ensureConnection() {
    if (!this.socket || !this.socket.connected) {
      console.log('🔌 Ensuring WebSocket connection...');
      if (this.token) {
        this.connect(this.token);
      }
    }
  }

  // Message events
  sendMessage(conversationId: string, receiverId: string, originalText: string, sourceLang: string = 'en', targetLang?: string) {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    
    console.log('🔥 FRONTEND: Sending message via socket:', {
      conversationId,
      receiverId,
      originalText,
      sourceLang,
      targetLang
    });
    
    this.socket.emit('sendMessage', {
      conversationId,
      receiverId,
      originalText,
      sourceLang,
      targetLang
    });
  }

  sendMessageToUser(receiverMobile: string, originalText: string, sourceLang: string = 'en', targetLang?: string) {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    
    console.log('🔥 FRONTEND: Sending message to user by mobile:', {
      receiverMobile,
      originalText,
      sourceLang,
      targetLang
    });
    
    this.socket.emit('sendMessageToUser', {
      receiverMobile,
      originalText,
      sourceLang,
      targetLang
    });
  }

  onNewMessage(callback: (message: SocketMessage) => void) {
    if (this.socket) {
      this.socket.off('newMessage');
      this.socket.on('newMessage', (message) => {
        console.log('🔌 Socket service received newMessage:', message);
        callback(message);
      });
    }
  }

  onMessageDelivered(callback: (data: { messageId: string; deliveredAt: string }) => void) {
    if (this.socket) {
      this.socket.off('messageDelivered');
      this.socket.on('messageDelivered', callback);
    }
  }

  onMessageRead(callback: (data: { messageId: string; readAt: string }) => void) {
    if (this.socket) {
      this.socket.off('messageRead');
      this.socket.on('messageRead', callback);
    }
  }

  markMessageRead(conversationId: string, messageId: string) {
    if (this.socket) {
      this.socket.emit('markMessageRead', { conversationId, messageId });
    }
  }

  // Conversation events
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
      console.log('🔌 Setting up userStatusChanged listener');
      this.socket.off('userStatusChanged');
      this.socket.on('userStatusChanged', (data) => {
        console.log('🔌 Socket service received userStatusChanged:', data);
        callback(data);
      });
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
      console.log('🔌 Requesting online users from backend...');
      this.socket.emit('getOnlineUsers');
    } else {
      console.log('🔌 Cannot request online users - socket not connected');
    }
  }

  onOnlineUsers(callback: (userIds: string[]) => void) {
    if (this.socket) {
      console.log('🔌 Setting up onlineUsers listener');
      this.socket.off('onlineUsers');
      this.socket.on('onlineUsers', (userIds) => {
        console.log('🔌 Socket service received onlineUsers:', userIds);
        // Force log to ensure we can see if events are received
        console.error('🔌 FORCE LOG - Socket service received onlineUsers:', userIds);
        callback(userIds);
      });
    }
  }

  onOnlineUsersResponse(callback: (data: { onlineUsers: string[] }) => void) {
    if (this.socket) {
      this.socket.on('onlineUsersResponse', callback);
    }
  }

  // Unread counts
  getUnreadCounts() {
    if (this.socket) {
      this.socket.emit('getUnreadCounts');
    }
  }

  onUnreadCounts(callback: (counts: { [conversationId: string]: number }) => void) {
    if (this.socket) {
      this.socket.off('unreadCounts');
      this.socket.on('unreadCounts', callback);
    }
  }

  offUnreadCounts() {
    if (this.socket) {
      this.socket.off('unreadCounts');
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

  onConversationCleared(callback: (data: { conversationId: string }) => void) {
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

  onNewConversationMessage(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('newConversationMessage', callback);
    }
  }

  onMessageToUserSent(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('messageToUserSent', callback);
    }
  }

  offNewConversationMessage() {
    if (this.socket) {
      this.socket.off('newConversationMessage');
    }
  }

  offMessageToUserSent() {
    if (this.socket) {
      this.socket.off('messageToUserSent');
    }
  }

  get connected(): boolean {
    return this.isConnected && !!this.socket?.connected;
  }

  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

export default new SocketService();
