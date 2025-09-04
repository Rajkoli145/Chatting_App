import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Globe, Eye, EyeOff, MoreVertical, Phone, Video, Settings, ArrowLeft, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { apiService, Message, User } from '@/services/api';
import { socketService, SocketMessage } from '@/services/socket';
import { useToast } from '@/hooks/use-toast';

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

export default function ChatWindow() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sourceLang, setSourceLang] = useState(user?.preferredLanguage || 'en');
  const [targetLang, setTargetLang] = useState('en');
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [receiverId, setReceiverId] = useState<string>('');
  const [showOriginal, setShowOriginal] = useState<{ [key: string]: boolean }>({});
  const [isTyping, setIsTyping] = useState(false);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    loadMessages();
    setupSocketListeners();
    
    return () => {
      socketService.stopTyping(conversationId);
      socketService.leaveConversation(conversationId);
    };
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!conversationId) return;
    
    try {
      const data = await apiService.getMessages(conversationId);
      setMessages(data.messages);
      
      // Set target language and receiverId based on other user's preference
      if (data.messages.length > 0) {
        const firstMessage = data.messages[0];
        const otherUserId = firstMessage.senderId === user?.id ? firstMessage.receiverId : firstMessage.senderId;
        setReceiverId(otherUserId);
        setTargetLang(data.messages[0].targetLang || 'en');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      });
    }
  };

  const setupSocketListeners = () => {
    if (!conversationId) return;

    // Join the conversation room
    socketService.joinConversation(conversationId);

    socketService.onNewMessage((message: SocketMessage) => {
      if (message.conversationId === conversationId) {
        const newMessage: Message = {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          receiverId: message.receiverId,
          originalText: message.originalText,
          sourceLang: message.sourceLang,
          translatedText: message.translatedText,
          targetLang: message.targetLang,
          createdAt: typeof message.timestamp === 'string' ? message.timestamp : message.timestamp.toISOString(),
          status: message.status as 'sent' | 'delivered' | 'read'
        };
        setMessages(prev => [...prev, newMessage]);
      }
    });

    socketService.onTypingUpdate((data) => {
      if (data.conversationId === conversationId && data.userId !== user?.id) {
        setIsOtherUserTyping(data.isTyping);
      }
    });

    socketService.onMessageDelivered((data) => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === data.messageId 
            ? { ...msg, status: 'delivered' as const }
            : msg
        )
      );
    });

    socketService.onMessageRead((data) => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === data.messageId 
            ? { ...msg, status: 'read' as const }
            : msg
        )
      );
    });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !conversationId) return;

    socketService.sendMessage(conversationId, newMessage, sourceLang, targetLang, receiverId);
    setNewMessage('');
    
    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socketService.stopTyping(conversationId);
    setIsTyping(false);
  };

  const handleTyping = (text: string) => {
    setNewMessage(text);
    
    if (!conversationId) return;

    // Start typing indicator
    if (!isTyping) {
      socketService.startTyping(conversationId);
      setIsTyping(true);
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping(conversationId);
      setIsTyping(false);
    }, 3000);
  };

  const toggleOriginal = (messageId: string) => {
    setShowOriginal(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const getLanguageName = (code: string) => {
    const lang = languages.find(l => l.code === code);
    return lang?.name || code;
  };

  const getLanguageNative = (code: string) => {
    const lang = languages.find(l => l.code === code);
    return lang?.native || code;
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-secondary">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-card border-b border-border shadow-sm">
        <div className="flex items-center space-x-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/')}
            className="lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-gradient-primary text-primary-foreground">
              {otherUser?.name.split(' ').map(n => n[0]).join('') || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-foreground">
              {otherUser?.name || 'User'}
            </h2>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span>Online</span>
              {otherUser && (
                <Badge variant="secondary" className="text-xs">
                  <Globe className="h-3 w-3 mr-1" />
                  {getLanguageName(otherUser.preferredLanguage)}
                </Badge>
              )}
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

      {/* Language Selection */}
      <div className="flex items-center justify-between p-3 bg-muted/30 border-b border-border text-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">From:</span>
            <Select value={sourceLang} onValueChange={setSourceLang}>
              <SelectTrigger className="h-8 w-auto border-0 bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.native}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-muted-foreground">To:</span>
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger className="h-8 w-auto border-0 bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.native}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Badge variant="outline" className="text-xs">
          Auto-translate enabled
        </Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.senderId === user.id ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-xs lg:max-w-md ${message.senderId === user.id ? 'order-2' : 'order-1'}`}>
              <div
                className={`rounded-2xl px-4 py-3 shadow-elegant ${
                  message.senderId === user.id
                    ? 'bg-chat-bubble-sent text-chat-bubble-sent-foreground ml-4'
                    : 'bg-chat-bubble-received text-chat-bubble-received-foreground mr-4'
                }`}
              >
                <div className="space-y-2">
                  <p className="text-sm leading-relaxed">
                    {showOriginal[message.id] 
                      ? message.originalText 
                      : (message.translatedText || message.originalText)
                    }
                  </p>
                  
                  {message.translatedText && message.translatedText !== message.originalText && (
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
              <div className={`text-xs text-muted-foreground mt-1 ${
                message.senderId === user.id ? 'text-right' : 'text-left'
              }`}>
                {formatTime(message.createdAt)}
                {message.senderId === user.id && (
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
        
        {isOtherUserTyping && (
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
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-card border-t border-border">
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e) => handleTyping(e.target.value)}
              placeholder={`Type in ${getLanguageNative(sourceLang)}...`}
              className="pr-12 rounded-full"
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Badge variant="outline" className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                {sourceLang.toUpperCase()}
              </Badge>
            </div>
          </div>
          <Button 
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="rounded-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}