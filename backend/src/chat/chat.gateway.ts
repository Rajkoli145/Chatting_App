import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
// import { MessagesService } from './messages.service';

@Injectable()
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: ['http://localhost:8080', 'http://localhost:8081'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private jwtService: JwtService,
    // private messagesService: MessagesService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;
      
      this.connectedUsers.set(userId, client.id);
      client.join(`user_${userId}`);
      
      this.logger.log(`💬 User ${userId} connected to chat`);
      
      // Notify user is online
      client.broadcast.emit('userOnline', { userId });
      
    } catch (error) {
      this.logger.error('Chat connection failed:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Find and remove user from connected users
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        client.broadcast.emit('userOffline', { userId });
        this.logger.log(`💬 User ${userId} disconnected from chat`);
        break;
      }
    }
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.join(`conversation_${data.conversationId}`);
    this.logger.log(`💬 Client joined conversation: ${data.conversationId}`);
  }

  @SubscribeMessage('leaveConversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conversation_${data.conversationId}`);
    this.logger.log(`💬 Client left conversation: ${data.conversationId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      conversationId: string;
      receiverId: string;
      originalText: string;
      sourceLang: string;
      targetLang?: string;
    },
  ) {
    try {
      const token = client.handshake.auth.token;
      const payload = this.jwtService.verify(token);
      const senderId = payload.sub;

      // For now, create a simple message object without database
      const message = {
        id: Date.now().toString(),
        conversationId: data.conversationId,
        senderId,
        receiverId: data.receiverId,
        originalText: data.originalText,
        translatedText: data.targetLang ? `[TRANSLATED] ${data.originalText}` : undefined,
        sourceLang: data.sourceLang,
        targetLang: data.targetLang,
        timestamp: new Date(),
        status: 'sent',
      };

      // Emit to conversation room
      this.server.to(`conversation_${data.conversationId}`).emit('newMessage', message);

      this.logger.log(`💬 Message sent in conversation: ${data.conversationId}`);
      
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      client.emit('messageError', { error: 'Failed to send message' });
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    const token = client.handshake.auth.token;
    const payload = this.jwtService.verify(token);
    const userId = payload.sub;

    // Emit typing status to conversation room (excluding sender)
    client.to(`conversation_${data.conversationId}`).emit('userTyping', {
      userId,
      isTyping: data.isTyping,
    });
  }

  // Method to emit message status updates
  async emitMessageStatus(messageId: string, status: 'delivered' | 'read') {
    // This would be called from other parts of the app
    this.server.emit('messageStatusUpdate', { messageId, status });
  }
}
