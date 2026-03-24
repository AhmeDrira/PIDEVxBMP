import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  Search,
  Send,
  Paperclip,
  Trash2,
  Download,
  FileText,
  ImageIcon,
  Ban,
  ShieldCheck,
  MoreHorizontal,
  ChevronDown,
  Smile,
  Reply,
  Flag,
  X,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import axios from 'axios';
import ViewArtisanProfile from '../expert/ViewArtisanProfile';

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
  blockedByCurrentUser?: boolean;
  blockedByOtherUser?: boolean;
}

interface Attachment {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

interface Message {
  id: string;
  senderName: string;
  senderId?: string;
  isSelf?: boolean;
  content: string;
  timestamp: string;
  attachments?: Attachment[];
  reactions?: Array<{ user: string; emoji: string }>;
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  } | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_BASE_URL = API_URL.replace(/\/api\/?$/, '');
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export default function Messages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [reactionPickerForMessageId, setReactionPickerForMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isConversationMenuOpen, setIsConversationMenuOpen] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [selectedProfileArtisanId, setSelectedProfileArtisanId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const conversationMenuRef = useRef<HTMLDivElement | null>(null);

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
    const otherUser = c.participants.find((p: any) => p._id !== currentUserId) || c.participants[0] || {};
    const name = `${otherUser.firstName ?? ''} ${otherUser.lastName ?? ''}`.trim() || 'Conversation';
    const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U';
    const lastMessageText = c.lastMessage || '';
    const dateSource = c.updatedAt;
    const timestamp = dateSource
      ? new Date(dateSource).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
      : '';

    return {
      id: c._id,
      participantId: otherUser._id || '',
      name,
      role: otherUser.role || 'user',
      avatar: initials,
      lastMessage: lastMessageText,
      timestamp,
      unread: c.unread ?? 0,
      online: otherUser.online ?? false,
      blockedByCurrentUser: Boolean(
        c.blockedByMe ??
          (Array.isArray(c.blockedBy) && c.blockedBy.some((id: string) => String(id) === String(currentUserId))),
      ),
      blockedByOtherUser: Boolean(c.blockedByOther),
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
      attachments: Array.isArray(m.attachments) ? m.attachments : [],
      reactions: Array.isArray(m.reactions)
        ? m.reactions.map((r: any) => ({
            user: r.user?._id || r.user || '',
            emoji: r.emoji,
          }))
        : [],
      replyTo: m.replyTo
        ? {
            id: m.replyTo._id || m.replyTo.id,
            content: m.replyTo.content || '',
            senderName:
              m.replyTo.sender?.name ||
              `${m.replyTo.sender?.firstName ?? ''} ${m.replyTo.sender?.lastName ?? ''}`.trim() ||
              'User',
          }
        : null,
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
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)),
        );
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [currentUserId]
  );

  const fetchConversationStatus = useCallback(async (conversationId: string) => {
    try {
      const token = getToken();
      if (!token) return;
      const response = await axios.get(`${API_URL}/conversations/${conversationId}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBlockedByMe(Boolean(response.data?.blockedByMe));
      setBlockedByOther(Boolean(response.data?.blockedByOther));
    } catch (err) {
      console.error('Error fetching conversation status:', err);
    }
  }, []);

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
    fetchConversationStatus(selectedConversationId);
    const interval = setInterval(() => fetchMessages(selectedConversationId), 5000);
    return () => clearInterval(interval);
  }, [selectedConversationId, fetchMessages, fetchConversationStatus]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileMenuOpen(false);
      }
      if (conversationMenuRef.current && !conversationMenuRef.current.contains(target)) {
        setIsConversationMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageInput.trim() && selectedFiles.length === 0) || !selectedConversationId) return;
    if (selectedFiles.some((file) => file.size > 10 * 1024 * 1024)) {
      setError('Each file must be 10MB max.');
      return;
    }
    try {
      const token = getToken();
      if (!token) {
        console.error('No token found');
        return;
      }

      const formData = new FormData();
      formData.append('conversationId', selectedConversationId);
      if (messageInput.trim()) {
        formData.append('content', messageInput.trim());
      }
      if (replyingTo?.id) {
        formData.append('replyTo', replyingTo.id);
      }
      selectedFiles.forEach((file) => formData.append('attachments', file));

      const response = await axios.post(
        `${API_URL}/messages`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('Message response:', response.data);

      const newMsg = mapMessage(response.data);
      setMessages(prev => [...prev, newMsg]);
      setMessageInput('');
      setSelectedFiles([]);
      setReplyingTo(null);
      setError(null);
      fetchConversations();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to send message.');
      console.error('Error sending message:', err);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversationId) return;
    const confirmed = window.confirm('Delete this conversation?');
    if (!confirmed) return;
    try {
      const token = getToken();
      if (!token) return;
      await axios.delete(`${API_URL}/conversations/${selectedConversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const next = conversations.filter((c) => c.id !== selectedConversationId);
      setConversations(next);
      setMessages([]);
      setSelectedConversationId(next.length ? next[0].id : null);
      setIsConversationMenuOpen(false);
      setIsProfileMenuOpen(false);
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  const handleToggleBlock = async () => {
    if (!selectedConversationId || !selectedConv) return;
    const blocking = !blockedByMe;
    const confirmed = window.confirm(blocking ? 'Block this user?' : 'Unblock this user?');
    if (!confirmed) return;
    try {
      const token = getToken();
      if (!token) return;
      await axios.post(
        `${API_URL}/conversations/${selectedConversationId}/${blocking ? 'block' : 'unblock'}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await fetchConversations();
      await fetchConversationStatus(selectedConversationId);
      setError(null);
      setIsConversationMenuOpen(false);
      setIsProfileMenuOpen(false);
    } catch (err) {
      console.error('Error toggling block:', err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const confirmed = window.confirm('Delete this message?');
    if (!confirmed) return;
    try {
      const token = getToken();
      if (!token) return;
      await axios.delete(`${API_URL}/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      fetchConversations();
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      const token = getToken();
      if (!token) return;
      const response = await axios.post(
        `${API_URL}/messages/${messageId}/reaction`,
        { emoji },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const updated = mapMessage(response.data);
      setMessages((prev) => prev.map((msg) => (msg.id === messageId ? updated : msg)));
      setReactionPickerForMessageId(null);
    } catch (err) {
      console.error('Error adding reaction:', err);
    }
  };

  const handleViewProfile = () => {
    if (!selectedConv) return;
    if (selectedConv.role !== 'artisan') {
      window.alert('Profil non disponible pour cet utilisateur.');
      return;
    }
    setSelectedProfileArtisanId(selectedConv.participantId);
    setIsProfileMenuOpen(false);
  };

  const reactionSummary = (message: Message) => {
    const grouped = new Map<string, number>();
    (message.reactions || []).forEach((r) => {
      grouped.set(r.emoji, (grouped.get(r.emoji) || 0) + 1);
    });
    return Array.from(grouped.entries());
  };

  const formatFileSize = (size: number) => {
    if (!size || size <= 0) return '';
    const mb = size / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    const kb = size / 1024;
    return `${Math.max(1, Math.round(kb))} KB`;
  };

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (conv) =>
        conv.name.toLowerCase().includes(q) ||
        conv.role.toLowerCase().includes(q) ||
        (conv.lastMessage || '').toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const selectedConv = conversations.find(c => c.id === selectedConversationId);
  const sendingDisabled = blockedByMe || blockedByOther || !selectedConversationId;

  useEffect(() => {
    if (!selectedConv) {
      setBlockedByMe(false);
      setBlockedByOther(false);
      return;
    }
    setBlockedByMe(Boolean(selectedConv.blockedByCurrentUser));
    setBlockedByOther(Boolean(selectedConv.blockedByOtherUser));
  }, [selectedConv]);

  if (selectedProfileArtisanId) {
    return (
      <ViewArtisanProfile
        artisanId={selectedProfileArtisanId}
        onBack={() => setSelectedProfileArtisanId(null)}
      />
    );
  }

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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
              />
            </div>
          </div>

          {loadingConversations && <div className="p-4 text-sm text-muted-foreground">Loading conversations...</div>}
          {error && <div className="p-4 text-sm text-red-500">{error}</div>}

          <div className="flex-1 overflow-y-auto">
            {!loadingConversations && filteredConversations.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No conversations found.</p>
            )}
            {filteredConversations.map(conv => (
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
                <div className="flex items-center gap-2 relative" ref={profileMenuRef}>
                  <div>
                    <h3 className="font-bold text-foreground text-lg">{selectedConv.name}</h3>
                    <p className="text-sm font-medium" style={{ color: selectedConv.online ? '#10B981' : '#6B7280' }}>
                      {selectedConv.online ? 'Online' : 'Offline'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl h-8 w-8 p-0"
                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                  >
                    <ChevronDown size={16} />
                  </Button>
                  {isProfileMenuOpen && (
                    <div className="absolute left-0 top-full mt-2 z-40 min-w-[180px] rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          handleViewProfile();
                          setIsProfileMenuOpen(false);
                        }}
                        disabled={selectedConv.role !== 'artisan'}
                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FileText size={16} />
                        Voir le profil
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleBlock}
                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        {blockedByMe ? <ShieldCheck size={16} /> : <Ban size={16} />}
                        {blockedByMe ? 'Débloquer' : 'Bloquer'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="relative" ref={conversationMenuRef}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setIsConversationMenuOpen((prev) => !prev)}
                >
                  <MoreHorizontal size={20} />
                </Button>
                {isConversationMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 z-40 min-w-[220px] rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={handleDeleteConversation}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 text-left"
                    >
                      <Trash2 size={16} />
                      Supprimer la conversation
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleBlock}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 text-left"
                    >
                      {blockedByMe ? <ShieldCheck size={16} /> : <Ban size={16} />}
                      {blockedByMe ? 'Débloquer l’utilisateur' : 'Bloquer l’utilisateur'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.alert('Signalement envoyé');
                        setIsConversationMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 text-left"
                    >
                      <Flag size={16} />
                      Signaler
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-8 space-y-6" style={{ backgroundColor: '#F9FAFB' }}>
            {loadingMessages && <p className="text-sm text-muted-foreground">Loading messages...</p>}
            {!loadingMessages && messages.length === 0 && selectedConv && <p className="text-sm text-muted-foreground">No messages yet.</p>}
            {!selectedConv && !loadingConversations && <p className="text-sm text-muted-foreground">Select a conversation to start chatting.</p>}
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.isSelf ? 'justify-end' : 'justify-start'}`}
                onMouseEnter={() => setHoveredMessageId(message.id)}
                onMouseLeave={() => {
                  setHoveredMessageId((prev) => (prev === message.id ? null : prev));
                  setReactionPickerForMessageId((prev) => (prev === message.id ? null : prev));
                }}
              >
                <div className={`max-w-md ${message.isSelf ? 'order-2' : 'order-1'} relative`}>
                  {!message.isSelf && (
                    <p className="text-xs font-medium text-muted-foreground mb-2">{message.senderName}</p>
                  )}
                  {hoveredMessageId === message.id && (
                    <div className={`absolute -top-4 ${message.isSelf ? '-left-1' : '-right-1'} z-20`}>
                      <div className="flex items-center gap-1 rounded-full border bg-white shadow-sm px-1 py-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() =>
                            setReactionPickerForMessageId((prev) => (prev === message.id ? null : message.id))
                          }
                        >
                          <Smile size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setReplyingTo(message);
                            setReactionPickerForMessageId(null);
                          }}
                        >
                          <Reply size={14} />
                        </Button>
                        {message.isSelf && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:text-destructive"
                            onClick={() => handleDeleteMessage(message.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                      {reactionPickerForMessageId === message.id && (
                        <div className="mt-1 rounded-full border bg-white shadow-md px-2 py-1 flex items-center gap-1">
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="text-base hover:scale-110 transition-transform"
                              onClick={() => handleReaction(message.id, emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {message.replyTo && (
                    <div
                      className={`mb-2 rounded-xl border-l-4 px-3 py-2 ${
                        message.isSelf
                          ? 'bg-blue-100 border-l-blue-500 text-blue-900'
                          : 'bg-gray-100 border-l-gray-400 text-gray-700'
                      }`}
                    >
                      <p className="text-[11px] font-semibold mb-0.5">Vous avez répondu à {message.replyTo.senderName}</p>
                      <p className="text-xs line-clamp-2 opacity-90">{message.replyTo.content || 'Pièce jointe'}</p>
                    </div>
                  )}
                  {message.content && (
                    <div
                      className={`px-5 py-3 rounded-2xl shadow-sm ${
                        message.isSelf
                          ? 'rounded-br-sm text-white'
                          : 'bg-white text-foreground rounded-bl-sm'
                      }`}
                      style={message.isSelf ? { backgroundColor: '#1E40AF' } : {}}
                    >
                      <p className="leading-relaxed break-words">{message.content}</p>
                    </div>
                  )}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className={message.content ? 'mt-2' : ''}>
                      <div className="space-y-2">
                        {message.attachments.map((att) => {
                          const url = `${API_BASE_URL}${att.url}`;
                          const isImage = att.mimeType?.startsWith('image/');
                          return (
                            <div key={att.filename} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-3">
                              {isImage ? (
                                <a href={url} target="_blank" rel="noreferrer" className="block">
                                  <img
                                    src={url}
                                    alt={att.originalName}
                                    className="max-h-44 w-full rounded-xl object-contain bg-gray-50"
                                  />
                                </a>
                              ) : null}
                              <div className="flex items-center gap-3 mt-2">
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                  {isImage ? <ImageIcon size={18} className="text-gray-600" /> : <FileText size={18} className="text-gray-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{att.originalName}</p>
                                  <p className="text-xs text-gray-500">{formatFileSize(att.size)}</p>
                                </div>
                                <a href={url} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-primary">
                                  <Download size={16} />
                                </a>
                              </div>
                              <p className="text-[11px] text-right text-gray-500 mt-1">Envoyé</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="mt-1 px-1">
                    <p className="text-xs text-muted-foreground">{message.timestamp}</p>
                  </div>
                  {reactionSummary(message).length > 0 && (
                    <div className="mt-1 px-1 flex flex-wrap gap-1.5">
                      {reactionSummary(message).map(([emoji, count]) => (
                        <span key={emoji} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs">
                          <span>{emoji}</span>
                          <span>{count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 border-t-2 border-gray-100">
            {blockedByMe && selectedConv && (
              <div className="mb-3 rounded-xl border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-sm text-yellow-900 font-medium">Vous avez bloque {selectedConv.name}.</p>
                <p className="text-xs text-yellow-800 mt-1">Vous ne pouvez plus envoyer de messages.</p>
                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={handleToggleBlock}>
                  Debloquer
                </Button>
              </div>
            )}
            {blockedByOther && selectedConv && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700 font-medium">
                  Vous ne pouvez pas envoyer de message a {selectedConv.name} car vous etes bloque.
                </p>
              </div>
            )}
            {selectedFiles.length > 0 && (
              <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                {selectedFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      {file.type.startsWith('image/') ? <ImageIcon size={16} /> : <FileText size={16} />}
                      <span className="text-xs truncate">{file.name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {replyingTo && (
              <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary">Replying to {replyingTo.senderName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {replyingTo.content || (replyingTo.attachments?.length ? 'Attachment' : 'Message')}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setReplyingTo(null)}>
                  <X size={14} />
                </Button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length) setSelectedFiles((prev) => [...prev, ...files]);
                  e.currentTarget.value = '';
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl"
                onClick={() => fileInputRef.current?.click()}
                disabled={sendingDisabled}
              >
                <Paperclip size={20} />
              </Button>
              <Input
                placeholder="Type a message..."
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                className="flex-1 h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                disabled={sendingDisabled}
              />
              <Button
                type="submit"
                className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md"
                disabled={(!messageInput.trim() && selectedFiles.length === 0) || sendingDisabled}
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