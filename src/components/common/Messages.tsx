import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Search, Send, Paperclip, MoreVertical } from 'lucide-react';
import { Badge } from '../ui/badge';
import axios from 'axios';

interface Conversation {
  id: string;
  participantId: string;
  name: string;
  role: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  online: boolean;
}

interface Message {
  id: string;
  senderName: string;
  senderId?: string;
  isSelf?: boolean;
  content: string;
  timestamp: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function Messages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const getToken = () => {
    let token: string | null = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) {
      const parsedUser = JSON.parse(userStorage);
      token = parsedUser.token;
    }
    return token;
  };

  // Récupération de l'utilisateur courant
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token = getToken();
        if (!token) return;
        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const userData = response.data.user ? response.data.user : response.data;
        const id = userData._id || userData.id || null;
        setCurrentUserId(id);
        console.log('Current User ID:', id);
      } catch (err) {
        console.error('Error fetching current user:', err);
      }
    };
    fetchCurrentUser();
  }, []);

  const mapConversation = (c: any): Conversation => {
    const otherUser = c.participants.find((p: any) => p._id !== currentUserId);
    const name = `${otherUser.firstName ?? ''} ${otherUser.lastName ?? ''}`.trim() || 'Conversation';
    const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U';
    const lastMessageText = c.lastMessage || '';
    const dateSource = c.updatedAt;
    const timestamp = dateSource
      ? new Date(dateSource).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
      : '';

    return {
      id: c._id,
      participantId: otherUser._id,
      name,
      role: otherUser.role,
      avatar: initials,
      lastMessage: lastMessageText,
      timestamp,
      unread: c.unread ?? 0,
      online: otherUser.online ?? false,
    };
  };

  const mapMessage = (m: any): Message => {
    const tsSource = m.createdAt || m.timestamp;
    const timestamp = tsSource
      ? new Date(tsSource).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : '';

    let senderId: string | undefined;
    let senderName: string = 'User';

    if (typeof m.sender === 'string') {
      senderId = m.sender;
    } else if (typeof m.sender === 'object') {
      senderId = m.sender._id || m.sender.id || m.senderId;
      senderName = m.sender.name || `${m.sender.firstName ?? ''} ${m.sender.lastName ?? ''}`.trim() || 'User';
    } else {
      senderId = m.senderId || undefined;
    }

    const isSelf = currentUserId ? senderId === currentUserId : false;

    console.log('Mapping message:', {
      messageId: m._id || m.id,
      senderId,
      senderName,
      isSelf,
      content: m.content,
    });

    return {
      id: m._id || m.id,
      senderName,
      senderId,
      isSelf,
      content: m.content || '',
      timestamp,
    };
  };

  const fetchConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      setError(null);
      const token = getToken();
      if (!token) return;

      const response = await axios.get(`${API_URL}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const convs = Array.isArray(response.data) ? response.data : [];
      const mapped = convs.map(mapConversation);
      setConversations(mapped);

      const selectedArtisanId = localStorage.getItem('selectedArtisanId');
      if (selectedArtisanId) {
        let existingConv = mapped.find(c => c.participantId === selectedArtisanId);

        if (!existingConv) {
          const newConvResp = await axios.post(
            `${API_URL}/conversations`,
            { participantId: selectedArtisanId },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          existingConv = mapConversation(newConvResp.data);
          setConversations(prev => [existingConv!, ...prev]);
        }

        setSelectedConversationId(existingConv.id);
        localStorage.removeItem('selectedArtisanId');
      } else if (!selectedConversationId && mapped.length > 0) {
        setSelectedConversationId(mapped[0].id);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, [selectedConversationId, currentUserId]);

  const fetchMessages = useCallback(
    async (conversationId: string) => {
      try {
        setLoadingMessages(true);
        setError(null);
        const token = getToken();
        if (!token) return;

        const response = await axios.get(`${API_URL}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { conversationId },
        });

        const msgs = Array.isArray(response.data) ? response.data : [];
        const mappedMsgs = msgs.map(mapMessage);
        console.log('Fetched messages:', mappedMsgs);
        setMessages(mappedMsgs);
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [currentUserId]
  );

  useEffect(() => {
    const storedConversationId = localStorage.getItem('selectedConversationId');
    if (storedConversationId) {
      setSelectedConversationId(storedConversationId);
      localStorage.removeItem('selectedConversationId');
    }
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!selectedConversationId) return;
    fetchMessages(selectedConversationId);
    const interval = setInterval(() => fetchMessages(selectedConversationId), 5000);
    return () => clearInterval(interval);
  }, [selectedConversationId, fetchMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConversationId) return;
    try {
      const token = getToken();
      if (!token) {
        console.error('No token found');
        return;
      }

      console.log('Sending message:', messageInput);

      const response = await axios.post(
        `${API_URL}/messages`,
        { conversationId: selectedConversationId, content: messageInput.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('Message response:', response.data);

      const newMsg = mapMessage(response.data);
      setMessages(prev => [...prev, newMsg]);
      setMessageInput('');
      fetchConversations();
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const selectedConv = conversations.find(c => c.id === selectedConversationId);

  return (
    <div className="h-[calc(100vh-12rem)]">
      <Card className="h-full bg-white rounded-2xl border-0 shadow-lg flex flex-col lg:flex-row overflow-hidden">
        {/* Conversations List */}
        <div className="lg:w-96 border-r-2 border-gray-100 flex flex-col">
          <div className="p-6 border-b-2 border-gray-100">
            <h2 className="text-2xl font-bold text-foreground mb-4">Messages</h2>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <Input placeholder="Search conversations..." className="pl-12 h-12 rounded-xl border-2 border-gray-200 focus:border-primary" />
            </div>
          </div>

          {loadingConversations && <div className="p-4 text-sm text-muted-foreground">Loading conversations...</div>}
          {error && <div className="p-4 text-sm text-red-500">{error}</div>}

          <div className="flex-1 overflow-y-auto">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversationId(conv.id)}
                className={`w-full p-4 transition-all ${
                  selectedConversationId === conv.id
                    ? 'bg-primary/5 border-l-4 border-primary'
                    : 'hover:bg-gray-50 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="w-14 h-14 ring-2 ring-white shadow-md">
                      <AvatarFallback className="bg-primary text-white font-semibold text-lg">{conv.avatar}</AvatarFallback>
                    </Avatar>
                    {conv.online && <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white bg-accent shadow-sm" />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-foreground truncate">{conv.name}</h4>
                      <span className="text-xs text-muted-foreground">{conv.timestamp}</span>
                    </div>
                    <Badge variant="secondary" className="mb-2 text-xs bg-secondary/10 text-secondary border-0">
                      {conv.role}
                    </Badge>
                    <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                  </div>
                  {conv.unread > 0 && <span className="px-2 py-1 rounded-full text-xs font-bold text-white bg-destructive shadow-sm">{conv.unread}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConv && (
            <div className="p-6 flex items-center justify-between border-b-2 border-gray-100">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="w-12 h-12 ring-2 ring-white shadow-md">
                    <AvatarFallback className="bg-primary text-white font-semibold">{selectedConv.avatar}</AvatarFallback>
                  </Avatar>
                  {selectedConv.online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white bg-accent" />}
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

          <div className="flex-1 overflow-y-auto p-8 space-y-6" style={{ backgroundColor: '#F9FAFB' }}>
            {loadingMessages && <p className="text-sm text-muted-foreground">Loading messages...</p>}
            {!loadingMessages && messages.length === 0 && selectedConv && <p className="text-sm text-muted-foreground">No messages yet.</p>}
            {!selectedConv && !loadingConversations && <p className="text-sm text-muted-foreground">Select a conversation to start chatting.</p>}
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.isSelf ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-md ${message.isSelf ? 'order-2' : 'order-1'}`}>
                  {!message.isSelf && (
                    <p className="text-xs font-medium text-muted-foreground mb-2">{message.senderName}</p>
                  )}
                  <div
  className={`px-5 py-3 rounded-2xl shadow-sm ${
    message.isSelf
      ? 'rounded-br-sm text-white'
      : 'bg-white text-foreground rounded-bl-sm'
  }`}
  style={message.isSelf ? { backgroundColor: '#1E40AF' } : {}}
>
                    <p className="leading-relaxed">{message.content}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 px-1">{message.timestamp}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 border-t-2 border-gray-100">
            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <Button type="button" variant="ghost" size="sm" className="rounded-xl">
                <Paperclip size={20} />
              </Button>
              <Input
                placeholder="Type a message..."
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                className="flex-1 h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
              />
              <Button type="submit" className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md" disabled={!messageInput.trim() || !selectedConversationId}>
                <Send size={20} />
              </Button>
            </form>
          </div>
        </div>
      </Card>
    </div>
  );
}