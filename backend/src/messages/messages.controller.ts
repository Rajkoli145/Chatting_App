import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';

@Controller('conversations/:conversationId/messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get()
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query('cursor') cursor?: string,
    @Request() req?,
  ) {
    // Temporarily hardcode user ID for testing
    const userId = '68b68bb0ecfa98f8d1e87e4f';
    console.log('📨 Getting messages for conversation:', conversationId, 'user:', userId);
    const result = await this.messagesService.findByConversationId(
      conversationId,
      userId,
      cursor,
    );

    return {
      messages: result.messages.map(message => ({
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        originalText: message.originalText,
        sourceLang: message.sourceLang,
        translatedText: message.translatedText,
        targetLang: message.targetLang,
        status: message.status,
        createdAt: (message as any).createdAt,
      })),
      hasMore: result.hasMore,
    };
  }

  @Post()
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() body: {
      originalText: string;
      sourceLang: string;
      targetLang?: string;
      receiverId: string;
    },
    @Request() req,
  ) {
    // Temporarily hardcode user ID for testing
    const userId = '68b68bb0ecfa98f8d1e87e4f';
    console.log('📤 Sending message via API:', body.originalText, 'from user:', userId, 'to:', body.receiverId);
    
    const message = await this.messagesService.create(
      conversationId,
      userId,
      body.receiverId,
      body.originalText,
      body.sourceLang,
      body.targetLang,
    );

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      originalText: message.originalText,
      sourceLang: message.sourceLang,
      translatedText: message.translatedText,
      targetLang: message.targetLang,
      status: message.status,
      createdAt: (message as any).createdAt,
    };
  }
}
