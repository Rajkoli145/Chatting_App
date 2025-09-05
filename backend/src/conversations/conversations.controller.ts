import { Controller, Get, Post, Body, UseGuards, Request, Param, Query } from '@nestjs/common';
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
  @UseGuards(JwtAuthGuard)
  async getConversations(@Request() req) {
    const userId = req.user.sub; // Get user ID from JWT token
    console.log('📋 Getting conversations for authenticated user:', userId);
    const conversations = await this.conversationsService.getUserConversations(userId);
    console.log('📋 Conversations returned:', JSON.stringify(conversations, null, 2));
    return conversations;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createConversation(@Request() req, @Body() body: { userId: string }) {
    const userId = req.user.sub; // Get user ID from JWT token
    console.log('🔗 Creating conversation between authenticated users:', userId, 'and', body.userId);
    return this.conversationsService.createConversation(userId, body.userId);
  }

  @Get(':id/messages')
  @UseGuards(JwtAuthGuard)
  async getMessages(
    @Request() req, 
    @Param('id') conversationId: string,
    @Query('targetLang') targetLang?: string
  ) {
    try {
      const userId = req.user.sub; // Get user ID from JWT token
      console.log('💬 Getting messages for conversation:', conversationId, 'authenticated user:', userId, 'targetLang:', targetLang);
      
      const { messages } = await this.messagesService.findByConversationId(conversationId, userId, undefined, 50, targetLang);
      
      return messages;
    } catch (error) {
      console.error('❌ Error in getMessages controller:', error);
      throw error;
    }
  }

  @Post(':id/messages')
  @UseGuards(JwtAuthGuard)
  async sendMessage(
    @Param('id') conversationId: string,
    @Body() body: {
      originalText: string;
      sourceLang: string;
      targetLang?: string;
      receiverId: string;
    },
    @Request() req,
  ) {
    const userId = req.user.sub; // Get user ID from JWT token
    console.log('📤 Sending message via API:', body.originalText, 'from authenticated user:', userId, 'to:', body.receiverId);
    
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

  @Post('send-to-user')
  @UseGuards(JwtAuthGuard)
  async sendMessageToUser(
    @Body() body: {
      receiverMobile: string;
      originalText: string;
      sourceLang: string;
      targetLang?: string;
    },
    @Request() req,
  ) {
    const senderId = req.user.sub;
    console.log('📤 Sending message to user by mobile:', body.receiverMobile, 'from:', senderId);
    
    try {
      // Find receiver by mobile number
      const User = this.messagesService.getUserModel();
      const receiver = await User.findOne({ mobile: body.receiverMobile });
      
      if (!receiver) {
        throw new Error('User not found with mobile number: ' + body.receiverMobile);
      }

      const receiverId = receiver._id.toString();
      
      // Check if conversation exists, create if not
      let conversation = await this.conversationsService.createConversation(senderId, receiverId);
      
      // Save message to database
      const savedMessage = await this.messagesService.create(
        conversation.id,
        senderId,
        receiverId,
        body.originalText,
        body.sourceLang,
        body.targetLang
      );

      // Send notification to receiver about new message from unknown user
      this.chatGateway.server.to(`user_${receiverId}`).emit('newConversationMessage', {
        message: {
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
        },
        conversation: conversation,
        isNewConversation: true
      });

      console.log('📡 New conversation message notification sent to:', receiverId);

      return {
        success: true,
        message: 'Message sent successfully',
        conversationId: conversation.id
      };
    } catch (error) {
      console.error('❌ Error sending message to user:', error);
      throw error;
    }
  }
}
