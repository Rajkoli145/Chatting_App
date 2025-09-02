import { Controller, Post, Body, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(@Body() body: { mobile: string; name: string; preferredLanguage: string }) {
    return this.authService.register(body.mobile, body.name, body.preferredLanguage);
  }

  @Post('login')
  async login(@Body() body: { mobile: string }) {
    return this.authService.login(body.mobile);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: { mobile: string; otp: string }) {
    return this.authService.verifyOTP(body.mobile, body.otp);
  }
}

@Controller('conversations')
export class ConversationsController {
  @Get()
  async getConversations() {
    return [];
  }
}
