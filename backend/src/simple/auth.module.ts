import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SimpleAuthController } from './auth.controller';
import { SimpleAuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  controllers: [SimpleAuthController],
  providers: [SimpleAuthService],
})
export class SimpleAuthModule {}
