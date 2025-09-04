import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { MessagesService } from '../messages/messages.service';
import { TranslationService } from '../translation/translation.service';
import { ChatModule } from '../chat/chat.module';
import { Conversation, ConversationSchema } from '../schemas/conversation.schema';
import { Message, MessageSchema } from '../schemas/message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    ChatModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService, MessagesService, TranslationService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
