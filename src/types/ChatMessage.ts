export type ChatMessage = {
  id: string;
  userId: string;
  text: string;
  timestamp: Date;
  sender: 'user' | 'bot';
  conversationId?: string;
  personalityId: string;
  profileId: string; // Added for profile-based data isolation
};
