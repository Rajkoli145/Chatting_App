import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Module, Controller, Post, Get, Body, Headers, UnauthorizedException, Injectable } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository, Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Like } from 'typeorm';
import { ConfigModule } from '@nestjs/config';

// Entities
@Entity('users')
class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  mobile: string;

  @Column()
  name: string;

  @Column({ default: 'en' })
  preferredLanguage: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastSeen: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('conversations')
class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user1Id: string;

  @Column()
  user2Id: string;

  @Column({ nullable: true })
  lastMessageId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('messages')
class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @Column()
  senderId: string;

  @Column()
  receiverId: string;

  @Column('text')
  originalText: string;

  @Column({ default: 'en' })
  sourceLang: string;

  @Column('text', { nullable: true })
  translatedText: string;

  @Column({ nullable: true })
  targetLang: string;

  @Column({ default: 'sent' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Translation Service
@Injectable()
class TranslationService {
  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    if (process.env.GOOGLE_TRANSLATE_API_KEY && process.env.GOOGLE_TRANSLATE_API_KEY !== 'your-google-translate-api-key') {
      try {
        // Google Translate API integration
        const { Translate } = require('@google-cloud/translate').v2;
        const translate = new Translate({ key: process.env.GOOGLE_TRANSLATE_API_KEY });
        const [translation] = await translate.translate(text, { from: sourceLang, to: targetLang });
        return translation;
      } catch (error) {
        console.error('Google Translate API error:', error);
        // Fall back to mock translation
      }
    }

    // Mock translations for development
    const mockTranslations = {
      'hello': { 'es': 'hola', 'fr': 'bonjour', 'de': 'hallo', 'hi': 'नमस्ते', 'zh': '你好' },
      'how are you': { 'es': '¿cómo estás?', 'fr': 'comment allez-vous?', 'de': 'wie geht es dir?', 'hi': 'आप कैसे हैं?' },
      'good morning': { 'es': 'buenos días', 'fr': 'bonjour', 'de': 'guten morgen', 'hi': 'सुप्रभात' },
      'thank you': { 'es': 'gracias', 'fr': 'merci', 'de': 'danke', 'hi': 'धन्यवाद' },
      'goodbye': { 'es': 'adiós', 'fr': 'au revoir', 'de': 'auf wiedersehen', 'hi': 'अलविदा' },
    };

    const lowerText = text.toLowerCase();
    const translation = mockTranslations[lowerText]?.[targetLang];
    
    return translation || `[${targetLang.toUpperCase()}] ${text}`;
  }
}

// Enhanced Auth Service with Database
@Injectable()
class EnhancedAuthService {
  private otpStorage = new Map();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    private jwtService: JwtService,
    private translationService: TranslationService,
  ) {}

  async register(mobile: string, name: string, preferredLanguage: string) {
    const otp = process.env.NODE_ENV === 'development' ? '123456' : this.generateOTP();
    
    this.otpStorage.set(mobile, {
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      userData: { mobile, name, preferredLanguage }
    });

    console.log(`📱 OTP for ${mobile}: ${otp}`);
    
    const existingUser = await this.userRepository.findOne({ where: { mobile } });
    return { 
      message: existingUser ? 'OTP sent to existing user' : 'OTP sent for registration', 
      otp: process.env.NODE_ENV === 'development' ? otp : undefined 
    };
  }

  async verifyOTP(mobile: string, otp: string) {
    const storedData = this.otpStorage.get(mobile);
    
    if (!storedData || storedData.otp !== otp) {
      throw new Error('Invalid OTP');
    }

    if (storedData.expiresAt < new Date()) {
      this.otpStorage.delete(mobile);
      throw new Error('OTP expired');
    }

    this.otpStorage.delete(mobile);

    let user = await this.userRepository.findOne({ where: { mobile } });
    
    if (!user) {
      user = this.userRepository.create({
        mobile: storedData.userData.mobile,
        name: storedData.userData.name,
        preferredLanguage: storedData.userData.preferredLanguage,
      });
      await this.userRepository.save(user);
    } else {
      user.name = storedData.userData.name;
      user.preferredLanguage = storedData.userData.preferredLanguage;
      user.lastSeen = new Date();
      await this.userRepository.save(user);
    }

    const accessToken = this.jwtService.sign({ sub: user.id, mobile: user.mobile });

    return {
      accessToken,
      user: {
        id: user.id,
        mobile: user.mobile,
        name: user.name,
        preferredLanguage: user.preferredLanguage,
        createdAt: user.createdAt,
      },
    };
  }

  async getCurrentUser(userId: string) {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  async searchUsers(query: string, currentUserId: string) {
    return this.userRepository.find({
      where: [
        { name: Like(`%${query}%`) },
        { mobile: Like(`%${query}%`) },
      ],
      take: 20,
    }).then(users => users.filter(user => user.id !== currentUserId));
  }

  async getConversations(userId: string) {
    const conversations = await this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoin(User, 'user1', 'user1.id = conversation.user1Id')
      .leftJoin(User, 'user2', 'user2.id = conversation.user2Id')
      .leftJoin(Message, 'lastMessage', 'lastMessage.id = conversation.lastMessageId')
      .select([
        'conversation.id as id',
        'conversation.createdAt as createdAt',
        'CASE WHEN conversation.user1Id = :userId THEN user2.id ELSE user1.id END as otherUserId',
        'CASE WHEN conversation.user1Id = :userId THEN user2.name ELSE user1.name END as otherUserName',
        'CASE WHEN conversation.user1Id = :userId THEN user2.mobile ELSE user1.mobile END as otherUserMobile',
        'CASE WHEN conversation.user1Id = :userId THEN user2.preferredLanguage ELSE user1.preferredLanguage END as otherUserLanguage',
        'lastMessage.originalText as lastMessageText',
        'lastMessage.createdAt as lastMessageTime',
        'lastMessage.senderId as lastMessageSenderId'
      ])
      .where('conversation.user1Id = :userId OR conversation.user2Id = :userId', { userId })
      .orderBy('conversation.updatedAt', 'DESC')
      .getRawMany();

    return conversations.map(conv => ({
      id: conv.id,
      user: {
        id: conv.otherUserId,
        mobile: conv.otherUserMobile,
        name: conv.otherUserName,
        preferredLanguage: conv.otherUserLanguage,
        createdAt: conv.createdAt,
      },
      lastMessage: conv.lastMessageText ? {
        text: conv.lastMessageText,
        timestamp: conv.lastMessageTime,
        isOwn: conv.lastMessageSenderId === userId,
      } : undefined,
    }));
  }

  async createConversation(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new Error('Cannot create conversation with yourself');
    }

    // Check if conversation already exists
    let conversation = await this.conversationRepository
      .createQueryBuilder('conversation')
      .where(
        '(conversation.user1Id = :userId AND conversation.user2Id = :otherUserId) OR (conversation.user1Id = :otherUserId AND conversation.user2Id = :userId)',
        { userId, otherUserId }
      )
      .getOne();

    if (!conversation) {
      conversation = this.conversationRepository.create({
        user1Id: userId,
        user2Id: otherUserId,
      });
      await this.conversationRepository.save(conversation);
    }

    const otherUser = await this.userRepository.findOne({ where: { id: otherUserId } });
    
    return {
      id: conversation.id,
      user: {
        id: otherUser.id,
        mobile: otherUser.mobile,
        name: otherUser.name,
        preferredLanguage: otherUser.preferredLanguage,
        createdAt: otherUser.createdAt,
      },
    };
  }

  async getMessages(conversationId: string, userId: string) {
    // Verify user is part of conversation
    const conversation = await this.conversationRepository.findOne({ where: { id: conversationId } });
    if (!conversation || (conversation.user1Id !== userId && conversation.user2Id !== userId)) {
      throw new Error('Unauthorized');
    }

    const messages = await this.messageRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    return {
      messages: messages.map(message => ({
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        originalText: message.originalText,
        sourceLang: message.sourceLang,
        translatedText: message.translatedText,
        targetLang: message.targetLang,
        status: message.status,
        createdAt: message.createdAt,
      })),
      hasMore: false,
    };
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

// Enhanced Controller
@Controller()
class EnhancedAuthController {
  constructor(
    private authService: EnhancedAuthService,
    private jwtService: JwtService,
  ) {}

  private async getUserFromToken(auth: string) {
    if (!auth) throw new UnauthorizedException();
    const token = auth.replace('Bearer ', '');
    const payload = this.jwtService.verify(token);
    const user = await this.authService.getCurrentUser(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }

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
    return this.getUserFromToken(auth);
  }

  @Get('users/search')
  async searchUsers(@Headers('authorization') auth: string, @Body() body: { q: string }) {
    const user = await this.getUserFromToken(auth);
    return this.authService.searchUsers(body.q || '', user.id);
  }

  @Get('conversations')
  async getConversations(@Headers('authorization') auth: string) {
    const user = await this.getUserFromToken(auth);
    return this.authService.getConversations(user.id);
  }

  @Post('conversations')
  async createConversation(@Headers('authorization') auth: string, @Body() body: { userId: string }) {
    const user = await this.getUserFromToken(auth);
    return this.authService.createConversation(user.id, body.userId);
  }

  @Get('conversations/:id/messages')
  async getMessages(@Headers('authorization') auth: string, @Body() body: { conversationId: string }) {
    const user = await this.getUserFromToken(auth);
    return this.authService.getMessages(body.conversationId, user.id);
  }
}

// Enhanced App Module
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT) || 5432,
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'password',
      database: process.env.DATABASE_NAME || 'cross_lingo_talk',
      entities: [User, Conversation, Message],
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forFeature([User, Conversation, Message]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  controllers: [EnhancedAuthController],
  providers: [EnhancedAuthService, TranslationService],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8081',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  const port = process.env.PORT || 5001;
  await app.listen(port);
  
  console.log(`🚀 Enhanced Backend server running on http://localhost:${port}`);
  console.log(`📊 Database: PostgreSQL (${process.env.DATABASE_NAME})`);
  console.log(`🌐 Translation: ${process.env.GOOGLE_TRANSLATE_API_KEY && process.env.GOOGLE_TRANSLATE_API_KEY !== 'your-google-translate-api-key' ? 'Google Translate API' : 'Mock translations'}`);
}

bootstrap();
