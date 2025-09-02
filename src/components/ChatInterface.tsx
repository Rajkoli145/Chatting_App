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
  originalText: string;
  translatedText?: string;
  sourceLang: string;
  targetLang?: string;
  senderId: string;
  timestamp: Date;
  isOwn: boolean;
  status: 'sent' | 'delivered' | 'read';
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
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ selectedConversationId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showTranslations, setShowTranslations] = useState(true);
  const [showOriginal, setShowOriginal] = useState<{ [key: string]: boolean }>({});
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Connect to chat WebSocket on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    console.log('🔑 Auth token found:', !!token);
    
    if (token && user) {
      console.log('💬 Connecting to chat WebSocket...');
      chatService.connect(token);
      
      // Set up message listeners
      chatService.onNewMessage((message) => {
        console.log('📨 Received new message:', message);
        setMessages(prev => [...prev, {
          ...message,
          timestamp: new Date(message.timestamp),
          isOwn: message.senderId === user.id
        }]);
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

  // Join conversation when selected
  useEffect(() => {
    if (selectedConversationId) {
      console.log('🏠 Joining conversation:', selectedConversationId);
      chatService.joinConversation(selectedConversationId);
      loadMessages();
    }
  }, [selectedConversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    if (!selectedConversationId) return;
    
    try {
      const data = await apiService.getMessages(selectedConversationId);
      setMessages(data.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.createdAt),
        isOwn: msg.senderId === user?.id
      })));
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversationId || !user) return;

    console.log('📤 Sending message:', newMessage);
    
    const messageData = {
      conversationId: selectedConversationId,
      receiverId: 'other-user-id', // TODO: Get from conversation
      originalText: newMessage,
      sourceLang: user.preferredLanguage || 'en',
      targetLang: 'auto', // TODO: Detect target language
    };

    chatService.sendMessage(messageData);
    setNewMessage('');
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
            <h2 className="font-semibold text-foreground">Chat User</h2>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-muted" />
              <span>Offline</span>
              <Badge variant="secondary" className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                EN
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
          {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-xs lg:max-w-md ${message.isOwn ? 'order-2' : 'order-1'}`}>
              <div
                className={`rounded-2xl px-4 py-3 shadow-elegant ${
                  message.isOwn
                    ? 'bg-chat-bubble-sent text-chat-bubble-sent-foreground ml-4'
                    : 'bg-chat-bubble-received text-chat-bubble-received-foreground mr-4'
                }`}
              >
                <div className="space-y-2">
                  <p className="text-sm leading-relaxed">
                    {showOriginal[message.id] ? message.originalText : (message.translatedText || message.originalText)}
                  </p>
                  
                  {message.translatedText && (
                    <div className="flex items-center justify-between text-xs opacity-70">
                      <div className="flex items-center space-x-1">
                        <Globe className="h-3 w-3" />
                        <span>
                          {showOriginal[message.id] 
                            ? `Original (${getLanguageName(message.sourceLang)})`
                            : `Translated from ${getLanguageName(message.sourceLang)}`
                          }
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs opacity-70 hover:opacity-100"
                        onClick={() => toggleOriginal(message.id)}
                      >
                        {showOriginal[message.id] ? (
                          <><EyeOff className="h-3 w-3 mr-1" />Hide</>
                        ) : (
                          <><Eye className="h-3 w-3 mr-1" />Original</>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div className={`text-xs text-muted-foreground mt-1 ${message.isOwn ? 'text-right' : 'text-left'}`}>
                {formatTime(message.timestamp)}
                {message.isOwn && (
                  <span className="ml-2">
                    {message.status === 'sent' && '✓'}
                    {message.status === 'delivered' && '✓✓'}
                    {message.status === 'read' && <span className="text-primary">✓✓</span>}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        
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