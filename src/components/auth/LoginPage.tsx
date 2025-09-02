
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Smartphone, MessageCircle, Clock } from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [isLoading, setIsLoading] = useState(false);
  const [otpTimeRemaining, setOtpTimeRemaining] = useState<number>(0);
  const [isOtpExpired, setIsOtpExpired] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string>('');

  const { toast } = useToast();
  const navigate = useNavigate();
  const { login } = useAuth();

  // Timer for OTP countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimeRemaining > 0) {
      interval = setInterval(() => {
        setOtpTimeRemaining(prev => {
          if (prev <= 1) {
            setIsOtpExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimeRemaining]);

  const handleSendOTP = async () => {
    if (!mobile.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter your mobile number',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiService.login(mobile);
      setStep('otp');
      setOtpTimeRemaining(300); // 5 minutes
      setIsOtpExpired(false);

      toast({
        title: 'OTP Sent',
        description: 'Please check your phone for the verification code',
      });

      // Display OTP in development
      if (data.otp) {
        setGeneratedOtp(data.otp);
        toast({
          title: 'OTP Generated',
          description: `Your OTP: ${data.otp}`,
          duration: 10000,
        });
      }
    } catch (error: any) {
      if (error.response?.data?.message?.includes('User not found')) {
        toast({
          title: 'Account Not Found',
          description: 'Please register first before logging in.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to send OTP. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeNumber = () => {
    setStep('mobile');
    setOtp('');
    setOtpTimeRemaining(0);
    setIsOtpExpired(false);
    setGeneratedOtp('');
    setMobile('');
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter the OTP',
        variant: 'destructive',
      });
      return;
    }

    if (isOtpExpired) {
      toast({
        title: 'OTP Expired',
        description: 'Please request a new OTP',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await login(mobile, otp);

      toast({
        title: 'Success',
        description: 'Login successful!',
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Invalid OTP. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-gradient-primary p-3 rounded-full">
              <MessageCircle className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to your multilingual chat account
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {step === 'mobile' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number</Label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="mobile"
                    type="tel"
                    placeholder="+1234567890"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Button 
                onClick={handleSendOTP}
                disabled={isLoading}
                className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                {isLoading ? 'Sending...' : 'Send OTP'}
              </Button>
            </>
          )}

          {step === 'otp' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="otp">Enter OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>OTP sent to {mobile}</span>
                  {otpTimeRemaining > 0 && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span className={isOtpExpired ? 'text-red-500' : ''}>
                        {Math.floor(otpTimeRemaining / 60)}:{(otpTimeRemaining % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Development OTP Display */}
                {generatedOtp && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm font-medium text-blue-800">
                      Development OTP: <span className="font-mono text-lg">{generatedOtp}</span>
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      This is shown only in development mode
                    </p>
                  </div>
                )}
                
                {isOtpExpired && (
                  <p className="text-xs text-red-500">
                    OTP has expired. Please request a new one.
                  </p>
                )}
              </div>
              
              <Button 
                onClick={handleVerifyOTP}
                disabled={isLoading}
                className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </Button>
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleChangeNumber}
                  variant="ghost"
                  className="flex-1"
                >
                  Change Number
                </Button>
                {isOtpExpired && (
                  <Button 
                    onClick={handleSendOTP}
                    variant="outline"
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Resend OTP
                  </Button>
                )}
              </div>
            </>
          )}

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link to="/register" className="text-primary hover:underline">
              Register
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
