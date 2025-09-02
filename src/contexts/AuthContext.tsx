
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService, User } from '@/services/api';
import { socketService } from '@/services/socket';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (mobile: string, otp: string) => Promise<void>;
  register: (mobile: string, name: string, preferredLanguage: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: { name?: string; preferredLanguage?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  useEffect(() => {
    // Check if user is already logged in on app start
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('user');
      console.log('Checking auth on startup, token:', token ? 'exists' : 'not found');
      console.log('Stored user data:', storedUser);
      
      if (token) {
        try {
          // Try to use stored user data first, then fetch from API if needed
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            console.log('Using stored user data:', userData);
            setUser(userData);
          }
          
          // Still fetch fresh data from API
          const userData = await apiService.getCurrentUser();
          console.log('Fresh user data retrieved:', userData);
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
          
          // Connect to socket
          socketService.connect(token);
          console.log('Socket connected on startup');
        } catch (error) {
          console.error('Auth check failed:', error);
          // Token is invalid, remove it
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (mobile: string, otp: string) => {
    console.log('Auth: Starting login process for mobile:', mobile);
    
    try {
      const response = await apiService.verifyOTP(mobile, otp);
      console.log('Auth: Login successful, user:', response.user);
      console.log('Auth: User name:', response.user?.name);
      console.log('Auth: User language:', response.user?.preferredLanguage);
      console.log('Auth: Full response object:', JSON.stringify(response, null, 2));
      
      // Store user data in localStorage as well for persistence
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
      
      // Connect to socket
      socketService.connect(response.accessToken);
      console.log('Auth: Socket connected after login');
    } catch (error: any) {
      console.error('Auth: Login failed:', error);
      
      // Enhanced error handling
      if (error?.message?.includes('404')) {
        throw new Error('User not found. Please register first.');
      } else if (error?.message?.includes('401') || error?.message?.includes('Invalid')) {
        throw new Error('Invalid OTP. Please use 1234 for development.');
      } else if (error?.message?.includes('Failed to fetch')) {
        throw new Error('Network error. Please check if the backend server is running on http://localhost:3000');
      }
      
      throw error;
    }
  };

  const register = async (mobile: string, name: string, preferredLanguage: string) => {
    console.log('Auth: Starting registration for mobile:', mobile);
    
    try {
      await apiService.register(mobile, name, preferredLanguage);
      console.log('Auth: Registration successful');
      // Registration successful, user can now login with OTP
    } catch (error: any) {
      console.error('Auth: Registration failed:', error);
      
      if (error?.message?.includes('409') || error?.message?.includes('already exists')) {
        throw new Error('Mobile number already registered. Please login instead.');
      } else if (error?.message?.includes('Failed to fetch')) {
        throw new Error('Network error. Please check if the backend server is running on http://localhost:3000');
      }
      
      throw error;
    }
  };

  const logout = () => {
    console.log('Auth: Logging out user');
    apiService.logout();
    socketService.disconnect();
    setUser(null);
  };

  const updateUser = async (data: { name?: string; preferredLanguage?: string }) => {
    try {
      const updatedUser = await apiService.updateProfile(data);
      setUser(updatedUser);
    } catch (error) {
      console.error('Auth: Update user failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
