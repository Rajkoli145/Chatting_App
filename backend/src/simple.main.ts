import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Module, Controller, Post, Get, Body, Headers, UnauthorizedException, Injectable } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';

@Injectable()
class SimpleAuthService {
  private users = new Map();
  private otpStorage = new Map();

  constructor(private jwtService: JwtService) {}

  async register(mobile: string, name: string, preferredLanguage: string) {
    const otp = '123456';
    
    this.otpStorage.set(mobile, {
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      userData: { mobile, name, preferredLanguage }
    });

    console.log(`📱 OTP for ${mobile}: ${otp}`);
    return { message: 'OTP sent', otp };
  }

  async verifyOTP(mobile: string, otp: string) {
    const storedData = this.otpStorage.get(mobile);
    
    if (!storedData || storedData.otp !== otp) {
      throw new Error('Invalid OTP');
    }

    this.otpStorage.delete(mobile);

    const userId = `user_${Date.now()}`;
    const user = {
      id: userId,
      mobile,
      name: storedData.userData.name,
      preferredLanguage: storedData.userData.preferredLanguage,
      createdAt: new Date().toISOString(),
    };

    this.users.set(userId, user);
    const accessToken = this.jwtService.sign({ sub: userId, mobile });
    return { accessToken, user };
  }

  async getCurrentUser(userId: string) {
    return this.users.get(userId);
  }

  async searchUsers(query: string) {
    const allUsers = Array.from(this.users.values());
    return allUsers.filter(user => 
      user.name.toLowerCase().includes(query.toLowerCase()) ||
      user.mobile.includes(query)
    ).slice(0, 10);
  }
}

@Controller()
class SimpleAuthController {
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
    return [];
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

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [SimpleAuthController],
  providers: [SimpleAuthService],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: 'http://localhost:8081',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  const port = process.env.PORT || 5001;
  await app.listen(port);
  
  console.log(`🚀 Backend server running on http://localhost:${port}`);
}

bootstrap();
