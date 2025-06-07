export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
  personality?: string;
  isTyping?: boolean;
}

// Add a type for typing indicator message
export interface TypingIndicator {
  id: string;
  isTyping: true;
}

// Update the Message type to include typing indicator
export type ChatMessage = Message | TypingIndicator;

export interface Personality {
  id: string;
  name: string;
  avatar: string;
  description: string;
  theme: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    inputBorder: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  timestamp?: string;
  text?: string;
  user?: T;
  error?: string;
  personality?: string;
  endpoint?: string;
  status?: number;
  data: {
    message?: string;
    timestamp?: string;
    personality?: string;
  };
}

export interface Meme {
  id: string;
  url: string;
  uploaderId: string;
  uploadTime: string;
  likes: number;
  category?: string;
}

export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string | Date;
  personality: string;
  messages?: Message[];
  profileId?: string;
}

export interface User {
  id: string;
  phoneNumber: string;
  displayName?: string;
  avatar?: string;
  preferences?: {
    defaultPersonality: string;
    theme: 'light' | 'dark';
  };
} 