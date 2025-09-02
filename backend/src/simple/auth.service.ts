import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SimpleAuthService {
  private users = new Map(); // In-memory user storage
  private otpStorage = new Map();

  constructor(private jwtService: JwtService) {}

  async register(mobile: string, name: string, preferredLanguage: string) {
    const otp = '123456'; // Mock OTP for development
    
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

    // Create or update user
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
