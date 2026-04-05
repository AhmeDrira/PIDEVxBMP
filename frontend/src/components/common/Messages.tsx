import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  Search,
  Send,
  Paperclip,
  Mic,
  MicOff,
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
import { toast } from 'sonner';
import ViewArtisanProfile from '../expert/ViewArtisanProfile';
import VoiceMessage from './VoiceMessage';
import VoiceRecorder from './VoiceRecorder';
import CallButton from './CallButton';
import IncomingCallModal from './IncomingCallModal';
import CallingModal from './CallingModal';
import VideoCall from './VideoCall';
import AudioCall from './AudioCall';
import { useSocket } from '../../context/SocketContext';
import { useGlobalCall } from '../../context/GlobalCallContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useLanguage } from '../../context/LanguageContext';

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
  voiceMessage?: {
    url: string;
    duration: number;
    mimeType?: string;
    size?: number;
  };
}

type ReportSpeechField = 'customReason' | 'details';

type BrowserSpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};

type BrowserSpeechRecognitionErrorEvent = Event & {
  error: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_BASE_URL = API_URL.replace(/\/api\/?$/, '');
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];
export default function Messages() {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const REPORT_REASONS = [
    tr('Harassment or abusive behavior', 'Harcèlement ou comportement abusif', 'التحرش أو السلوك المسيء'),
    tr('Spam or misleading content', 'Spam ou contenu trompeur', 'رسالات غير مرغوبة أو محتوى مضلل'),
    tr('Fraud or suspicious activity', 'Fraude ou activite suspecte', 'الاحتيال أو نشاط ميبهوم'),
    tr('Late delivery or no-show', 'Retard de livraison ou absence', 'التأخر في الشحن أو العدم بالظهور'),
    tr('Poor quality of service/product', 'Mauvaise qualite de service/produit', 'رداعة الخدمة / المنتج الرديئة'),
    tr('Policy violation', 'Violation des regles', 'انتهاك السياسة'),
    tr('Other', 'Autre', 'أخرى'),
  ];
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
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [reactionPickerForMessageId, setReactionPickerForMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isConversationMenuOpen, setIsConversationMenuOpen] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [selectedProfileArtisanId, setSelectedProfileArtisanId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ type: 'delete-conv' | 'block' | 'unblock' | 'report' | 'delete-msg'; messageId?: string } | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportCustomReason, setReportCustomReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [activeReportSpeechField, setActiveReportSpeechField] = useState<ReportSpeechField | null>(null);
  const [isReportListening, setIsReportListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const conversationMenuRef = useRef<HTMLDivElement | null>(null);
  const reportRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const reportSpeechBaseRef = useRef('');
  const reportSpeechFinalRef = useRef('');

  const isSpeechSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const { socket } = useSocket();
  const {
    callState,
    initiateCall,
    acceptCall: acceptCallState,
    rejectCall,
    endCall: endCallState,
    patchRemoteUser,
    setIsMessagesOpen,
    pendingOffer,
    clearPendingOffer,
  } = useGlobalCall();
  const {
    localStream,
    remoteStream,
    startCall,
    acceptCall: acceptWebRTCCall,
    handleAnswer,
    handleIceCandidate,
    endCall: endWebRTCCall,
    toggleMicrophone,
    toggleCamera,
    isMicrophoneEnabled,
    isCameraEnabled
  } = useWebRTC(socket, selectedConversationId);

  // Tell GlobalCallContext that Messages is mounted so global IncomingCallModal is suppressed
  useEffect(() => {
    setIsMessagesOpen(true);
    return () => setIsMessagesOpen(false);
  }, [setIsMessagesOpen]);

  // Check for pending call conversation (accepted from another page)
  useEffect(() => {
    const pending = localStorage.getItem('pendingCallConvId');
    if (pending) {
      setSelectedConversationId(pending);
      localStorage.removeItem('pendingCallConvId');
    }
  }, []);

  // Handle buffered WebRTC offer (callee navigated to Messages after accepting)
  useEffect(() => {
    if (pendingOffer && callState.type && callState.status === 'in-call' && !callState.isCaller) {
      acceptWebRTCCall(callState.type, pendingOffer).catch(console.error);
      clearPendingOffer();
    }
  }, [pendingOffer, callState.type, callState.status, callState.isCaller, acceptWebRTCCall, clearPendingOffer]);

  useEffect(() => {
    if (callState.status === 'in-call' && callState.isCaller && callState.type) {
      startCall(callState.type).catch(console.error);
    }
  }, [callState.status, callState.isCaller, callState.type, startCall]);

  useEffect(() => {
    if (!socket) return;

    const onOffer = ({ offer }: any) => {
      if (callState.type) {
        acceptWebRTCCall(callState.type, offer).catch(console.error);
      }
    };

    const onAnswer = ({ answer }: any) => handleAnswer(answer);
    const onIceCandidate = ({ candidate }: any) => handleIceCandidate(candidate);

    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice-candidate', onIceCandidate);

    return () => {
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice-candidate', onIceCandidate);
    };
  }, [socket, callState.type, acceptWebRTCCall, handleAnswer, handleIceCandidate]);

  useEffect(() => {
    if (callState.status === 'ringing' && callState.conversationId) {
      const conv = conversations.find(c => c.id === callState.conversationId);
      if (conv) patchRemoteUser(conv.name, conv.avatar);
    }
  }, [callState.status, callState.conversationId, conversations, patchRemoteUser]);

  const endEntireCall = () => {
    endCallState();
    endWebRTCCall();
  };

  const handleAudioCall = () => {
    console.log('[Messages] handleAudioCall clicked. selectedConv?', !!selectedConv);
    if (selectedConv) {
      initiateCall(selectedConv.id, 'audio', { id: selectedConv.participantId, name: selectedConv.name, avatar: selectedConv.avatar });
    }
  };

  const handleVideoCall = () => {
    console.log('[Messages] handleVideoCall clicked. selectedConv?', !!selectedConv);
    if (selectedConv) {
      initiateCall(selectedConv.id, 'video', { id: selectedConv.participantId, name: selectedConv.name, avatar: selectedConv.avatar });
    }
  };

  const getToken = () => {
    let token: string | null = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) {
      const parsedUser = JSON.parse(userStorage);
      token = parsedUser.token;
    }
    return token;
  };

  const getSpeechLanguage = () => {
    if (language === 'fr') return 'fr-FR';
    if (language === 'ar') return 'ar-TN';
    return 'en-US';
  };

  const stopReportDictation = useCallback(() => {
    reportRecognitionRef.current?.stop();
    reportRecognitionRef.current = null;
    setIsReportListening(false);
    setActiveReportSpeechField(null);
  }, []);

  const startReportDictation = useCallback((field: ReportSpeechField) => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      toast.error(tr('Speech-to-text is not supported on this browser.', 'La dictee vocale n est pas supportee sur ce navigateur.', 'Speech-to-text is not supported on this browser.'));
      return;
    }

    if (activeReportSpeechField === field) {
      stopReportDictation();
      return;
    }

    reportRecognitionRef.current?.stop();

    const recognition = new SpeechRecognitionClass();
    recognition.lang = getSpeechLanguage();
    recognition.continuous = true;
    recognition.interimResults = true;

    reportSpeechBaseRef.current = field === 'customReason' ? reportCustomReason.trim() : reportDetails.trim();
    reportSpeechFinalRef.current = '';

    recognition.onstart = () => {
      setIsReportListening(true);
    };

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript?.trim();
        if (!transcript) continue;
        if (event.results[i].isFinal) {
          reportSpeechFinalRef.current = `${reportSpeechFinalRef.current} ${transcript}`.trim();
        } else {
          interim = `${interim} ${transcript}`.trim();
        }
      }

      const combined = [reportSpeechBaseRef.current, reportSpeechFinalRef.current, interim]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (field === 'customReason') {
        setReportCustomReason(combined);
      } else {
        setReportDetails(combined);
      }
    };

    recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted') {
        toast.error(tr('Voice capture failed. Please retry.', 'La capture vocale a echoue. Veuillez reessayer.', 'Voice capture failed. Please retry.'));
      }
      setIsReportListening(false);
      setActiveReportSpeechField(null);
      reportRecognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsReportListening(false);
      setActiveReportSpeechField(null);
      reportRecognitionRef.current = null;
    };

    reportRecognitionRef.current = recognition;
    setActiveReportSpeechField(field);
    setIsReportListening(false);
    recognition.start();
  }, [activeReportSpeechField, getSpeechLanguage, reportCustomReason, reportDetails, stopReportDictation, tr]);

  const renderReportSpeechButton = (field: ReportSpeechField) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => startReportDictation(field)}
      disabled={!isSpeechSupported}
      aria-pressed={activeReportSpeechField === field}
      aria-label={
        activeReportSpeechField === field
          ? tr('Stop voice input', 'Arreter la dictee vocale', 'Stop voice input')
          : tr('Start voice input', 'Demarrer la dictee vocale', 'Start voice input')
      }
      className={`h-9 rounded-lg border ${activeReportSpeechField === field ? 'border-red-500 text-red-600' : 'border-border text-muted-foreground'}`}
    >
      {activeReportSpeechField === field ? <MicOff size={16} className="mr-2" /> : <Mic size={16} className="mr-2" />}
      {activeReportSpeechField === field && isReportListening
        ? tr('Listening...', 'Ecoute...', 'Listening...')
        : activeReportSpeechField === field
          ? tr('Stop', 'Arreter', 'Stop')
          : tr('Dictee', 'Dictee', 'Dictee')}
    </Button>
  );

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
      voiceMessage: m.voiceMessage ? {
        url: m.voiceMessage.url,
        duration: m.voiceMessage.duration,
        mimeType: m.voiceMessage.mimeType,
        size: m.voiceMessage.size,
      } : undefined,
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
    const interval = setInterval(() => {
      fetchMessages(selectedConversationId);
    }, 15000);
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

  const openReportModal = () => {
    setIsConversationMenuOpen(false);
    setConfirmModal(null);
    setReportReason(REPORT_REASONS[0]);
    setReportCustomReason('');
    setReportDetails('');
    setReportModalOpen(true);
  };

  const closeReportModal = () => {
    stopReportDictation();
    setReportModalOpen(false);
  };

  const handleSubmitDirectReport = async () => {
    if (!selectedConv) {
      toast.error(tr('Unable to submit report right now.', 'Impossible de soumettre le signalement pour le moment.', 'لا يمكن تقديم البلاغ في هذه اللحظة.'));
      return;
    }

    const token = getToken();
    if (!token) {
      toast.error(tr('You must be logged in to submit a report.', 'Vous devez etre connecte pour soumettre un signalement.', 'يجب أن تكون مسجلاً لتقديم البلاغ.'));
      return;
    }

    const reason = reportReason === 'Other' ? reportCustomReason.trim() : reportReason;
    if (!reason) {
      toast.error(tr('Please select or write a report reason.', 'Veuillez selectionner ou ecrire un motif de signalement.', 'يرجى تحديث أو كتابة علة بالبلاغ.'));
      return;
    }

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reportType: 'user',
          targetUserId: selectedConv.participantId,
          targetRole: selectedConv.role,
          reason,
          details: reportDetails.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit report');
      }

      closeReportModal();
      toast.success(tr('Report submitted. We will notify you soon via email once it is treated.', 'Signalement envoye. Nous vous informerons bientot par email une fois traite.', 'تم تقديم البلاغ. سيتم مخطرك عبر البريد بعد معالجته.'));
    } catch {
      toast.error(tr('Failed to submit report. Please try again.', 'Echec de l\'envoi du signalement. Veuillez reessayer.', 'فشل إرسال البلاغ. يرجى المحاولة مرة أخرى.'));
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmModal) return;
    switch (confirmModal.type) {
      case 'delete-conv':
        await handleDeleteConversation();
        break;
      case 'block':
      case 'unblock':
        await handleToggleBlock();
        break;
      case 'report':
        setIsConversationMenuOpen(false);
        break;
      case 'delete-msg':
        if (confirmModal.messageId) await handleDeleteMessage(confirmModal.messageId);
        break;
    }
    setConfirmModal(null);
  };

  const getConfirmModalConfig = () => {
    if (!confirmModal) return { title: '', message: '', confirmLabel: '', color: '' };
    switch (confirmModal.type) {
      case 'delete-conv':
        return { title: tr('Delete Conversation', 'Supprimer la conversation', 'حذف المحادثة'), message: tr('Are you sure you want to delete this conversation? All messages will be permanently removed.', 'Voulez-vous vraiment supprimer cette conversation ? Tous les messages seront supprimes definitivement.', 'هل أنت متأكد من حذف هذه المحادثة ؟ جميع الرسالات سيتم حذفها نهائياً.'), confirmLabel: tr('Delete', 'Supprimer', 'حذف'), color: '#ef4444' };
      case 'block':
        return { title: tr('Block User', 'Bloquer l\'utilisateur', 'حجب المستخدم'), message: tr(`Are you sure you want to block ${selectedConv?.name || 'this user'}? They won't be able to send you messages.`, `Voulez-vous vraiment bloquer ${selectedConv?.name || tr('this user', 'cet utilisateur', 'هذا المستخدم')} ? Cette personne ne pourra plus vous envoyer de messages.`, `هل أنت متأكد من حجب ${selectedConv?.name || 'هذا المستخدم'}ْ لن يضي لهم القدرة على إرسال رسالات إليك.`), confirmLabel: tr('Block', 'Bloquer', 'حجب'), color: '#ef4444' };
      case 'unblock':
        return { title: tr('Unblock User', 'Debloquer l\'utilisateur', 'إلغاء حجب المستخدم'), message: tr(`Are you sure you want to unblock ${selectedConv?.name || 'this user'}?`, `Voulez-vous vraiment debloquer ${selectedConv?.name || tr('this user', 'cet utilisateur', 'هذا المستخدم')} ?`, `هل أنت متأكد من إلغاء حجب ${selectedConv?.name || 'هذا المستخدم'}ْ`), confirmLabel: tr('Unblock', 'Debloquer', 'إلغاء'), color: '#10b981' };
      case 'report':
        return { title: tr('Report User', 'Signaler l\'utilisateur', 'إبلاغ عن مستخدم'), message: tr(`Are you sure you want to report ${selectedConv?.name || 'this user'}? Our team will review the conversation.`, `Voulez-vous vraiment signaler ${selectedConv?.name || tr('this user', 'cet utilisateur', 'هذا المستخدم')} ? Notre equipe examinera la conversation.`, `هل أنت متأكد من الإبلاغ عن ${selectedConv?.name || 'هذا المستخدم'}ْ ؟ سيقوم فريقنا بمراجعة المحادثة.`), confirmLabel: tr('Report', 'Signaler', 'إبلاغ'), color: '#f59e0b' };
      case 'delete-msg':
        return { title: tr('Delete Message', 'Supprimer le message', 'حذف الرسالة'), message: tr('Are you sure you want to delete this message?', 'Voulez-vous vraiment supprimer ce message ?', 'هل أنت متأكد من حذف هذه الرسالة؟'), confirmLabel: tr('Delete', 'Supprimer', 'حذف'), color: '#ef4444' };
      default:
        return { title: '', message: '', confirmLabel: '', color: '' };
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

  useEffect(() => {
    if (!reportModalOpen) {
      stopReportDictation();
    }
  }, [reportModalOpen, stopReportDictation]);

  useEffect(() => {
    return () => {
      stopReportDictation();
    };
  }, [stopReportDictation]);


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
      <Card className="h-full bg-card rounded-2xl border border-border shadow-lg flex flex-col lg:flex-row overflow-hidden">
        {/* Conversations List */}
        <div className="lg:w-96 border-r-2 border-border flex flex-col">
          <div className="p-6 border-b-2 border-border">
            
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <Input
                placeholder={tr('Search conversations...', 'Rechercher des conversations...', 'ابحث عن المحادثات...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 rounded-xl border-2 border-border focus:border-primary"
              />
            </div>
          </div>

          {loadingConversations && <div className="p-4 text-sm text-muted-foreground">{tr('Loading conversations...', 'Chargement des conversations...', 'جاري تحميل المحادثات...')}</div>}
          {error && <div className="p-4 text-sm text-red-500">{error}</div>}

          <div className="flex-1 overflow-y-auto">
            {!loadingConversations && filteredConversations.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">{tr('No conversations found.', 'Aucune conversation trouvee.', 'لم يتم العثور على محادثات.')}</p>
            )}
            {filteredConversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversationId(conv.id)}
                className={`w-full p-4 transition-all ${
                  selectedConversationId === conv.id
                    ? 'bg-primary/5 border-l-4 border-primary'
                    : 'hover:bg-muted/50 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="w-14 h-14 ring-2 ring-border shadow-md dark:ring-slate-700">
                      <AvatarFallback className="bg-slate-200 text-slate-500 font-semibold text-lg dark:bg-slate-700 dark:text-slate-100">{conv.avatar}</AvatarFallback>
                    </Avatar>
                    {conv.online && <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-border dark:border-slate-800 bg-emerald-500 shadow-sm" />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-foreground truncate">{conv.name}</h4>
                      <span className="text-xs text-muted-foreground">{conv.timestamp}</span>
                    </div>
                    <Badge variant="secondary" className="mb-2 text-xs bg-blue-100 text-blue-700 dark:bg-blue-100 dark:text-blue-700 border-0">
                      {conv.role}
                    </Badge>
                    <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                  </div>
                  {conv.unread > 0 && <span className="px-2 py-1 rounded-full text-xs font-bold text-white bg-red-500 dark:bg-red-500 shadow-sm">{conv.unread}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col relative bg-muted/50 dark:bg-[#0b0f14] h-full">
          {callState.status === 'ringing' ? (
            <IncomingCallModal
              callState={callState}
              onAccept={() => {
                acceptCallState();
                const currentConv = conversations.find(c => c.id === callState.conversationId);
                if (currentConv) setSelectedConversationId(currentConv.id);
              }}
              onReject={rejectCall}
            />
          ) : callState.status === 'calling' ? (
            <CallingModal callState={callState} onCancel={endEntireCall} />
          ) : callState.status === 'in-call' ? (
            <div
              className="fixed inset-0 flex items-center justify-center pointer-events-auto"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999 }}
            >
              <div
                className="relative flex flex-col overflow-hidden"
                style={{ width: '850px', height: '650px', maxWidth: '90vw', maxHeight: '85vh', backgroundColor: '#000', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
              >
                {callState.type === 'video' ? (
                  <VideoCall
                    callState={callState}
                    localStream={localStream}
                    remoteStream={remoteStream}
                    isMicrophoneEnabled={isMicrophoneEnabled}
                    isCameraEnabled={isCameraEnabled}
                    toggleMicrophone={toggleMicrophone}
                    toggleCamera={toggleCamera}
                    endCall={endEntireCall}
                  />
                ) : (
                  <AudioCall
                    callState={callState}
                    remoteStream={remoteStream}
                    isMicrophoneEnabled={isMicrophoneEnabled}
                    toggleMicrophone={toggleMicrophone}
                    endCall={endEntireCall}
                  />
                )}
              </div>
            </div>
          ) : (
            <>
          {selectedConv && (
                <div className="p-6 flex items-center justify-between border-b-2 border-border bg-card">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="w-12 h-12 ring-2 ring-border shadow-md dark:ring-slate-700">
                    <AvatarFallback className="bg-slate-200 text-slate-500 font-semibold dark:bg-slate-700 dark:text-slate-100">{selectedConv.avatar}</AvatarFallback>
                  </Avatar>
                  {selectedConv.online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-border dark:border-slate-800 bg-emerald-500" />}
                </div>
                <div className="flex items-center gap-2 relative" ref={profileMenuRef}>
                  <div>
                    <h3 className="font-bold text-foreground text-lg">{selectedConv.name}</h3>
                    <p className="text-sm font-medium" style={{ color: selectedConv.online ? '#10B981' : '#6B7280' }}>
                      {selectedConv.online ? tr('Online', 'En ligne', 'ماتصل') : tr('Offline', 'Hors ligne', 'غير مثبوت')}
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
                    <div className="absolute left-0 top-full mt-2 z-40 min-w-[180px] rounded-xl border border-border bg-card p-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          handleViewProfile();
                          setIsProfileMenuOpen(false);
                        }}
                        disabled={selectedConv.role !== 'artisan'}
                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FileText size={16} />
                        {tr('View profile', 'Voir le profil', 'عرض الملف الشخصي')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setConfirmModal({ type: blockedByMe ? 'unblock' : 'block' }); setIsProfileMenuOpen(false); }}
                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/50"
                      >
                        {blockedByMe ? <ShieldCheck size={16} /> : <Ban size={16} />}
                        {blockedByMe ? tr('Unblock', 'Debloquer', 'إلغاء الحجب') : tr('Block', 'Bloquer', 'حجب')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <CallButton 
                  onAudioCall={handleAudioCall} 
                  onVideoCall={handleVideoCall} 
                  disabled={sendingDisabled || callState.status !== 'idle'} 
                />
                {sendingDisabled && <span className="text-xs text-red-500 mx-2">(Envoi bloqué)</span>}
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
                  <div className="absolute right-0 top-full mt-2 z-40 min-w-[220px] rounded-xl border border-border bg-card p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => { setConfirmModal({ type: 'delete-conv' }); setIsConversationMenuOpen(false); }}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/50 text-left"
                    >
                      <Trash2 size={16} />
                      {tr('Delete Conversation', 'Supprimer la conversation', 'حذف المحادثة')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setConfirmModal({ type: blockedByMe ? 'unblock' : 'block' }); setIsConversationMenuOpen(false); }}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/50 text-left"
                    >
                      {blockedByMe ? <ShieldCheck size={16} /> : <Ban size={16} />}
                      {blockedByMe ? tr('Unblock User', 'Debloquer l\'utilisateur', 'إلغاء حجب المستخدم') : tr('Block User', 'Bloquer l\'utilisateur', 'حجب المستخدم')}
                    </button>
                    <button
                      type="button"
                      onClick={openReportModal}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/50 text-left"
                    >
                      <Flag size={16} />
                      {tr('Report', 'Signaler', 'إبلاغ')}
                    </button>
                  </div>
                )}
              </div>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50 dark:bg-[#11161c]">
            {loadingMessages && <p className="text-sm text-muted-foreground">{tr('Loading messages...', 'Chargement des messages...', 'جاري تحميل الرسالات...')}</p>}
            {!loadingMessages && messages.length === 0 && selectedConv && <p className="text-sm text-muted-foreground">{tr('No messages yet.', 'Aucun message pour le moment.', 'لا توجد رسالات حتى الآن.')}</p>}
            {!selectedConv && !loadingConversations && <p className="text-sm text-muted-foreground">{tr('Select a conversation to start chatting.', 'Selectionnez une conversation pour commencer a discuter.', 'ابتدئ محادثة لبدء الدردشة.')}</p>}
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
                      <div className="flex items-center gap-1 rounded-full border bg-card shadow-sm px-1 py-0.5">
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
                            onClick={() => setConfirmModal({ type: 'delete-msg', messageId: message.id })}
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                      {reactionPickerForMessageId === message.id && (
                        <div className="mt-1 rounded-full border bg-card shadow-md px-2 py-1 flex items-center gap-1">
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
                          : 'bg-muted border-l-gray-400 text-foreground'
                      }`}
                    >
                      <p className="text-[11px] font-semibold mb-0.5">{tr('Replied to', 'Repondu a', 'ردعلى')} {message.replyTo.senderName}</p>
                      <p className="text-xs line-clamp-2 opacity-90">{message.replyTo.content || tr('Attachment', 'Piece jointe', 'مرفق')}</p>
                    </div>
                  )}
                  {message.content && (
                    <div
                      className={`px-5 py-3 rounded-2xl shadow-sm ${
                        message.isSelf
                          ? 'rounded-br-sm text-white'
                          : 'bg-card text-foreground rounded-bl-sm'
                      }`}
                      style={message.isSelf ? { backgroundColor: '#1E40AF' } : {}}
                    >
                      <p className="leading-relaxed break-words">{message.content}</p>
                    </div>
                  )}
                  {message.voiceMessage && (
                    <div className={message.content ? 'mt-2' : ''}>
                      <VoiceMessage
                        url={`${API_BASE_URL}${message.voiceMessage.url}`}
                        duration={message.voiceMessage.duration}
                        isSelf={!!message.isSelf}
                        messageId={message.id}
                      />
                    </div>
                  )}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className={message.content ? 'mt-2' : ''}>
                      <div className="space-y-2">
                        {message.attachments.map((att) => {
                          const url = `${API_BASE_URL}${att.url}`;
                          const isImage = att.mimeType?.startsWith('image/');
                          return (
                            <div key={att.filename} className="rounded-2xl border border-border bg-card shadow-sm p-3">
                              {isImage ? (
                                <a href={url} target="_blank" rel="noreferrer" className="block">
                                  <img
                                    src={url}
                                    alt={att.originalName}
                                    className="max-h-44 w-full rounded-xl object-contain bg-muted/50"
                                  />
                                </a>
                              ) : null}
                              <div className="flex items-center gap-3 mt-2">
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                  {isImage ? <ImageIcon size={18} className="text-muted-foreground" /> : <FileText size={18} className="text-muted-foreground" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{att.originalName}</p>
                                  <p className="text-xs text-muted-foreground">{formatFileSize(att.size)}</p>
                                </div>
                                <a href={url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                                  <Download size={16} />
                                </a>
                              </div>
                              <p className="text-[11px] text-right text-muted-foreground mt-1">Envoyé</p>
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
                        <span key={emoji} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs">
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

          <div className="p-6 border-t-2 border-border">
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
              <div className="mb-3 rounded-xl border border-border bg-muted/50 p-3 space-y-2">
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
                    {replyingTo.content || (replyingTo.attachments?.length ? tr('Attachment', 'Piece jointe', 'مرفق') : (replyingTo.voiceMessage ? tr('Voice message', 'Message vocal', 'رسالة صوتية') : tr('Message', 'Message', 'رسالة')))}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setReplyingTo(null)}>
                  <X size={14} />
                </Button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className={`flex items-center gap-3 ${isVoiceActive ? 'w-full' : ''}`} key={selectedConversationId}>
              <VoiceRecorder 
                onSend={async (blob, duration) => {
                  if (!selectedConversationId) return;
                  try {
                    const token = getToken();
                    if (!token) return;
                    const formData = new FormData();
                    formData.append('conversationId', selectedConversationId);
                    formData.append('duration', duration.toString());
                    const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
                    formData.append('voice', blob, `voice.${ext}`);
                    const response = await axios.post(
                      `${API_URL}/messages/voice`,
                      formData,
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                          'Content-Type': 'multipart/form-data',
                        },
                      }
                    );
                    const newMsg = mapMessage(response.data);
                    setMessages(prev => [...prev, newMsg]);
                    fetchConversations();
                    setIsVoiceActive(false);
                  } catch (err: any) {
                    setError(err?.response?.data?.message || tr('Unable to send voice message.', 'Impossible d\'envoyer le message vocal.'));
                    console.error('Error sending voice message:', err);
                    throw err; // Propagate to VoiceRecorder so it doesn't reset
                  }
                }}
                onCancel={() => setIsVoiceActive(false)}
                onStateChange={setIsVoiceActive}
                disabled={sendingDisabled}
              />
              {!isVoiceActive && (
                <>
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
                    placeholder={tr('Type a message...', '   Ecrire un message...', 'اكتب رسالة...')}
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    className="flex-1 h-12 rounded-xl border-2 border-border focus:border-primary"
                    disabled={sendingDisabled}
                  />
                  <Button
                    type="submit"
                    className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md"
                    disabled={(!messageInput.trim() && selectedFiles.length === 0) || sendingDisabled}
                  >
                    <Send size={20} />
                  </Button>
                </>
              )}
            </form>
          </div>
            </>
          )}
        </div>
      </Card>

      {/* Confirmation Modal */}
      {confirmModal && (() => {
        const config = getConfirmModalConfig();
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setConfirmModal(null)}
          >
            <div
              style={{ backgroundColor: 'var(--card)', borderRadius: 20, padding: 32, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', textAlign: 'center', margin: '0 0 8px' }}>{config.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--muted-foreground)', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>{config.message}</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setConfirmModal(null)}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '2px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  {tr('Cancel', 'Annuler', 'إلغاء')}
                </button>
                <button
                  onClick={handleConfirmAction}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', backgroundColor: config.color, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  {config.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {reportModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={closeReportModal}
        >
          <div
            style={{
              backgroundColor: 'var(--card)',
              borderRadius: 20,
              border: '1px solid var(--border)',
              padding: 24,
              maxWidth: 520,
              width: '92%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 8px' }}>{tr('Report User', 'Signaler l\'utilisateur')}</h3>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)', margin: '0 0 16px', lineHeight: 1.5 }}>
              {tr('Reporting:', 'Signalement de :', 'البلاغ عن:')} <strong style={{ color: 'var(--foreground)' }}>{selectedConv?.name || tr('User', 'Utilisateur', 'مستخدم')}</strong>
            </p>

            <div style={{ marginBottom: 14 }}>
              <label htmlFor="direct-report-reason" style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
                {tr('Reason', 'Raison', 'السبب')}
              </label>
              <select
                id="direct-report-reason"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', padding: '0 10px', fontSize: 14 }}
              >
                {REPORT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>

            {reportReason === tr('Other', 'Autre', 'أخرى') && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                  <label htmlFor="direct-report-custom" style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                    {tr('Custom reason', 'Raison personnalisee', 'سبب مخصصة')}
                  </label>
                  {renderReportSpeechButton('customReason')}
                </div>
                <Input
                  id="direct-report-custom"
                  value={reportCustomReason}
                  onChange={(e) => setReportCustomReason(e.target.value)}
                  placeholder={tr('Write your reason', 'Ecrivez votre raison', 'اكتب سببك')}
                />
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                <label htmlFor="direct-report-details" style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                  {tr('Details (optional)', 'Details (optionnel)', 'التفاصيل (اختياري)')}
                </label>
                {renderReportSpeechButton('details')}
              </div>
              <Textarea
                id="direct-report-details"
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder={tr('Add extra details', 'Ajouter des details supplementaires', 'ضم تفاصيل إضافية')}
                className="min-h-28"
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={closeReportModal}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '2px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                {tr('Cancel', 'Annuler', 'إلغاء')}
              </button>
              <button
                onClick={handleSubmitDirectReport}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', backgroundColor: '#f59e0b', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                {tr('Submit Report', 'Envoyer le signalement', 'إرسال البلاغ')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}