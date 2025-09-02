import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ChatSidebar from '@/components/ChatSidebar';
import ChatInterface from '@/components/ChatInterface';

const Index = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>(undefined);

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
          onSelectConversation={setSelectedConversationId}
        />
        <div className="flex-1">
          <ChatInterface selectedConversationId={selectedConversationId} />
        </div>
      </div>
    </>
  );
};

export default Index;
