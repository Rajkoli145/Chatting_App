import { io, Socket } from 'socket.io-client';

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

  connect(token: string) {
    this.token = token;
    this.socket = io('http://localhost:5001/chat', {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('💬 Connected to chat WebSocket');
    });

    this.socket.on('disconnect', () => {
      console.log('💬 Disconnected from chat WebSocket');
    });

    this.socket.on('connect_error', (error) => {
      console.error('💬 Chat WebSocket connection error:', error);
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
