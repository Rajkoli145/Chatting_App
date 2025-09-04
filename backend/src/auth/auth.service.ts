import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { OtpService } from './otp.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private otpService: OtpService,
  ) {}

  async register(mobile: string, name: string, preferredLanguage: string) {
    // Check if user already exists
    const existingUser = await this.userModel.findOne({ mobile });
    
    if (existingUser) {
      throw new BadRequestException('User with this mobile number already exists. Please login instead.');
    }

    // Clear any existing OTPs for this mobile number
    await this.otpService.clearOtpsForMobile(mobile);
    
    // Generate new OTP with registration data
    const otp = await this.otpService.generateOtp(mobile, { name, preferredLanguage });

    return { 
      message: 'OTP sent for registration',
      mobile,
      otp: process.env.NODE_ENV === 'development' ? otp : undefined 
    };
  }

  async login(mobile: string) {
    // Check if user exists
    const existingUser = await this.userModel.findOne({ mobile });
    
    if (!existingUser) {
      throw new BadRequestException('User not found. Please register first.');
    }

    // Clear any existing OTPs for this mobile number
    await this.otpService.clearOtpsForMobile(mobile);
    
    // Generate new OTP using the OTP service
    const otp = await this.otpService.generateOtp(mobile);

    return { 
      message: 'OTP sent for login',
      mobile,
      otp: process.env.NODE_ENV === 'development' ? otp : undefined 
    };
  }

  async verifyOTP(mobile: string, otp: string, name?: string, preferredLanguage?: string) {
    // Verify OTP using the OTP service
    const verificationResult = await this.otpService.verifyOtp(mobile, otp);
    
    if (!verificationResult.isValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Find or create user
    let user = await this.userModel.findOne({ mobile });
    
    if (!user) {
      // Create new user - use registration data from OTP if available
      const regData = verificationResult.registrationData;
      user = new this.userModel({
        mobile,
        name: regData?.name || name || 'User',
        preferredLanguage: regData?.preferredLanguage || preferredLanguage || 'en',
        isVerified: true,
        lastLoginAt: new Date(),
      });
      await user.save();
    } else {
      // Update existing user
      if (name) user.name = name;
      if (preferredLanguage) user.preferredLanguage = preferredLanguage;
      user.isVerified = true;
      user.lastLoginAt = new Date();
      await user.save();
    }

    // Generate JWT token
    const payload = { sub: user._id.toString(), mobile: user.mobile };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user._id.toString(),
        mobile: user.mobile,
        name: user.name,
        preferredLanguage: user.preferredLanguage,
        createdAt: (user as any).createdAt,
      },
    };
  }

  async validateUser(userId: string): Promise<UserDocument> {
    console.log('🔍 AuthService: Validating user with ID:', userId);
    const user = await this.userModel.findById(userId);
    if (!user) {
      console.log('❌ AuthService: User not found for ID:', userId);
      throw new UnauthorizedException('User not found');
    }
    console.log('✅ AuthService: User validated:', user.name, user.mobile);
    return user;
  }
}
