import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Smartphone, User, MessageCircle, Globe, ArrowRight } from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

const languages = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिंदी' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
];

export default function RegisterPage() {
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'register' | 'otp'>('register');
  const [otp, setOtp] = useState('');
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleRegister = async () => {
    if (!mobile.trim() || !name.trim() || !preferredLanguage) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.register(mobile, name, preferredLanguage);
      
      // Show OTP in development mode
      if (response.otp) {
        toast({
          title: 'Development OTP',
          description: `Your OTP is: ${response.otp}`,
          duration: 10000, // Show for 10 seconds
        });
      }
      
      toast({
        title: 'OTP Sent',
        description: 'Please verify your mobile number with the OTP sent.',
      });
      setStep('otp');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to register. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
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

    setIsLoading(true);
    try {
      await login(mobile, otp);
      
      toast({
        title: 'Success',
        description: 'Registration completed successfully!',
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
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>
            Join our multilingual chat community
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {step === 'register' ? (
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

              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Preferred Language</Label>
                <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
                  <SelectTrigger>
                    <div className="flex items-center">
                      <Globe className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Select your language" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <div className="flex items-center space-x-2">
                          <span>{lang.name}</span>
                          <span className="text-muted-foreground">({lang.native})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={handleRegister}
                disabled={isLoading}
                className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                {isLoading ? 'Sending OTP...' : 'Create Account'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <div className="text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <Link to="/login" className="text-primary hover:underline">
                  Login
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold">Verify Your Number</h3>
                <p className="text-sm text-muted-foreground">
                  Enter the OTP sent to {mobile}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp">Enter OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="text-center text-lg tracking-widest"
                  maxLength={6}
                />
              </div>
              
              <Button 
                onClick={handleVerifyOTP}
                disabled={isLoading}
                className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                {isLoading ? 'Verifying...' : 'Verify & Complete Registration'}
              </Button>

              <Button 
                variant="ghost"
                onClick={() => setStep('register')}
                className="w-full"
              >
                Back to Registration
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}