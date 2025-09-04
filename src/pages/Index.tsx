import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import ChatSidebar from '@/components/ChatSidebar';
import ChatInterface from '@/components/ChatInterface';

const Index = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);

  // Restore selected conversation on component mount
  useEffect(() => {
    const savedConversationId = localStorage.getItem('selectedConversationId');
    const savedConversation = localStorage.getItem('selectedConversation');
    
    if (savedConversationId && savedConversation) {
      try {
        const parsedConversation = JSON.parse(savedConversation);
        console.log('🔄 Restoring selected conversation:', savedConversationId);
        setSelectedConversationId(savedConversationId);
        setSelectedConversation(parsedConversation);
      } catch (error) {
        console.error('Failed to restore conversation:', error);
        localStorage.removeItem('selectedConversationId');
        localStorage.removeItem('selectedConversation');
      }
    }
  }, []);

  const handleSelectConversation = (conversationId: string, conversation?: any) => {
    console.log('🔄 Selecting conversation:', conversationId, conversation);
    setSelectedConversationId(conversationId);
    setSelectedConversation(conversation);
    
    // Persist selected conversation to localStorage
    localStorage.setItem('selectedConversationId', conversationId);
    if (conversation) {
      localStorage.setItem('selectedConversation', JSON.stringify(conversation));
    }
  };

  return (
    <>
      <Helmet>
        <title>Multilingual Chat - Instant Translation Messaging</title>
        <meta name="description" content="Chat with people worldwide in any language. Our real-time translation makes global communication effortless and natural." />
        <meta name="keywords" content="multilingual chat, real-time translation, global messaging, instant translate chat" />
        <link rel="canonical" href="/" />
      </Helmet>
      
      <div className="flex h-screen bg-background">
        <ChatSidebar 
          selectedConversationId={selectedConversationId}
          onSelectConversation={handleSelectConversation}
        />
        <div className="flex-1">
          <ChatInterface 
          selectedConversationId={selectedConversationId} 
          selectedConversation={selectedConversation}
        />
        </div>
      </div>
    </>
  );
};

export default Index;
