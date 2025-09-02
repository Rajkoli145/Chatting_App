import { io, Socket } from 'socket.io-client';

export interface OtpStatus {
  exists: boolean;
  expiresAt?: string;
  attempts?: number;
  timeRemaining?: number;
}

export interface OtpEvents {
  otpGenerated: (data: { mobile: string; expiresAt: string; message: string; code?: string }) => void;
  otpVerified: (data: { mobile: string; message: string }) => void;
  otpVerificationFailed: (data: { mobile: string; message: string }) => void;
  otpStatus: (data: OtpStatus) => void;
  otpGenerationSuccess: (data: { mobile: string; message: string }) => void;
  otpGenerationError: (data: { message: string }) => void;
  otpVerificationSuccess: (data: { mobile: string; message: string }) => void;
  otpVerificationError: (data: { message: string }) => void;
  otpStatusError: (data: { message: string }) => void;
}

class OtpService {
  private socket: Socket | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/otp`, {
      transports: ['websocket'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('OTP WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('OTP WebSocket disconnected');
    });

    // Set up event listeners
    Object.keys(this.getDefaultEvents()).forEach(event => {
      this.socket!.on(event, (data: any) => {
        const listeners = this.eventListeners.get(event) || [];
        listeners.forEach(listener => listener(data));
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventListeners.clear();
  }

  joinMobile(mobile: string) {
    if (!this.socket?.connected) {
      this.connect();
    }
    this.socket?.emit('joinMobile', { mobile });
  }

  generateOtp(mobile: string) {
    if (!this.socket?.connected) {
      this.connect();
    }
    this.socket?.emit('generateOtp', { mobile });
  }

  verifyOtp(mobile: string, code: string) {
    if (!this.socket?.connected) {
      this.connect();
    }
    this.socket?.emit('verifyOtp', { mobile, code });
  }

  getOtpStatus(mobile: string) {
    if (!this.socket?.connected) {
      this.connect();
    }
    this.socket?.emit('getOtpStatus', { mobile });
  }

  on<K extends keyof OtpEvents>(event: K, listener: OtpEvents[K]) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off<K extends keyof OtpEvents>(event: K, listener: OtpEvents[K]) {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  private getDefaultEvents(): OtpEvents {
    return {
      otpGenerated: () => {},
      otpVerified: () => {},
      otpVerificationFailed: () => {},
      otpStatus: () => {},
      otpGenerationSuccess: () => {},
      otpGenerationError: () => {},
      otpVerificationSuccess: () => {},
      otpVerificationError: () => {},
      otpStatusError: () => {},
    };
  }
}

export const otpService = new OtpService();
