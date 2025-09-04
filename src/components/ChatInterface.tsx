import React, { useState, useEffect, useRef } from 'react';
import { Send, Globe, Eye, EyeOff, MoreVertical, Phone, Video, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { chatService } from '@/services/chat';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  originalText: string;
  translatedText?: string;
  sourceLang: string;
  targetLang?: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: Date;
  timestamp: Date;
  isOwn: boolean;
}

interface User {
  id: string;
  name: string;
  avatar?: string;
  preferredLanguage: string;
  isOnline: boolean;
}

interface ChatInterfaceProps {
  selectedConversationId?: string;
  selectedConversation?: {
    id: string;
    user: {
      id: string;
      name: string;
      preferredLanguage: string;
      isOnline: boolean;
    };
  };
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ selectedConversationId, selectedConversation }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showTranslations, setShowTranslations] = useState(true);
  const [showOriginal, setShowOriginal] = useState<{ [key: string]: boolean }>({});
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Connect to chat WebSocket on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    console.log('🔑 Auth token found:', !!token);
    
    if (token && user) {
      console.log('💬 Connecting to chat WebSocket...');
      chatService.connect(token);
      
      // Set up WebSocket listeners
      chatService.onNewMessage((message) => {
        console.log('📨 Received new message:', message);
        console.log('📨 Current user ID:', user?._id || user?.id);
        console.log('📨 Message sender ID:', message.senderId);
        console.log('📨 Selected conversation ID:', selectedConversationId);
        console.log('📨 Message conversation ID:', message.conversationId);
        
        const newMessage = {
          ...message,
          createdAt: new Date(message.timestamp),
          timestamp: new Date(message.timestamp),
          isOwn: message.senderId === (user?._id || user?.id)
        };
        
        setMessages(prev => {
          // Check if message already exists to prevent duplicates
          const messageExists = prev.some(msg => msg.id === message.id);
          if (messageExists) {
            console.log('📨 Message already exists, skipping:', message.id);
            return prev;
          }
          
          // Only add message if it belongs to the current conversation
          if (message.conversationId !== selectedConversationId) {
            console.log('📨 Message not for current conversation, skipping');
            console.log('📨 Message conversation ID:', message.conversationId);
            console.log('📨 Selected conversation ID:', selectedConversationId);
            return prev;
          }
          
          console.log('📨 Adding new message to UI:', newMessage);
          return [...prev, newMessage];
        });
      });

      chatService.onUserTyping(({ userId, isTyping }) => {
        console.log('⌨️ User typing:', userId, isTyping);
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          if (isTyping) {
            newSet.add(userId);
          } else {
            newSet.delete(userId);
          }
          return newSet;
        });
      });

      chatService.onUserOnline(({ userId }) => {
        console.log('🟢 User online:', userId);
      });

      chatService.onUserOffline(({ userId }) => {
        console.log('🔴 User offline:', userId);
      });

      return () => {
        console.log('🔌 Disconnecting chat WebSocket');
        chatService.removeAllListeners();
        chatService.disconnect();
      };
    }
  }, [user]);

  // Join conversation when selected and load messages
  useEffect(() => {
    console.log('🔄 Effect triggered - selectedConversationId:', selectedConversationId, 'user:', user?.id);
    
    if (selectedConversationId && user) {
      console.log('🏠 Joining conversation:', selectedConversationId);
      chatService.joinConversation(selectedConversationId);
      
      // Load messages from API only
      console.log('📥 Loading messages from API');
      loadMessages();
      
      setMessagesLoaded(true);
    } else if (selectedConversationId) {
      // Don't clear messages if we have a conversation but user is still loading
      console.log('⏳ Waiting for user data...');
    } else {
      // Clear messages when no conversation is selected
      console.log('🧹 Clearing messages - no conversation selected');
      setMessages([]);
      setMessagesLoaded(false);
    }
  }, [selectedConversationId, user]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    if (!selectedConversationId) return;
    
    try {
      const data = await apiService.getMessages(selectedConversationId);
      const messages = Array.isArray(data) ? data : data.messages || [];
      const formattedMessages = messages.map(msg => ({
        ...msg,
        createdAt: new Date(msg.createdAt),
        timestamp: new Date(msg.createdAt),
        isOwn: msg.senderId === (user?._id || user?.id)
      }));
      
      console.log('💾 Loading messages from API for conversation:', selectedConversationId, formattedMessages.length);
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      // If conversation doesn't exist, clear the selected conversation
      if (error.message?.includes('404') || error.message?.includes('500')) {
        console.log('🚫 Conversation not found, clearing selection');
        setMessages([]);
        // You might want to navigate back to conversation list or show an error
      }
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversationId || !selectedConversation) return;

    const receiverId = selectedConversation.user.id;
    console.log('📤 Sending message from:', user?.id, 'to:', receiverId);

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: selectedConversationId,
      senderId: user?._id || user?.id || '',
      receiverId: receiverId,
      originalText: newMessage,
      translatedText: '',
      sourceLang: user?.preferredLanguage || 'en',
      targetLang: selectedConversation.user.preferredLanguage,
      createdAt: new Date(),
      timestamp: new Date(),
      status: 'sending',
      isOwn: true
    };

    // Add message immediately to UI
    const updatedMessages = [...messages, tempMessage];
    setMessages(updatedMessages);
    
    setNewMessage('');

    try {
      // Send via WebSocket for real-time delivery
      chatService.sendMessage({
        conversationId: selectedConversationId,
        originalText: newMessage,
        sourceLang: user?.preferredLanguage || 'en',
        targetLang: selectedConversation.user.preferredLanguage,
        receiverId: receiverId
      });

      // Also send via API for persistence
      await apiService.sendMessage(selectedConversationId, {
        originalText: newMessage,
        sourceLang: user?.preferredLanguage || 'en',
        receiverId: receiverId
      });

      console.log('✅ Message sent successfully');
      
      // Update message status to sent
      const sentMessages = updatedMessages.map(msg => 
        msg.id === tempMessage.id ? { ...msg, status: 'sent' as const } : msg
      );
      setMessages(sentMessages);
      
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      // Update message status to failed
      const failedMessages = updatedMessages.map(msg => 
        msg.id === tempMessage.id ? { ...msg, status: 'failed' as const } : msg
      );
      setMessages(failedMessages);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);
    
    if (selectedConversationId) {
      console.log('⌨️ Sending typing status:', value.length > 0);
      chatService.sendTyping(selectedConversationId, value.length > 0);
    }
  };

  if (!selectedConversationId) {
    return (
      <div className="flex items-center justify-center h-full text-center p-8">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Welcome to Cross-Lingo Chat</h2>
          <p className="text-muted-foreground">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }


  const toggleOriginal = (messageId: string) => {
    setShowOriginal(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const getLanguageName = (code: string) => {
    const languages: { [key: string]: string } = {
      'en': 'English',
      'mr': 'मराठी',
      'hi': 'हिंदी',
      'zh': '中文',
      'es': 'Español',
      'fr': 'Français'
    };
    return languages[code] || code;
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-secondary">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-card border-b border-border shadow-sm">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src="" />
            <AvatarFallback className="bg-gradient-primary text-primary-foreground">
              U
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-foreground">
              {selectedConversation?.user?.name || 'Chat User'}
            </h2>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <div className={`w-2 h-2 rounded-full ${selectedConversation?.user?.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span>{selectedConversation?.user?.isOnline ? 'Online' : 'Offline'}</span>
              {typingUsers.size > 0 && (
                <span className="text-blue-500 animate-pulse">typing...</span>
              )}
              <Badge variant="secondary" className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                {selectedConversation?.user?.preferredLanguage?.toUpperCase() || 'EN'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Video className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Chat Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-xs text-gray-500 mb-2">
            Debug: Messages count: {messages.length} | Selected conversation: {selectedConversationId}
          </div>
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
          {messages.map((message, index) => {
            console.log(`🎨 Rendering message ${index}:`, message);
            return (
              <div
                key={message.id}
                className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'} mb-4`}
              >
                <div className={`max-w-xs lg:max-w-md`}>
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      message.isOwn
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    <p className="text-sm">
                      {message.originalText || 'No text'}
                    </p>
                  </div>
                  <div className={`text-xs text-gray-500 mt-1 ${message.isOwn ? 'text-right' : 'text-left'}`}>
                    {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : 'No time'}
                    {message.isOwn && (
                      <span className="ml-2">
                        {message.status === 'sent' && '✓'}
                        {message.status === 'delivered' && '✓✓'}
                        {message.status === 'read' && '✓✓'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        
        {typingUsers.size > 0 && (
          <div className="flex justify-start">
            <div className="bg-chat-bubble-received text-chat-bubble-received-foreground rounded-2xl px-4 py-3 mr-4">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-card border-t border-border">
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Badge variant="outline" className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                EN
              </Badge>
            </div>
          </div>
          <Button 
            onClick={handleSendMessage}
            className="rounded-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;