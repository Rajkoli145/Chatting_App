import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ChatSidebar from '@/components/ChatSidebar';
import ChatInterface from '@/components/ChatInterface';

const Index = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);

  const handleSelectConversation = (conversationId: string, conversation?: any) => {
    console.log('🔄 Selecting conversation:', conversationId, conversation);
    setSelectedConversationId(conversationId);
    setSelectedConversation(conversation);
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
