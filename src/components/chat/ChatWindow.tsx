import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Globe, Eye, EyeOff, MoreVertical, Phone, Video, Settings, ArrowLeft, Languages, Trash2, MessageSquareX } from 'lucide-react';
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
  const [userOnlineStatus, setUserOnlineStatus] = useState<{ [userId: string]: boolean }>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    loadMessages();
    setupSocketListeners();
    
    // Get initial online status for other user
    if (receiverId) {
      socketService.getUserStatus(receiverId);
    }
    
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
      setMessages(data.messages || []);
      
      // Set target language and receiverId based on other user's preference
      if (data.messages && data.messages.length > 0) {
        const firstMessage = data.messages[0];
        console.log(`🎨 Rendering message ${0}:`, firstMessage);
        console.log(`🔤 Original: "${firstMessage.originalText}", Translated: "${firstMessage.translatedText}"`);
        const otherUserId = firstMessage.senderId === (user?._id || user?.id) ? firstMessage.receiverId : firstMessage.senderId;
        setReceiverId(otherUserId);
        setTargetLang(data.messages[0].targetLang || 'en');
        
        // Get online status for the other user
        socketService.getUserStatus(otherUserId);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
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
        console.log('📨 Received WebSocket message:', message);
        console.log('🔤 WebSocket translatedText:', message.translatedText);
        
        // Skip messages sent by current user to prevent duplicates
        if (message.senderId === (user?._id || user?.id)) {
          console.log('⚠️ Skipping own message to prevent duplicate:', message.id);
          return;
        }
        
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
        console.log('📝 Created message object:', newMessage);
        
        // Check if message already exists to prevent duplicates
        setMessages(prev => {
          const existingMessage = prev.find(msg => msg.id === message.id);
          if (existingMessage) {
            console.log('⚠️ Duplicate message detected, skipping:', message.id);
            return prev;
          }
          return [...prev, newMessage];
        });
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

    // Handle message deletion
    socketService.onMessageDeleted((data) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
      }
    });

    // Handle conversation clearing
    socketService.onConversationCleared((data) => {
      if (data.conversationId === conversationId) {
        setMessages([]);
        toast({
          title: 'Conversation cleared',
          description: 'All messages have been removed from this conversation.',
        });
      }
    });

    // Handle delete/clear errors
    socketService.onDeleteMessageError((data) => {
      toast({
        title: 'Error',
        description: data.error,
        variant: 'destructive',
      });
    });

    socketService.onClearConversationError((data) => {
      toast({
        title: 'Error',
        description: data.error,
        variant: 'destructive',
      });
    });

    // Handle user status changes
    socketService.onUserStatusChanged((data) => {
      setUserOnlineStatus(prev => ({
        ...prev,
        [data.userId]: data.isOnline
      }));
    });

    socketService.onUserStatusResponse((data) => {
      setUserOnlineStatus(prev => ({
        ...prev,
        [data.userId]: data.isOnline
      }));
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

  const handleDeleteMessage = (messageId: string) => {
    if (!conversationId) return;
    socketService.deleteMessage(messageId, conversationId);
  };

  const handleClearConversation = () => {
    if (!conversationId) return;
    if (window.confirm('Are you sure you want to clear all messages in this conversation? This action cannot be undone.')) {
      socketService.clearConversation(conversationId);
    }
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
              <div className={`w-2 h-2 rounded-full ${
                receiverId && userOnlineStatus[receiverId] 
                  ? 'bg-green-500' 
                  : 'bg-gray-400'
              }`} />
              <span>
                {receiverId && userOnlineStatus[receiverId] ? 'Online' : 'Offline'}
              </span>
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
              <DropdownMenuItem 
                onClick={handleClearConversation}
                className="text-destructive focus:text-destructive"
              >
                <MessageSquareX className="h-4 w-4 mr-2" />
                Clear Conversation
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
        {messages.map((message, index) => {
          const isOwn = message.senderId === (user._id || user.id);
          // Show message in user's preferred language
          const messageContent = isOwn 
            ? message.originalText  // Sender sees original text
            : (message.translatedText || message.originalText); // Receiver sees translated text
          const isGif = messageContent.startsWith('[GIF]');
          const gifUrl = isGif ? messageContent.replace('[GIF]', '') : null;
          
          return (
            <div
              key={message.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  isOwn
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isGif ? (
                  <div className="rounded-lg overflow-hidden">
                    <img 
                      src={gifUrl} 
                      alt="GIF" 
                      className="max-w-full h-auto rounded-lg"
                      style={{ maxHeight: '200px' }}
                    />
                  </div>
                ) : (
                  <div>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {messageContent}
                    </p>
                    {!isOwn && message.translatedText && message.translatedText !== message.originalText && (
                      <div className="mt-2 pt-2 border-t border-border/20">
                        <div className="flex items-center justify-between">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleOriginal(message.id)}
                            className="h-auto p-1 text-xs opacity-70 hover:opacity-100"
                          >
                            <Globe className="h-3 w-3 mr-1" />
                            {showOriginal[message.id] ? 'Show Translation' : 'Show Original'}
                          </Button>
                          <span className="text-xs opacity-50">
                            {message.sourceLang} → {message.targetLang}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs opacity-50">
                    {formatTime(message.createdAt)}
                  </span>
                  {isOwn && (
                    <div className="flex items-center space-x-1">
                      {message.status === 'read' && <Eye className="h-3 w-3 text-blue-500" />}
                      {message.status === 'delivered' && <EyeOff className="h-3 w-3 text-gray-400" />}
                      {message.status === 'sent' && <div className="h-3 w-3 rounded-full bg-gray-400" />}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
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