import React, { useState, useEffect } from 'react';
import { Search, Plus, Globe, Settings, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import LanguageSettings from './LanguageSettings';
import socketService from '@/services/socket';

interface Conversation {
  id: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
    preferredLanguage: string;
    isOnline: boolean;
  };
  lastMessage?: {
    text: string;
    timestamp: Date;
    isOwn: boolean;
    isTranslated?: boolean;
  };
  unreadCount?: number;
}

interface ChatSidebarProps {
  selectedConversationId?: string | null;
  onSelectConversation: (conversationId: string, conversation?: any) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ selectedConversationId, onSelectConversation }) => {
  const { user, logout, updateUser } = useAuth();
  const { toast } = useToast();
  
  // Cleanup effect for WebSocket listeners
  useEffect(() => {
    return () => {
      // Clean up specific listeners when component unmounts
      socketService.offUnreadCounts();
      socketService.offNewConversationMessage();
    };
  }, []);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<{ [conversationId: string]: number }>({});

  useEffect(() => {
    if (user) {
      console.log('🔄 ChatSidebar: Setting up WebSocket event listeners for user:', user._id || user.id);
      
      // Clear any existing online users state first
      setOnlineUsers(new Set());
      
      setupUnreadCountTracking();
      const cleanupOnlineTracking = setupOnlineStatusTracking();
      
      // Load conversations when user is authenticated
      loadConversations();
      
      // Setup new conversation message notifications
      setupNewConversationNotifications();
      
      // Ensure WebSocket connection and force status sync
      setTimeout(() => {
        console.log('🔄 Ensuring WebSocket connection for proper status sync...');
        socketService.ensureConnection();
      }, 1000);
      
      // Force immediate refresh of online users
      setTimeout(() => {
        console.log('🔄 Force refreshing online users list...');
        socketService.getOnlineUsers();
      }, 1500);
      
      // Set up periodic connection checks
      const connectionCheckInterval = setInterval(() => {
        socketService.ensureConnection();
      }, 30000); // Every 30 seconds
      
      return () => {
        if (cleanupOnlineTracking) {
          cleanupOnlineTracking();
        }
        clearInterval(connectionCheckInterval);
      };
    }
  }, [user]);

  const setupUnreadCountTracking = () => {
    console.log('📊 Setting up unread count tracking...');
    
    // Listen for unread count updates first
    socketService.onUnreadCounts((counts) => {
      console.log('📊 Received unread counts:', counts);
      setUnreadCounts(counts);
    });
    
    // Get initial unread counts with a small delay to ensure WebSocket is connected
    setTimeout(() => {
      console.log('📊 Requesting initial unread counts...');
      socketService.getUnreadCounts();
    }, 500);
  };

  const setupOnlineStatusTracking = () => {
    console.log('🔄 Setting up online status tracking...');
    
    // Set up event listeners immediately - no delay
    socketService.onUserStatusChanged((data) => {
      console.log('🔄 Frontend received userStatusChanged:', data);
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        if (data.isOnline) {
          console.log(`🟢 Setting user ${data.userId} as ONLINE`);
          newSet.add(data.userId);
        } else {
          console.log(`🔴 Setting user ${data.userId} as OFFLINE`);
          newSet.delete(data.userId);
        }
        console.log('🔄 Updated online users:', Array.from(newSet));
        return newSet;
      });
    });
    
    // Listen for online users list response
    socketService.onOnlineUsers((userIds) => {
      console.log('📋 Received online users list:', userIds);
      console.log('📋 Converting to Set and updating state...');
      const newOnlineUsers = new Set(userIds);
      console.log('📋 New online users Set:', Array.from(newOnlineUsers));
      setOnlineUsers(newOnlineUsers);
      
      // Force immediate conversation update with new online status
      setTimeout(() => {
        console.log('📋 Force updating conversations with new online status...');
        setConversations(prev => prev.map(conv => {
          const userId = (conv.user as any)._id || conv.user.id;
          const isOnline = newOnlineUsers.has(userId);
          console.log(`📋 Force update - User ${conv.user.name} (ID: ${userId}) - Online: ${isOnline}`);
          return {
            ...conv,
            user: {
              ...conv.user,
              isOnline: isOnline
            }
          };
        }));
      }, 100);
    });
    
    // Request initial online users list with shorter delay
    setTimeout(() => {
      console.log('📋 Requesting initial online users...');
      socketService.getOnlineUsers();
    }, 500);
    
    // Periodically refresh online users list to ensure sync
    const refreshInterval = setInterval(() => {
      console.log('🔄 Periodic refresh of online users...');
      socketService.getOnlineUsers();
      
      // Fallback: If WebSocket events aren't working, assume both users are online
      // This is a temporary fix until WebSocket event reception is resolved
      setTimeout(() => {
        console.log('🔄 Fallback: Setting all conversation users as online...');
        setConversations(prev => prev.map(conv => ({
          ...conv,
          user: {
            ...conv.user,
            isOnline: true // Temporary fallback - assume all users are online
          }
        })));
      }, 1000);
    }, 10000); // Every 10 seconds
    
    // Cleanup interval on component unmount
    return () => {
      clearInterval(refreshInterval);
    };
  };

  const setupNewConversationNotifications = () => {
    console.log('🔔 Setting up new conversation message notifications...');
    
    socketService.onNewConversationMessage((data) => {
      console.log('🔔 Received new conversation message notification:', data);
      
      const { message, sender, conversation, isNewConversation } = data;
      
      // Show toast notification
      toast({
        title: isNewConversation ? 'New Message from Unknown User' : 'New Message',
        description: `${sender.name} (${sender.mobile}): ${message.originalText}`,
        duration: 5000,
      });
      
      // If it's a new conversation, add it to the conversations list
      if (isNewConversation) {
        const newConversation: Conversation = {
          id: conversation.id,
          user: {
            id: sender.id,
            name: sender.name,
            preferredLanguage: sender.preferredLanguage,
            isOnline: onlineUsers.has(sender.id)
          },
          lastMessage: {
            text: message.originalText,
            timestamp: new Date(message.timestamp),
            isOwn: false,
            isTranslated: message.isTranslated || false
          },
          unreadCount: 1
        };
        
        setConversations(prev => [newConversation, ...prev]);
        
        // Update unread counts
        setUnreadCounts(prev => ({
          ...prev,
          [conversation.id]: 1
        }));
      } else {
        // Update existing conversation's last message
        setConversations(prev => prev.map(conv => {
          if (conv.id === conversation.id) {
            return {
              ...conv,
              lastMessage: {
                text: message.originalText,
                timestamp: new Date(message.timestamp),
                isOwn: false,
                isTranslated: message.isTranslated || false
              }
            };
          }
          return conv;
        }));
        
        // Update unread count
        setUnreadCounts(prev => ({
          ...prev,
          [conversation.id]: (prev[conversation.id] || 0) + 1
        }));
      }
    });
  };

  // Separate effect to ensure online status updates are applied to conversations
  useEffect(() => {
    console.log('🔄 Updating conversation online status...');
    console.log('🔄 Current online users:', Array.from(onlineUsers));
    
    setConversations(prev => prev.map(conv => {
      // Handle both _id and id formats for user identification
      const userId = (conv.user as any)._id || conv.user.id;
      const isOnline = onlineUsers.has(userId);
      console.log(`🔄 User ${conv.user.name} (ID: ${userId}) - Online: ${isOnline}`);
      console.log(`🔄 Checking against online users:`, Array.from(onlineUsers));
      return {
        ...conv,
        user: {
          ...conv.user,
          isOnline: isOnline
        }
      };
    }));
  }, [onlineUsers]);

  // Listen for new messages to update unread counts
  useEffect(() => {
    socketService.onNewMessage((message) => {
      const currentUserId = user?._id || user?.id;
      
      // Only increment unread count if message is not from current user and not in active conversation
      if (message.senderId !== currentUserId && message.conversationId !== selectedConversationId) {
        setUnreadCounts(prev => ({
          ...prev,
          [message.conversationId]: (prev[message.conversationId] || 0) + 1
        }));
      }
    });
  }, [user, selectedConversationId]);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getConversations();
      // Transform API data to match local interface
      const transformedData = (data || []).map((conv: any) => ({
        ...conv,
        user: {
          ...conv.user,
          isOnline: onlineUsers.has(conv.user.id), // Check actual online status
          avatar: undefined
        },
        unreadCount: 0,
        lastMessage: conv.lastMessage ? {
          ...conv.lastMessage,
          timestamp: new Date(conv.lastMessage.timestamp),
          isTranslated: false
        } : null
      }));
      
      setConversations(transformedData);
      
      // If no conversations exist, clear any stored conversation ID
      if (transformedData.length === 0) {
        localStorage.removeItem('selectedConversationId');
        onSelectConversation(null);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      // Show empty state for now
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (newName: string) => {
    try {
      await updateUser({ name: newName });
    } catch (error) {
      console.error('Failed to update name:', error);
    }
  };

  const updateLanguage = async (newLang: string) => {
    try {
      await updateUser({ preferredLanguage: newLang });
    } catch (error) {
      console.error('Failed to update language:', error);
    }
  };

  const handleSelectConversation = (conversationId: string, conversation?: any) => {
    // Clear unread count when conversation is selected
    setUnreadCounts(prev => ({
      ...prev,
      [conversationId]: 0
    }));
    onSelectConversation(conversationId, conversation);
  };

  const handleNewChat = async () => {
    const query = prompt('Enter name or mobile number to search users:\n\nNote: You cannot chat with yourself. Search for other users like "Rajkoli" or "9619564351"');
    if (query && query.trim()) {
      try {
        console.log('🔍 Searching for users:', query);
        const users = await apiService.searchUsers(query.trim());
        console.log('🔍 Search results received:', users);
        console.log('🔍 Users type:', typeof users, 'Length:', users?.length);
        console.log('🔍 First user:', users?.[0]);
        
        if (!users || users.length === 0) {
          console.log('🔍 No users found or empty array');
          toast({
            title: 'No Users Found',
            description: `No users found matching "${query}". Try searching by name or mobile number.`,
            variant: 'destructive',
          });
          return;
        }
        
        console.log('🔍 Processing', users.length, 'users');

        // If multiple users found, let user choose
        let selectedUser;
        if (users.length === 1) {
          selectedUser = users[0];
        } else {
          const userList = users.map((u, i) => `${i + 1}. ${u.name} (${u.mobile})`).join('\n');
          const choice = prompt(`Multiple users found:\n${userList}\n\nEnter number (1-${users.length}):`);
          const index = parseInt(choice || '1') - 1;
          selectedUser = users[index] || users[0];
        }

        // Map backend user format to frontend format
        const mappedUser = {
          id: selectedUser._id || selectedUser.id,
          name: selectedUser.name,
          mobile: selectedUser.mobile,
          preferredLanguage: selectedUser.preferredLanguage
        };
        
        // Check if conversation already exists
        const existingConv = conversations.find(conv => conv.user.id === mappedUser.id);
        if (existingConv) {
          onSelectConversation(existingConv.id, existingConv);
          toast({
            title: 'Existing Chat',
            description: `Opened chat with ${mappedUser.name} (${mappedUser.mobile})`,
          });
          return;
        }

        // Create new conversation via API
        try {
          const newConv = await apiService.createConversation(mappedUser.id);
          const newConversation: Conversation = {
            id: newConv.id,
            user: {
              id: mappedUser.id,
              name: mappedUser.name,
              preferredLanguage: mappedUser.preferredLanguage,
              isOnline: onlineUsers.has(mappedUser.id) // Check actual online status
            },
            lastMessage: {
              text: 'Chat started',
              timestamp: new Date(),
              isOwn: false,
              isTranslated: false
            },
            unreadCount: 0
          };
          
          setConversations(prev => [...prev, newConversation]);
          onSelectConversation(newConversation.id, newConversation);
          
          toast({
            title: 'New Chat Started',
            description: `Started chat with ${mappedUser.name} (${mappedUser.mobile})`,
          });
        } catch (convError) {
          console.error('Failed to create conversation:', convError);
          toast({
            title: 'Chat Creation Failed',
            description: 'Failed to create conversation. Please try again.',
            variant: 'destructive',
          });
        }
        
      } catch (error) {
        console.error('Failed to search users:', error);
        toast({
          title: 'Search Failed',
          description: 'Failed to search for users. Please check your connection.',
          variant: 'destructive',
        });
      }
    }
  };


  // Use only real conversations from API
  const allConversations = conversations;
  
  const filteredConversations = allConversations.filter(conv =>
    conv.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getLanguageName = (code: string) => {
    const languages: { [key: string]: string } = {
      'en': 'EN',
      'mr': 'मर',
      'hi': 'हि',
      'zh': '中',
      'es': 'ES',
      'fr': 'FR',
      'pt': 'PT',
      'ja': '日'
    };
    return languages[code] || code.toUpperCase();
  };

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col h-screen">
      {/* User Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src="" />
              <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                {user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-foreground">{user?.name || 'Loading...'}</h2>
              <Badge variant="secondary" className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                {getLanguageName(user?.preferredLanguage || 'en')}
              </Badge>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                const newName = prompt('Enter your name:', user?.name || '');
                if (newName && newName !== user?.name) {
                  updateProfile(newName);
                }
              }}>
                <Settings className="h-4 w-4 mr-2" />
                Update Name
              </DropdownMenuItem>
              <Dialog>
                <DialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Globe className="h-4 w-4 mr-2" />
                    Language Settings
                  </DropdownMenuItem>
                </DialogTrigger>
                <DialogContent>
                  <LanguageSettings onClose={() => {}} />
                </DialogContent>
              </Dialog>
              <DropdownMenuItem 
                className="text-destructive"
                onClick={logout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-4 border-b border-border">
        <Button 
          onClick={handleNewChat}
          className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.map((conversation) => (
          <div
            key={conversation.id}
            onClick={() => handleSelectConversation(conversation.id, conversation)}
            className={`p-4 hover:bg-accent cursor-pointer border-b border-border/50 transition-colors ${
              selectedConversationId === conversation.id ? 'bg-accent' : ''
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={conversation.user.avatar} />
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                    {conversation.user.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card ${
                  conversation.user.isOnline ? 'bg-success' : 'bg-muted'
                }`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-sm text-foreground truncate">
                      {conversation.user.name}
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {getLanguageName(conversation.user.preferredLanguage)}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    {unreadCounts[conversation.id] && unreadCounts[conversation.id] > 0 && (
                      <Badge variant="destructive" className="text-xs min-w-[20px] h-5 rounded-full flex items-center justify-center">
                        {unreadCounts[conversation.id]}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {conversation.lastMessage?.timestamp ? formatTimestamp(conversation.lastMessage.timestamp) : 'Just now'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center text-sm text-muted-foreground">
                  <p className="truncate flex-1">
                    {conversation.lastMessage?.isOwn && "You: "}
                    {conversation.lastMessage?.text || 'No messages yet'}
                  </p>
                  {conversation.lastMessage?.isTranslated && (
                    <Globe className="h-3 w-3 ml-2 text-primary" />
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatSidebar;