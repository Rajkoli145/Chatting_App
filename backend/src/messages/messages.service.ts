import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

  // Helper methods for ChatGateway
  async findConversationById(conversationId: string): Promise<ConversationDocument> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  getUserModel() {
    return this.conversationModel.db.model('User');
  }

  getTranslationService() {
    return this.translationService;
  }

  async create(
    conversationId: string,
    senderId: string,
    receiverId: string,
    text: string,
    sourceLang: string,
    targetLang?: string,
  ): Promise<MessageDocument> {
    try {
      console.log(`💬 Creating message: conversationId=${conversationId}, senderId=${senderId}, receiverId=${receiverId}`);
      
      // Verify conversation exists and user is part of it
      const conversation = await this.conversationModel.findById(conversationId);
      if (!conversation) {
        console.log(`❌ Conversation ${conversationId} not found`);
        throw new NotFoundException('Conversation not found');
      }
      
      console.log(`💬 Conversation found with participants:`, conversation.participants);
      
      // Convert senderId to ObjectId for proper comparison
      const senderObjectId = new Types.ObjectId(senderId);
      const isParticipant = conversation.participants.some(participantId => 
        participantId.toString() === senderId || participantId.equals(senderObjectId)
      );
      
      console.log(`💬 Is sender ${senderId} a participant?`, isParticipant);
      
      if (!isParticipant) {
        console.log(`❌ User ${senderId} not part of conversation ${conversationId}`);
        console.log(`❌ Conversation participants:`, conversation.participants.map(p => p.toString()));
        throw new ForbiddenException('User not part of this conversation');
      }

      // Get both sender's and receiver's preferred languages
      const User = this.conversationModel.db.model('User');
      const [sender, receiver] = await Promise.all([
        User.findById(senderId),
        User.findById(receiverId)
      ]);
      
      const senderPreferredLang = sender?.preferredLanguage || sourceLang || 'en';
      const receiverPreferredLang = receiver?.preferredLanguage || targetLang || 'en';

      console.log(`🌐 Translation setup: text="${text}", senderLang="${senderPreferredLang}", receiverLang="${receiverPreferredLang}"`);

      // Only translate if sender and receiver have different preferred languages
      let translatedText: string | undefined;
      if (senderPreferredLang !== receiverPreferredLang) {
        try {
          translatedText = await this.translationService.translate(text, senderPreferredLang, receiverPreferredLang);
          console.log(`🌐 Translation result: "${text}" (${senderPreferredLang} → ${receiverPreferredLang}) = "${translatedText}"`);
        } catch (error) {
          console.error('Translation failed:', error);
          // Continue without translation if service fails
        }
      } else {
        console.log(`🌐 No translation needed: both users prefer ${senderPreferredLang}`);
      }

      const message = new this.messageModel({
        conversationId: new Types.ObjectId(conversationId),
        senderId: new Types.ObjectId(senderId),
        receiverId: new Types.ObjectId(receiverId),
        originalText: text,
        translatedText,
        sourceLang,
        targetLang: receiverPreferredLang,
        status: MessageStatus.DELIVERED, // Set as DELIVERED initially for unread counting
      });

      const savedMessage = await message.save();
      console.log(`✅ Message saved with ID: ${savedMessage._id}`);
      console.log(`📊 Message details: senderId=${savedMessage.senderId}, receiverId=${savedMessage.receiverId}, status=${savedMessage.status}`);
      
      // Update conversation's last message
      await this.conversationModel.findByIdAndUpdate(conversationId, {
        lastMessageId: savedMessage._id,
        updatedAt: new Date(),
      });

      return savedMessage;
    } catch (error) {
      console.error(`❌ Error creating message:`, error);
      throw error;
    }
  }

  async findByConversationId(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit: number = 50,
  ): Promise<{ messages: MessageDocument[]; hasMore: boolean }> {
    console.log(`💬 Getting messages for conversation: ${conversationId} user: ${userId}`);
    
    // Verify user is part of conversation
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation || !conversation.participants.includes(userId as any)) {
      throw new ForbiddenException('User not part of this conversation');
    }

    // Convert conversationId to ObjectId for proper MongoDB query
    const query: any = { conversationId: new Types.ObjectId(conversationId) };
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    console.log(`💬 Query for messages:`, JSON.stringify(query, null, 2));

    const messages = await this.messageModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate('senderId', 'name mobile preferredLanguage')
      .populate('receiverId', 'name mobile preferredLanguage')
      .exec();

    console.log(`💬 Found ${messages.length} messages for conversation ${conversationId}`);
    console.log(`💬 Messages found: ${messages.length}`);

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

  async getUnreadMessageCounts(userId: string): Promise<{ [conversationId: string]: number }> {
    console.log(`📊 Getting unread message counts for user: ${userId}`);
    
    // Get all conversations the user is part of
    const conversations = await this.conversationModel.find({
      participants: userId
    }).select('_id');

    const unreadCounts: { [conversationId: string]: number } = {};

    // For each conversation, count unread messages
    for (const conversation of conversations) {
      // Debug: Check all messages in this conversation for this user
      const allMessages = await this.messageModel.find({
        conversationId: conversation._id,
        receiverId: new Types.ObjectId(userId)
      }).select('status senderId receiverId');
      
      console.log(`📊 Debug - All messages for user ${userId} in conversation ${conversation._id}:`, 
        allMessages.map(m => ({ status: m.status, senderId: m.senderId, receiverId: m.receiverId })));
      
      const unreadCount = await this.messageModel.countDocuments({
        conversationId: conversation._id,
        receiverId: new Types.ObjectId(userId),
        status: { $ne: MessageStatus.READ }
      });
      
      console.log(`📊 Conversation ${conversation._id}: ${unreadCount} unread messages for user ${userId}`);
      
      if (unreadCount > 0) {
        unreadCounts[conversation._id.toString()] = unreadCount;
      }
    }

    console.log(`📊 Unread counts for user ${userId}:`, unreadCounts);
    return unreadCounts;
  }

  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    console.log(`📖 Marking messages as read in conversation: ${conversationId} for user: ${userId}`);
    
    const result = await this.messageModel.updateMany(
      {
        conversationId: new Types.ObjectId(conversationId),
        receiverId: userId,
        status: { $ne: MessageStatus.READ }
      },
      {
        $set: {
          status: MessageStatus.READ,
          readAt: new Date()
        }
      }
    );

    console.log(`📖 Marked ${result.modifiedCount} messages as read`);
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
