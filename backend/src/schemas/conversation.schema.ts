import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  user1Id: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  user2Id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  lastMessageId: Types.ObjectId;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
