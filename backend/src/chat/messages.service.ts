import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async createMessage(data: {
    conversationId: string;
    senderId: string;
    receiverId: string;
    originalText: string;
    sourceLang: string;
    targetLang?: string;
  }): Promise<MessageDocument> {
    // TODO: Add translation logic here
    const translatedText = data.targetLang ? `[TRANSLATED] ${data.originalText}` : undefined;

    const message = new this.messageModel({
      ...data,
      translatedText,
      status: 'sent',
      createdAt: new Date(),
    });

    return message.save();
  }

  async getMessagesByConversation(
    conversationId: string,
    limit: number = 50,
    cursor?: string,
  ): Promise<{ messages: MessageDocument[]; hasMore: boolean }> {
    const query: any = { conversationId };
    
    if (cursor) {
      query._id = { $lt: cursor };
    }

    const messages = await this.messageModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .exec();

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop();
    }

    return {
      messages: messages.reverse(),
      hasMore,
    };
  }

  async markMessageAsDelivered(messageId: string): Promise<void> {
    await this.messageModel.findByIdAndUpdate(messageId, {
      status: 'delivered',
      deliveredAt: new Date(),
    });
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    await this.messageModel.findByIdAndUpdate(messageId, {
      status: 'read',
      readAt: new Date(),
    });
  }
}
