import React, { useState, useEffect } from 'react';
import { Search, Plus, Globe, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import LanguageSettings from './LanguageSettings';

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
  
  // Debug user data
  console.log('ChatSidebar: Current user data:', user);
  console.log('ChatSidebar: User name:', user?.name);
  console.log('ChatSidebar: User language:', user?.preferredLanguage);
  
  // Force re-render when user data changes
  useEffect(() => {
    console.log('ChatSidebar: User state changed:', user);
  }, [user]);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?._id || user?.id) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getConversations();
      // Transform API data to match local interface
      const transformedData = (data || []).map((conv: any) => ({
        ...conv,
        user: {
          ...conv.user,
          isOnline: false, // Default to offline
          avatar: undefined
        },
        unreadCount: 0,
        lastMessage: conv.lastMessage ? {
          ...conv.lastMessage,
          timestamp: new Date(conv.lastMessage.timestamp),
          isTranslated: false
        } : undefined
      }));
      setConversations(transformedData);
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
              isOnline: true // Set as online for new conversations
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
            className={`p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors ${
              selectedConversationId === conversation.id ? 'bg-muted' : ''
            }`}
            onClick={() => {
              console.log('🔄 Conversation clicked:', conversation.id, conversation);
              onSelectConversation(conversation.id, conversation);
            }}
          >
            <div className="flex items-start space-x-3">
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
                    <span className="text-xs text-muted-foreground">
                      {conversation.lastMessage?.timestamp ? formatTimestamp(conversation.lastMessage.timestamp) : 'Just now'}
                    </span>
                    {conversation.unreadCount > 0 && (
                      <Badge className="bg-primary text-primary-foreground text-xs min-w-[20px] h-5 flex items-center justify-center rounded-full">
                        {conversation.unreadCount}
                      </Badge>
                    )}
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