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
      
      // Add event listener debugging
      this.logger.log(`🔥 Setting up event listeners for socket ${client.id}`);
      
      // Notify user is online (broadcast to all clients except the connecting one)
      console.log(`🟢 Broadcasting user ${userId} as ONLINE`);
      this.server.emit('userStatusChanged', { userId, isOnline: true });
      
      // Also send to the connecting client
      client.emit('userStatusChanged', { userId, isOnline: true });
      
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
    this.logger.log('🔥 BACKEND: joinConversation event received!');
    this.logger.log('🔥 BACKEND: joinConversation data:', JSON.stringify(data, null, 2));
    
    const userId = (client as any).userId;
    // Join conversation room and user-specific room
    client.join(`conversation_${data.conversationId}`);
    client.join(`user_${userId}`);
    this.logger.log(`🔌 User ${userId} joined conversation room: conversation_${data.conversationId}`);
    this.logger.log(`🔌 User ${userId} joined user room: user_${userId}`);
    
    // Send current unread counts BEFORE marking as read
    const unreadCounts = await this.messagesService.getUnreadMessageCounts(userId);
    client.emit('unreadCounts', unreadCounts);
    
    // Mark messages as read when user joins conversation (after sending counts)
    await this.messagesService.markMessagesAsRead(data.conversationId, userId);
    
    // Send updated unread counts after marking as read
    const updatedUnreadCounts = await this.messagesService.getUnreadMessageCounts(userId);
    client.emit('unreadCounts', updatedUnreadCounts);
    
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
  async handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const onlineUserIds = Array.from(this.connectedUsers.keys());
    console.log(`📋 Frontend requested online users, sending:`, onlineUserIds);
    client.emit('onlineUsers', onlineUserIds);
  }

  @SubscribeMessage('getUnreadCounts')
  async handleGetUnreadCounts(@ConnectedSocket() client: Socket) {
    const userId = (client as any).userId;
    console.log(`📊 Frontend requested unread counts for user: ${userId}`);
    const unreadCounts = await this.messagesService.getUnreadMessageCounts(userId);
    console.log(`📊 Sending unread counts to frontend:`, unreadCounts);
    client.emit('unreadCounts', unreadCounts);
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
          console.log(`🔴 Broadcasting user ${userId} as OFFLINE`);
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
    this.logger.log('🔥 BACKEND: sendMessage event received!');
    this.logger.log('🔥 BACKEND: Data received:', JSON.stringify(data, null, 2));
    this.logger.log('🔥 BACKEND: Client ID:', client.id);
    
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
      
      // Send personalized messages immediately to each user
      await this.sendPersonalizedMessages(savedMessage, conversation.participants);
      
      this.logger.log(`💬 Message delivered immediately to conversation: ${data.conversationId}`);
      
      // Process personalized translations asynchronously (non-blocking)
      this.processPersonalizedTranslations(savedMessage, conversation.participants).catch(error => {
        this.logger.error('Background translation processing failed:', error);
      });

      this.logger.log(`💬 Message saved and broadcasted to conversation: ${data.conversationId}`);
      this.logger.log(`💬 Message ID: ${savedMessage._id.toString()}`);
      
      // Log room participants for debugging
      const conversationRoom = this.server?.sockets?.adapter?.rooms?.get(`conversation_${data.conversationId}`);
    } catch (error) {
      this.logger.error('Error handling message:', error);
      client.emit('messageError', { error: 'Failed to send message' });
    }
  }

  // Send personalized messages immediately to each participant
  private async sendPersonalizedMessages(savedMessage: any, participants: any[]) {
    const User = this.messagesService.getUserModel();
    const TranslationService = this.messagesService.getTranslationService();
    
    // Get sender's preferred language
    const sender = await User.findById(savedMessage.senderId);
    const senderPreferredLang = sender?.preferredLanguage || savedMessage.sourceLang || 'en';
    
    // Send immediate messages to all participants
    for (const participantId of participants) {
      try {
        const participant = await User.findById(participantId);
        const participantLang = participant?.preferredLanguage || 'en';
        const isSender = participantId.toString() === savedMessage.senderId.toString();
        
        let messageToSend;
        
        if (isSender) {
          // Sender always sees original text
          messageToSend = {
            id: savedMessage._id.toString(),
            conversationId: savedMessage.conversationId,
            senderId: savedMessage.senderId,
            receiverId: savedMessage.receiverId,
            originalText: savedMessage.originalText,
            translatedText: savedMessage.originalText, // Same as original for sender
            sourceLang: savedMessage.sourceLang,
            targetLang: senderPreferredLang,
            timestamp: savedMessage.createdAt,
            status: savedMessage.status,
            isTranslated: false
          };
        } else {
          // Receiver gets message translated to their preferred language
          let basicTranslation = savedMessage.originalText;
          
          // Always translate if source language is different from participant's preferred language
          if (savedMessage.sourceLang !== participantLang) {
            try {
              basicTranslation = await TranslationService.translate(
                savedMessage.originalText,
                savedMessage.sourceLang,
                participantLang
              );
              this.logger.log(`🌐 Immediate translation: "${savedMessage.originalText}" → "${basicTranslation}" (${savedMessage.sourceLang} → ${participantLang})`);
            } catch (error) {
              this.logger.error(`Basic translation failed for ${participantId}:`, error);
              basicTranslation = savedMessage.originalText; // Fall back to original text
            }
          } else {
            this.logger.log(`🌐 No translation needed for ${participantId}: message already in preferred language (${participantLang})`);
          }
          
          messageToSend = {
            id: savedMessage._id.toString(),
            conversationId: savedMessage.conversationId,
            senderId: savedMessage.senderId,
            receiverId: savedMessage.receiverId,
            originalText: savedMessage.originalText,
            translatedText: basicTranslation,
            sourceLang: savedMessage.sourceLang,
            targetLang: participantLang,
            timestamp: savedMessage.createdAt,
            status: savedMessage.status,
            isTranslated: basicTranslation !== savedMessage.originalText
          };
        }
        
        // Send to user's personal room only (avoid duplicate conversation room messages)
        this.server.to(`user_${participantId}`).emit('newMessage', messageToSend);
        
        // Update unread counts for receiver (not sender)
        if (!isSender) {
          const unreadCounts = await this.messagesService.getUnreadMessageCounts(participantId.toString());
          this.server.to(`user_${participantId}`).emit('unreadCounts', unreadCounts);
        }
        
        this.logger.log(`💬 Sent immediate message to ${participantId}: "${messageToSend.translatedText}"`);
        
      } catch (error) {
        this.logger.error(`Failed to send immediate message to participant ${participantId}:`, error);
      }
    }
  }

  private async processPersonalizedTranslations(savedMessage: any, participants: any[]) {
    const User = this.messagesService.getUserModel();
    const TranslationService = this.messagesService.getTranslationService();
    
    // Get sender's preferred language
    const sender = await User.findById(savedMessage.senderId);
    const senderPreferredLang = sender?.preferredLanguage || savedMessage.sourceLang || 'en';
    
    // Process all translations in parallel for better performance
    const translationPromises = participants.map(async (participantId) => {
      try {
        const participant = await User.findById(participantId);
        const participantLang = participant?.preferredLanguage || 'en';
        
        // Skip if same language as source language or if it's the sender
        if (participantLang === savedMessage.sourceLang || participantId.toString() === savedMessage.senderId.toString()) {
          this.logger.log(`🌐 Skipping translation for ${participantId}: same language (${participantLang}) or sender`);
          return;
        }
        
        const personalizedTranslation = await TranslationService.translate(
          savedMessage.originalText, 
          savedMessage.sourceLang, 
          participantLang
        );
        
        // Send updated translation if different from original
        if (personalizedTranslation !== savedMessage.originalText) {
          const updatedMessage = {
            id: savedMessage._id.toString(),
            conversationId: savedMessage.conversationId,
            senderId: savedMessage.senderId,
            receiverId: savedMessage.receiverId,
            originalText: savedMessage.originalText,
            translatedText: personalizedTranslation,
            sourceLang: savedMessage.sourceLang,
            targetLang: participantLang,
            timestamp: savedMessage.createdAt,
            status: savedMessage.status,
            isTranslationUpdate: true
          };
          
          this.server.to(`user_${participantId}`).emit('messageTranslationUpdate', updatedMessage);
          this.logger.log(`🌐 Sent personalized translation to ${participantId}: "${personalizedTranslation}"`);
        }
      } catch (error) {
        this.logger.error(`Translation failed for participant ${participantId}:`, error);
      }
    });
    
    await Promise.all(translationPromises);
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
