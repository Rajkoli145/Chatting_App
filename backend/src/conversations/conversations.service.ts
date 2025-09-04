import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from '../schemas/conversation.schema';
import { Message, MessageDocument } from '../schemas/message.schema';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async createConversation(userId1: string, userId2: string): Promise<any> {
    // Check if conversation already exists
    const existingConversation = await this.conversationModel.findOne({
      participants: { $all: [userId1, userId2] }
    }).populate('participants', 'name mobile preferredLanguage');

    if (existingConversation) {
      const otherParticipant = (existingConversation.participants as any[]).find(
        (p: any) => p._id.toString() !== userId1
      );
      
      return {
        id: existingConversation._id,
        participants: existingConversation.participants,
        user: {
          id: otherParticipant._id,
          name: otherParticipant.name,
          mobile: otherParticipant.mobile,
          preferredLanguage: otherParticipant.preferredLanguage
        }
      };
    }

    // Create new conversation
    const conversation = new this.conversationModel({
      participants: [userId1, userId2]
    });

    const savedConversation = await conversation.save();
    const populatedConversation = await this.conversationModel.findById(savedConversation._id)
      .populate('participants', 'name mobile preferredLanguage');

    const otherParticipant = (populatedConversation.participants as any[]).find(
      (p: any) => p._id.toString() !== userId1
    );

    return {
      id: populatedConversation._id,
      participants: populatedConversation.participants,
      user: {
        id: otherParticipant._id,
        name: otherParticipant.name,
        mobile: otherParticipant.mobile,
        preferredLanguage: otherParticipant.preferredLanguage
      }
    };
  }

  async getUserConversations(userId: string): Promise<any[]> {
    const conversations = await this.conversationModel.find({
      participants: userId
    })
    .populate('participants', 'name mobile preferredLanguage')
    .sort({ updatedAt: -1 });

    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await this.messageModel
          .findOne({ conversationId: conv._id })
          .sort({ createdAt: -1 });

        const otherParticipant = (conv.participants as any[]).find(
          (p: any) => p._id.toString() !== userId
        );

        return {
          id: conv._id,
          user: {
            id: otherParticipant._id,
            name: otherParticipant.name,
            mobile: otherParticipant.mobile,
            preferredLanguage: otherParticipant.preferredLanguage
          },
          lastMessage: lastMessage ? {
            text: lastMessage.originalText,
            timestamp: (lastMessage as any).createdAt,
            isOwn: lastMessage.senderId.toString() === userId
          } : null,
          updatedAt: (conv as any).updatedAt
        };
      })
    );

    return conversationsWithLastMessage;
  }

  async getConversationMessages(conversationId: string, userId: string): Promise<any> {
    // Verify user is participant
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      throw new Error('Conversation not found or user not authorized');
    }

    // Get messages for this conversation
    const messages = await this.messageModel
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(50);

    console.log(` Found ${messages.length} messages for conversation ${conversationId}`);

    return messages.map(msg => ({
      id: msg._id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      originalText: msg.originalText,
      translatedText: msg.translatedText,
      sourceLang: msg.sourceLang,
      targetLang: msg.targetLang,
      status: msg.status,
      createdAt: (msg as any).createdAt
    }));
  }
}
