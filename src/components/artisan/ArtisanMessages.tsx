import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Search, Send, Paperclip, MoreVertical } from 'lucide-react';
import { Badge } from '../ui/badge';

export default function ArtisanMessages() {
  const [selectedConversation, setSelectedConversation] = useState<number>(1);
  const [messageInput, setMessageInput] = useState('');

  const conversations = [
    {
      id: 1,
      name: 'Mohamed Ali',
      role: 'Client',
      avatar: 'MA',
      lastMessage: 'When can we schedule the next phase?',
      timestamp: '10:30 AM',
      unread: 2,
      online: true
    },
    {
      id: 2,
      name: 'BuildMaster Ltd',
      role: 'Manufacturer',
      avatar: 'BM',
      lastMessage: 'Your order #ORD-1234 has been shipped',
      timestamp: 'Yesterday',
      unread: 0,
      online: false
    },
    {
      id: 3,
      name: 'Sara Ben Ahmed',
      role: 'Client',
      avatar: 'SA',
      lastMessage: 'Thank you for the quote!',
      timestamp: 'Feb 7',
      unread: 0,
      online: true
    },
    {
      id: 4,
      name: 'Tech Solutions SA',
      role: 'Client',
      avatar: 'TS',
      lastMessage: 'Can we discuss the timeline?',
      timestamp: 'Feb 6',
      unread: 1,
      online: false
    },
  ];

  const messages = [
    {
      id: 1,
      sender: 'Mohamed Ali',
      isSelf: false,
      content: 'Hello! I wanted to discuss the villa construction project.',
      timestamp: '9:45 AM'
    },
    {
      id: 2,
      sender: 'You',
      isSelf: true,
      content: 'Good morning! Of course, what would you like to know?',
      timestamp: '9:47 AM'
    },
    {
      id: 3,
      sender: 'Mohamed Ali',
      isSelf: false,
      content: 'The progress looks great. When can we schedule the next phase?',
      timestamp: '10:30 AM'
    },
    {
      id: 4,
      sender: 'You',
      isSelf: true,
      content: 'I\'m glad you\'re satisfied! We can start the next phase by March 1st. I\'ll send you a detailed schedule.',
      timestamp: '10:32 AM'
    },
  ];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) {
      setMessageInput('');
    }
  };

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="h-[calc(100vh-12rem)]">
      <Card className="h-full bg-white rounded-2xl border-0 shadow-lg flex flex-col lg:flex-row overflow-hidden">
        {/* Conversations List */}
        <div className="lg:w-96 border-r-2 border-gray-100 flex flex-col">
          <div className="p-6 border-b-2 border-gray-100">
            <h2 className="text-2xl font-bold text-foreground mb-4">Messages</h2>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <Input 
                placeholder="Search conversations..." 
                className="pl-12 h-12 rounded-xl border-2 border-gray-200 focus:border-primary" 
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={`w-full p-4 transition-all ${
                  selectedConversation === conv.id 
                    ? 'bg-primary/5 border-l-4 border-primary' 
                    : 'hover:bg-gray-50 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="w-14 h-14 ring-2 ring-white shadow-md">
                      <AvatarFallback className="bg-primary text-white font-semibold text-lg">
                        {conv.avatar}
                      </AvatarFallback>
                    </Avatar>
                    {conv.online && (
                      <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white bg-accent shadow-sm" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-foreground truncate">{conv.name}</h4>
                      <span className="text-xs text-muted-foreground">{conv.timestamp}</span>
                    </div>
                    <Badge variant="secondary" className="mb-2 text-xs bg-secondary/10 text-secondary border-0">
                      {conv.role}
                    </Badge>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.lastMessage}
                    </p>
                  </div>
                  {conv.unread > 0 && (
                    <span className="px-2 py-1 rounded-full text-xs font-bold text-white bg-destructive shadow-sm">
                      {conv.unread}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          {selectedConv && (
            <div className="p-6 flex items-center justify-between border-b-2 border-gray-100">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="w-12 h-12 ring-2 ring-white shadow-md">
                    <AvatarFallback className="bg-primary text-white font-semibold">
                      {selectedConv.avatar}
                    </AvatarFallback>
                  </Avatar>
                  {selectedConv.online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white bg-accent" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">{selectedConv.name}</h3>
                  <p className="text-sm font-medium" style={{ color: selectedConv.online ? '#10B981' : '#6B7280' }}>
                    {selectedConv.online ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="rounded-xl">
                <MoreVertical size={20} />
              </Button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6" style={{ backgroundColor: '#F9FAFB' }}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isSelf ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-md ${message.isSelf ? 'order-2' : 'order-1'}`}>
                  {!message.isSelf && (
                    <p className="text-xs font-medium text-muted-foreground mb-2">{message.sender}</p>
                  )}
                  <div
                    className={`px-5 py-3 rounded-2xl shadow-sm ${
                      message.isSelf 
                        ? 'bg-primary text-white rounded-br-sm' 
                        : 'bg-white text-foreground rounded-bl-sm'
                    }`}
                  >
                    <p className="leading-relaxed">{message.content}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 px-1">
                    {message.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="p-6 border-t-2 border-gray-100">
            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <Button type="button" variant="ghost" size="sm" className="rounded-xl">
                <Paperclip size={20} />
              </Button>
              <Input
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="flex-1 h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
              />
              <Button
                type="submit"
                className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md"
                disabled={!messageInput.trim()}
              >
                <Send size={20} />
              </Button>
            </form>
          </div>
        </div>
      </Card>
    </div>
  );
}
