import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { AuthController, ConversationsController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { OtpGateway } from './otp.gateway';
import { User, UserSchema } from '../schemas/user.schema';
import { Otp, OtpSchema } from '../schemas/otp.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Otp.name, schema: OtpSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  controllers: [AuthController, ConversationsController],
  providers: [AuthService, OtpService, OtpGateway],
  exports: [AuthService, OtpService],
})
export class AuthModule {}
