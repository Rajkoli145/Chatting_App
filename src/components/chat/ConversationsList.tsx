import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Globe, Settings, LogOut, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { apiService, Conversation, User } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

const getLanguageDisplay = (code: string) => {
  const languages: { [key: string]: string } = {
    'en': 'EN', 'hi': 'हि', 'mr': 'मर', 'es': 'ES',
    'fr': 'FR', 'pt': 'PT', 'zh': '中', 'ja': '日',
    'ko': '한', 'ar': 'ع'
  };
  return languages[code] || code.toUpperCase();
};

export default function ConversationsList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const data = await apiService.getConversations();
      setConversations(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load conversations',
        variant: 'destructive',
      });
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const users = await apiService.searchUsers(query);
      setSearchResults(users);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to search users',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const startConversation = async (targetUser: User) => {
    try {
      const conversation = await apiService.createConversation(targetUser.id);
      setIsNewChatOpen(false);
      navigate(`/chat/${conversation.id}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create conversation',
        variant: 'destructive',
      });
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.user.mobile.includes(searchQuery)
  );

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
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

  if (!user) {
    return null;
  }

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col h-screen">
      {/* User Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src="" />
              <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                {user.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-foreground">{user.name}</h2>
              <Badge variant="secondary" className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                {getLanguageDisplay(user.preferredLanguage)}
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
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Preferences
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Globe className="h-4 w-4 mr-2" />
                Language Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={logout}>
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
        <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300">
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start New Conversation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name or mobile..."
                  value={userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    searchUsers(e.target.value);
                  }}
                  className="pl-10"
                />
              </div>
              
              {isSearching && (
                <div className="text-center py-4">
                  <div className="text-sm text-muted-foreground">Searching...</div>
                </div>
              )}
              
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map((searchUser) => (
                    <div
                      key={searchUser.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50"
                      onClick={() => startConversation(searchUser)}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                          {searchUser.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-medium">{searchUser.name}</div>
                        <div className="text-sm text-muted-foreground">{searchUser.mobile}</div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {getLanguageDisplay(searchUser.preferredLanguage)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              
              {userSearchQuery && !isSearching && searchResults.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No users found</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 && !searchQuery ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageCircle className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No conversations yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start a new conversation to begin chatting
            </p>
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className="p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/chat/${conversation.id}`)}
            >
              <div className="flex items-start space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                    {conversation.user.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-sm text-foreground truncate">
                        {conversation.user.name}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {getLanguageDisplay(conversation.user.preferredLanguage)}
                      </Badge>
                    </div>
                    {conversation.lastMessage && (
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(conversation.lastMessage.timestamp)}
                      </span>
                    )}
                  </div>
                  
                  {conversation.lastMessage && (
                    <p className="text-sm text-muted-foreground truncate">
                      {conversation.lastMessage.isOwn && "You: "}
                      {conversation.lastMessage.text}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}