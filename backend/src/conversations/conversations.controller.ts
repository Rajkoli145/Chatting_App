import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationsService } from './conversations.service';
import { MessagesService } from '../messages/messages.service';
import { ChatGateway } from '../chat/chat.gateway';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly chatGateway: ChatGateway
  ) {}

  @Get()
  async getConversations(@Request() req) {
    // Get user ID from query param for testing different users
    const userId = req.query.userId || '68b708e13c8c92c7f2769ca9';
    console.log('📋 Getting conversations for user:', userId);
    const conversations = await this.conversationsService.getUserConversations(userId);
    console.log('📋 Conversations returned:', JSON.stringify(conversations, null, 2));
    return conversations;
  }

  @Post()
  async createConversation(@Request() req, @Body() body: { userId: string }) {
    // Temporarily hardcode user ID for testing
    const userId = '68b68bb0ecfa98f8d1e87e4f';
    console.log('🔗 Creating conversation between users:', userId, 'and', body.userId);
    return this.conversationsService.createConversation(userId, body.userId);
  }

  @Get(':id/messages')
  async getMessages(@Request() req, @Param('id') conversationId: string) {
    const userId = req.query.userId || '68b68bb0ecfa98f8d1e87e4f';
    console.log('💬 Getting messages for conversation:', conversationId, 'user:', userId);
    const messages = await this.conversationsService.getConversationMessages(conversationId, userId);
    console.log('💬 Messages found:', messages?.length || 0);
    return messages;
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') conversationId: string,
    @Body() body: {
      originalText: string;
      sourceLang: string;
      targetLang?: string;
      receiverId: string;
      senderId?: string;
    },
    @Request() req,
  ) {
    const userId = body.senderId || '68b68bb0ecfa98f8d1e87e4f';
    console.log('📤 Sending message via API:', body.originalText, 'from user:', userId, 'to:', body.receiverId);
    
    try {
      // Use MessagesService to properly save message to database
      const savedMessage = await this.messagesService.create(
        conversationId,
        userId,
        body.receiverId,
        body.originalText,
        body.sourceLang,
        body.targetLang
      );

      console.log('✅ Message saved to database:', savedMessage);

      // Broadcast message via WebSocket
      const messageForSocket = {
        id: savedMessage._id,
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

      // Emit to conversation room and directly to receiver
      this.chatGateway.server.to(`conversation_${conversationId}`).emit('newMessage', messageForSocket);
      this.chatGateway.server.to(`user_${body.receiverId}`).emit('newMessage', messageForSocket);
      
      console.log('📡 Message broadcast via WebSocket to conversation and receiver');

      return {
        id: savedMessage._id,
        conversationId: savedMessage.conversationId,
        senderId: savedMessage.senderId,
        receiverId: savedMessage.receiverId,
        originalText: savedMessage.originalText,
        sourceLang: savedMessage.sourceLang,
        translatedText: savedMessage.translatedText,
        targetLang: savedMessage.targetLang,
        status: savedMessage.status,
        createdAt: (savedMessage as any).createdAt,
      };
    } catch (error) {
      console.error('❌ Error saving message:', error);
      throw error;
    }
  }
}
