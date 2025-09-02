import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Otp, OtpDocument } from '../schemas/otp.schema';
import { Server } from 'socket.io';

@Injectable()
export class OtpService {
  private server: Server;

  constructor(
    @InjectModel(Otp.name) private otpModel: Model<OtpDocument>,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  private generateOtpCode(): string {
    // Generate a unique 6-digit OTP with timestamp-based uniqueness
    const timestamp = Date.now().toString().slice(-3); // Last 3 digits of timestamp
    const random = Math.floor(100 + Math.random() * 900).toString(); // 3 random digits
    return timestamp + random;
  }

  async generateOtp(mobile: string, registrationData?: { name: string; preferredLanguage: string }): Promise<string> {
    const code = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Invalidate any existing OTPs for this mobile
    await this.otpModel.updateMany(
      { mobile, isUsed: false },
      { isUsed: true }
    );

    // Create new OTP
    const otp = new this.otpModel({
      mobile,
      code,
      expiresAt,
      isUsed: false,
      attempts: 0,
      registrationData,
    });

    await otp.save();

    // Emit OTP to connected clients for this mobile (for real-time updates)
    if (this.server) {
      this.server.to(`mobile:${mobile}`).emit('otpGenerated', {
        mobile,
        expiresAt,
        message: 'New OTP generated',
        // Include OTP code in development mode
        code: process.env.NODE_ENV === 'development' ? code : undefined
      });
    }

    // Enhanced terminal display for development
    console.log('\n' + '='.repeat(50));
    console.log(`🔐 REAL-TIME OTP GENERATED`);
    console.log(`📱 Mobile: ${mobile}`);
    console.log(`🔑 OTP Code: ${code}`);
    console.log(`⏰ Generated at: ${new Date().toLocaleTimeString()}`);
    console.log(`⏳ Expires at: ${expiresAt.toLocaleTimeString()}`);
    console.log('='.repeat(50) + '\n');
    
    return code;
  }

  async clearOtpsForMobile(mobile: string): Promise<void> {
    await this.otpModel.deleteMany({ mobile });
    console.log(`🧹 CLEARED ALL OTPs for mobile: ${mobile}`);
  }

  async verifyOtp(mobile: string, code: string): Promise<{ isValid: boolean; registrationData?: { name: string; preferredLanguage: string } }> {
    const otp = await this.otpModel.findOne({
      mobile,
      code,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otp) {
      // Increment attempts for failed verification
      await this.otpModel.updateOne(
        { mobile, isUsed: false },
        { $inc: { attempts: 1 } }
      );
      
      if (this.server) {
        this.server.to(`mobile:${mobile}`).emit('otpVerificationFailed', {
          mobile,
          message: 'Invalid or expired OTP'
        });
      }
      
      console.log(`❌ OTP VERIFICATION FAILED for ${mobile} with code ${code}`);
      return { isValid: false };
    }

    // Mark OTP as used
    otp.isUsed = true;
    await otp.save();

    // Emit successful verification
    if (this.server) {
      this.server.to(`mobile:${mobile}`).emit('otpVerified', {
        mobile,
        message: 'OTP verified successfully'
      });
    }

    // Enhanced terminal display for successful verification
    console.log('\n' + '✅'.repeat(25));
    console.log(`🎉 OTP VERIFICATION SUCCESS`);
    console.log(`📱 Mobile: ${mobile}`);
    console.log(`🔑 Verified Code: ${code}`);
    console.log(`⏰ Verified at: ${new Date().toLocaleTimeString()}`);
    console.log('✅'.repeat(25) + '\n');

    return { isValid: true, registrationData: otp.registrationData };
  }

  async getOtpStatus(mobile: string): Promise<any> {
    const otp = await this.otpModel.findOne({
      mobile,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otp) {
      return { exists: false };
    }

    return {
      exists: true,
      expiresAt: otp.expiresAt,
      attempts: otp.attempts,
      timeRemaining: Math.max(0, otp.expiresAt.getTime() - Date.now()),
    };
  }

  async cleanupExpiredOtps(): Promise<void> {
    await this.otpModel.deleteMany({
      expiresAt: { $lt: new Date() }
    });
  }
}
