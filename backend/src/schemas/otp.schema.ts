import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OtpDocument = Otp & Document;

@Schema({ timestamps: true })
export class Otp {
  @Prop({ required: true })
  mobile: string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  isUsed: boolean;

  @Prop({ default: 0 })
  attempts: number;

  // Store registration data temporarily during registration flow
  @Prop({ type: Object })
  registrationData?: {
    name: string;
    preferredLanguage: string;
  };
}

export const OtpSchema = SchemaFactory.createForClass(Otp);
