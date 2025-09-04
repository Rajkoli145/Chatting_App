import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { OtpGateway } from './otp.gateway';
import { User, UserSchema } from '../schemas/user.schema';
import { Otp, OtpSchema } from '../schemas/otp.schema';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Otp.name, schema: OtpSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || '70a3e694ee581a02174d9a7133250b8635afcc4c6dbf60415c52eed9ebcd2f6653acb9615820be7633495fff8dde01cd90eae5a6ebc44e9d5e2d4cda33a15250',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, OtpGateway, JwtStrategy],
  exports: [AuthService, OtpService, JwtStrategy],
})
export class AuthModule {}
