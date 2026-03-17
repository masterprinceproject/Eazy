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
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
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
  Megaphone
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [channelSearchResults, setChannelSearchResults] = useState<Chat[]>([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isChatInfoOpen, setIsChatInfoOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [userBio, setUserBio] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Update user profile in Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserBio(userSnap.data().bio || '');
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
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

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
      setChats(chatList);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
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
        .map(doc => doc.data() as UserProfile)
        .filter(p => p.uid !== user?.uid);
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
      return;
    }

    // Create new chat
    const chatData = {
      participants: [user.uid, otherUser.uid],
      type: 'private',
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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !user) return;

    const msgContent = newMessage;
    setNewMessage('');

    try {
      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
        chatId: activeChat.id,
        senderId: user.uid,
        senderName: user.displayName,
        content: msgContent,
        createdAt: serverTimestamp(),
        type: 'text'
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: msgContent,
        lastMessageAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, 'create', `chats/${activeChat.id}/messages`);
    }
  };

  const createGroup = async () => {
    if (!user || !groupName.trim() || selectedUsers.length === 0) return;

    const chatData = {
      participants: [user.uid, ...selectedUsers.map(u => u.uid)],
      type: 'group',
      name: groupName,
      lastMessage: 'Group created',
      lastMessageAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, 'chats'), chatData);
      setActiveChat({ id: docRef.id, ...chatData } as Chat);
      setIsGroupModalOpen(false);
      setGroupName('');
      setSelectedUsers([]);
    } catch (error) {
      handleFirestoreError(error, 'create', 'chats');
    }
  };

  const createChannel = async () => {
    if (!user || !channelName.trim()) return;

    const channelData = {
      participants: [user.uid],
      type: 'channel',
      name: channelName,
      description: channelDescription,
      admins: [user.uid],
      subscriberCount: 1,
      lastMessage: 'Channel created',
      lastMessageAt: serverTimestamp(),
      isPublic: true
    };

    try {
      const docRef = await addDoc(collection(db, 'chats'), channelData);
      setActiveChat({ id: docRef.id, ...channelData } as Chat);
      setIsChannelModalOpen(false);
      setChannelName('');
      setChannelDescription('');
    } catch (error) {
      handleFirestoreError(error, 'create', 'chats');
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
    } catch (error) {
      handleFirestoreError(error, 'update', `chats/${chat.id}`);
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
  const deleteMessage = async (msgId: string) => {
    if (!activeChat) return;
    try {
      // For simplicity, we just delete it. In a real app, we might mark as deleted.
      // Note: Security rules must allow this.
      // await deleteDoc(doc(db, 'chats', activeChat.id, 'messages', msgId));
      // Actually, my rules don't allow delete yet. I'll stick to UI for now or update rules.
    } catch (error) {
      handleFirestoreError(error, 'delete', `chats/${activeChat.id}/messages/${msgId}`);
    }
  };
  const handleTyping = () => {
    if (!user || !activeChat) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    updateDoc(doc(db, 'chats', activeChat.id), {
      [`typing.${user.uid}`]: true
    });

    typingTimeoutRef.current = setTimeout(() => {
      updateDoc(doc(db, 'chats', activeChat.id), {
        [`typing.${user.uid}`]: false
      });
    }, 3000);
  };

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error.message,
      operationType: operation,
      path: path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email
      }
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white text-emerald-600">
        <div className="animate-pulse text-2xl font-bold">TeleClone</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-gray-900 p-4">
        <div className="w-24 h-24 bg-emerald-600 rounded-full flex items-center justify-center mb-8 shadow-xl">
          <MessageSquare size={48} className="text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-2">TeleClone</h1>
        <p className="text-gray-500 mb-8 text-center max-w-md">
          The world's fastest messaging app. It is free and secure.
        </p>
        <button 
          onClick={handleLogin}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-medium transition-all shadow-lg hover:shadow-emerald-600/20 flex items-center gap-3"
        >
          Start Messaging
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
        "w-full md:w-[400px] border-r border-gray-200 flex flex-col transition-all",
        activeChat ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 flex items-center gap-4 bg-white border-b border-gray-100">
          <div className="relative group">
            <img 
              src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
              className="w-10 h-10 rounded-full cursor-pointer border-2 border-emerald-500"
              alt="Profile"
            />
            <div className="absolute top-12 left-0 bg-white border border-gray-200 rounded-lg shadow-xl hidden group-hover:block z-50 p-2 min-w-[150px]">
              <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-2 w-full p-2 hover:bg-emerald-50 rounded text-gray-700">
                <UserIcon size={16} className="text-emerald-600" /> My Profile
              </button>
              <button onClick={() => setIsGroupModalOpen(true)} className="flex items-center gap-2 w-full p-2 hover:bg-emerald-50 rounded text-gray-700">
                <Plus size={16} className="text-emerald-600" /> New Group
              </button>
              <button onClick={() => setIsChannelModalOpen(true)} className="flex items-center gap-2 w-full p-2 hover:bg-emerald-50 rounded text-gray-700">
                <Megaphone size={16} className="text-emerald-600" /> New Channel
              </button>
              <button onClick={handleLogout} className="flex items-center gap-2 w-full p-2 hover:bg-red-50 rounded text-red-500">
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={handleSearch}
              className="w-full bg-gray-100 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-gray-900"
            />
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
                        <div className="font-medium text-gray-900">{profile.displayName}</div>
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
          ) : (
            <div className="p-2">
              {chats.map(chat => {
                const profile = chat.participantProfiles?.[0];
                return (
                  <div 
                    key={chat.id}
                    onClick={() => setActiveChat(chat)}
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
                          {chat.type === 'group' && <Plus size={14} className="text-emerald-600 flex-shrink-0" />}
                          {chat.type === 'channel' && <Megaphone size={14} className="text-emerald-600 flex-shrink-0" />}
                          <h3 className={cn(
                            "font-semibold truncate",
                            activeChat?.id === chat.id ? "text-emerald-900" : "text-gray-900"
                          )}>{chat.name || profile?.displayName || 'Chat'}</h3>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {chat.lastMessageAt && format(chat.lastMessageAt.toDate(), 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{chat.lastMessage || 'No messages yet'}</p>
                    </div>
                  </div>
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

        <button 
          onClick={() => {
            const input = document.querySelector('input[placeholder="Search"]') as HTMLInputElement;
            input?.focus();
          }}
          className="absolute bottom-6 right-6 md:right-[420px] bg-emerald-600 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform z-10"
        >
          <Plus size={28} className="text-white" />
        </button>
      </div>

      {/* Main Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col h-full bg-white relative",
        !activeChat && "hidden md:flex items-center justify-center bg-[url('https://telegram.org/img/t_desktop_bg.jpg')] bg-repeat opacity-10"
      )}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-gray-100 flex items-center justify-between px-4 bg-white/90 backdrop-blur-md sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChat(null)} className="md:hidden text-gray-500 hover:text-emerald-600">
                  <ArrowLeft size={24} />
                </button>
                <img 
                  src={activeChat.participantProfiles?.[0]?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeChat.id}`} 
                  className="w-10 h-10 rounded-full border border-gray-100" 
                  alt="" 
                />
                <div>
                  <h3 className="font-bold leading-tight text-gray-900">{activeChat.name || activeChat.participantProfiles?.[0]?.displayName || 'Chat'}</h3>
                  <span className="text-xs text-emerald-600 font-medium">
                    {activeChat.type === 'channel' ? (
                      `${activeChat.subscriberCount || 0} subscribers`
                    ) : (
                      Object.entries(activeChat.typing || {})
                        .filter(([uid, isTyping]) => uid !== user.uid && isTyping)
                        .length > 0 ? 'typing...' : (activeChat.participantProfiles?.[0]?.status === 'online' ? 'online' : 'last seen recently')
                    )}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-6 text-gray-400">
                <Phone size={20} className="cursor-pointer hover:text-emerald-600" />
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
                  <div key={msg.id} className={cn(
                    "flex items-end gap-2 mb-1",
                    isMine ? "flex-row-reverse" : "flex-row"
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
                      "max-w-[70%] px-3 py-2 rounded-2xl relative shadow-sm",
                      isMine ? "bg-emerald-600 text-white rounded-br-none" : "bg-white text-gray-900 border border-gray-100 rounded-bl-none"
                    )}>
                      {activeChat.type !== 'private' && !isMine && msg.senderName && (
                        <div className="text-[13px] font-bold text-emerald-600 mb-1">{msg.senderName}</div>
                      )}
                      <p className="text-[15px] leading-relaxed break-words pr-12">{msg.content}</p>
                      <span className="absolute bottom-1 right-2 text-[10px] text-gray-400/80">
                        {msg.createdAt && format(msg.createdAt.toDate(), 'HH:mm')}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100">
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
                    <Paperclip className="text-gray-500 cursor-pointer hover:text-emerald-600" size={24} />
                  </div>
                  <button 
                    type="submit"
                    className="bg-emerald-600 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform"
                  >
                    <Send size={22} />
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="text-center p-8">
            <div className="bg-emerald-50 p-4 rounded-full inline-block mb-4">
              <MessageSquare size={32} className="text-emerald-600 opacity-50" />
            </div>
            <p className="text-gray-500 font-medium">Select a chat to start messaging</p>
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

      {/* Profile Modal */}
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
            <h3 className="font-bold text-gray-900">User Info</h3>
          </div>
          <div className="p-6 flex flex-col items-center text-center">
            <img 
              src={activeChat.participantProfiles?.[0]?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeChat.id}`} 
              className="w-32 h-32 rounded-full mb-4"
              alt=""
            />
            <h2 className="text-xl font-bold">{activeChat.participantProfiles?.[0]?.displayName || 'Chat'}</h2>
            <p className="text-sm text-gray-500 mb-6">{activeChat.participantProfiles?.[0]?.status || 'offline'}</p>
            
            <div className="w-full text-left space-y-6">
              <div>
                <label className="text-xs font-semibold text-emerald-600 uppercase block mb-1">Bio</label>
                <p className="text-sm text-gray-700">{(activeChat.participantProfiles?.[0] as any)?.bio || 'No bio yet'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-emerald-600 uppercase block mb-1">Username</label>
                <p className="text-sm text-gray-700">@{activeChat.participantProfiles?.[0]?.displayName?.toLowerCase().replace(/\s/g, '_')}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
