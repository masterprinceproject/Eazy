import React, { useState, useEffect, useRef } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  limit,
  updateDoc,
  deleteDoc,
  Timestamp,
  getDocFromServer,
  arrayUnion,
  writeBatch
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { UserProfile, Chat, Message } from './types';
import { format } from 'date-fns';
import { 
  Search, 
  MoreVertical, 
  Send, 
  Paperclip, 
  Smile, 
  Phone, 
  Video, 
  ArrowLeft,
  LogOut,
  User as UserIcon,
  MessageSquare,
  Plus,
  Megaphone,
  Check,
  CheckCheck,
  Edit2,
  Settings,
  Shield,
  Bell,
  Palette,
  CreditCard,
  Star,
  ChevronRight,
  Globe,
  Lock,
  Smartphone,
  Bookmark,
  Camera,
  X,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  Square,
  Trash2,
  Pin,
  PinOff,
  Monitor,
  BellOff,
  Users,
  Maximize2,
  Minimize2,
  Share2,
  FileText,
  Download,
  Play,
  Pause,
  Bot,
  Sparkles
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const VoiceMessage = ({ src, isMine }: { src: string, isMine: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn(
      "flex items-center gap-3 py-2 px-3 rounded-2xl min-w-[240px]",
      isMine ? "bg-emerald-700/40" : "bg-gray-50"
    )}>
      <audio 
        ref={audioRef} 
        src={src} 
        onLoadedMetadata={onLoadedMetadata} 
        onTimeUpdate={onTimeUpdate} 
        onEnded={onEnded}
        className="hidden"
      />
      <button 
        onClick={togglePlay}
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105",
          isMine ? "bg-white text-emerald-600" : "bg-emerald-600 text-white"
        )}
      >
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-end gap-[2px] h-6 mb-1">
          {[...Array(24)].map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "w-1 rounded-full transition-all duration-300",
                isMine ? "bg-white/40" : "bg-emerald-200",
                isPlaying && "animate-pulse"
              )}
              style={{ 
                height: `${20 + Math.sin(i * 0.5) * 40 + Math.random() * 20}%`,
                animationDelay: `${i * 0.05}s`,
                opacity: duration > 0 && (currentTime / duration) * 24 > i ? 1 : 0.4,
                backgroundColor: duration > 0 && (currentTime / duration) * 24 > i ? (isMine ? 'white' : '#10b981') : undefined
              }}
            />
          ))}
        </div>
        <div className="flex justify-between items-center">
          <span className={cn(
            "text-[10px] font-medium",
            isMine ? "text-emerald-100" : "text-gray-500"
          )}>
            {formatTime(currentTime)}
          </span>
          <span className={cn(
            "text-[10px] font-medium",
            isMine ? "text-emerald-100" : "text-gray-500"
          )}>
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};

const VideoMessage = ({ src, isMine }: { src: string, isMine: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className={cn(
      "relative rounded-2xl overflow-hidden group max-w-[280px] aspect-[3/4] bg-black",
      isMine ? "border-emerald-500/30" : "border-gray-100"
    )}>
      <video 
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        onEnded={() => setIsPlaying(false)}
        onClick={togglePlay}
        playsInline
      />
      <button 
        onClick={togglePlay}
        className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
          {isPlaying ? <Pause size={24} /> : <Play size={24} fill="currentColor" />}
        </div>
      </button>
    </div>
  );
};

const AI_ASSISTANT_UID = 'ai-assistant-bot';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'all' | 'groups' | 'channels' | 'settings'>('all');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [channelSearchResults, setChannelSearchResults] = useState<Chat[]>([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState<'profile' | 'privacy' | 'notifications' | 'appearance' | 'language' | 'devices'>('profile');
  const [showSettingsContentOnMobile, setShowSettingsContentOnMobile] = useState(false);

  // Settings State
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
  const [isLastSeenHidden, setIsLastSeenHidden] = useState(false);
  const [isProfilePhotoHidden, setIsProfilePhotoHidden] = useState(false);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [language, setLanguage] = useState('English');
  const [privacy, setPrivacy] = useState<'everybody' | 'contacts' | 'nobody'>('everybody');
  const [groupName, setGroupName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [isPublicChannel, setIsPublicChannel] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isChatInfoOpen, setIsChatInfoOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [messageToForward, setMessageToForward] = useState<Message | null>(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [userBio, setUserBio] = useState('');
  const [userDisplayName, setUserDisplayName] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userPhoneNumber, setUserPhoneNumber] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [activeCallState, setActiveCallState] = useState<{
    chatId: string;
    type: 'audio' | 'video';
    participants: string[];
    localStream: MediaStream | null;
    remoteStreams: Record<string, MediaStream>;
    isMuted: boolean;
    isVideoOff: boolean;
  } | null>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const signalingUnsubscribes = useRef<Record<string, () => void>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const callVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Test connection to Firestore
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        setConnectionError(null);
      } catch (error) {
        if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('Could not reach Cloud Firestore backend'))) {
          console.error("Please check your Firebase configuration.");
          setConnectionError("Could not reach Cloud Firestore backend. Please check your internet connection or Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const createAiAssistant = async () => {
      const aiRef = doc(db, 'users', AI_ASSISTANT_UID);
      const aiSnap = await getDoc(aiRef);
      if (!aiSnap.exists()) {
        await setDoc(aiRef, {
          uid: AI_ASSISTANT_UID,
          displayName: 'Customer Service AI',
          email: 'assistant@mastergram.ai',
          photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=assistant',
          status: 'online',
          bio: 'Your friendly MasterGram customer service helper. How can I help you today?',
          isPremium: true
        });
      }
    };
    createAiAssistant();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Update user profile in Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        let isNewUser = !userSnap.exists();
        
        if (userSnap.exists()) {
          const profile = userSnap.data() as UserProfile;
          if (profile.isBanned) {
            setIsBanned(true);
            setBanReason(profile.bio || 'Violation of community guidelines.');
            await signOut(auth);
            setLoading(false);
            return;
          }
          setUserBio(profile.bio || '');
          setUserDisplayName(profile.displayName || currentUser.displayName || '');
          setUserUsername(profile.username || '');
          setUserPhoneNumber(profile.phoneNumber || '');
          setCurrentUserProfile(profile);
          if (profile.settings) {
            setIsTwoFactorEnabled(profile.settings.twoFactor ?? false);
            setIsLastSeenHidden(profile.settings.hideLastSeen ?? false);
            setIsProfilePhotoHidden(profile.settings.hideProfilePhoto ?? false);
            setIsNotificationsEnabled(profile.settings.notifications ?? true);
            setTheme(profile.settings.theme ?? 'light');
            setLanguage(profile.settings.language ?? 'English');
            setPrivacy(profile.settings.privacy ?? 'everybody');
          }
        }
        await setDoc(userRef, {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'Anonymous',
          email: currentUser.email || '',
          photoURL: currentUser.photoURL || '',
          lastSeen: serverTimestamp(),
          status: 'online'
        }, { merge: true });
        
        setUser(currentUser);

        // If new user, create welcome chat with AI Assistant
        if (isNewUser) {
          const chatData = {
            participants: [currentUser.uid, AI_ASSISTANT_UID],
            type: 'private',
            lastMessage: 'Welcome to MasterGram! I am your AI Assistant.',
            lastMessageAt: serverTimestamp()
          };
          const chatRef = await addDoc(collection(db, 'chats'), chatData);
          
          // Add first message from AI
          await addDoc(collection(db, 'chats', chatRef.id, 'messages'), {
            chatId: chatRef.id,
            senderId: AI_ASSISTANT_UID,
            senderName: 'Customer Service AI',
            content: `Hello ${currentUser.displayName || 'there'}! Welcome to MasterGram. I'm your customer service helper. I'm here to help you get started and answer any questions you might have. How can I assist you today?`,
            createdAt: serverTimestamp(),
            type: 'text',
            readBy: []
          });
        }
      } else {
        setUser(null);
        setCurrentUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // AI Assistant Response Logic
  useEffect(() => {
    if (!activeChat || !user || activeChat.type !== 'private' || !activeChat.participants.includes(AI_ASSISTANT_UID)) return;
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.senderId === AI_ASSISTANT_UID) return; // Don't respond to self

    const respondToUser = async () => {
      setIsAiResponding(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

        const getUsersList: FunctionDeclaration = {
          name: "getUsersList",
          description: "Retrieve a list of all users in the application.",
          parameters: { type: Type.OBJECT, properties: {} }
        };

        const editUser: FunctionDeclaration = {
          name: "editUser",
          description: "Edit a user's profile information.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              userId: { type: Type.STRING, description: "The unique ID of the user to edit." },
              displayName: { type: Type.STRING, description: "The new display name for the user." },
              bio: { type: Type.STRING, description: "The new bio for the user." },
              isPremium: { type: Type.BOOLEAN, description: "Set the user's premium status." }
            },
            required: ["userId"]
          }
        };

        const banUser: FunctionDeclaration = {
          name: "banUser",
          description: "Ban a user from the application.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              userId: { type: Type.STRING, description: "The unique ID of the user to ban." },
              reason: { type: Type.STRING, description: "The reason for banning the user." }
            },
            required: ["userId"]
          }
        };

        const unbanUser: FunctionDeclaration = {
          name: "unbanUser",
          description: "Unban a user from the application.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              userId: { type: Type.STRING, description: "The unique ID of the user to unban." }
            },
            required: ["userId"]
          }
        };

        const deleteMessageAdmin: FunctionDeclaration = {
          name: "deleteMessageAdmin",
          description: "Delete a specific message from any chat.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              chatId: { type: Type.STRING, description: "The ID of the chat containing the message." },
              messageId: { type: Type.STRING, description: "The ID of the message to delete." }
            },
            required: ["chatId", "messageId"]
          }
        };

        const tools = [{ functionDeclarations: [getUsersList, editUser, banUser, unbanUser, deleteMessageAdmin] }];

        const model = ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            {
              role: 'user',
              parts: [{ text: `You are a friendly customer service assistant for MasterGram, a messaging app. 
              The user's name is ${user.displayName}. 
              Your goal is to be helpful, welcoming, and answer questions about MasterGram.
              MasterGram features: real-time chat, voice messages, image sharing, channels, groups, and a polished UI.
              
              You also have administrative powers via an invisible virtual admin. You can manage users, edit their info, ban them, and delete messages if they violate rules.
              When a user asks for administrative actions, use your tools to perform them.
              
              User says: ${lastMessage.content}` }]
            }
          ],
          config: {
            systemInstruction: "You are a friendly customer service assistant with administrative powers. You can manage the app by calling your virtual admin tools. Always confirm actions to the user.",
            tools
          }
        });

        const result = await model;
        
        if (result.functionCalls) {
          const functionResponses = [];
          for (const call of result.functionCalls) {
            let toolResult;
            if (call.name === "getUsersList") {
              const usersSnap = await getDocs(collection(db, 'users'));
              toolResult = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
            } else if (call.name === "editUser") {
              const { userId, ...updates } = call.args as any;
              await updateDoc(doc(db, 'users', userId), updates);
              toolResult = { success: true, message: `User ${userId} updated successfully.` };
            } else if (call.name === "banUser") {
              const { userId } = call.args as any;
              await updateDoc(doc(db, 'users', userId), { isBanned: true });
              toolResult = { success: true, message: `User ${userId} has been banned.` };
            } else if (call.name === "unbanUser") {
              const { userId } = call.args as any;
              await updateDoc(doc(db, 'users', userId), { isBanned: false });
              toolResult = { success: true, message: `User ${userId} has been unbanned.` };
            } else if (call.name === "deleteMessageAdmin") {
              const { chatId, messageId } = call.args as any;
              await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
              toolResult = { success: true, message: `Message ${messageId} deleted.` };
            }
            functionResponses.push({ name: call.name, response: { result: toolResult }, id: call.id });
          }

          const finalResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
              { role: 'user', parts: [{ text: lastMessage.content }] },
              { role: 'model', parts: result.candidates[0].content.parts },
              { role: 'user', parts: functionResponses.map(r => ({ functionResponse: r })) }
            ],
            config: { tools }
          });

          const responseText = finalResponse.text;
          await sendAiMessage(responseText);
        } else {
          await sendAiMessage(result.text);
        }

      } catch (error) {
        console.error("AI Assistant Error:", error);
      } finally {
        setIsAiResponding(false);
      }
    };

    const sendAiMessage = async (text: string) => {
      // Wait a bit to simulate typing
      await new Promise(resolve => setTimeout(resolve, 1500));

      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
        chatId: activeChat.id,
        senderId: AI_ASSISTANT_UID,
        senderName: 'Customer Service AI',
        content: text,
        createdAt: serverTimestamp(),
        type: 'text',
        readBy: []
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: text,
        lastMessageAt: serverTimestamp()
      });
    };

    // Only respond if the last message was within the last 30 seconds (to avoid responding to old history)
    const now = new Date().getTime();
    const msgTime = lastMessage.createdAt instanceof Timestamp ? lastMessage.createdAt.toMillis() : now;
    if (now - msgTime < 30000) {
      respondToUser();
    }
  }, [messages.length, activeChat?.id]);
  useEffect(() => {
    if (!user) return;
    
    const userRef = doc(db, 'users', user.uid);
    
    const setStatus = async (status: 'online' | 'offline') => {
      try {
        await updateDoc(userRef, {
          status,
          lastSeen: serverTimestamp()
        });
      } catch (error) {
        // Ignore errors if document doesn't exist yet or permission denied during logout
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setStatus('online');
      } else {
        setStatus('offline');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Set online initially
    setStatus('online');
    
    // Periodically update lastSeen to keep it fresh
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setStatus('online');
      }
    }, 60000); // Every minute
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
      // Try to set offline on unmount
      setStatus('offline');
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCurrentUserProfile(null);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUserProfile(docSnap.data() as UserProfile);
      }
    });

    return unsubscribe;
  }, [user]);

  // Save settings to Firestore
  useEffect(() => {
    if (!user) return;
    const saveSettings = async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          settings: {
            twoFactor: isTwoFactorEnabled,
            hideLastSeen: isLastSeenHidden,
            hideProfilePhoto: isProfilePhotoHidden,
            notifications: isNotificationsEnabled,
            theme,
            language,
            privacy
          }
        });
      } catch (error) {
        handleFirestoreError(error, 'update', `users/${user.uid}`);
      }
    };
    
    const timeout = setTimeout(saveSettings, 1000);
    return () => clearTimeout(timeout);
  }, [user, isTwoFactorEnabled, isLastSeenHidden, isProfilePhotoHidden, isNotificationsEnabled, theme, language, privacy]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Fetch chats
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatList: Chat[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const otherParticipantId = data.participants.find((id: string) => id !== user.uid);
        
        let otherProfile: UserProfile | undefined;
        if (otherParticipantId) {
          const profileSnap = await getDoc(doc(db, 'users', otherParticipantId));
          if (profileSnap.exists()) {
            otherProfile = profileSnap.data() as UserProfile;
          }
        }

        chatList.push({
          id: docSnap.id,
          ...data,
          participantProfiles: otherProfile ? [otherProfile] : []
        } as Chat);
      }
      
      const sortedChats = [...chatList].sort((a, b) => {
        const aIsAi = a.participants.includes(AI_ASSISTANT_UID);
        const bIsAi = b.participants.includes(AI_ASSISTANT_UID);
        if (aIsAi && !bIsAi) return -1;
        if (!aIsAi && bIsAi) return 1;
        return 0; // Keep original order (lastMessageAt desc) for others
      });
      
      setChats(sortedChats);
    }, (error) => {
      handleFirestoreError(error, 'list', 'chats');
    });

    return unsubscribe;
  }, [user]);

  // Fetch active chat metadata
  useEffect(() => {
    if (!user || !activeChat) return;

    const unsubscribe = onSnapshot(doc(db, 'chats', activeChat.id), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const otherParticipantId = data.participants.find((id: string) => id !== user.uid);
        
        let otherProfile: UserProfile | undefined;
        if (otherParticipantId) {
          const profileSnap = await getDoc(doc(db, 'users', otherParticipantId));
          if (profileSnap.exists()) {
            otherProfile = profileSnap.data() as UserProfile;
          }
        }

        setActiveChat(prev => {
          if (!prev || prev.id !== docSnap.id) return prev;
          return {
            id: docSnap.id,
            ...data,
            participantProfiles: otherProfile ? [otherProfile] : []
          } as Chat;
        });
      }
    }, (error) => {
      handleFirestoreError(error, 'get', `chats/${activeChat.id}`);
    });

    return unsubscribe;
  }, [user, activeChat?.id]);

  // Monitor active call status
  useEffect(() => {
    if (!activeChat || !user || !activeCallState) return;
    
    // If the call was ended in Firestore, end it locally
    if (!activeChat.activeCall) {
      activeCallState.localStream?.getTracks().forEach(track => track.stop());
      setActiveCallState(null);
    } else {
      // Update participants list
      setActiveCallState(prev => prev ? {
        ...prev,
        participants: activeChat.activeCall!.participants
      } : null);
    }
  }, [activeChat?.activeCall, user, activeCallState?.chatId]);

  // Fetch messages for active chat
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'chats', activeChat.id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      setMessages(msgList);
      scrollToBottom();
    }, (error) => {
      handleFirestoreError(error, 'list', `chats/${activeChat.id}/messages`);
    });

    return unsubscribe;
  }, [activeChat]);

  // Mark messages as delivered and read
  useEffect(() => {
    if (!user || !activeChat || messages.length === 0) return;

    const markMessagesStatus = async () => {
      const batch = writeBatch(db);
      let hasUpdates = false;

      // Mark as delivered (received by client)
      const undeliveredMessages = messages.filter(msg => 
        msg.senderId !== user.uid && (!msg.deliveredTo || !msg.deliveredTo.includes(user.uid))
      );

      if (undeliveredMessages.length > 0) {
        undeliveredMessages.forEach(msg => {
          const msgRef = doc(db, 'chats', activeChat.id, 'messages', msg.id);
          batch.update(msgRef, {
            deliveredTo: arrayUnion(user.uid)
          });
        });
        hasUpdates = true;
      }

      // Mark as read (viewed by user)
      const unreadMessages = messages.filter(msg => 
        msg.senderId !== user.uid && (!msg.readBy || !msg.readBy.includes(user.uid))
      );

      if (unreadMessages.length > 0) {
        unreadMessages.forEach(msg => {
          const msgRef = doc(db, 'chats', activeChat.id, 'messages', msg.id);
          batch.update(msgRef, {
            readBy: arrayUnion(user.uid)
          });
        });
        
        // Also update the chat document's lastMessageReadBy if applicable
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && unreadMessages.some(m => m.id === lastMsg.id)) {
          batch.update(doc(db, 'chats', activeChat.id), {
            lastMessageReadBy: arrayUnion(user.uid)
          });
        }
        hasUpdates = true;
      }

      if (hasUpdates) {
        try {
          await batch.commit();
        } catch (error) {
          console.error("Failed to update message status", error);
        }
      }
    };

    markMessagesStatus();
  }, [user, activeChat?.id, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), {
        status: 'offline',
        lastSeen: serverTimestamp()
      });
    }
    await signOut(auth);
    setActiveChat(null);
  };

  const PremiumBadge = () => (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-0.5 rounded-full inline-flex items-center justify-center ml-1 flex-shrink-0">
      <Star size={10} className="text-white fill-white" />
    </div>
  );

  const focusSearch = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const queryText = e.target.value;
    setSearchQuery(queryText);
    
    if (queryText.length > 2) {
      setIsSearching(true);
      const q = query(
        collection(db, 'users'),
        where('displayName', '>=', queryText),
        where('displayName', '<=', queryText + '\uf8ff'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .map(doc => doc.data() as UserProfile);
      setSearchResults(results);

      // Search for public channels
      const channelQ = query(
        collection(db, 'chats'),
        where('type', '==', 'channel'),
        where('isPublic', '==', true),
        where('name', '>=', queryText),
        where('name', '<=', queryText + '\uf8ff'),
        limit(10)
      );
      const channelSnapshot = await getDocs(channelQ);
      const channelResults = channelSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setChannelSearchResults(channelResults);
    } else {
      setIsSearching(false);
      setSearchResults([]);
      setChannelSearchResults([]);
    }
  };

  const startChat = async (otherUser: UserProfile) => {
    if (!user) return;

    // Check if chat already exists
    const existingChat = chats.find(c => 
      c.type === 'private' && c.participants.includes(otherUser.uid)
    );

    if (existingChat) {
      setActiveChat(existingChat);
      setIsSearching(false);
      setSearchQuery('');
      setEditingMessage(null);
      setNewMessage('');
      return;
    }

    // Create new chat
    const chatData = {
      participants: otherUser.uid === user.uid ? [user.uid] : [user.uid, otherUser.uid],
      type: 'private',
      name: otherUser.uid === user.uid ? 'Saved Messages' : undefined,
      lastMessage: '',
      lastMessageAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, 'chats'), chatData);
      setActiveChat({ id: docRef.id, ...chatData, participantProfiles: [otherUser] } as Chat);
      setIsSearching(false);
      setSearchQuery('');
    } catch (error) {
      handleFirestoreError(error, 'create', 'chats');
    }
  };

  const openAiAssistantChat = async () => {
    if (!user) return;
    const botChat = chats.find(c => c.participants.includes(AI_ASSISTANT_UID));
    if (botChat) {
      setActiveChat(botChat);
      setActiveSidebarTab('all');
    } else {
      try {
        const chatData = {
          participants: [user.uid, AI_ASSISTANT_UID],
          type: 'private',
          lastMessage: 'Welcome to MasterGram! I am your Customer Service AI.',
          lastMessageAt: serverTimestamp()
        };
        const chatRef = await addDoc(collection(db, 'chats'), chatData);
        
        await addDoc(collection(db, 'chats', chatRef.id, 'messages'), {
          chatId: chatRef.id,
          senderId: AI_ASSISTANT_UID,
          senderName: 'Customer Service AI',
          content: `Hello ${user.displayName || 'there'}! Welcome to MasterGram. I'm your customer service helper. How can I help you today?`,
          createdAt: serverTimestamp(),
          type: 'text',
          readBy: []
        });
        
        // The onSnapshot will update the chats list, and the user can click again
        // or we can try to set the active chat if we had the ID, but it's better to wait for the snapshot
      } catch (error) {
        handleFirestoreError(error, 'create', 'chats');
      }
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !user) return;

    const msgContent = newMessage;
    setNewMessage('');

    if (editingMessage) {
      try {
        await updateDoc(doc(db, 'chats', activeChat.id, 'messages', editingMessage.id), {
          content: msgContent,
          isEdited: true,
          editedAt: serverTimestamp()
        });
        
        // Update last message in chat if this was the last message
        if (messages.length > 0 && messages[messages.length - 1].id === editingMessage.id) {
          await updateDoc(doc(db, 'chats', activeChat.id), {
            lastMessage: msgContent,
            lastMessageAt: serverTimestamp()
          });
        }

        setEditingMessage(null);
      } catch (error) {
        handleFirestoreError(error, 'update', `chats/${activeChat.id}/messages/${editingMessage.id}`);
      }
      return;
    }

    try {
      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
        chatId: activeChat.id,
        senderId: user.uid,
        senderName: user.displayName,
        senderIsPremium: currentUserProfile?.isPremium || false,
        content: msgContent,
        createdAt: serverTimestamp(),
        type: 'text',
        readBy: [user.uid],
        deliveredTo: [user.uid]
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: msgContent,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
        lastMessageReadBy: [user.uid]
      });
    } catch (error) {
      handleFirestoreError(error, 'create', `chats/${activeChat.id}/messages`);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat || !user) return;

    // Check file size (limit to 800KB for base64 in Firestore)
    if (file.size > 800 * 1024) {
      alert("File is too large. Please select a file smaller than 800KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Content = event.target?.result as string;
      
      try {
        const msgData = {
          chatId: activeChat.id,
          senderId: user.uid,
          senderName: user.displayName,
          senderIsPremium: currentUserProfile?.isPremium || false,
          content: base64Content,
          createdAt: serverTimestamp(),
          type: 'file',
          fileName: file.name,
          fileSize: file.size,
          readBy: [user.uid],
          deliveredTo: [user.uid]
        };

        await addDoc(collection(db, 'chats', activeChat.id, 'messages'), msgData);

        await updateDoc(doc(db, 'chats', activeChat.id), {
          lastMessage: `📎 File: ${file.name}`,
          lastMessageAt: serverTimestamp(),
          lastMessageSenderId: user.uid,
          lastMessageReadBy: [user.uid]
        });
      } catch (error) {
        handleFirestoreError(error, 'create', `chats/${activeChat.id}/messages`);
      }
    };
    reader.readAsDataURL(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const buyPremium = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isPremium: true
      });
      alert("Welcome to MasterGram Premium! You now have a premium badge and exclusive features.");
    } catch (error) {
      handleFirestoreError(error, 'update', `users/${user.uid}`);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), updates);
      // Update local state is handled by onSnapshot if we had one, but here we update manually
      setCurrentUserProfile(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      handleFirestoreError(error, 'update', `users/${user.uid}`);
    }
  };

  const updateBio = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        bio: userBio
      });
      setIsProfileModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, 'update', `users/${user.uid}`);
    }
  };

  const createGroup = async () => {
    if (!user || !groupName.trim() || selectedUsers.length === 0) return;

    const chatData = {
      name: groupName,
      type: 'group',
      participants: [user.uid, ...selectedUsers.map(u => u.uid)],
      admins: [user.uid],
      lastMessage: 'Group created',
      lastMessageAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, 'chats'), chatData);
      setActiveChat({ id: docRef.id, ...chatData, participantProfiles: selectedUsers } as Chat);
      setIsGroupModalOpen(false);
      setGroupName('');
      setSelectedUsers([]);
    } catch (error) {
      handleFirestoreError(error, 'create', 'chats');
    }
  };

  const createChannel = async () => {
    if (!user || !channelName.trim()) return;

    const chatData = {
      name: channelName,
      description: channelDescription,
      type: 'channel',
      isPublic: isPublicChannel,
      participants: [user.uid],
      admins: [user.uid],
      subscriberCount: 1,
      lastMessage: 'Channel created',
      lastMessageAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, 'chats'), chatData);
      setActiveChat({ id: docRef.id, ...chatData, participantProfiles: [] } as Chat);
      setIsChannelModalOpen(false);
      setChannelName('');
      setChannelDescription('');
    } catch (error) {
      handleFirestoreError(error, 'create', 'chats');
    }
  };

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  const createPeerConnection = (targetUid: string, isInitiator: boolean) => {
    if (!activeCallState || !user) return null;
    
    const pc = new RTCPeerConnection(iceServers);
    peerConnections.current[targetUid] = pc;
    
    activeCallState.localStream?.getTracks().forEach(track => {
      pc.addTrack(track, activeCallState.localStream!);
    });
    
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setActiveCallState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          remoteStreams: { ...prev.remoteStreams, [targetUid]: stream }
        };
      });
    };
    
    const signalId = isInitiator ? `${user.uid}_${targetUid}` : `${targetUid}_${user.uid}`;
    const signalRef = doc(db, 'chats', activeCallState.chatId, 'signaling', signalId);
    const candidatesRef = collection(signalRef, isInitiator ? 'fromCandidates' : 'toCandidates');
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(candidatesRef, event.candidate.toJSON());
      }
    };
    
    return pc;
  };

  const handleOffer = async (fromUid: string, offer: any, signalRef: any) => {
    if (!activeCallState || !user) return;
    
    const pc = createPeerConnection(fromUid, false);
    if (!pc) return;
    
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    await updateDoc(signalRef, {
      answer: { type: answer.type, sdp: answer.sdp }
    });
    
    // Listen for remote candidates
    const fromCandidatesRef = collection(signalRef, 'fromCandidates');
    onSnapshot(fromCandidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });
  };

  useEffect(() => {
    if (!activeCallState || !user) return;

    const signalingRef = collection(db, 'chats', activeCallState.chatId, 'signaling');
    
    // Listen for signals where I am the target (callee)
    const q = query(signalingRef, where('toUid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const data = change.doc.data();
        if (data.offer && !peerConnections.current[data.fromUid]) {
          await handleOffer(data.fromUid, data.offer, change.doc.ref);
        }
      });
    });

    return () => {
      unsubscribe();
    };
  }, [activeCallState?.chatId, user?.uid]);

  const isUserAdmin = currentUserProfile?.role === 'admin' || user?.email === 'masterprincecheta207@gmail.com';

  const startCall = async (type: 'audio' | 'video') => {
    if (!activeChat || !user) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
      
      const callData = {
        type,
        startedAt: serverTimestamp(),
        participants: [user.uid],
        initiatorId: user.uid
      };
      
      await updateDoc(doc(db, 'chats', activeChat.id), {
        activeCall: callData
      });
      
      setActiveCallState({
        chatId: activeChat.id,
        type,
        participants: [user.uid],
        localStream: stream,
        remoteStreams: {},
        isMuted: false,
        isVideoOff: false
      });
    } catch (error) {
      console.error("Failed to start call", error);
      alert("Could not access camera/microphone. Please check permissions.");
    }
  };

  const joinCall = async () => {
    if (!activeChat || !user || !activeChat.activeCall) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: activeChat.activeCall.type === 'video'
      });
      
      const existingParticipants = activeChat.activeCall.participants;
      
      await updateDoc(doc(db, 'chats', activeChat.id), {
        'activeCall.participants': arrayUnion(user.uid)
      });
      
      setActiveCallState({
        chatId: activeChat.id,
        type: activeChat.activeCall.type,
        participants: [...existingParticipants, user.uid],
        localStream: stream,
        remoteStreams: {},
        isMuted: false,
        isVideoOff: false
      });

      // Create offers for all existing participants
      for (const targetUid of existingParticipants) {
        if (targetUid === user.uid) continue;
        
        const pc = createPeerConnection(targetUid, true);
        if (!pc) continue;
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        const signalId = `${user.uid}_${targetUid}`;
        const signalRef = doc(db, 'chats', activeChat.id, 'signaling', signalId);
        
        await setDoc(signalRef, {
          fromUid: user.uid,
          toUid: targetUid,
          offer: { type: offer.type, sdp: offer.sdp }
        });
        
        // Listen for answer
        const unsubscribe = onSnapshot(signalRef, async (docSnap) => {
          const data = docSnap.data();
          if (data?.answer && pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          }
        });
        
        // Listen for remote candidates
        const toCandidatesRef = collection(signalRef, 'toCandidates');
        onSnapshot(toCandidatesRef, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
            }
          });
        });
      }
    } catch (error) {
      console.error("Failed to join call", error);
      alert("Could not access camera/microphone. Please check permissions.");
    }
  };

  const endCall = async () => {
    if (!activeCallState || !user) return;
    
    activeCallState.localStream?.getTracks().forEach(track => track.stop());
    
    // Close all peer connections
    Object.values(peerConnections.current).forEach((pc: any) => pc.close());
    peerConnections.current = {};
    
    try {
      const chatRef = doc(db, 'chats', activeCallState.chatId);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const data = chatSnap.data();
        const updatedParticipants = data.activeCall?.participants.filter((id: string) => id !== user.uid) || [];
        
        if (updatedParticipants.length === 0) {
          await updateDoc(chatRef, {
            activeCall: null
          });
          // Clean up signaling
          const signalingRef = collection(chatRef, 'signaling');
          const signals = await getDocs(signalingRef);
          const batch = writeBatch(db);
          signals.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        } else {
          await updateDoc(chatRef, {
            'activeCall.participants': updatedParticipants
          });
        }
      }
    } catch (error) {
      console.error("Failed to end call", error);
    }
    
    setActiveCallState(null);
  };

  const toggleMute = () => {
    if (!activeCallState) return;
    const isMuted = !activeCallState.isMuted;
    activeCallState.localStream?.getAudioTracks().forEach(track => {
      track.enabled = !isMuted;
    });
    setActiveCallState({ ...activeCallState, isMuted });
  };

  const toggleVideo = () => {
    if (!activeCallState) return;
    const isVideoOff = !activeCallState.isVideoOff;
    activeCallState.localStream?.getVideoTracks().forEach(track => {
      track.enabled = !isVideoOff;
    });
    setActiveCallState({ ...activeCallState, isVideoOff });
  };

  const forwardMessage = async (targetChatId: string) => {
    if (!user || !messageToForward) return;

    const forwardedMessageData = {
      chatId: targetChatId,
      senderId: user.uid,
      senderName: currentUserProfile?.displayName || 'Unknown',
      content: messageToForward.content,
      type: messageToForward.type,
      createdAt: serverTimestamp(),
      forwardedFrom: messageToForward.senderId,
      readBy: [user.uid],
      deliveredTo: [user.uid]
    };

    try {
      await addDoc(collection(db, 'chats', targetChatId, 'messages'), forwardedMessageData);
      
      // Update last message in the target chat
      await updateDoc(doc(db, 'chats', targetChatId), {
        lastMessage: messageToForward.type === 'text' ? messageToForward.content : `Forwarded ${messageToForward.type}`,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
        lastMessageReadBy: [user.uid]
      });

      setIsForwardModalOpen(false);
      setMessageToForward(null);
      
      // If we are in the active chat, it will update via onSnapshot
      // If not, we might want to switch to the target chat? 
      // Let's just show a success toast or something, but for now just close modal.
    } catch (error) {
      handleFirestoreError(error, 'create', `chats/${targetChatId}/messages`);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user || !activeChat) return;

    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const reactions = { ...(message.reactions || {}) };
    const userIds = reactions[emoji] || [];

    if (userIds.includes(user.uid)) {
      reactions[emoji] = userIds.filter(id => id !== user.uid);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...userIds, user.uid];
    }

    try {
      await updateDoc(doc(db, 'chats', activeChat.id, 'messages', messageId), {
        reactions
      });
      setReactionPickerMsgId(null);
    } catch (error) {
      handleFirestoreError(error, 'update', `chats/${activeChat.id}/messages/${messageId}`);
    }
  };

  const joinChannel = async (chat: Chat) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'chats', chat.id), {
        participants: [...chat.participants, user.uid],
        subscriberCount: (chat.subscriberCount || 0) + 1
      });
      setActiveChat({ ...chat, participants: [...chat.participants, user.uid], subscriberCount: (chat.subscriberCount || 0) + 1 });
      setEditingMessage(null);
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, 'update', `chats/${chat.id}`);
    }
  };

  const togglePinMessage = async (messageId: string) => {
    if (!user || !activeChat) return;
    
    const currentPinned = activeChat.pinnedMessageIds || [];
    const isPinned = currentPinned.includes(messageId);
    
    const newPinned = isPinned 
      ? currentPinned.filter(id => id !== messageId)
      : [...currentPinned, messageId];

    try {
      await updateDoc(doc(db, 'chats', activeChat.id), {
        pinnedMessageIds: newPinned
      });
      setReactionPickerMsgId(null);
    } catch (error) {
      handleFirestoreError(error, 'update', `chats/${activeChat.id}`);
    }
  };

  const deleteMessage = async (msgId: string) => {
    if (!activeChat) return;
    try {
      await deleteDoc(doc(db, 'chats', activeChat.id, 'messages', msgId));
    } catch (error) {
      handleFirestoreError(error, 'delete', `chats/${activeChat.id}/messages/${msgId}`);
    }
  };
  const handleTyping = () => {
    if (!user || !activeChat) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (!isTyping) {
      setIsTyping(true);
      updateDoc(doc(db, 'chats', activeChat.id), {
        [`typing.${user.uid}`]: true
      });
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateDoc(doc(db, 'chats', activeChat.id), {
        [`typing.${user.uid}`]: false
      });
    }, 3000);
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const sendCapturedPhoto = async () => {
    if (!capturedImage || !activeChat || !user) return;
    
    try {
      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
        chatId: activeChat.id,
        senderId: user.uid,
        senderName: user.displayName,
        senderIsPremium: currentUserProfile?.isPremium || false,
        content: capturedImage,
        createdAt: serverTimestamp(),
        type: 'image',
        readBy: [user.uid]
      });
      
      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: '📷 Photo',
        lastMessageAt: serverTimestamp()
      });
      
      setCapturedImage(null);
    } catch (error) {
      handleFirestoreError(error, 'create', `chats/${activeChat.id}/messages`);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          await sendVoiceMessage(base64Audio);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      videoChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(videoBlob);
        reader.onloadend = async () => {
          const base64Video = reader.result as string;
          await sendVideoMessage(base64Video);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsVideoRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing camera/microphone:", err);
      alert("Could not access camera/microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (isRecording || isVideoRecording)) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsVideoRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && (isRecording || isVideoRecording)) {
      mediaRecorderRef.current.onstop = null; // Prevent sending
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsVideoRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      audioChunksRef.current = [];
      videoChunksRef.current = [];
    }
  };

  const sendVideoMessage = async (videoData: string) => {
    if (!activeChat || !user) return;
    try {
      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
        chatId: activeChat.id,
        senderId: user.uid,
        senderName: user.displayName,
        senderIsPremium: currentUserProfile?.isPremium || false,
        content: videoData,
        createdAt: serverTimestamp(),
        type: 'video',
        readBy: [user.uid]
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: '📹 Video message',
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
        lastMessageReadBy: [user.uid]
      });
    } catch (error) {
      handleFirestoreError(error, 'create', `chats/${activeChat.id}/messages`);
    }
  };

  const sendVoiceMessage = async (audioData: string) => {
    if (!activeChat || !user) return;
    try {
      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
        chatId: activeChat.id,
        senderId: user.uid,
        senderName: user.displayName,
        senderIsPremium: currentUserProfile?.isPremium || false,
        content: audioData,
        createdAt: serverTimestamp(),
        type: 'audio',
        readBy: [user.uid]
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: '🎤 Voice message',
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
        lastMessageReadBy: [user.uid]
      });
    } catch (error) {
      handleFirestoreError(error, 'create', `chats/${activeChat.id}/messages`);
    }
  };

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType: operation,
      path: path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      }
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  if (isBanned) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-red-100">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield size={40} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Banned</h1>
          <p className="text-gray-600 mb-6">
            Your account has been suspended for violating our terms of service.
          </p>
          <div className="bg-red-50 rounded-2xl p-4 mb-8 text-left">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Reason</p>
            <p className="text-sm text-red-700">{banReason}</p>
          </div>
          <button 
            onClick={() => setIsBanned(false)}
            className="w-full bg-gray-900 text-white py-3 rounded-2xl font-semibold hover:bg-gray-800 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white text-emerald-600">
        <div className="animate-pulse text-2xl font-bold">MasterGram</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-gray-900 p-4">
        <div className="w-24 h-24 bg-emerald-600 rounded-full flex items-center justify-center mb-8 shadow-xl">
          <MessageSquare size={48} className="text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-2">MasterGram</h1>
        <p className="text-gray-500 mb-8 text-center max-w-md">
          The world's fastest messaging app. It is free and secure.
        </p>
        <button 
          onClick={handleLogin}
          disabled={isLoggingIn}
          className={cn(
            "bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-medium transition-all shadow-lg hover:shadow-emerald-600/20 flex items-center gap-3",
            isLoggingIn && "opacity-70 cursor-not-allowed"
          )}
        >
          {isLoggingIn ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Connecting...
            </>
          ) : (
            'Start Messaging'
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-white text-gray-900 overflow-hidden font-sans">
      {/* Connection Error Banner */}
      {connectionError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-red-500 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <div className="bg-white/20 p-1 rounded-full">
            <MoreVertical className="rotate-90" size={16} />
          </div>
          <p className="text-sm font-medium">{connectionError}</p>
          <button onClick={() => window.location.reload()} className="underline text-xs ml-2 hover:text-white/80">Retry</button>
        </div>
      )}

      {/* Sidebar */}
      <div className={cn(
        "w-full md:w-[400px] border-r border-gray-200 flex flex-col transition-all relative",
        (activeChat || (activeSidebarTab === 'settings' && showSettingsContentOnMobile)) ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 flex items-center gap-4 bg-white border-b border-gray-100">
          <div className="relative group">
            <div className="relative">
              <img 
                src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                className="w-10 h-10 rounded-full cursor-pointer border-2 border-emerald-500"
                alt="Profile"
              />
              {user.isPremium && (
                <div className="absolute -bottom-1 -right-1">
                  <PremiumBadge />
                </div>
              )}
            </div>
            <div className="absolute top-12 left-0 bg-white border border-gray-200 rounded-lg shadow-xl hidden group-hover:block z-50 p-2 min-w-[180px] animate-in fade-in slide-in-from-top-2 duration-200">
              <button onClick={() => { setActiveSidebarTab('settings'); setActiveSettingsSection('profile'); setActiveChat(null); }} className="flex items-center gap-3 w-full p-3 hover:bg-emerald-50 rounded-xl text-gray-700 transition-colors group/item">
                <div className="bg-emerald-100 p-2 rounded-lg group-hover/item:bg-emerald-200 transition-colors">
                  <UserIcon size={16} className="text-emerald-600" />
                </div>
                <span className="font-medium">My Profile</span>
              </button>
              <button onClick={() => { setActiveSidebarTab('settings'); setActiveChat(null); }} className="flex items-center gap-3 w-full p-3 hover:bg-emerald-50 rounded-xl text-gray-700 transition-colors group/item">
                <div className="bg-emerald-100 p-2 rounded-lg group-hover/item:bg-emerald-200 transition-colors">
                  <Settings size={16} className="text-emerald-600" />
                </div>
                <span className="font-medium">Settings</span>
              </button>
              <button onClick={() => setIsGroupModalOpen(true)} className="flex items-center gap-3 w-full p-3 hover:bg-emerald-50 rounded-xl text-gray-700 transition-colors group/item">
                <div className="bg-emerald-100 p-2 rounded-lg group-hover/item:bg-emerald-200 transition-colors">
                  <Plus size={16} className="text-emerald-600" />
                </div>
                <span className="font-medium">New Group</span>
              </button>
              <button onClick={() => setIsChannelModalOpen(true)} className="flex items-center gap-3 w-full p-3 hover:bg-emerald-50 rounded-xl text-gray-700 transition-colors group/item">
                <div className="bg-emerald-100 p-2 rounded-lg group-hover/item:bg-emerald-200 transition-colors">
                  <Megaphone size={16} className="text-emerald-600" />
                </div>
                <span className="font-medium">New Channel</span>
              </button>
              <div className="h-px bg-gray-100 my-2" />
              <button onClick={handleLogout} className="flex items-center gap-3 w-full p-3 hover:bg-red-50 rounded-xl text-red-500 transition-colors group/item">
                <div className="bg-red-100 p-2 rounded-lg group-hover/item:bg-red-200 transition-colors">
                  <LogOut size={16} />
                </div>
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                ref={searchInputRef}
                placeholder="Search"
                value={searchQuery}
                onChange={handleSearch}
                className="w-full bg-gray-100 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-gray-900"
              />
            </div>
            <button 
              onClick={openAiAssistantChat}
              className="p-2 bg-emerald-100 text-emerald-600 rounded-full hover:bg-emerald-200 transition-colors shadow-sm flex items-center gap-2 px-3"
              title="Customer Service AI"
            >
              <Bot size={20} />
              <span className="text-xs font-semibold hidden lg:inline">Support</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isSearching ? (
            <div className="p-2">
              {searchResults.length === 0 && channelSearchResults.length === 0 && (
                <div className="text-center text-gray-500 mt-8">No results found</div>
              )}
              
              {searchResults.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase px-4 py-2">Users</h3>
                  {searchResults.map(profile => (
                    <div 
                      key={profile.uid}
                      onClick={() => startChat(profile)}
                      className="flex items-center gap-4 p-3 hover:bg-gray-100 cursor-pointer rounded-xl mx-2 transition-colors"
                    >
                      <img src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`} className="w-12 h-12 rounded-full" alt="" />
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-1.5">
                          {profile.displayName}
                          {profile.status === 'online' && (
                            <span className="w-2 h-2 bg-emerald-500 rounded-full border border-white shadow-sm flex-shrink-0" />
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{profile.status || 'offline'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {channelSearchResults.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase px-4 py-2">Channels</h3>
                  {channelSearchResults.map(channel => (
                    <div 
                      key={channel.id}
                      onClick={() => {
                        setActiveChat(channel);
                        setIsSearching(false);
                        setSearchQuery('');
                        setActiveSidebarTab('all');
                        setEditingMessage(null);
                        setNewMessage('');
                      }}
                      className="flex items-center gap-4 p-3 hover:bg-gray-100 cursor-pointer rounded-xl mx-2 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                        <Megaphone size={24} />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{channel.name}</div>
                        <div className="text-xs text-gray-500">{channel.subscriberCount || 0} subscribers</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeSidebarTab === 'settings' ? (
            <div className="p-2 space-y-1">
              <div className="px-4 py-6 flex flex-col items-center border-b border-gray-100 mb-2">
                <div className="relative mb-4">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    className="w-20 h-20 rounded-full border-4 border-emerald-500 shadow-lg"
                    alt="Profile"
                  />
                  {currentUserProfile?.isPremium && (
                    <div className="absolute -bottom-1 -right-1 scale-150">
                      <PremiumBadge />
                    </div>
                  )}
                </div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  {userDisplayName || user.displayName}
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white shadow-sm" />
                </h2>
                <p className="text-sm text-gray-500">@{userUsername || 'username'}</p>
              </div>

              <button 
                onClick={() => {
                  setActiveSettingsSection('profile');
                  setShowSettingsContentOnMobile(true);
                }}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                  activeSettingsSection === 'profile' ? "bg-emerald-50 text-emerald-600" : "hover:bg-gray-100 text-gray-700"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg",
                  activeSettingsSection === 'profile' ? "bg-emerald-100" : "bg-gray-100"
                )}>
                  <UserIcon size={20} />
                </div>
                <span className="font-medium">Edit Profile</span>
                <ChevronRight size={16} className="ml-auto opacity-30" />
              </button>

              <button 
                onClick={() => {
                  setActiveSettingsSection('notifications');
                  setShowSettingsContentOnMobile(true);
                }}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                  activeSettingsSection === 'notifications' ? "bg-emerald-50 text-emerald-600" : "hover:bg-gray-100 text-gray-700"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg",
                  activeSettingsSection === 'notifications' ? "bg-emerald-100" : "bg-gray-100"
                )}>
                  <Bell size={20} />
                </div>
                <span className="font-medium">Notifications</span>
                <ChevronRight size={16} className="ml-auto opacity-30" />
              </button>

              <button 
                onClick={() => {
                  setActiveSettingsSection('privacy');
                  setShowSettingsContentOnMobile(true);
                }}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                  activeSettingsSection === 'privacy' ? "bg-emerald-50 text-emerald-600" : "hover:bg-gray-100 text-gray-700"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg",
                  activeSettingsSection === 'privacy' ? "bg-emerald-100" : "bg-gray-100"
                )}>
                  <Shield size={20} />
                </div>
                <span className="font-medium">Privacy & Security</span>
                <ChevronRight size={16} className="ml-auto opacity-30" />
              </button>

              <button 
                onClick={() => {
                  setActiveSettingsSection('appearance');
                  setShowSettingsContentOnMobile(true);
                }}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                  activeSettingsSection === 'appearance' ? "bg-emerald-50 text-emerald-600" : "hover:bg-gray-100 text-gray-700"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg",
                  activeSettingsSection === 'appearance' ? "bg-emerald-100" : "bg-gray-100"
                )}>
                  <Palette size={20} />
                </div>
                <span className="font-medium">Appearance</span>
                <ChevronRight size={16} className="ml-auto opacity-30" />
              </button>

              <button 
                onClick={() => {
                  setActiveSettingsSection('language');
                  setShowSettingsContentOnMobile(true);
                }}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                  activeSettingsSection === 'language' ? "bg-emerald-50 text-emerald-600" : "hover:bg-gray-100 text-gray-700"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg",
                  activeSettingsSection === 'language' ? "bg-emerald-100" : "bg-gray-100"
                )}>
                  <Globe size={20} />
                </div>
                <span className="font-medium">Language</span>
                <ChevronRight size={16} className="ml-auto opacity-30" />
              </button>

              <button 
                onClick={() => {
                  setActiveSettingsSection('devices');
                  setShowSettingsContentOnMobile(true);
                }}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                  activeSettingsSection === 'devices' ? "bg-emerald-50 text-emerald-600" : "hover:bg-gray-100 text-gray-700"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg",
                  activeSettingsSection === 'devices' ? "bg-emerald-100" : "bg-gray-100"
                )}>
                  <Smartphone size={20} />
                </div>
                <span className="font-medium">Devices</span>
                <ChevronRight size={16} className="ml-auto opacity-30" />
              </button>

              <div className="h-px bg-gray-100 my-4 mx-4" />

              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-red-50 text-red-500 transition-all"
              >
                <div className="p-2 bg-red-100 rounded-lg">
                  <LogOut size={20} />
                </div>
                <span className="font-medium">Logout</span>
              </button>
            </div>
          ) : (
            <div className="p-2">
              {activeSidebarTab === 'groups' && (
                <div className="px-4 py-3 flex items-center justify-between group/header">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Groups</h2>
                  <button 
                    onClick={() => setIsGroupModalOpen(true)}
                    className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                    title="Create New Group"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              )}
              {activeSidebarTab === 'channels' && (
                <div className="px-4 py-3 flex items-center justify-between group/header">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Channels</h2>
                  <button 
                    onClick={() => setIsChannelModalOpen(true)}
                    className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                    title="Create New Channel"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              )}
              {chats
                .filter(chat => {
                  if (activeSidebarTab === 'groups') return chat.type === 'group';
                  if (activeSidebarTab === 'channels') return chat.type === 'channel';
                  return true;
                })
                .map((chat, index, filteredChats) => {
                  const profile = chat.participantProfiles?.[0];
                  const isAi = chat.participants.includes(AI_ASSISTANT_UID);
                  const showPinnedHeader = index === 0 && isAi;
                  const showAllChatsHeader = index > 0 && filteredChats[index-1].participants.includes(AI_ASSISTANT_UID) && !isAi;
                  
                  return (
                    <React.Fragment key={chat.id}>
                      {showPinnedHeader && (
                        <div className="px-4 py-2 text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                          <Pin size={10} /> Pinned
                        </div>
                      )}
                      {showAllChatsHeader && (
                        <div className="px-4 py-2 mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          All Chats
                        </div>
                      )}
                      <div 
                        onClick={() => {
                          setActiveChat(chat);
                          setActiveSidebarTab('all');
                          setEditingMessage(null);
                          setNewMessage('');
                        }}
                        className={cn(
                          "flex items-center gap-4 p-3 cursor-pointer rounded-xl mx-2 transition-all",
                          activeChat?.id === chat.id ? "bg-emerald-50" : "hover:bg-gray-100"
                        )}
                      >
                        <img 
                          src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.id}`} 
                          className="w-14 h-14 rounded-full" 
                          alt="" 
                        />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline">
                              <div className="flex items-center gap-1 overflow-hidden">
                                {chat.participants.includes(AI_ASSISTANT_UID) && <Pin size={14} className="text-emerald-600 flex-shrink-0" />}
                                {chat.name === 'Saved Messages' && <Bookmark size={14} className="text-emerald-600 flex-shrink-0" />}
                                {chat.type === 'group' && <Plus size={14} className="text-emerald-600 flex-shrink-0" />}
                                {chat.type === 'channel' && <Megaphone size={14} className="text-emerald-600 flex-shrink-0" />}
                                <h3 className={cn(
                                  "font-semibold truncate flex items-center gap-1.5",
                                  activeChat?.id === chat.id ? "text-emerald-900" : "text-gray-900"
                                )}>
                                  {chat.name || profile?.displayName || 'Chat'}
                                  {chat.type === 'private' && profile?.status === 'online' && (
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full border border-white shadow-sm flex-shrink-0" />
                                  )}
                                  {profile?.isPremium && <PremiumBadge />}
                                </h3>
                              </div>
                              <div className="flex items-center gap-1">
                                {chat.lastMessageSenderId === user?.uid && (
                                  <div className="flex-shrink-0">
                                    {chat.lastMessageReadBy && chat.lastMessageReadBy.length > 1 ? (
                                      <CheckCheck size={14} className="text-emerald-500" />
                                    ) : (
                                      <Check size={14} className="text-gray-400" />
                                    )}
                                  </div>
                                )}
                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                  {chat.lastMessageAt && format(chat.lastMessageAt.toDate(), 'HH:mm')}
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                              <p className={cn(
                                "text-sm truncate flex-1",
                                chat.lastMessageSenderId !== user?.uid && (!chat.lastMessageReadBy || !chat.lastMessageReadBy.includes(user?.uid))
                                  ? "text-gray-900 font-medium"
                                  : "text-gray-500"
                              )}>
                                {chat.lastMessage || 'No messages yet'}
                              </p>
                              {chat.lastMessageSenderId !== user?.uid && (!chat.lastMessageReadBy || !chat.lastMessageReadBy.includes(user?.uid)) && (
                                <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
                              )}
                            </div>
                          </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              {chats.length === 0 && (
                <div className="text-center text-gray-500 mt-20">
                  <div className="mb-4 flex justify-center">
                    <MessageSquare size={48} className="opacity-20" />
                  </div>
                  <p>No chats yet. Search for someone to start messaging!</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="absolute bottom-20 right-6 z-10 group/fab">
          <div className="absolute bottom-full right-0 mb-4 flex flex-col gap-3 opacity-0 translate-y-4 pointer-events-none group-hover/fab:opacity-100 group-hover/fab:translate-y-0 group-hover/fab:pointer-events-auto transition-all duration-300">
            <button 
              onClick={() => setIsChannelModalOpen(true)}
              className="bg-white text-emerald-600 w-12 h-12 rounded-full flex items-center justify-center shadow-xl hover:bg-emerald-50 transition-colors group/item"
              title="New Channel"
            >
              <Megaphone size={20} />
              <span className="absolute right-full mr-3 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/item:opacity-100 transition-opacity whitespace-nowrap">New Channel</span>
            </button>
            <button 
              onClick={() => setIsGroupModalOpen(true)}
              className="bg-white text-emerald-600 w-12 h-12 rounded-full flex items-center justify-center shadow-xl hover:bg-emerald-50 transition-colors group/item"
              title="New Group"
            >
              <Users size={20} />
              <span className="absolute right-full mr-3 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/item:opacity-100 transition-opacity whitespace-nowrap">New Group</span>
            </button>
            <button 
              onClick={() => { focusSearch(); setActiveSidebarTab('all'); }}
              className="bg-white text-emerald-600 w-12 h-12 rounded-full flex items-center justify-center shadow-xl hover:bg-emerald-50 transition-colors group/item"
              title="New Chat"
            >
              <MessageSquare size={20} />
              <span className="absolute right-full mr-3 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/item:opacity-100 transition-opacity whitespace-nowrap">New Chat</span>
            </button>
          </div>
          <button 
            onClick={() => {
              if (activeSidebarTab === 'groups') setIsGroupModalOpen(true);
              else if (activeSidebarTab === 'channels') setIsChannelModalOpen(true);
              else focusSearch();
            }}
            className="bg-emerald-600 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
          >
            <Plus size={28} className="text-white group-hover/fab:rotate-45 transition-transform" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-t border-gray-100 bg-white">
          <button 
            onClick={() => setActiveSidebarTab('all')}
            className={cn(
              "flex-1 flex flex-col items-center py-2 transition-colors",
              activeSidebarTab === 'all' ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <MessageSquare size={20} />
            <span className="text-[10px] mt-1 font-medium uppercase tracking-wider">All</span>
          </button>
          <button 
            onClick={() => setActiveSidebarTab('groups')}
            className={cn(
              "flex-1 flex flex-col items-center py-2 transition-colors",
              activeSidebarTab === 'groups' ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Users size={20} />
            <span className="text-[10px] mt-1 font-medium uppercase tracking-wider">Groups</span>
          </button>
          <button 
            onClick={() => setActiveSidebarTab('channels')}
            className={cn(
              "flex-1 flex flex-col items-center py-2 transition-colors",
              activeSidebarTab === 'channels' ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Megaphone size={20} />
            <span className="text-[10px] mt-1 font-medium uppercase tracking-wider">Channels</span>
          </button>
          <button 
            onClick={() => {
              setActiveSidebarTab('settings');
              setActiveChat(null);
              setShowSettingsContentOnMobile(false);
            }}
            className={cn(
              "flex-1 flex flex-col items-center py-2 transition-colors",
              activeSidebarTab === 'settings' ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Settings size={20} />
            <span className="text-[10px] mt-1 font-medium uppercase tracking-wider">Settings</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 flex flex-col h-full overflow-hidden bg-white transition-all",
        (activeChat || (activeSidebarTab === 'settings' && showSettingsContentOnMobile)) ? "flex" : "hidden md:flex"
      )}>
        {activeSidebarTab === 'settings' && !activeChat ? (
          <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-y-auto">
            <div className="h-16 border-b border-gray-100 flex items-center px-4 bg-white sticky top-0 z-20 md:hidden">
              <button 
                onClick={() => setShowSettingsContentOnMobile(false)} 
                className="text-gray-500 hover:text-emerald-600 flex items-center gap-2"
              >
                <ArrowLeft size={24} />
                <span className="font-medium">Back to Settings</span>
              </button>
            </div>
            <div className="max-w-2xl mx-auto w-full p-4 md:p-8">
              {activeSettingsSection === 'profile' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold mb-6">Edit Profile</h2>
                  
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={userDisplayName}
                            onChange={(e) => setUserDisplayName(e.target.value)}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="Your name"
                          />
                          <button 
                            onClick={() => updateProfile({ displayName: userDisplayName })}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            Save
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                            <input 
                              type="text" 
                              value={userUsername}
                              onChange={(e) => setUserUsername(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              placeholder="username"
                            />
                          </div>
                          <button 
                            onClick={() => updateProfile({ username: userUsername })}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            Save
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <div className="flex gap-2">
                          <input 
                            type="tel" 
                            value={userPhoneNumber}
                            onChange={(e) => setUserPhoneNumber(e.target.value)}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="+1 234 567 890"
                          />
                          <button 
                            onClick={() => updateProfile({ phoneNumber: userPhoneNumber })}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            Save
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                        <textarea 
                          value={userBio}
                          onChange={(e) => setUserBio(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                          placeholder="Tell us about yourself..."
                        />
                        <div className="flex justify-end mt-2">
                          <button 
                            onClick={() => updateProfile({ bio: userBio })}
                            className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            Update Bio
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="font-bold mb-4">Telegram Premium</h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white">
                          <Star size={20} />
                        </div>
                        <div>
                          <div className="font-medium">Premium Features</div>
                          <div className="text-xs text-gray-500">Exclusive badges, stickers and more</div>
                        </div>
                      </div>
                      {user.isPremium ? (
                        <span className="bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-xs font-bold">ACTIVE</span>
                      ) : (
                        <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors">
                          SUBSCRIBE
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsSection === 'notifications' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold mb-6">Notifications</h2>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">Show Notifications</div>
                        <div className="text-xs text-gray-500">Receive alerts for new messages</div>
                      </div>
                      <button 
                        onClick={() => setIsNotificationsEnabled(!isNotificationsEnabled)}
                        className={cn(
                          "w-12 h-6 rounded-full transition-colors relative",
                          isNotificationsEnabled ? "bg-emerald-500" : "bg-gray-300"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          isNotificationsEnabled ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">Message Preview</div>
                        <div className="text-xs text-gray-500">Show message text in notifications</div>
                      </div>
                      <button className="w-12 h-6 bg-emerald-500 rounded-full relative">
                        <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full" />
                      </button>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">Sound</div>
                        <div className="text-xs text-gray-500">Play sound for new messages</div>
                      </div>
                      <button className="w-12 h-6 bg-emerald-500 rounded-full relative">
                        <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsSection === 'privacy' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold mb-6">Privacy & Security</h2>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">Two-Step Verification</div>
                        <div className="text-xs text-gray-500">{isTwoFactorEnabled ? 'On' : 'Off'}</div>
                      </div>
                      <button 
                        onClick={() => setIsTwoFactorEnabled(!isTwoFactorEnabled)}
                        className="text-emerald-600 font-medium text-sm"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">Last Seen & Online</div>
                        <div className="text-xs text-gray-500">{isLastSeenHidden ? 'Nobody' : 'Everybody'}</div>
                      </div>
                      <button 
                        onClick={() => setIsLastSeenHidden(!isLastSeenHidden)}
                        className="text-emerald-600 font-medium text-sm"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">Profile Photos</div>
                        <div className="text-xs text-gray-500">{isProfilePhotoHidden ? 'Nobody' : 'Everybody'}</div>
                      </div>
                      <button 
                        onClick={() => setIsProfilePhotoHidden(!isProfilePhotoHidden)}
                        className="text-emerald-600 font-medium text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsSection === 'appearance' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold mb-6">Appearance</h2>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="font-medium mb-4">Color Theme</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <button 
                        onClick={() => setTheme('light')}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                          theme === 'light' ? "border-emerald-500 bg-emerald-50" : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <div className="w-full h-12 bg-white border border-gray-200 rounded-lg" />
                        <span className="text-sm font-medium">Light</span>
                      </button>
                      <button 
                        onClick={() => setTheme('dark')}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                          theme === 'dark' ? "border-emerald-500 bg-emerald-50" : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <div className="w-full h-12 bg-gray-900 rounded-lg" />
                        <span className="text-sm font-medium">Dark</span>
                      </button>
                      <button 
                        onClick={() => setTheme('system')}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                          theme === 'system' ? "border-emerald-500 bg-emerald-50" : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <div className="w-full h-12 bg-gradient-to-r from-white to-gray-900 border border-gray-200 rounded-lg" />
                        <span className="text-sm font-medium">System</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsSection === 'devices' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold mb-6">Devices</h2>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="font-medium mb-4">This Device</h3>
                    <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl">
                      <Monitor className="text-emerald-600" size={24} />
                      <div>
                        <div className="font-medium">Chrome on Windows</div>
                        <div className="text-xs text-gray-500">Online · Current Device</div>
                      </div>
                    </div>
                    
                    <h3 className="font-medium mt-8 mb-4">Active Sessions</h3>
                    <div className="text-center py-8 text-gray-500">
                      <Monitor size={48} className="mx-auto opacity-20 mb-2" />
                      <p>No other active sessions found</p>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsSection === 'language' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold mb-6">Language</h2>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
                    {['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian', 'Chinese', 'Japanese', 'Korean'].map(lang => (
                      <button 
                        key={lang}
                        onClick={() => setLanguage(lang)}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-medium">{lang}</span>
                        {language === lang && <Check size={20} className="text-emerald-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-gray-100 flex items-center justify-between px-4 bg-white/90 backdrop-blur-md sticky top-0 z-20">
              <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                <button onClick={() => setActiveChat(null)} className="md:hidden text-gray-500 hover:text-emerald-600 flex-shrink-0">
                  <ArrowLeft size={24} />
                </button>
                <img 
                  src={activeChat.participantProfiles?.[0]?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeChat.id}`} 
                  className="w-10 h-10 rounded-full border border-gray-100 flex-shrink-0" 
                  alt="" 
                />
                <div className="overflow-hidden">
                  <h3 className="font-bold leading-tight text-gray-900 flex items-center truncate gap-1.5">
                    {activeChat.name === 'Saved Messages' && <Bookmark size={18} className="text-emerald-600 mr-2 flex-shrink-0" />}
                    <span className="truncate">{activeChat.name || activeChat.participantProfiles?.[0]?.displayName || 'Chat'}</span>
                    {activeChat.type === 'private' && activeChat.participantProfiles?.[0]?.status === 'online' && (
                      <span className="w-2 h-2 bg-emerald-500 rounded-full border border-white shadow-sm flex-shrink-0" />
                    )}
                    {activeChat.participantProfiles?.[0]?.isPremium && <div className="ml-1 flex-shrink-0"><PremiumBadge /></div>}
                  </h3>
                  <span className="text-xs text-emerald-600 font-medium truncate block">
                    {activeChat.type === 'channel' ? (
                      `${activeChat.subscriberCount || 0} subscribers`
                    ) : (
                      (() => {
                        const typingUsers = Object.entries(activeChat.typing || {})
                          .filter(([uid, isTyping]) => uid !== user.uid && isTyping);
                        
                        if (typingUsers.length > 0 || isAiResponding) {
                          if (activeChat.type === 'private') return 'typing...';
                          return 'someone is typing...';
                        }
                        
                        return activeChat.participantProfiles?.[0]?.status === 'online' ? 'online' : 'last seen recently';
                      })()
                    )}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 md:gap-6 text-gray-400 flex-shrink-0">
                {activeChat.type === 'group' && (
                  <>
                    <Phone 
                      size={20} 
                      className="cursor-pointer hover:text-emerald-600 hidden sm:block" 
                      onClick={() => startCall('audio')}
                    />
                    <Video 
                      size={20} 
                      className="cursor-pointer hover:text-emerald-600 hidden sm:block" 
                      onClick={() => startCall('video')}
                    />
                  </>
                )}
                <Sparkles 
                  size={20} 
                  className="cursor-pointer text-emerald-500 hover:text-emerald-600 animate-pulse" 
                  onClick={openAiAssistantChat}
                  title="Ask Customer Service AI"
                />
                <Video 
                  size={20} 
                  className="cursor-pointer hover:text-emerald-600 hidden sm:block" 
                  onClick={() => startCall('video')}
                />
                <Phone 
                  size={20} 
                  className="cursor-pointer hover:text-emerald-600 hidden sm:block" 
                  onClick={() => startCall('audio')}
                />
                <Search 
                  size={20} 
                  className="cursor-pointer hover:text-emerald-600" 
                  onClick={() => setIsMessageSearchOpen(!isMessageSearchOpen)}
                />
                <MoreVertical 
                  size={20} 
                  className="cursor-pointer hover:text-emerald-600" 
                  onClick={() => setIsChatInfoOpen(!isChatInfoOpen)}
                />
              </div>
            </div>

            {/* Active Call Banner */}
            {activeChat.activeCall && !activeCallState && (
              <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 flex items-center justify-between animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white animate-pulse">
                    {activeChat.activeCall.type === 'video' ? <Video size={16} /> : <Phone size={16} />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-emerald-900">Active {activeChat.activeCall.type} call</div>
                    <div className="text-xs text-emerald-600">{activeChat.activeCall.participants.length} people in call</div>
                  </div>
                </div>
                <button 
                  onClick={joinCall}
                  className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors"
                >
                  Join
                </button>
              </div>
            )}

            {/* Pinned Messages Bar */}
            {activeChat.pinnedMessageIds && activeChat.pinnedMessageIds.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 px-4 py-2 flex items-center justify-between sticky top-16 z-10 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => {
                  const lastPinnedId = activeChat.pinnedMessageIds![activeChat.pinnedMessageIds!.length - 1];
                  const element = document.getElementById(lastPinnedId);
                  if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-0.5 h-8 bg-emerald-500 rounded-full" />
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-bold text-emerald-600">Pinned Message</span>
                    <span className="text-sm text-gray-600 truncate">
                      {(() => {
                        const lastPinnedId = activeChat.pinnedMessageIds![activeChat.pinnedMessageIds!.length - 1];
                        const msg = messages.find(m => m.id === lastPinnedId);
                        if (!msg) return 'Pinned message';
                        return msg.type === 'text' ? msg.content : msg.type === 'image' ? '📷 Photo' : msg.type === 'audio' ? '🎤 Voice message' : msg.type === 'video' ? '📹 Video message' : '📎 File';
                      })()}
                    </span>
                  </div>
                </div>
                <Pin size={16} className="text-emerald-500 flex-shrink-0" />
              </div>
            )}

            {/* Message Search Bar */}
            {isMessageSearchOpen && (
              <div className="bg-gray-50 p-2 flex items-center gap-2 border-b border-gray-200">
                <Search size={16} className="text-gray-500 ml-2" />
                <input 
                  type="text"
                  placeholder="Search messages..."
                  value={messageSearchQuery}
                  onChange={(e) => setMessageSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent py-1 px-2 focus:outline-none text-sm text-gray-900"
                />
                <button onClick={() => { setIsMessageSearchOpen(false); setMessageSearchQuery(''); }} className="text-xs text-gray-500 hover:text-emerald-600 px-2">Close</button>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-fixed">
              {messages
                .filter(msg => msg.content.toLowerCase().includes(messageSearchQuery.toLowerCase()))
                .map((msg, idx) => {
                const isMine = msg.senderId === user.uid;
                const showAvatar = idx === 0 || messages[idx - 1].senderId !== msg.senderId;
                
                return (
                  <div key={msg.id} id={msg.id} className={cn(
                    "flex items-end gap-2 mb-1 transition-all duration-300",
                    isMine ? "flex-row-reverse" : "flex-row",
                    activeChat.pinnedMessageIds?.includes(msg.id) && "bg-emerald-50/40 py-2 px-1 rounded-xl ring-1 ring-emerald-100/50"
                  )}>
                    {!isMine && (
                      <div className="w-8 h-8 flex-shrink-0">
                        {showAvatar && (
                          <img 
                            src={activeChat.type === 'private' ? activeChat.participantProfiles?.[0]?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`} 
                            className="w-8 h-8 rounded-full" 
                            alt="" 
                          />
                        )}
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[70%] relative group",
                      isMine ? "flex flex-col items-end" : "flex flex-col items-start"
                    )}>
                      <div className={cn(
                        "px-3 py-2 rounded-2xl relative shadow-sm",
                        isMine ? "bg-emerald-600 text-white rounded-br-none" : "bg-white text-gray-900 border border-gray-100 rounded-bl-none"
                      )}
                      onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)}
                      >
                        {/* Hover Action Button */}
                        <button 
                          className={cn(
                            "absolute opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-md text-gray-500 hover:text-emerald-600 z-10",
                            isMine ? "right-full mr-2 top-0" : "left-full ml-2 top-0"
                          )}
                          onClick={(e) => { e.stopPropagation(); setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id); }}
                        >
                          <Smile size={16} />
                        </button>
                        {msg.forwardedFrom && (
                          <div className={cn(
                            "text-[10px] italic mb-1 flex items-center gap-1",
                            isMine ? "text-emerald-100/70" : "text-gray-400"
                          )}>
                            <Share2 size={10} />
                            Forwarded
                          </div>
                        )}
                        {activeChat.type !== 'private' && !isMine && msg.senderName && (
                          <div className="text-[13px] font-bold text-emerald-600 mb-1 flex items-center gap-1">
                            {msg.senderName}
                            {msg.senderIsPremium && <PremiumBadge />}
                          </div>
                        )}
                        {msg.type === 'image' ? (
                          <img src={msg.content} alt="Sent photo" className="max-w-full rounded-lg mb-1" />
                        ) : msg.type === 'audio' ? (
                          <VoiceMessage src={msg.content} isMine={isMine} />
                        ) : msg.type === 'video' ? (
                          <VideoMessage src={msg.content} isMine={isMine} />
                        ) : msg.type === 'file' ? (
                          <div className={cn(
                            "flex items-center gap-3 p-2 rounded-xl border min-w-[200px]",
                            isMine ? "bg-emerald-700/50 border-emerald-500/30" : "bg-gray-50 border-gray-100"
                          )}>
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              isMine ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-600"
                            )}>
                              <FileText size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={cn(
                                "text-sm font-bold truncate",
                                isMine ? "text-white" : "text-gray-900"
                              )}>
                                {msg.fileName || 'Document'}
                              </div>
                              <div className={cn(
                                "text-[10px]",
                                isMine ? "text-emerald-100/70" : "text-gray-500"
                              )}>
                                {msg.fileSize ? `${(msg.fileSize / 1024).toFixed(1)} KB` : 'Unknown size'}
                              </div>
                            </div>
                            <a 
                              href={msg.content} 
                              download={msg.fileName || 'file'}
                              className={cn(
                                "p-2 rounded-full transition-colors",
                                isMine ? "hover:bg-white/10 text-emerald-100" : "hover:bg-gray-200 text-gray-500"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download size={18} />
                            </a>
                          </div>
                        ) : (
                          <p className="text-[15px] leading-relaxed break-words pr-14">
                            {msg.content}
                          </p>
                        )}
                        <div className="absolute bottom-1 right-2 flex items-center gap-1">
                          {msg.isEdited && (
                            <span className={cn(
                              "text-[9px] font-medium uppercase tracking-wider",
                              isMine ? "text-emerald-100/60" : "text-gray-400/60"
                            )}>
                              edited
                            </span>
                          )}
                          <span className={cn(
                            "text-[10px]",
                            isMine ? "text-emerald-100/80" : "text-gray-400/80"
                          )}>
                            {msg.createdAt && format(msg.createdAt.toDate(), 'HH:mm')}
                          </span>
                          {isMine && (
                            <div className="flex items-center gap-0.5">
                              {msg.readBy && msg.readBy.length > 1 ? (
                                <div className="flex items-center">
                                  <CheckCheck size={12} className="text-blue-300" />
                                  {activeChat.type === 'group' && (
                                    <span className="text-[9px] text-blue-200 leading-none ml-0.5">
                                      {msg.readBy.length - 1}
                                    </span>
                                  )}
                                </div>
                              ) : msg.deliveredTo && msg.deliveredTo.length > 1 ? (
                                <CheckCheck size={12} className="text-emerald-100/60" />
                              ) : (
                                <Check size={12} className="text-emerald-100/60" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Reaction Picker & Message Actions */}
                        {reactionPickerMsgId === msg.id && (
                          <div className={cn(
                            "absolute bottom-full mb-2 z-20 bg-white border border-gray-100 shadow-2xl rounded-2xl p-2 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 min-w-[200px]",
                            isMine ? "right-0" : "left-0"
                          )}>
                            <div className="flex flex-wrap items-center gap-1">
                              {['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉', '🤔', '💯'].map(emoji => (
                                <button 
                                  key={emoji}
                                  onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); }}
                                  className={cn(
                                    "hover:scale-125 transition-transform text-xl p-1.5 rounded-lg hover:bg-gray-50",
                                    msg.reactions?.[emoji]?.includes(user.uid) && "bg-emerald-50"
                                  )}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            <div className="h-px bg-gray-100 my-1" />
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); togglePinMessage(msg.id); }}
                                className={cn(
                                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-colors",
                                  activeChat.pinnedMessageIds?.includes(msg.id) 
                                    ? "text-emerald-600 bg-emerald-50" 
                                    : "text-gray-600 hover:bg-gray-50"
                                )}
                              >
                                {activeChat.pinnedMessageIds?.includes(msg.id) ? <PinOff size={16} /> : <Pin size={16} />}
                                {activeChat.pinnedMessageIds?.includes(msg.id) ? 'Unpin' : 'Pin'}
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setMessageToForward(msg); setIsForwardModalOpen(true); setReactionPickerMsgId(null); }}
                                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                              >
                                <Share2 size={16} />
                                Forward
                              </button>
                              {isMine && msg.type === 'text' && msg.createdAt && (Date.now() - msg.createdAt.toDate().getTime() < 15 * 60 * 1000) && (
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setEditingMessage(msg); 
                                    setNewMessage(msg.content);
                                    setReactionPickerMsgId(null);
                                  }}
                                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                  <Edit2 size={16} />
                                  Edit
                                </button>
                              )}
                              {isMine && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}
                                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 size={16} />
                                  Delete
                                </button>
                              )}
                              {!isMine && isUserAdmin && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}
                                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                  title="Admin Delete"
                                >
                                  <Shield size={16} />
                                  Admin Delete
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Reactions Display */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={cn(
                          "flex flex-wrap gap-1 mt-1",
                          isMine ? "justify-end" : "justify-start"
                        )}>
                          {Object.entries(msg.reactions).map(([emoji, uids]) => {
                            const userIds = uids as string[];
                            return userIds.length > 0 && (
                              <button
                                key={emoji}
                                onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); }}
                                className={cn(
                                  "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-all",
                                  userIds.includes(user.uid) 
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                                    : "bg-white border-gray-100 text-gray-600 hover:border-gray-200"
                                )}
                              >
                                <span>{emoji}</span>
                                {userIds.length > 1 && <span className="font-medium">{userIds.length}</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100">
              {editingMessage && (
                <div className="max-w-4xl mx-auto mb-2 flex items-center justify-between bg-emerald-50 p-2 rounded-xl border border-emerald-100 animate-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-1 h-8 bg-emerald-500 rounded-full" />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs font-bold text-emerald-600">Editing Message</span>
                      <span className="text-sm text-gray-600 truncate">{editingMessage.content}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setEditingMessage(null); setNewMessage(''); }}
                    className="p-1 hover:bg-emerald-100 rounded-full text-emerald-600 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
              {activeChat.type === 'channel' && !activeChat.participants.includes(user.uid) ? (
                <div className="max-w-4xl mx-auto">
                  <button 
                    onClick={() => joinChannel(activeChat)}
                    className="w-full bg-emerald-600 py-3 rounded-xl font-bold uppercase tracking-wider hover:bg-emerald-700 text-white transition-colors"
                  >
                    Join Channel
                  </button>
                </div>
              ) : activeChat.type === 'channel' && !activeChat.admins?.includes(user.uid) ? (
                <div className="max-w-4xl mx-auto text-center py-2 text-gray-500 text-sm italic">
                  Only admins can post in this channel
                </div>
              ) : (
                <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex items-center gap-3">
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl flex items-center px-4 py-1">
                    {(isRecording || isVideoRecording) ? (
                      <div className="flex-1 flex items-center gap-4 py-3 px-4">
                        <div className="flex items-center gap-2 text-red-500 animate-pulse">
                          <div className="w-2 h-2 bg-red-500 rounded-full" />
                          <span className="font-mono font-bold">
                            {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
                          </span>
                        </div>
                        <div className="flex-1 text-gray-500 text-sm">
                          Recording {isVideoRecording ? 'video' : 'voice'} message...
                        </div>
                        <button 
                          type="button" 
                          onClick={cancelRecording}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Smile className="text-gray-500 cursor-pointer hover:text-emerald-600" size={24} />
                        <input 
                          type="text"
                          placeholder="Message"
                          value={newMessage}
                          onChange={(e) => {
                            setNewMessage(e.target.value);
                            handleTyping();
                          }}
                          className="flex-1 bg-transparent py-3 px-4 focus:outline-none text-gray-900"
                        />
                        {newMessage.trim() && (
                          <button 
                            type="submit"
                            className="text-emerald-600 hover:text-emerald-700 transition-colors mr-2"
                          >
                            <Send size={20} />
                          </button>
                        )}
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          onChange={handleFileSelect}
                        />
                        <Paperclip 
                          className="text-gray-500 cursor-pointer hover:text-emerald-600" 
                          size={24} 
                          onClick={() => fileInputRef.current?.click()}
                        />
                        <Camera 
                          className="text-gray-500 cursor-pointer hover:text-emerald-600 ml-2" 
                          size={24} 
                          onClick={startCamera}
                        />
                      </>
                    )}
                  </div>
                  {(isRecording || isVideoRecording) ? (
                    <button 
                      type="button"
                      onClick={stopRecording}
                      className="bg-red-500 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform animate-pulse"
                    >
                      <Send size={22} />
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {!newMessage.trim() && (
                        <>
                          <button 
                            type="button"
                            onClick={startVideoRecording}
                            className="bg-emerald-600 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform"
                            title="Record Video Message"
                          >
                            <Video size={22} />
                          </button>
                          <button 
                            type="button"
                            onClick={startRecording}
                            className="bg-emerald-600 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform"
                            title="Record Voice Message"
                          >
                            <Mic size={22} />
                          </button>
                        </>
                      )}
                      <button 
                        type="submit"
                        disabled={!newMessage.trim() && !editingMessage}
                        className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform",
                          (!newMessage.trim() && !editingMessage) ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-600"
                        )}
                        title="Send Message"
                      >
                        {editingMessage ? <Check size={24} /> : <Send size={22} />}
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gray-50">
            <div className="bg-emerald-50 p-6 rounded-full inline-block mb-4 shadow-sm">
              <MessageSquare size={48} className="text-emerald-600 opacity-50" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Welcome to MasterGram</h3>
            <p className="text-gray-500 font-medium max-w-xs">Select a chat from the sidebar to start messaging with your friends and groups.</p>
          </div>
        )}
      </div>
      {/* Channel Modal */}
      {isChannelModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-gray-100">
            <h2 className="text-xl font-bold mb-4 text-gray-900">New Channel</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Channel Name</label>
                <input 
                  type="text"
                  placeholder="Enter channel name"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full bg-gray-50 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Description (Optional)</label>
                <textarea 
                  placeholder="What is this channel about?"
                  value={channelDescription}
                  onChange={(e) => setChannelDescription(e.target.value)}
                  className="w-full bg-gray-50 rounded-xl py-3 px-4 h-24 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-gray-900"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-medium text-gray-900">Public Channel</div>
                  <div className="text-xs text-gray-500">Anyone can find and join this channel</div>
                </div>
                <button 
                  onClick={() => setIsPublicChannel(!isPublicChannel)}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    isPublicChannel ? "bg-emerald-500" : "bg-gray-300"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    isPublicChannel ? "right-1" : "left-1"
                  )} />
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsChannelModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700">Cancel</button>
              <button 
                onClick={createChannel}
                disabled={!channelName.trim()}
                className="bg-emerald-600 px-6 py-2 rounded-xl font-medium text-white disabled:opacity-50 hover:bg-emerald-700 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-gray-100">
            <div className="flex flex-col items-center mb-6">
              <img 
                src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                className="w-24 h-24 rounded-full mb-4 border-2 border-emerald-500"
                alt=""
              />
              <h2 className="text-xl font-bold text-gray-900">{user.displayName}</h2>
              <p className="text-gray-500">{user.email}</p>
            </div>
            <div className="mb-6">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Bio</label>
              <textarea 
                value={userBio}
                onChange={(e) => setUserBio(e.target.value)}
                placeholder="Write something about yourself..."
                className="w-full bg-gray-50 rounded-xl py-3 px-4 h-24 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-gray-900"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsProfileModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700">Cancel</button>
              <button 
                onClick={updateBio}
                className="bg-emerald-600 px-6 py-2 rounded-xl font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-gray-100">
            <h2 className="text-xl font-bold mb-4 text-gray-900">New Group</h2>
            <input 
              type="text"
              placeholder="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full bg-gray-50 rounded-xl py-3 px-4 mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
            />
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">Selected Users: {selectedUsers.length}</p>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(u => (
                  <div key={u.uid} className="bg-emerald-600 px-2 py-1 rounded-full text-xs flex items-center gap-1 text-white">
                    {u.displayName}
                    <button onClick={() => setSelectedUsers(selectedUsers.filter(su => su.uid !== u.uid))} className="hover:text-emerald-200">×</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto mb-6 border-t border-gray-100 pt-4">
              {chats.filter(c => c.type === 'private').map(c => {
                const profile = c.participantProfiles?.[0];
                if (!profile) return null;
                const isSelected = selectedUsers.some(su => su.uid === profile.uid);
                return (
                  <div 
                    key={profile.uid}
                    onClick={() => {
                      if (isSelected) setSelectedUsers(selectedUsers.filter(su => su.uid !== profile.uid));
                      else setSelectedUsers([...selectedUsers, profile]);
                    }}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg cursor-pointer mb-1 transition-colors",
                      isSelected ? "bg-emerald-50" : "hover:bg-gray-50"
                    )}
                  >
                    <img src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`} className="w-8 h-8 rounded-full" alt="" />
                    <span className={cn("text-sm", isSelected ? "text-emerald-900 font-medium" : "text-gray-700")}>{profile.displayName}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsGroupModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700">Cancel</button>
              <button 
                onClick={createGroup}
                disabled={!groupName.trim() || selectedUsers.length === 0}
                className="bg-emerald-600 px-6 py-2 rounded-xl font-medium text-white disabled:opacity-50 hover:bg-emerald-700 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Chat Info Sidebar */}
      {isChatInfoOpen && activeChat && (
        <div className="w-[300px] border-l border-gray-200 bg-white flex flex-col animate-in slide-in-from-right duration-300">
          <div className="h-16 flex items-center px-4 border-b border-gray-100">
            <button onClick={() => setIsChatInfoOpen(false)} className="mr-4 text-gray-500 hover:text-emerald-600">×</button>
            <h3 className="font-bold text-gray-900">
              {activeChat.type === 'private' ? 'User Info' : activeChat.type === 'group' ? 'Group Info' : 'Channel Info'}
            </h3>
          </div>
          <div className="p-6 flex flex-col items-center text-center">
            <img 
              src={activeChat.participantProfiles?.[0]?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeChat.id}`} 
              className="w-32 h-32 rounded-full mb-4"
              alt=""
            />
            <h2 className="text-xl font-bold flex items-center gap-2">
              {activeChat.name || activeChat.participantProfiles?.[0]?.displayName || 'Chat'}
              {activeChat.type === 'private' && activeChat.participantProfiles?.[0]?.status === 'online' && (
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white shadow-sm" />
              )}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {activeChat.type === 'private' ? (activeChat.participantProfiles?.[0]?.status || 'offline') : 
               activeChat.type === 'group' ? `${activeChat.participants.length} members` : 
               `${activeChat.subscriberCount || 0} subscribers`}
            </p>
            
            <div className="w-full text-left space-y-6">
              {activeChat.description && (
                <div>
                  <label className="text-xs font-semibold text-emerald-600 uppercase block mb-1">Description</label>
                  <p className="text-sm text-gray-700">{activeChat.description}</p>
                </div>
              )}
              
              {activeChat.type === 'private' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-emerald-600 uppercase block mb-1">Bio</label>
                    <p className="text-sm text-gray-700">{(activeChat.participantProfiles?.[0] as any)?.bio || 'No bio yet'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-emerald-600 uppercase block mb-1">Username</label>
                    <p className="text-sm text-gray-700">@{activeChat.participantProfiles?.[0]?.displayName?.toLowerCase().replace(/\s/g, '_')}</p>
                  </div>
                </>
              )}

              {activeChat.admins?.includes(user.uid) && (
                <div className="pt-4 border-t border-gray-100">
                  <label className="text-xs font-semibold text-emerald-600 uppercase block mb-3">Admin Panel</label>
                  <div className="space-y-2">
                    <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
                      <Settings size={16} />
                      Edit Info
                    </button>
                    <button 
                      onClick={async () => {
                        if (confirm(`Are you sure you want to delete this ${activeChat.type}?`)) {
                          try {
                            await deleteDoc(doc(db, 'chats', activeChat.id));
                            setActiveChat(null);
                            setIsChatInfoOpen(false);
                          } catch (error) {
                            handleFirestoreError(error, 'delete', `chats/${activeChat.id}`);
                          }
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      Delete {activeChat.type === 'channel' ? 'Channel' : 'Group'}
                    </button>
                  </div>
                </div>
              )}

              {activeChat.pinnedMessageIds && activeChat.pinnedMessageIds.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-emerald-600 uppercase block mb-2">Pinned Messages</label>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {activeChat.pinnedMessageIds.map(id => {
                      const msg = messages.find(m => m.id === id);
                      if (!msg) return null;
                      return (
                        <div key={id} className="p-3 bg-gray-50 rounded-xl text-sm text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100 group"
                          onClick={() => {
                            const element = document.getElementById(id);
                            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Pinned</span>
                            <Pin size={12} className="text-emerald-400" />
                          </div>
                          <p className="line-clamp-2 italic text-gray-500">
                            {msg.type === 'text' ? msg.content : msg.type === 'image' ? '📷 Photo' : msg.type === 'audio' ? '🎤 Voice message' : msg.type === 'video' ? '📹 Video message' : '📎 File'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
          <button 
            onClick={stopCamera}
            className="absolute top-6 right-6 text-white hover:bg-white/10 p-2 rounded-full transition-colors"
          >
            <X size={32} />
          </button>
          
          <div className="relative w-full max-w-2xl aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-8 left-0 right-0 flex justify-center">
              <button 
                onClick={takePhoto}
                className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center hover:scale-110 transition-transform"
              >
                <div className="w-12 h-12 bg-white rounded-full" />
              </button>
            </div>
          </div>
          <p className="text-white mt-6 text-lg font-medium">Take a photo to send</p>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Photo Preview Modal */}
      {capturedImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Send Photo</h3>
              <button 
                onClick={() => setCapturedImage(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-4">
              <img src={capturedImage} alt="Preview" className="w-full rounded-2xl shadow-inner" />
            </div>
            <div className="p-4 bg-gray-50 flex gap-3">
              <button 
                onClick={() => setCapturedImage(null)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={sendCapturedPhoto}
                className="flex-1 py-3 px-4 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
              >
                <Send size={20} />
                Send Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Overlay */}
      {activeCallState && (
        <div className="fixed inset-0 z-[200] bg-gray-900 flex flex-col items-center justify-center p-4 md:p-8">
          <div className="absolute top-6 left-6 flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              {activeCallState.type === 'video' ? <Video size={20} /> : <Phone size={20} />}
            </div>
            <div>
              <div className="font-bold text-lg">Group Call</div>
              <div className="text-sm text-gray-400">{activeCallState.participants.length} participants</div>
            </div>
          </div>
          
          <div className="w-full max-w-6xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {/* Local Video */}
            <div className="relative bg-gray-800 rounded-2xl overflow-hidden group">
              {activeCallState.type === 'video' && !activeCallState.isVideoOff ? (
                <video 
                  ref={(el) => {
                    if (el && activeCallState.localStream) {
                      el.srcObject = activeCallState.localStream;
                    }
                  }}
                  autoPlay 
                  muted 
                  playsInline 
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <img 
                    src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                    className="w-24 h-24 rounded-full border-4 border-emerald-500"
                    alt=""
                  />
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg text-white text-xs font-bold">
                You {activeCallState.isMuted && '(Muted)'}
              </div>
            </div>
            
            {/* Remote Participants */}
            {activeCallState.participants.filter(id => id !== user?.uid).map(id => (
              <div key={id} className="relative bg-gray-800 rounded-2xl overflow-hidden group">
                {activeCallState.remoteStreams[id] ? (
                  <video 
                    ref={(el) => {
                      if (el && activeCallState.remoteStreams[id]) {
                        el.srcObject = activeCallState.remoteStreams[id];
                      }
                    }}
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <img 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`} 
                      className="w-24 h-24 rounded-full border-4 border-gray-600"
                      alt=""
                    />
                  </div>
                )}
                <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg text-white text-xs font-bold">
                  {activeChat?.participantProfiles?.find(p => p.uid === id)?.displayName || `Participant ${id.slice(0, 4)}`}
                </div>
              </div>
            ))}
          </div>
          
          {/* Call Controls */}
          <div className="mt-8 flex items-center gap-6">
            <button 
              onClick={toggleMute}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center transition-all",
                activeCallState.isMuted ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              {activeCallState.isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            
            {activeCallState.type === 'video' && (
              <button 
                onClick={toggleVideo}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center transition-all",
                  activeCallState.isVideoOff ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
                )}
              >
                {activeCallState.isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
              </button>
            )}
            
            <button 
              onClick={endCall}
              className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-all hover:scale-110"
            >
              <PhoneOff size={24} />
            </button>
          </div>
        </div>
      )}

      {/* Forward Message Modal */}
      {isForwardModalOpen && messageToForward && (
        <div className="fixed inset-0 z-[150] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Forward to...</h3>
              <button 
                onClick={() => { setIsForwardModalOpen(false); setMessageToForward(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 bg-gray-50 border-b border-gray-100">
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Message Preview</div>
              <div className="bg-white p-3 rounded-xl border border-gray-200 text-sm text-gray-600 italic line-clamp-2">
                {messageToForward.type === 'text' ? messageToForward.content : `[${messageToForward.type}]`}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Select Chat</div>
              {chats.map(chat => {
                const otherParticipant = chat.participantProfiles?.[0];
                const displayName = chat.type === 'private' ? otherParticipant?.displayName : chat.name;
                
                return (
                  <button 
                    key={chat.id}
                    onClick={() => forwardMessage(chat.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-emerald-50 transition-all group border border-transparent hover:border-emerald-100"
                  >
                    <img 
                      src={otherParticipant?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.id}`} 
                      className="w-10 h-10 rounded-full shadow-sm"
                      alt=""
                    />
                    <div className="flex-1 text-left">
                      <div className="font-bold text-gray-900 group-hover:text-emerald-900">{displayName || 'Chat'}</div>
                      <div className="text-xs text-gray-500">{chat.type}</div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-emerald-400" />
                  </button>
                );
              })}
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <button 
                onClick={() => { setIsForwardModalOpen(false); setMessageToForward(null); }}
                className="w-full py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
