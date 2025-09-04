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
  private userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds

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
      
      // Track multiple sockets per user
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      
      client.join(`user_${userId}`);
      
      this.logger.log(`💬 User ${userId} connected to chat with socket ${client.id}`);
      this.logger.log(`💬 Connected users: ${Array.from(this.connectedUsers.keys()).join(', ')}`);
      
      // Store userId on the socket for easier access
      (client as any).userId = userId;
      
      // Notify user is online (broadcast to all clients)
      this.server.emit('userStatusChanged', { userId, isOnline: true });
      
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
    // Join conversation room and user-specific room
    client.join(`conversation_${data.conversationId}`);
    client.join(`user_${userId}`);
    this.logger.log(`🔌 User ${userId} joined conversation room: conversation_${data.conversationId}`);
    this.logger.log(`🔌 User ${userId} joined user room: user_${userId}`);
    
    // Get all clients in this conversation room
    const room = this.server?.sockets?.adapter?.rooms?.get(`conversation_${data.conversationId}`);
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

  @SubscribeMessage('getUserStatus')
  handleGetUserStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const isOnline = this.userSockets.has(data.userId);
    client.emit('userStatusResponse', { userId: data.userId, isOnline });
  }

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const onlineUsers = Array.from(this.userSockets.keys());
    client.emit('onlineUsersResponse', { onlineUsers });
  }

  handleDisconnect(client: Socket) {
    const userId = (client as any).userId;
    if (userId) {
      this.logger.log(`💬 User ${userId} disconnected with socket ${client.id}`);
      
      // Remove this socket from user's socket set
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        
        // If user has no more active sockets, mark as offline
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
          this.connectedUsers.delete(userId);
          
          // Notify user is offline
          this.server.emit('userStatusChanged', { userId, isOnline: false });
          this.logger.log(`💬 User ${userId} is now offline`);
        } else {
          this.logger.log(`💬 User ${userId} still has ${userSocketSet.size} active connections`);
        }
      }
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

      // Get all participants in the conversation
      const conversation = await this.messagesService.findConversationById(data.conversationId);
      
      // Send personalized translated messages to each participant
      for (const participantId of conversation.participants) {
        // Get participant's preferred language
        const User = this.messagesService.getUserModel();
        const participant = await User.findById(participantId);
        const participantLang = participant?.preferredLanguage || 'en';
        
        // Translate message to participant's language
        let personalizedTranslation = savedMessage.originalText;
        if (participantLang !== savedMessage.sourceLang) {
          try {
            const TranslationService = this.messagesService.getTranslationService();
            personalizedTranslation = await TranslationService.translate(
              savedMessage.originalText, 
              savedMessage.sourceLang, 
              participantLang
            );
          } catch (error) {
            this.logger.error('Translation failed for participant:', error);
          }
        }

        // Create personalized message for this participant
        const personalizedMessage = {
          id: savedMessage._id.toString(),
          conversationId: savedMessage.conversationId,
          senderId: savedMessage.senderId,
          receiverId: savedMessage.receiverId,
          originalText: savedMessage.originalText,
          translatedText: personalizedTranslation,
          sourceLang: savedMessage.sourceLang,
          targetLang: participantLang,
          timestamp: (savedMessage as any).createdAt,
          status: savedMessage.status,
        };

        // Send to this specific participant
        this.server.to(`user_${participantId}`).emit('newMessage', personalizedMessage);
        
        this.logger.log(`💬 Sent personalized message to user ${participantId} in ${participantLang}: "${personalizedTranslation}"`);
      }

      this.logger.log(`💬 Message saved and broadcasted to conversation: ${data.conversationId}`);
      this.logger.log(`💬 Message ID: ${savedMessage._id.toString()}`);
      
      // Log room participants for debugging
      const conversationRoom = this.server?.sockets?.adapter?.rooms?.get(`conversation_${data.conversationId}`);
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
