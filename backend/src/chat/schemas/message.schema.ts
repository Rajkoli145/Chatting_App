import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true })
  conversationId: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  senderId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  receiverId: Types.ObjectId;

  @Prop({ required: true })
  originalText: string;

  @Prop()
  translatedText?: string;

  @Prop({ required: true })
  sourceLang: string;

  @Prop()
  targetLang?: string;

  @Prop({ enum: ['sent', 'delivered', 'read'], default: 'sent' })
  status: string;

  @Prop()
  deliveredAt?: Date;

  @Prop()
  readAt?: Date;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
