export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  photoURL?: string;
  lastSeen?: string;
  status?: 'online' | 'offline';
  bio?: string;
  username?: string;
  isPremium?: boolean;
  isBanned?: boolean;
  role?: 'admin' | 'user';
  settings?: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    privacy: 'everybody' | 'contacts' | 'nobody';
    twoFactor?: boolean;
    hideLastSeen?: boolean;
    hideProfilePhoto?: boolean;
    language?: string;
  };
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: any;
  type: 'private' | 'group' | 'channel';
  name?: string;
  description?: string;
  participantProfiles?: UserProfile[];
  typing?: Record<string, boolean>;
  admins?: string[];
  subscriberCount?: number;
  isPublic?: boolean;
  pinnedMessageIds?: string[];
  lastMessageSenderId?: string;
  lastMessageReadBy?: string[];
  activeCall?: {
    type: 'audio' | 'video';
    startedAt: any;
    participants: string[];
    initiatorId: string;
  };
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  senderIsPremium?: boolean;
  content: string;
  createdAt: any;
  type: 'text' | 'image' | 'file' | 'audio' | 'video';
  readBy?: string[]; // Array of user IDs who have read the message
  deliveredTo?: string[]; // Array of user IDs who have received the message
  reactions?: Record<string, string[]>; // emoji -> array of user IDs
  forwardedFrom?: string; // UID of the original sender
  fileName?: string;
  fileSize?: number;
  isEdited?: boolean;
  editedAt?: any;
}
