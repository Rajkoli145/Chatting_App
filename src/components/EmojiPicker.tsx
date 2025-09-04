import React, { useState, useRef, useEffect } from 'react';
import { Smile, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onGifSelect: (gifUrl: string) => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, onGifSelect }) => {
  const [activeTab, setActiveTab] = useState<'emoji' | 'gif'>('emoji');
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Common emojis organized by category
  const emojiCategories = {
    'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
    'Gestures': ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
    'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
    'Objects': ['🎉', '🎊', '🎈', '🎁', '🎂', '🍰', '🧁', '🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥙', '🥗', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🍙', '🍘', '🍚'],
  };

  // Fetch trending GIFs from Giphy API (you'll need to add your API key)
  const fetchGifs = async (query: string = 'trending') => {
    try {
      // For demo purposes, using placeholder GIFs
      // In production, you'd use: https://api.giphy.com/v1/gifs/search?api_key=YOUR_KEY&q=${query}
      const demoGifs = [
        { id: '1', images: { fixed_height_small: { url: 'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/200.gif' } } },
        { id: '2', images: { fixed_height_small: { url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/200.gif' } } },
        { id: '3', images: { fixed_height_small: { url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200.gif' } } },
        { id: '4', images: { fixed_height_small: { url: 'https://media.giphy.com/media/3o6Zt4HU9uwXmXSAuI/200.gif' } } },
      ];
      setGifs(demoGifs);
    } catch (error) {
      console.error('Failed to fetch GIFs:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'gif') {
      fetchGifs(searchQuery || 'trending');
    }
  }, [activeTab, searchQuery]);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setIsOpen(false);
  };

  const handleGifClick = (gifUrl: string) => {
    onGifSelect(gifUrl);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" side="top" align="end">
        <div className="flex flex-col h-96">
          {/* Header with tabs */}
          <div className="flex border-b">
            <Button
              variant={activeTab === 'emoji' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('emoji')}
              className="flex-1 rounded-none"
            >
              <Smile className="h-4 w-4 mr-1" />
              Emoji
            </Button>
            <Button
              variant={activeTab === 'gif' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('gif')}
              className="flex-1 rounded-none"
            >
              <ImageIcon className="h-4 w-4 mr-1" />
              GIF
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'emoji' ? (
              <ScrollArea className="h-full p-2">
                {Object.entries(emojiCategories).map(([category, emojis]) => (
                  <div key={category} className="mb-4">
                    <h3 className="text-xs font-medium text-muted-foreground mb-2 px-1">
                      {category}
                    </h3>
                    <div className="grid grid-cols-8 gap-1">
                      {emojis.map((emoji, index) => (
                        <Button
                          key={`${category}-${index}`}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-lg hover:bg-accent"
                          onClick={() => handleEmojiClick(emoji)}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            ) : (
              <div className="flex flex-col h-full">
                {/* GIF search */}
                <div className="p-2 border-b">
                  <Input
                    placeholder="Search GIFs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8"
                  />
                </div>
                
                {/* GIF grid */}
                <ScrollArea className="flex-1 p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {gifs.map((gif) => (
                      <div
                        key={gif.id}
                        className="aspect-square bg-muted rounded cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
                        onClick={() => handleGifClick(gif.images.fixed_height_small.url)}
                      >
                        <img
                          src={gif.images.fixed_height_small.url}
                          alt="GIF"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  {gifs.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No GIFs found</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
