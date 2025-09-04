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
import { MessagesService } from '../messages/messages.service';

@Injectable()
@WebSocketGateway({
  namespace: '/chat',
  cors: true,
  allowEIO3: true,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private jwtService: JwtService,
    private messagesService: MessagesService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        this.logger.error('No token provided for WebSocket connection');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;
      
      this.connectedUsers.set(userId, client.id);
      client.join(`user_${userId}`);
      
      this.logger.log(`💬 User ${userId} connected to chat with socket ${client.id}`);
      this.logger.log(`💬 Connected users: ${Array.from(this.connectedUsers.keys()).join(', ')}`);
      
      // Store userId on the socket for easier access
      (client as any).userId = userId;
      
      // Notify user is online
      client.broadcast.emit('userOnline', { userId });
      
    } catch (error) {
      this.logger.error('Chat connection failed:', error);
      client.disconnect();
    }
  }


  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = (client as any).userId;
    client.join(`conversation_${data.conversationId}`);
    this.logger.log(`💬 User ${userId} with socket ${client.id} joined conversation: ${data.conversationId}`);
    
    // Get all clients in this conversation room
    const room = this.server.sockets.adapter.rooms.get(`conversation_${data.conversationId}`);
    this.logger.log(`💬 Conversation ${data.conversationId} now has ${room?.size || 0} participants`);
  }

  @SubscribeMessage('leaveConversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conversation_${data.conversationId}`);
    this.logger.log(`💬 Client left conversation: ${data.conversationId}`);
  }

  @SubscribeMessage('userOnline')
  handleUserOnline(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const userId = data.userId;
    console.log('User came online:', userId);
    
    // Store user as online
    this.connectedUsers.set(client.id, userId);
    
    // Broadcast to all clients that this user is online
    this.server.emit('userStatusChanged', {
      userId: userId,
      isOnline: true
    });
  }

  @SubscribeMessage('userOffline')
  handleUserOffline(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const userId = data.userId;
    console.log('User went offline:', userId);
    
    // Remove user from connected users
    this.connectedUsers.delete(client.id);
    
    // Broadcast to all clients that this user is offline
    this.server.emit('userStatusChanged', {
      userId: userId,
      isOnline: false
    });
  }

  handleDisconnect(client: Socket) {
    const userId = this.connectedUsers.get(client.id);
    if (userId) {
      console.log('User disconnected:', userId);
      this.connectedUsers.delete(client.id);
    }
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

      // Save message to database
      const savedMessage = await this.messagesService.create(
        data.conversationId,
        senderId,
        data.receiverId,
        data.originalText,
        data.sourceLang,
        data.targetLang,
      );

      // Create message object for WebSocket emission
      const message = {
        id: savedMessage._id.toString(),
        conversationId: savedMessage.conversationId,
        senderId: savedMessage.senderId,
        receiverId: savedMessage.receiverId,
        originalText: savedMessage.originalText,
        translatedText: savedMessage.translatedText,
        sourceLang: savedMessage.sourceLang,
        targetLang: savedMessage.targetLang,
        timestamp: (savedMessage as any).createdAt,
        status: savedMessage.status,
      };

      // Only broadcast to conversation room to avoid duplicates
      this.server.to(`conversation_${data.conversationId}`).emit('newMessage', message);

      this.logger.log(`💬 Message saved and broadcasted to conversation: ${data.conversationId}`);
      this.logger.log(`💬 Message ID: ${message.id}`);
      
      // Log room participants for debugging
      const conversationRoom = this.server.sockets.adapter.rooms.get(`conversation_${data.conversationId}`);
      this.logger.log(`💬 Conversation room size: ${conversationRoom?.size || 0}`);
      
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

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; conversationId: string },
  ) {
    try {
      const token = client.handshake.auth.token;
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      const success = await this.messagesService.deleteMessage(data.messageId, userId);
      
      if (success) {
        // Emit to conversation room that message was deleted
        this.server.to(`conversation_${data.conversationId}`).emit('messageDeleted', {
          messageId: data.messageId,
          conversationId: data.conversationId,
        });
        
        this.logger.log(`💬 Message ${data.messageId} deleted by user ${userId}`);
      } else {
        client.emit('deleteMessageError', { error: 'Failed to delete message' });
      }
    } catch (error) {
      this.logger.error('Failed to delete message:', error);
      client.emit('deleteMessageError', { error: 'Failed to delete message' });
    }
  }

  @SubscribeMessage('clearConversation')
  async handleClearConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const token = client.handshake.auth.token;
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      const success = await this.messagesService.clearConversation(data.conversationId, userId);
      
      if (success) {
        // Emit to conversation room that conversation was cleared
        this.server.to(`conversation_${data.conversationId}`).emit('conversationCleared', {
          conversationId: data.conversationId,
          clearedBy: userId,
        });
        
        this.logger.log(`💬 Conversation ${data.conversationId} cleared by user ${userId}`);
      } else {
        client.emit('clearConversationError', { error: 'Failed to clear conversation' });
      }
    } catch (error) {
      this.logger.error('Failed to clear conversation:', error);
      client.emit('clearConversationError', { error: 'Failed to clear conversation' });
    }
  }

  // Method to emit message status updates
  async emitMessageStatus(messageId: string, status: 'delivered' | 'read') {
    // This would be called from other parts of the app
    this.server.emit('messageStatusUpdate', { messageId, status });
  }
}
