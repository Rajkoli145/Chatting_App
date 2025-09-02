import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OtpService } from './otp.service';
import { Logger } from '@nestjs/common';

interface OtpSocket extends Socket {
  mobile?: string;
}

@WebSocketGateway({
  namespace: '/otp',
  cors: {
    origin: ['http://localhost:8080', 'http://localhost:8081', process.env.FRONTEND_URL || 'http://localhost:8081'],
    credentials: true,
  },
})
export class OtpGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OtpGateway.name);

  constructor(private otpService: OtpService) {}

  afterInit(server: Server) {
    this.otpService.setServer(server);
    this.logger.log('OTP WebSocket Gateway initialized');
  }

  handleConnection(client: OtpSocket) {
    this.logger.log(`OTP Client connected: ${client.id}`);
  }

  handleDisconnect(client: OtpSocket) {
    if (client.mobile) {
      client.leave(`mobile:${client.mobile}`);
    }
    this.logger.log(`OTP Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinMobile')
  async handleJoinMobile(
    @ConnectedSocket() client: OtpSocket,
    @MessageBody() data: { mobile: string }
  ) {
    const { mobile } = data;
    
    if (client.mobile) {
      client.leave(`mobile:${client.mobile}`);
    }
    
    client.mobile = mobile;
    client.join(`mobile:${mobile}`);
    
    // Send current OTP status
    const otpStatus = await this.otpService.getOtpStatus(mobile);
    client.emit('otpStatus', otpStatus);
    
    this.logger.log(`Client ${client.id} joined mobile room: ${mobile}`);
  }

  @SubscribeMessage('generateOtp')
  async handleGenerateOtp(
    @ConnectedSocket() client: OtpSocket,
    @MessageBody() data: { mobile: string }
  ) {
    try {
      const { mobile } = data;
      await this.otpService.generateOtp(mobile);
      
      client.emit('otpGenerationSuccess', {
        mobile,
        message: 'OTP generated successfully'
      });
    } catch (error) {
      client.emit('otpGenerationError', {
        message: 'Failed to generate OTP'
      });
    }
  }

  @SubscribeMessage('verifyOtp')
  async handleVerifyOtp(
    @ConnectedSocket() client: OtpSocket,
    @MessageBody() data: { mobile: string; code: string }
  ) {
    try {
      const { mobile, code } = data;
      const isValid = await this.otpService.verifyOtp(mobile, code);
      
      if (isValid) {
        client.emit('otpVerificationSuccess', {
          mobile,
          message: 'OTP verified successfully'
        });
      } else {
        client.emit('otpVerificationFailed', {
          mobile,
          message: 'Invalid or expired OTP'
        });
      }
    } catch (error) {
      client.emit('otpVerificationError', {
        message: 'Failed to verify OTP'
      });
    }
  }

  @SubscribeMessage('getOtpStatus')
  async handleGetOtpStatus(
    @ConnectedSocket() client: OtpSocket,
    @MessageBody() data: { mobile: string }
  ) {
    try {
      const { mobile } = data;
      const otpStatus = await this.otpService.getOtpStatus(mobile);
      client.emit('otpStatus', otpStatus);
    } catch (error) {
      client.emit('otpStatusError', {
        message: 'Failed to get OTP status'
      });
    }
  }
}
