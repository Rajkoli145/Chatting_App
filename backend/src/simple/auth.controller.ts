import { Controller, Post, Get, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { SimpleAuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';

@Controller()
export class SimpleAuthController {
  constructor(
    private authService: SimpleAuthService,
    private jwtService: JwtService,
  ) {}

  @Post('auth/register')
  async register(@Body() body: { mobile: string; name: string; preferredLanguage: string }) {
    return this.authService.register(body.mobile, body.name, body.preferredLanguage);
  }

  @Post('auth/verify-otp')
  async verifyOTP(@Body() body: { mobile: string; otp: string }) {
    return this.authService.verifyOTP(body.mobile, body.otp);
  }

  @Get('users/me')
  async getCurrentUser(@Headers('authorization') auth: string) {
    if (!auth) throw new UnauthorizedException();
    
    const token = auth.replace('Bearer ', '');
    const payload = this.jwtService.verify(token);
    const user = await this.authService.getCurrentUser(payload.sub);
    
    if (!user) throw new UnauthorizedException();
    return user;
  }

  @Get('users/search')
  async searchUsers(@Headers('authorization') auth: string, @Body() body: { q: string }) {
    if (!auth) throw new UnauthorizedException();
    return this.authService.searchUsers(body.q || '');
  }

  @Get('conversations')
  async getConversations() {
    return []; // Mock empty conversations
  }

  @Post('conversations')
  async createConversation() {
    return { id: 'conv_1', user: { id: 'user_1', name: 'Test User' } };
  }

  @Get('conversations/:id/messages')
  async getMessages() {
    return { messages: [], hasMore: false };
  }
}
