import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';

@Controller('conversations/:conversationId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get()
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query('cursor') cursor?: string,
    @Request() req?,
  ) {
    const result = await this.messagesService.findByConversationId(
      conversationId,
      req.user.id,
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
}
