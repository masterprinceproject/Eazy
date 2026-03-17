export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  lastSeen?: string;
  status?: 'online' | 'offline';
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
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  content: string;
  createdAt: any;
  type: 'text' | 'image' | 'file';
}
