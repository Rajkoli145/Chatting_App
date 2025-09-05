import React, { useState, useEffect, useRef } from 'react';
import { Send, Globe, Eye, EyeOff, MoreVertical, Phone, Video, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { socketService } from '@/services/socket';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import EmojiPicker from '@/components/EmojiPicker';

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
  const [newMessage, setNewMessage] = useState<string>('');
  console.log(' newMessage initialized:', newMessage, typeof newMessage);
  const [showTranslations, setShowTranslations] = useState(true);
  const [showOriginal, setShowOriginal] = useState<{ [key: string]: boolean }>({});
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [userOnlineStatus, setUserOnlineStatus] = useState<{ [userId: string]: boolean }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Connect to chat WebSocket on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    console.log(' Auth token found:', !!token);
    
    if (token && user) {
      console.log(' Connecting to chat WebSocket...');
      // Connection is handled by AuthContext via socketService
      
      // Set up WebSocket listeners
      socketService.onNewMessage((message) => {
        const incomingMessage: Message = {
          ...message,
          id: message.id,
          createdAt: new Date(message.timestamp),
          timestamp: new Date(message.timestamp),
          isOwn: message.senderId === (user?._id || user?.id),
          status: (message.status as 'sending' | 'sent' | 'delivered' | 'read' | 'failed') || 'sent',
        };
        
        setMessages(prev => {
          // Check if message already exists to prevent duplicates
          const messageExists = prev.some(msg => msg.id === message.id);
          if (messageExists) {
            return prev;
          }
          
          // Only add message if it belongs to the current conversation
          if (message.conversationId !== selectedConversationId) {
            return prev;
          }
          
          return [...prev, incomingMessage];
        });
      });

      socketService.onTypingUpdate(({ userId, isTyping }) => {
        console.log(' User typing:', userId, isTyping);
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

      socketService.onUserStatusChanged(({ userId, isOnline }) => {
        console.log(' User online status changed:', userId, isOnline);
        setUserOnlineStatus(prev => ({
          ...prev,
          [userId]: isOnline
        }));
      });

      // Request current online users when connecting
      socketService.getOnlineUsers();
      socketService.onOnlineUsersResponse(({ onlineUsers }) => {
        console.log(' Received online users list:', onlineUsers);
        const statusMap: { [userId: string]: boolean } = {};
        onlineUsers.forEach(userId => {
          statusMap[userId] = true;
        });
        setUserOnlineStatus(statusMap);
      });

      return () => {
        console.log(' Disconnecting chat WebSocket');
        socketService.removeAllListeners();
        // Disconnection is handled by AuthContext
      };
    }
  }, [user, selectedConversationId]);

  // Effect to join conversation when selected conversation changes
  useEffect(() => {
    console.log('🔄 ChatInterface: selectedConversationId changed to:', selectedConversationId);
    if (selectedConversationId && selectedConversation) {
      console.log('🔄 ChatInterface: Joining conversation and loading messages');
      socketService.joinConversation(selectedConversationId);
      loadMessages();
      
      // Clear unread count for this conversation when it's selected
      socketService.getUnreadCounts();
    }
  }, [selectedConversationId, selectedConversation]);

  // Join conversation when selected and load messages
  useEffect(() => {
    console.log('🔄 Conversation effect triggered:', { selectedConversationId, userId: user?._id || user?.id });
    
    if (selectedConversationId && user) {
      console.log('🔄 Joining conversation and loading messages');
      // Join the new conversation
      socketService.joinConversation(selectedConversationId);
      
      // Load messages from API
      loadMessages();
      
      setMessagesLoaded(true);
    } else if (selectedConversationId) {
      console.log('🔄 Conversation selected but user not ready');
      // Don't clear messages if we have a conversation but user is still loading
    } else {
      console.log('🔄 No conversation selected, clearing messages');
      // Clear messages when no conversation is selected
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
    
    console.log('📥 Loading messages for conversation:', selectedConversationId);
    
    try {
      const data = await apiService.getMessages(selectedConversationId);
      console.log('📥 Raw API response:', data);
      
      const messages = Array.isArray(data) ? data : data.messages || [];
      console.log('📥 Extracted messages array:', messages);
      
      const formattedMessages = messages.map(msg => ({
        ...msg,
        id: msg._id || msg.id,
        createdAt: new Date(msg.createdAt),
        timestamp: new Date(msg.createdAt),
        isOwn: msg.senderId === (user?._id || user?.id)
      }));
      
      console.log('📥 Formatted messages:', formattedMessages);
      setMessages(formattedMessages);
      console.log('📥 Messages state updated with', formattedMessages.length, 'messages');
    } catch (error) {
      console.error('📥 Failed to load messages:', error);
      if (error.message?.includes('404') || error.message?.includes('500')) {
        setMessages([]);
        localStorage.removeItem('selectedConversationId');
      }
    }
  };

  const handleSendMessage = async () => {
    console.log('🚀 handleSendMessage called - newMessage:', newMessage, 'type:', typeof newMessage);
    const messageText = typeof newMessage === 'string' ? newMessage.trim() : '';
    console.log('🚀 messageText after processing:', messageText);
    console.log('🚀 selectedConversationId:', selectedConversationId);
    console.log('🚀 selectedConversation:', selectedConversation);
    
    if (!messageText || !selectedConversationId || !selectedConversation) {
      console.log('🚀 Early return - missing data');
      return;
    }

    const receiverId = selectedConversation.user.id;
    const senderId = user?._id || user?.id;
    console.log('🚀 receiverId:', receiverId, 'senderId:', senderId);

    if (!senderId) {
      console.log('🚀 No sender ID - authentication error');
      toast({
        title: 'Error',
        description: 'User authentication error',
        variant: 'destructive',
      });
      return;
    }

    // Clear the input immediately for better UX
    setNewMessage('');
    console.log('🚀 Input cleared, sending message via WebSocket...');

    try {
      // Send via WebSocket only - backend handles persistence
      console.log('🚀 Calling socketService.sendMessage with:', {
        conversationId: selectedConversationId,
        message: messageText,
        senderLang: user?.preferredLanguage || 'en',
        receiverLang: selectedConversation.user.preferredLanguage,
        receiverId
      });
      
      socketService.sendMessage(
        selectedConversationId,
        messageText,
        user?.preferredLanguage || 'en',
        selectedConversation.user.preferredLanguage,
        receiverId
      );
      
      console.log('🚀 Message sent successfully via WebSocket');
      
    } catch (error) {
      console.error('🚀 Failed to send message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => (prev || '') + emoji);
  };

  const handleGifSelect = (gifUrl: string) => {
    // For now, we'll treat GIFs as text messages with the URL
    // In a full implementation, you might want to handle GIFs differently
    setNewMessage(prev => (prev || '') + ` [GIF: ${gifUrl}] `);
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
              <div className={`w-2 h-2 rounded-full ${userOnlineStatus[selectedConversation?.user?.id] ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span>{userOnlineStatus[selectedConversation?.user?.id] ? 'Online' : 'Offline'}</span>
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
            console.log(` Rendering message ${index}:`, message);
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
                    {/* Check if message is a GIF */}
                    {message.originalText?.startsWith('[GIF:') && message.originalText?.endsWith(']') ? (
                      <div className="mb-2">
                        <img
                          src={message.originalText.slice(6, -1)} // Extract URL from [GIF: url]
                          alt="GIF"
                          className="max-w-xs rounded-lg shadow-sm"
                          style={{ maxHeight: '200px' }}
                          onError={(e) => {
                            // Fallback to text if image fails to load
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                              e.currentTarget.nextElementSibling.style.display = 'block';
                            }
                          }}
                        />
                        <p style={{ display: 'none' }} className="text-muted-foreground text-sm">
                          {message.originalText}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm">
                          {showOriginal[message.id] 
                            ? message.originalText 
                            : (message.translatedText || message.originalText || 'No text')
                          }
                        </p>
                        
                        {message.translatedText && message.translatedText !== message.originalText && (
                          <div className="flex items-center justify-between text-xs opacity-70 mt-2">
                            <div className="flex items-center space-x-1">
                              <Globe className="h-3 w-3" />
                              <span>
                                {showOriginal[message.id] 
                                  ? `Original (${message.sourceLang})`
                                  : `Translated from ${message.sourceLang}`
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
                                <> Show Translation</>
                              ) : (
                                <> Show Original</>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={`text-xs text-gray-500 mt-1 ${message.isOwn ? 'text-right' : 'text-left'}`}>
                    {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : 'No time'}
                    {message.isOwn && (
                      <span className="ml-2">
                        {message.status === 'sent' && ''}
                        {message.status === 'delivered' && ''}
                        {message.status === 'read' && ''}
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
      <div className="flex items-center space-x-2 p-4 border-t">
        <Input
          value={newMessage || ''}
          onChange={(e) => {
            const value = e.target.value || '';
            setNewMessage(value);
          }}
          placeholder="Type a message..."
          className="flex-1"
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />
        <EmojiPicker onEmojiSelect={handleEmojiSelect} onGifSelect={handleGifSelect} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Globe className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => console.log('Auto-detect')}>
              Auto-detect
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => console.log('English')}>
              English
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => console.log('Hindi')}>
              Hindi
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => console.log('Spanish')}>
              Spanish
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button 
          onClick={handleSendMessage}
          disabled={!newMessage || !String(newMessage).trim()}
          size="sm"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatInterface;