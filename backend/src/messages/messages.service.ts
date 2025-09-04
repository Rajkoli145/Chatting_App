import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument, MessageStatus } from '../schemas/message.schema';
import { Conversation, ConversationDocument } from '../schemas/conversation.schema';
import { TranslationService } from '../translation/translation.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    private translationService: TranslationService,
  ) {}

  async create(
    conversationId: string,
    senderId: string,
    receiverId: string,
    text: string,
    sourceLang: string,
    targetLang?: string,
  ): Promise<MessageDocument> {
    // Verify conversation exists and user is part of it
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    
    if (!conversation.participants.includes(senderId as any)) {
      throw new ForbiddenException('User not part of this conversation');
    }

    // Translate message if target language is specified
    let translatedText: string | undefined;
    if (targetLang && targetLang !== sourceLang) {
      try {
        translatedText = await this.translationService.translate(text, sourceLang, targetLang);
      } catch (error) {
        console.error('Translation failed:', error);
        // Continue without translation if service fails
      }
    }

    const message = new this.messageModel({
      conversationId,
      senderId,
      receiverId,
      originalText: text,
      sourceLang,
      translatedText,
      targetLang,
      status: MessageStatus.SENT,
    });

    const savedMessage = await message.save();

    // Update conversation's last message
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessageId: savedMessage._id,
      updatedAt: new Date(),
    });

    return savedMessage;
  }

  async findByConversationId(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit: number = 50,
  ): Promise<{ messages: MessageDocument[]; hasMore: boolean }> {
    // Verify user is part of conversation
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation || !conversation.participants.includes(userId as any)) {
      throw new ForbiddenException('User not part of this conversation');
    }

    const query: any = { conversationId };
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    const messages = await this.messageModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate('senderId', 'name mobile preferredLanguage')
      .populate('receiverId', 'name mobile preferredLanguage')
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

  async markAsDelivered(messageId: string): Promise<MessageDocument> {
    const message = await this.messageModel.findByIdAndUpdate(
      messageId,
      {
        status: MessageStatus.DELIVERED,
        deliveredAt: new Date(),
      },
      { new: true }
    );

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  async markAsRead(messageId: string, userId: string): Promise<MessageDocument> {
    const message = await this.messageModel.findOneAndUpdate(
      { _id: messageId, receiverId: userId },
      {
        status: MessageStatus.READ,
        readAt: new Date(),
      },
      { new: true }
    );

    if (!message) {
      throw new NotFoundException('Message not found or access denied');
    }

    return message;
  }

  async findById(id: string): Promise<MessageDocument> {
    const message = await this.messageModel
      .findById(id)
      .populate('senderId', 'name mobile preferredLanguage')
      .populate('receiverId', 'name mobile preferredLanguage')
      .exec();

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    console.log('🗑️ Attempting to delete message:', messageId, 'by user:', userId);
    
    const message = await this.messageModel.findById(messageId);
    console.log('🗑️ Found message:', message ? 'Yes' : 'No');
    
    if (!message) {
      console.log('🗑️ Message not found');
      return false;
    }
    
    console.log('🗑️ Message senderId:', message.senderId.toString(), 'User ID:', userId);
    
    if (message.senderId.toString() !== userId) {
      console.log('🗑️ User not authorized to delete this message');
      return false; // Only sender can delete their own messages
    }
    
    await this.messageModel.findByIdAndDelete(messageId);
    console.log('🗑️ Message deleted successfully');
    return true;
  }

  async clearConversation(conversationId: string, userId: string): Promise<boolean> {
    console.log('🧹 Attempting to clear conversation:', conversationId, 'for user:', userId);
    
    // Verify user is part of conversation
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation || !conversation.participants.includes(userId as any)) {
      console.log('🧹 User not part of conversation');
      return false;
    }
    
    // Delete all messages in the conversation where the user is either sender or receiver
    const result = await this.messageModel.deleteMany({
      conversationId,
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    });
    
    console.log('🧹 Deleted', result.deletedCount, 'messages from conversation');
    return result.deletedCount > 0;
  }
}
