import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from '../schemas/conversation.schema';
import { Message, MessageDocument } from '../schemas/message.schema';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async createConversation(userId1: string, userId2: string): Promise<any> {
    // Convert string IDs to ObjectIds
    const objectId1 = new Types.ObjectId(userId1);
    const objectId2 = new Types.ObjectId(userId2);
    
    // Check if conversation already exists
    const existingConversation = await this.conversationModel.findOne({
      participants: { $all: [objectId1, objectId2] }
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
      participants: [objectId1, objectId2]
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
    try {
      console.log('🔍 Getting conversations for userId:', userId);
      
      // Convert string ID to ObjectId for MongoDB query
      const userObjectId = new Types.ObjectId(userId);
      console.log('🔍 Converted to ObjectId:', userObjectId);
      
      const conversations = await this.conversationModel.find({
        participants: userObjectId
      })
      .populate('participants', 'name mobile preferredLanguage')
      .sort({ updatedAt: -1 });
      
      console.log('🔍 Found conversations:', conversations.length);

      const conversationsWithLastMessage = await Promise.all(
        conversations.map(async (conv) => {
          try {
            const lastMessage = await this.messageModel
              .findOne({ conversationId: conv._id })
              .sort({ createdAt: -1 });

            const otherParticipant = (conv.participants as any[]).find(
              (p: any) => p && p._id && p._id.toString() !== userId
            );

            // Check if otherParticipant exists
            if (!otherParticipant) {
              console.log('⚠️ No other participant found for conversation:', conv._id);
              console.log('⚠️ Participants:', conv.participants);
              return null; // Skip this conversation
            }

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
                timestamp: lastMessage.createdAt
              } : null,
              updatedAt: (conv as any).updatedAt
            };
          } catch (error) {
            console.error('❌ Error processing conversation:', conv._id, error);
            return null;
          }
        })
      );

      const validConversations = conversationsWithLastMessage.filter(conv => conv !== null);
      console.log('📋 Conversations returned:', validConversations);
      return validConversations;
    } catch (error) {
      console.error('❌ Error getting user conversations:', error);
      throw error;
    }
  }

  async getConversationMessages(conversationId: string, userId: string): Promise<any> {
    try {
      console.log(`💬 Getting messages for conversation: ${conversationId} user: ${userId}`);
      
      // Convert string IDs to ObjectIds for MongoDB query
      let conversationObjectId: Types.ObjectId;
      let userObjectId: Types.ObjectId;
      
      try {
        conversationObjectId = new Types.ObjectId(conversationId);
        userObjectId = new Types.ObjectId(userId);
      } catch (error) {
        console.error(`❌ Invalid ObjectId format - conversationId: ${conversationId}, userId: ${userId}`);
        throw new Error('Invalid conversation or user ID format');
      }
      
      // Verify user is participant
      const conversation = await this.conversationModel.findOne({
        _id: conversationObjectId,
        participants: userObjectId
      });

      if (!conversation) {
        console.log(`🚫 Conversation ${conversationId} not found or user ${userId} not authorized`);
        throw new Error('Conversation not found or user not authorized');
      }

      // Get messages for this conversation
      const messages = await this.messageModel
        .find({ conversationId: conversationObjectId })
        .sort({ createdAt: 1 })
        .limit(50);

      console.log(`💬 Found ${messages.length} messages for conversation ${conversationId}`);

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
        createdAt: msg.createdAt,
        timestamp: msg.createdAt
      }));
    } catch (error) {
      console.error(`❌ Error getting messages for conversation ${conversationId}:`, error);
      throw error;
    }
  }
}
