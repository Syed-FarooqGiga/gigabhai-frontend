import React, { useEffect, useState, useRef, useCallback } from 'react';

import { API_URL } from '../constants';
import type { FC } from 'react';
import { PERSONALITIES, DEFAULT_PERSONALITY_ID } from '../constants/personalities';
import { useTheme } from '../contexts/ThemeContext';
import {
  Animated,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Image
} from 'react-native';


// Import the logo image
const GigaLogo = require('../Giga-logo1.png');

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MessageBubble } from '../components/MessageBubble';
import { TypingBubble } from '../components/TypingBubble';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, orderBy, doc, serverTimestamp, setDoc, getDoc, onSnapshot, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

// Load messages from Firestore for the given conversation
// Loads ALL messages for a conversation, including both user and bot (AI) messages, sorted by timestamp ascending. No filtering on sender.
const loadMessagesFromFirestore = async (profileId: string, conversationId: string): Promise<ChatMessage[]> => {
  if (!profileId || !conversationId) {
    console.log('[loadMessagesFromFirestore] Missing profileId or conversationId');
    return [];
  }

  console.log(`[loadMessagesFromFirestore] Attempting to load messages for profile: ${profileId}, conversation: ${conversationId}`);

  try {
    const db = getFirestore();
    const messagesRef = collection(db, 'users', profileId, 'conversations', conversationId, 'messages');
    console.log(`[loadMessagesFromFirestore] Messages ref path: users/${profileId}/conversations/${conversationId}/messages`);
    
    // Query all messages, regardless of sender (user or bot), sorted by timestamp ascending
    const q = query(
      messagesRef,
      orderBy('timestamp', 'asc')
    );
    
    console.log('[loadMessagesFromFirestore] Executing Firestore query...');
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('[loadMessagesFromFirestore] No messages found in this conversation');
      return [];
    }
    
    const messages: ChatMessage[] = [];
    
    querySnapshot.forEach((doc) => {
      try {
        const data = doc.data();
        if (!data) {
          console.warn(`[loadMessagesFromFirestore] Document ${doc.id} has no data`);
          return;
        }
        const message: ChatMessage = {
          id: doc.id,
          text: data.text || '',
          userId: data.userId || 'unknown',
          sender: data.sender || 'user',
          timestamp: data.timestamp?.toDate() || new Date(),
          conversationId: conversationId, // Use the passed conversationId instead of data.conversationId
          personalityId: data.personalityId || 'default',
          profileId: data.profileId || profileId,
        };
        messages.push(message);
      } catch (docError) {
        console.error(`[loadMessagesFromFirestore] Error processing document ${doc.id}:`, docError);
      }
    });

    console.log(`[loadMessagesFromFirestore] Successfully loaded ${messages.length} messages for conversation ${conversationId}`);
    return messages;
  } catch (error) {
    console.error('[loadMessagesFromFirestore] Error loading messages:', error);
    // Return empty array on error to prevent breaking the UI
    return [];
  }
};

import { getFirebaseAuth, getFirebaseFirestore } from '../utils/initFirebase';
import { getAuth } from 'firebase/auth';
import { getConversationTitleFromMistral } from '../utils/mistralTitle';
import { PersonalityType } from '../types/chat';
import { Conversation } from '../types/Conversation';
import { ChatMessage } from '../types/ChatMessage';
import { RootStackParamList } from '../types/navigation';

type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Chat'>;

// MessageBubble component expects text and sender props

interface Styles extends Record<string, any> {
  container: any;
  networkStatusBar: any;
  networkStatusText: any;
  messageList: any;
  inputContainer: any;
  input: any;
  sendButton: any;
  sendButtonDisabled: any;
  personalityButton: any;
  modalContainer: any;
  modalOverlay: any;
  modalContent: any;
  modalTitle: any;
  personalityItem: any;
  personalityInfo: any;
  personalityName: any;
  personalityDesc: any;
  emptyText: any;
  loadingContainer: any;
  headerContainer: any;
  logo: any;
  headerTextContainer: any;
  appName: any;
  tagline: any;
}

// NO LONGER USED: All message persistence is now in Firestore only. AsyncStorage is not used for chat messages.
// const saveMessagesToLocalStorage = ... (removed)

const ASYNC_STORAGE_CURRENT_CONVERSATION_KEY_PREFIX = 'currentConversation_';

const saveCurrentConversationToStorage = async (profileId: string, conversation: Conversation | null) => {
  if (!profileId) return;
  const key = `${ASYNC_STORAGE_CURRENT_CONVERSATION_KEY_PREFIX}${profileId}`;
  try {
    if (conversation && conversation.id) {
      await AsyncStorage.setItem(key, JSON.stringify(conversation));
      console.log('Saved current conversation to AsyncStorage:', conversation.id);
    } else {
      await AsyncStorage.removeItem(key);
      console.log('Removed current conversation from AsyncStorage for profile:', profileId);
    }
  } catch (error) {
    console.error('Failed to save current conversation to AsyncStorage:', error);
  }
};

const loadCurrentConversationFromStorage = async (profileId: string): Promise<Conversation | null> => {
  if (!profileId) return null;
  const key = `${ASYNC_STORAGE_CURRENT_CONVERSATION_KEY_PREFIX}${profileId}`;
  try {
    const storedConversation = await AsyncStorage.getItem(key);
    if (storedConversation) {
      const conversation = JSON.parse(storedConversation) as Conversation;
      if (conversation && conversation.id) {
        console.log('Loaded current conversation from AsyncStorage:', conversation.id);
        return conversation;
      }
    }
  } catch (error) {
    console.error('Failed to load current conversation from AsyncStorage:', error);
  }
  return null;
};


const sendMessageToBackendAndGetResponse = async (
  text: string,
  personalityId: string,
  profileId: string,
  conversationId: string | null,
  userId: string
): Promise<{ message: ChatMessage; conversationId: string } | null> => {
  if (!text || !personalityId || !profileId || !userId) { // conversationId can be null for new chats
    throw new Error('Missing required parameters');
  }
  try {
    const netInfoState = await NetInfo.fetch();
    const isOnline = netInfoState.isConnected ?? false;
    if (!isOnline) {
      throw new Error('No internet connection');
    }
    // Save the user's message to Firestore
    const db = getFirestore();
    const messageData: Omit<ChatMessage, 'id'> = {
      userId,
      text,
      sender: 'user',
      timestamp: new Date(),
      personalityId,
      profileId,
      conversationId: conversationId === null ? undefined : conversationId
    };
    await addDoc(collection(db, 'users', profileId, 'messages'), messageData);

    // Make real API call to backend with Firebase ID token
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');
    const idToken = await currentUser.getIdToken();

    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        message: text,
        personality: personalityId,
        conversation_id: conversationId,
        user_id: userId,
        profile_id: profileId,
      }),
    });
    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }
    const data = await response.json();
    // Generate a unique ID for the AI message (use uuid if available)
    const { v4: uuidv4 } = require('uuid'); // Consider if uuid is truly needed here or if backend can provide message IDs
    const backendConversationId = data.conversation_id;
    const aiMessage: ChatMessage = {
      id: data.message_id || uuidv4(), // Prefer backend message ID if available
      userId: 'ai',
      text: data.message,
      sender: 'bot',
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(), // Use backend timestamp if available
      personalityId: data.personality || personalityId, // Prefer backend personality if available
      profileId: profileId,
      conversationId: backendConversationId, // CRITICAL: Use ID from backend response
    };
    return { message: aiMessage, conversationId: backendConversationId };
  } catch (error) {
    console.error('Error in sendMessageToBackendAndGetResponse:', error);
    return null;
  }
};

const formatTimestamp = (timestamp: string | Date): string => {
  return new Date(timestamp).toLocaleString();
};

const createProfileId = (userId: string, provider?: string): string => {
  if (!provider) {
    // Attempt to extract provider from user ID if it's in email format like user@provider.com
    // This is a fallback and might not be robust for all cases (e.g. phone auth)
    // Prefer explicit provider if available from session.user.app_metadata.provider or session.user.identities[0].provider
    const parts = userId.split('@');
    if (parts.length > 1) {
      const domainParts = parts[1].split('.');
      provider = domainParts[0]; // e.g., 'google' from 'google.com'
    } else {
      provider = 'unknown'; // Fallback if no provider info
    }
  }
  return `${userId}_${provider}`;
};

// --- Header Component ---
interface HeaderProps {
  onPressConversations: () => void;
}
const Header: React.FC<HeaderProps> = ({ onPressConversations }) => {
  const { isDark } = useTheme();
  return (
    <View style={[styles.headerContainer, { backgroundColor: isDark ? '#111' : '#fff', borderBottomColor: isDark ? '#222' : '#eee', flexDirection: 'row', alignItems: 'center' }]}
    >
      <TouchableOpacity onPress={onPressConversations} style={styles.conversationsButton}>
  {/* Hamburger icon: three lines */}
  <View style={styles.hamburgerIcon}>
    <View style={styles.hamburgerLine} />
    <View style={styles.hamburgerLine} />
    <View style={styles.hamburgerLine} />
  </View>
</TouchableOpacity>
      <Image source={GigaLogo} style={[styles.logo, { backgroundColor: isDark ? '#222' : '#f5f5f5' }]} resizeMode="contain" />
      <View style={styles.headerTextContainer}>
        <Text style={[styles.appName, { color: isDark ? '#fff' : '#222' }]}>Giga BhAI</Text>
        <Text style={[styles.tagline, { color: isDark ? '#aaa' : '#666' }]}>Desi dimaagGiga level swag</Text>
      </View>
    </View>
  );
};

// Main ChatScreen component
const ChatScreen = () => {
  const { colors, isDark } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false); // For AI typing indicator
  const [selectedPersonality, setSelectedPersonality] = useState<PersonalityType>(PERSONALITIES[DEFAULT_PERSONALITY_ID]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
// (All other duplicate declarations of these variables throughout this function have been removed)

  // Load messages when the conversation changes and set up real-time listener
  useEffect(() => {
    let isMounted = true;
    let unsubscribe = () => {};
    
    const setupMessageListener = async () => {
      if (!profileId || !currentConversation?.id) {
        console.log('[fetchMessages] Missing profileId or conversationId');
        if (isMounted) {
          setMessages([]);
        }
        return () => {};
      }

      console.log(`[fetchMessages] Setting up message listener for conversation: ${currentConversation.id}`);
      
      try {
        setIsLoadingMessages(true);
        
        // First, load existing messages
        const firestoreMessages = await loadMessagesFromFirestore(profileId, currentConversation.id);
        
        if (!isMounted) return () => {};
        
        // Set initial messages from Firestore only (do not keep optimistic messages on reload)
        setMessages(firestoreMessages);
        
        // Set up real-time listener for new messages
        const db = getFirestore();
        const messagesRef = collection(db, 'users', profileId, 'conversations', currentConversation.id, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
        
        unsubscribe = onSnapshot(q, (querySnapshot) => {
          if (!isMounted) return;
          
          const newMessages: ChatMessage[] = [];
          querySnapshot.forEach((doc) => {
            try {
              const data = doc.data();
              if (!data) return;
              
              newMessages.push({
                id: doc.id,
                text: data.text || '',
                userId: data.userId || 'unknown',
                sender: data.sender || 'user',
                timestamp: data.timestamp?.toDate() || new Date(),
                conversationId: currentConversation.id,
                personalityId: data.personalityId || 'default',
                profileId: data.profileId || profileId,
              });
            } catch (docError) {
              console.error(`[messageListener] Error processing document ${doc.id}:`, docError);
            }
          });
          
          if (newMessages.length > 0) {
            console.log(`[messageListener] Received ${newMessages.length} new/updated messages`);
            setMessages(prevMessages => {
              // Create a map of existing messages by ID for quick lookup
              const existingMessages = new Map(prevMessages.map(msg => [msg.id, msg]));
              
              // Update or add new messages
              newMessages.forEach(newMsg => {
                existingMessages.set(newMsg.id, newMsg);
              });
              
              // Convert back to array and sort by timestamp
              const updatedMessages = Array.from(existingMessages.values()).sort((a, b) => {
                const tsA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                const tsB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                return tsA - tsB;
              });
              
              return updatedMessages;
            });
          }
        }, (error) => {
          console.error('[messageListener] Error in message listener:', error);
        });
        
      } catch (error) {
        console.error('[fetchMessages] Error:', error);
        if (isMounted) {
          setMessages(prev => (prev.length > 0 ? prev : []));
        }
      } finally {
        if (isMounted) {
          setIsLoadingMessages(false);
        }
      }
      
      return unsubscribe;
    };
    
    setupMessageListener();
    
    // Cleanup function to prevent state updates after unmount and unsubscribe
    return () => {
      isMounted = false;
      if (unsubscribe) {
        console.log('[fetchMessages] Cleaning up message listener');
        unsubscribe();
      }
    };
  }, [currentConversation?.id, profileId]);

  // Always create a new conversation after login or profileId change
  useEffect(() => {
    const createNewOnLogin = async () => {
      if (!profileId) return;
      // Optionally clear old state
      setCurrentConversation(null);
      await createNewConversation(); // createNewConversation will setCurrentConversation internally
    };
    createNewOnLogin();
  }, [profileId]);

  const [userId, setUserId] = useState<string | null>(null);
  const [showPersonalityModal, setShowPersonalityModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const { session, loading: authLoading } = useAuth();
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'Chat'>>();
  const flatListRef = useRef<any>(null);
  // Drawer state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-280)).current;

  // Drawer open/close
  const openDrawer = () => {
    setDrawerVisible(true);
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };
  const closeDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: -280,
      duration: 200,
      useNativeDriver: false,
    }).start(() => setDrawerVisible(false));
  };

  // Set up network listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      handleNetworkChange(state);
    });
    return () => unsubscribe();
  }, []);

  // State to hold all conversations
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Derive profileId and userId from session
  useEffect(() => {
    // Loads all conversations for the profile and sets the most recent as current
    const restoreLastConversation = async (profileId: string) => {
      try {
        const db = getFirestore();
        const convQuery = query(
          collection(db, 'users', profileId, 'conversations'),
          orderBy('last_message_timestamp', 'desc')
        );
        const snapshot = await getDocs(convQuery);
        if (snapshot.empty) {
          console.log('[ChatScreen] No conversations found for profile. Will create new conversation on first message.');
          setConversations([]);
          setCurrentConversation(null);
        } else {
          // Each conversation must have all required Conversation fields
          const conversations = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              title: data.title || 'Untitled',
              lastMessage: data.lastMessage || '',
              timestamp: data.timestamp || data.last_message_timestamp || new Date().toISOString(),
              personalityId: data.personalityId || DEFAULT_PERSONALITY_ID,
              ...data // Keep other properties if present
            };
          });
          setConversations(conversations);
          console.log('[ChatScreen] Loaded conversations:', conversations);
          setCurrentConversation(conversations[0]); // Set most recent as current
        }
      } catch (error) {
        console.error('[ChatScreen] Error loading conversations:', error);
        setConversations([]);
        setCurrentConversation(null);
      }
    };
    if (session?.user && session.profileId) {
      setProfileId(session.profileId);
      setUserId(session.user.uid);
      console.log('Profile ID set:', session.profileId, 'User ID set:', session.user.uid);
      restoreLastConversation(session.profileId);
      // Debug: Print all messages for this profileId
      const debugPrintAllMessages = async (profileId: string) => {
        try {
          const db = getFirestore();
          const messagesSnapshot = await getDocs(collection(db, 'users', profileId, 'messages'));
          const allMessages = messagesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
          console.log('[ChatScreen][DEBUG] All messages for profile', profileId, allMessages);
        } catch (err) {
          console.error('[ChatScreen][DEBUG] Error fetching all messages for profile:', profileId, err);
        }
      };
      debugPrintAllMessages(session.profileId);
    } else if (!authLoading && !session) {
      setProfileId(null);
      setUserId(null);
      setCurrentConversation(null);
    }
  }, [session, authLoading]);

  const handleNetworkChange = (state: NetInfoState) => {
    setIsOnline(state.isConnected ?? false);
  };

  const createNewConversation = async (initialMessage?: ChatMessage): Promise<Conversation | null> => {
  if (!profileId || !selectedPersonality) {
    console.error('Profile ID or selected personality missing for new conversation');
    return null;
  }
  setIsLoadingMessages(true);
  try {
    const db = getFirestore();
    // Prepare first 5 messages for title
    let firstMessages: { text: string }[] = [];
    if (initialMessage) {
      firstMessages = [initialMessage];
    }
    // Call Mistral for title if we have at least one message
    let title = initialMessage?.text ? initialMessage.text.substring(0, 30) : `New ${selectedPersonality.name} Chat`;
    if (firstMessages.length > 0) {
      const mistralTitle = await getConversationTitleFromMistral(firstMessages);
      if (mistralTitle && mistralTitle.trim().length > 0) {
        title = mistralTitle;
      }
    }
    const newConversationData = {
      profile_id: profileId,
      personality_id: selectedPersonality.id,
      last_message_timestamp: initialMessage?.timestamp || new Date().toISOString(),
      title,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, 'users', profileId, 'conversations'), newConversationData);

    // Map to Conversation type
    const conversation: Conversation = {
      id: docRef.id,
      title: newConversationData.title,
      lastMessage: initialMessage?.text || '',
      timestamp: initialMessage?.timestamp
        ? (typeof initialMessage.timestamp === 'string' ? new Date(initialMessage.timestamp) : initialMessage.timestamp)
        : new Date(),
      personalityId: selectedPersonality.id,
      // Add other required fields if your Conversation type/interface expects them
    };
    setCurrentConversation(conversation);
    // saveCurrentConversationToStorage is handled by the useEffect watching currentConversation
    return conversation;
  } catch (error) {
    console.error('Error creating new conversation:', error);
    return null;
  } finally {
    setIsLoadingMessages(false);
  }
};

  const handleSendMessage = async (text: string) => {
  if (!profileId || !userId || !text.trim()) return;

  let conversationToUse = currentConversation;
  if (!conversationToUse) {
      const newConv = await createNewConversation();
      if (!newConv) {
          console.error('Failed to create or get a conversation to send message.');
          // TODO: Notify user about failure to create conversation
          return;
      }
      conversationToUse = newConv;
  }
  const convId = conversationToUse.id;

  // Create user message and save to Firestore
  const userMessageData: Omit<ChatMessage, 'id'> = {
    text: text.trim(),
    userId,
    sender: 'user',
    timestamp: new Date(),
    personalityId: selectedPersonality.id,
    profileId,
    conversationId: convId
  };
  const db = getFirestore();
  try {
    // Add user message to Firestore
    const userMsgDoc = await addDoc(collection(db, 'users', profileId, 'conversations', convId, 'messages'), userMessageData);
    const userMessage: ChatMessage = { ...userMessageData, id: userMsgDoc.id };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Send to backend and get AI response
    const backendResult = await sendMessageToBackendAndGetResponse(
      userMessage.text,
      selectedPersonality.id,
      profileId,
      convId,
      userId
    );

    if (backendResult && backendResult.message && backendResult.conversationId) {
       const aiMessage = backendResult.message; // ChatMessage object for AI
       const returnedConversationId = backendResult.conversationId;

       // --- ENFORCE BOT TIMESTAMP STRICTLY AFTER USER ---
       const userTs = userMessage.timestamp instanceof Date
         ? userMessage.timestamp.getTime()
         : new Date(userMessage.timestamp).getTime();
       let aiTs = aiMessage.timestamp instanceof Date
         ? aiMessage.timestamp.getTime()
         : new Date(aiMessage.timestamp).getTime();
       if (aiTs <= userTs) {
         aiMessage.timestamp = new Date(userTs + 1);
       }

      // If the conversation ID from the backend is different from the one used for the user's optimistic message,
      // update the user's message in the local state to reflect the new conversation ID.
      // This ensures it's correctly merged when loadMessages runs for the new conversation.
      if (convId !== returnedConversationId) {
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === userMessage.id ? { ...msg, conversationId: returnedConversationId } : msg
          )
        );
      }

      // Optimistically add AI's message to the UI (it already has the returnedConversationId)
      setMessages(prevMessages => [...prevMessages, aiMessage]);

      // Update currentConversation state
      if (!currentConversation || currentConversation.id !== returnedConversationId) {
        // ID is new or different: fetch full conversation details from Firestore for accuracy
        console.log(`Backend conversation ID ${returnedConversationId} is new or different from current ${currentConversation?.id}. Fetching details.`);
        const db = getFirestore();
        try {
          const conversationDocRef = doc(db, 'users', profileId, 'conversations', returnedConversationId);
          const conversationDocSnap = await getDoc(conversationDocRef);
          if (conversationDocSnap.exists()) {
            const conversationData = conversationDocSnap.data();
            const updatedConv: Conversation = {
              id: conversationDocSnap.id,
              title: conversationData.title || `Chat (${returnedConversationId.substring(0,5)})`,
              lastMessage: aiMessage.text,
              timestamp: aiMessage.timestamp,
              personalityId: aiMessage.personalityId,
              // Map other fields from your Conversation type as needed
            };
            setCurrentConversation(updatedConv);
            console.log(`Set currentConversation to ID: ${returnedConversationId} from Firestore data.`);
          } else {
            // Conversation doc not found (should be rare if backend ensures creation)
            // Create a basic currentConversation object with available details
            console.warn(`Conversation document ${returnedConversationId} not found. Using basic info.`);
            setCurrentConversation({
              id: returnedConversationId,
              title: `Chat (${returnedConversationId.substring(0,5)})`,
              lastMessage: aiMessage.text,
              timestamp: aiMessage.timestamp,
              personalityId: aiMessage.personalityId,
            });
          }
        } catch (error) {
          console.error('Error fetching conversation details for new/different ID:', error);
          // Fallback: Create a basic currentConversation object
          const updatedConv: Conversation = {
            id: returnedConversationId,
            title: `Chat (${returnedConversationId.substring(0,5)})`,
            lastMessage: aiMessage.text,
            timestamp: aiMessage.timestamp,
            personalityId: aiMessage.personalityId,
          };
          setCurrentConversation(updatedConv);
        }
      } else if (currentConversation) { // IDs match, and currentConversation exists
        // Conversation ID is the same, and currentConversation exists. Update its details.
        console.log(`Backend conversation ID ${returnedConversationId} matches current. Updating details on existing currentConversation object.`);
        const updatedConv: Conversation = {
          ...currentConversation, // Spread the existing current conversation
          lastMessage: aiMessage.text,
          timestamp: aiMessage.timestamp,
          personalityId: aiMessage.personalityId, // Ensure personality is updated if it can change
        };
        setCurrentConversation(updatedConv);
      } else {
        // This case implies currentConversation was null, but the initial outer `if` condition
        // (!currentConversation || currentConversation.id !== returnedConversationId) was false.
        // This indicates an inconsistent state or a logic flaw earlier.
        console.error(`Inconsistent state: currentConversation is null, yet somehow its ID was considered matching ${returnedConversationId}. Re-fetching conversation.`);
        // As a robust fallback, try to fetch the conversation as if it were new/different.
        const db = getFirestore();
        await (async () => {
          try {
            const conversationDocRef = doc(db, 'users', profileId, 'conversations', returnedConversationId);
            const conversationDocSnap = await getDoc(conversationDocRef);
            if (conversationDocSnap.exists()) {
              const conversationData = conversationDocSnap.data();
              const updatedConv: Conversation = {
                id: conversationDocSnap.id,
                title: conversationData.title || `Chat (${returnedConversationId.substring(0,5)})`,
                lastMessage: aiMessage.text,
                timestamp: aiMessage.timestamp,
                personalityId: aiMessage.personalityId,
              };
              setCurrentConversation(updatedConv);
            } else {
               const updatedConv: Conversation = {
                  id: returnedConversationId,
                  title: `Chat (${returnedConversationId.substring(0,5)})`,
                  lastMessage: aiMessage.text,
                  timestamp: aiMessage.timestamp,
                  personalityId: aiMessage.personalityId,
                };
              setCurrentConversation(updatedConv);
            }
          } catch (fetchError) {
            console.error('Error re-fetching conversation during inconsistent state:', fetchError);
            const updatedConv: Conversation = {
              id: returnedConversationId,
              title: `Chat (${returnedConversationId.substring(0,5)})`,
              lastMessage: aiMessage.text,
              timestamp: aiMessage.timestamp,
              personalityId: aiMessage.personalityId,
            };
            setCurrentConversation(updatedConv);
          }
        })();
      }
    } else {
      // Backend call failed or returned invalid data
      console.error('Failed to get valid response from backend. AI message not added.');
      // Optionally, revert the optimistic user message add if desired, or show an error toast
      // setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
    }
    // Rely on useEffect watching currentConversation to call loadMessages for sync
    setIsTyping(false);
  } catch (error) {
    console.error('Error sending message:', error);
    setIsTyping(false);
  }
};

  const loadMessages = useCallback(async () => {
  if (!profileId || !currentConversation?.id) {
    setMessages([]);
    return;
  }
  setIsLoadingMessages(true);
  try {
    const db = getFirestore();
    const q = query(
      collection(db, 'users', profileId, 'messages'),
      where('conversation_id', '==', currentConversation.id),
      orderBy('timestamp', 'asc')
    );
    const querySnapshot = await getDocs(q);
    const firebaseMessages: ChatMessage[] = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ChatMessage));

    setMessages(prevMessagesInState => {
      if (!currentConversation?.id) return []; // Should not happen if loadMessages is called correctly
      // Identify optimistic messages in the current state that belong to the *current* conversation
      // and are not yet present in the messages fetched from Firestore.
      const optimisticMessagesForCurrentConv = prevMessagesInState.filter(
        msg => msg.conversationId === currentConversation.id && 
               !firebaseMessages.find(fm => fm.id === msg.id)
      );

      // Combine Firestore messages with these optimistic ones.
      const newMessagesToShow = [...firebaseMessages, ...optimisticMessagesForCurrentConv];
      
      // Sort all messages by timestamp to ensure correct order.
      newMessagesToShow.sort((a, b) => {
  const tsA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
  const tsB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
  if (tsA !== tsB) return tsA - tsB;
  // If timestamps are equal, user comes before bot
  if (a.sender === 'user' && b.sender === 'bot') return -1;
  if (a.sender === 'bot' && b.sender === 'user') return 1;
  return 0;
});
      return newMessagesToShow;
    });
    console.log('Loaded messages from Firestore:', firebaseMessages.length);
  } catch (error) {
    console.error('Error loading messages from Firestore:', error);
    setMessages([]);
  } finally {
    setIsLoadingMessages(false);
  }
}, [profileId, currentConversation]);

  // Effect to load messages when profileId or currentConversation changes
  useEffect(() => {
    if (profileId && currentConversation && currentConversation.id) {
      console.log(`[ChatScreen] useEffect: Valid profileId (${profileId}) and currentConversation.id (${currentConversation.id}). Calling loadMessages.`);
      loadMessages();
    } else if (!profileId) {
      // Only clear messages if the user is logged out or profileId is not yet available.
      console.log('[ChatScreen] useEffect: No profileId. Clearing messages.');
      setMessages([]); 
    } else {
      // ProfileId is valid, but currentConversation is not (or has no id).
      // Do not clear messages here to prevent flicker during transitions.
      // Messages will update once currentConversation is properly set and loadMessages runs.
      console.log(`[ChatScreen] useEffect: Valid profileId (${profileId}) but currentConversation is not ready. Waiting for currentConversation to settle.`);
    }
  }, [profileId, currentConversation, loadMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // TODO: Implement loadConversations and integrate with History Modal
  const loadConversations = async () => {
    if (!profileId) return;
    console.log('Loading conversations for profile:', profileId);
    try {
      const db = getFirestore();
      const q = query(
        collection(db, 'users', profileId, 'conversations'),
        orderBy('last_message_timestamp', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const conversations: Conversation[] = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Conversation));
      // setConversations(conversations); // Uncomment if you have a conversations state
      if (conversations && conversations.length > 0 && !currentConversation) {
        setCurrentConversation(conversations[0]); // Auto-select the latest conversation
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  // Effect to load or create conversation when profileId is available
  useEffect(() => {
    const initializeConversation = async () => {
      if (profileId && !currentConversation) {
        console.log('Profile ID available, attempting to load or create conversation.');
        let loadedConversation = await loadCurrentConversationFromStorage(profileId);
        if (loadedConversation && loadedConversation.id) {
          // Validate with Firestore to ensure it's not stale/deleted
          const db = getFirestore();
          const convRef = doc(db, 'users', profileId, 'conversations', loadedConversation.id);
          const convSnap = await getDoc(convRef);
          if (convSnap.exists()) {
            console.log('Setting current conversation from AsyncStorage (validated):', loadedConversation.id);
            setCurrentConversation(loadedConversation);
          } else {
            console.log('Conversation from AsyncStorage not found in Firestore, creating new one.');
            loadedConversation = null; // Treat as not loaded
            await saveCurrentConversationToStorage(profileId, null); // Clear stale entry
          }
        }
        
        if (!loadedConversation) { // If not loaded or was stale
          console.log('No valid conversation in AsyncStorage or was stale, creating new one.');
          const newConv = await createNewConversation(); // createNewConversation should call setCurrentConversation & save
          if (!newConv) {
            console.log('Could not auto-create a conversation on load.');
          }
        }
      }
    };
    initializeConversation();
  }, [profileId, currentConversation]); // currentConversation is included to re-run if it gets nulled externally

  // Effect to save currentConversation to AsyncStorage whenever it changes
  useEffect(() => {
    if (profileId && currentConversation && currentConversation.id) {
      saveCurrentConversationToStorage(profileId, currentConversation);
    }
  }, [profileId, currentConversation]);


  const handlePersonalitySelect = (personality: PersonalityType) => {
    setSelectedPersonality(personality);
    setShowPersonalityModal(false);
    // Optionally, start a new conversation when personality changes, or clear messages
    // For now, it just changes the personality for the *next* message in current/new conversation
    // Consider if changing personality should imply a new conversation context:
    // setCurrentConversation(null); 
    // setMessages([]);
    // createNewConversation();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    conversationsButton: {
      padding: 8,
      marginRight: 8,
      marginLeft: 4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    networkStatusBar: {
      backgroundColor: colors.notification, // Or a specific color for offline
      padding: 8,
      alignItems: 'center'
    },
    networkStatusText: {
      color: colors.card // Or a contrasting color
    },
    messageList: {
      flex: 1,
      paddingHorizontal: 10
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120, // Allow multiline input up to a certain height
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.background, // Input field background
      borderRadius: 20,
      marginHorizontal: 8,
      color: colors.text,
      fontSize: 16
    },
    sendButton: {
      padding: 10,
      borderRadius: 20,
      backgroundColor: colors.primary
    },
    sendButtonDisabled: {
        backgroundColor: colors.border // A more muted color for disabled state
    },
    personalityButton: {
      padding: 10
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'flex-end', // Aligns modal to bottom or 'center' for middle
      backgroundColor: 'rgba(0,0,0,0.5)' // Semi-transparent overlay
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      padding: 20,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%' // Limit height for personality/history list
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center'
    },
    personalityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: colors.background // Slightly different from modalContent for contrast
    },
    personalityInfo: {
      flex: 1,
      marginLeft: 12
    },
    personalityName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4
    },
    personalityDesc: {
      fontSize: 14,
      color: colors.text,
      opacity: 0.8
    },
    emptyText: {
      color: colors.text,
      textAlign: 'center',
      marginTop: 20,
      fontSize: 16,
      opacity: 0.7
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.1)'
    }
  });

  if (authLoading) {
    return (
        <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{color: colors.text, marginTop: 10}}>Loading session...</Text>
        </View>
    );
  }

  if (!profileId && !authLoading) {
    return (
        <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
            <Text style={{color: colors.text, marginBottom: 20, textAlign: 'center'}}>
                Could not determine user profile. Please try logging in again.
            </Text>
        </View>
    );
  }
  // Use KeyboardAvoidingView on iOS and Android (not web) to handle keyboard pop-up without blank space.
// On web, use regular View to avoid layout bugs. On Android, use behavior='height' for best results.
const isWeb = Platform.OS === 'web';
const Container = !isWeb ? KeyboardAvoidingView : View;
// Fixes for mobile Chrome/Android blank space and scroll issues:
// - Make container and FlatList flex: 1 (fill screen)
// - FlatList contentContainerStyle uses flexGrow: 1 and justifyContent: 'flex-end'
// - Remove extra padding/margin at bottom
// - Header always visible at top
// - KeyboardAvoidingView on iOS/Android, View on web
return (
  <Container
    style={[styles.container, { flex: 1 }]}
    {...(!isWeb ? (Platform.OS === 'ios'
      ? { behavior: 'padding', keyboardVerticalOffset: 64 }
      : { behavior: 'height' }) : {})}
  >
       <Header onPressConversations={() => setShowHistoryModal(true)} />
       {!isOnline && (
         <View style={styles.networkStatusBar}>
           <Text style={styles.networkStatusText}>You are offline. Some features may be limited.</Text>
         </View>
       )}
         {console.log('Rendering messages:', messages.map(m => ({ id: m.id, sender: m.sender, ts: m.timestamp, text: m.text })))}
         <FlatList
         ref={flatListRef}
         data={isTyping ? [...messages, { id: 'typing-indicator', text: '', sender: 'bot' as const, personalityId: selectedPersonality.id || 'default', userId: 'ai', timestamp: new Date(), conversationId: currentConversation?.id || '', profileId: profileId || '' }] : messages}
         keyExtractor={(item: ChatMessage) => item.id}
         renderItem={({ item }: { item: ChatMessage }) => {
           if (item.id === 'typing-indicator') {
              // Show animated three-dot bubble as bot reply placeholder
              return <TypingBubble />;
            }
           return (
             <MessageBubble
               text={item.text}
               sender={item.sender}
               personalityEmoji={item.sender === 'bot' && PERSONALITIES[item.personalityId || 'default']?.emoji ? PERSONALITIES[item.personalityId || 'default'].emoji : undefined}
             />
           );
         }}
         style={[styles.messageList, { flex: 1 }]}
         // Fix: Ensure content grows to fill and pushes input to bottom, prevents blank space below input
         contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingBottom: 0, paddingTop: 0 }}
         ListEmptyComponent={() => (
             !isLoadingMessages && (
                 <Text style={styles.emptyText}>
                     {currentConversation ? 'No messages yet. Start typing!' : 'Select or start a new conversation.'}
                 </Text>
             )
         )}
       />
       <View style={[styles.inputContainer, { marginBottom: 0 }]}>
        <TouchableOpacity
          style={styles.personalityButton}
          onPress={() => setShowPersonalityModal(true)}
        >
          <MaterialCommunityIcons
            name={selectedPersonality.icon as any} // Cast as any if icon names are not strictly typed
            size={24}
            color={selectedPersonality.color}
          />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder={`Message ${selectedPersonality.name}...`}
          placeholderTextColor={colors.textTertiary} // Use the tertiary text color for placeholders
          multiline
          maxLength={1000}
          editable={!isLoadingMessages && !!currentConversation} // Disable if loading or no conversation
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isTyping || isLoadingMessages || !currentConversation) && styles.sendButtonDisabled]}
          onPress={() => {
            if (inputText.trim() && currentConversation) {
              void handleSendMessage(inputText);
            }
          }}
          disabled={!inputText.trim() || isTyping || isLoadingMessages || !currentConversation}
        >
          <MaterialCommunityIcons name="send" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showPersonalityModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPersonalityModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowPersonalityModal(false)} // Close when overlay is pressed
        >
          <Pressable style={styles.modalContent}> {/* Prevent closing when content is pressed */}
            <Text style={styles.modalTitle}>Choose Personality</Text>
            <FlatList<PersonalityType>
                data={Object.values(PERSONALITIES)}
                keyExtractor={(item: PersonalityType) => item.id}
                renderItem={({item}: {item: PersonalityType}) => (
                    <TouchableOpacity
                        key={item.id}
                        style={styles.personalityItem}
                        onPress={() => handlePersonalitySelect(item)}
                    >
                        <MaterialCommunityIcons name={item.icon as any} size={24} color={item.color} />
                        <View style={styles.personalityInfo}>
                            <Text style={styles.personalityName}>{item.name}</Text>
                            <Text style={styles.personalityDesc}>{String(item.description || "")}</Text>
                        </View>
                    </TouchableOpacity>
                )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* History Modal - TODO: Implement fully */}
      <Modal
        visible={showHistoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowHistoryModal(false)}
        >
          <Pressable style={styles.modalContent}>
            <Text style={styles.modalTitle}>Conversation History</Text>
            <TouchableOpacity
              style={[
                styles.personalityItem,
                { backgroundColor: messages.length === 0 ? '#ccc' : '#e0e0e0', marginBottom: 8, opacity: messages.length === 0 ? 0.6 : 1 }
              ]}
              disabled={messages.length === 0}
              onPress={async () => {
                if (messages.length === 0) return;
                const newConvo = await createNewConversation();
                if (newConvo) {
                  setCurrentConversation(newConvo);
                  setShowHistoryModal(false);
                }
              }}
            >
              <MaterialCommunityIcons name="plus" size={24} color={messages.length === 0 ? '#aaa' : '#3a86ff'} />
              <View style={styles.personalityInfo}>
                <Text style={styles.personalityName}>
                  {messages.length === 0 ? 'Finish current conversation to start new' : 'Start New Conversation'}
                </Text>
              </View>
            </TouchableOpacity>
            <FlatList
              data={conversations.slice(0, 20)}
              keyExtractor={(item: Conversation) => item.id}
              renderItem={({ item }: { item: Conversation }) => (
                <TouchableOpacity
                  style={[styles.personalityItem, currentConversation?.id === item.id && { backgroundColor: '#d0ebff' }]}
                  onPress={() => {
                    setCurrentConversation(item);
                    setShowHistoryModal(false);
                  }}
                >
                  <MaterialCommunityIcons name="message-text" size={24} color="#888" />
                  <View style={styles.personalityInfo}>
                    <Text style={styles.personalityName} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.personalityDesc} numberOfLines={1}>{item.lastMessage || 'No messages yet.'}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#999', marginLeft: 'auto' }}>{formatTimestamp(item.timestamp)}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No conversations yet.</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
      {isLoadingMessages && 
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
        </View>
      }
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  networkStatusBar: {
    backgroundColor: '#f8d7da',
    padding: 6,
    alignItems: 'center',
  },
  networkStatusText: {
    color: '#721c24',
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    marginRight: 8,
    backgroundColor: '#f9f9f9',
  },
  sendButton: {
    backgroundColor: '#3a86ff',
    borderRadius: 20,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#b0c4de',
  },
  personalityButton: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#eee',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    minWidth: 300,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  personalityItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    width: '100%',
  },
  personalityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  personalityName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  personalityDesc: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  emptyText: {
    color: '#aaa',
    fontStyle: 'italic',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // Header styles
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  logo: {
    width: 64, // Increased size
    height: 64, // Increased size
    marginRight: 20,
    borderRadius: 16,
  },
  headerTextContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 24, // Slightly bigger
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    marginTop: 2,
    fontStyle: 'italic',
  },
  conversationsButton: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 0,
  },
  hamburgerIcon: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburgerLine: {
    width: 22,
    height: 3,
    backgroundColor: '#3a86ff',
    marginVertical: 2,
    borderRadius: 2,
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    flexDirection: 'row',
  },
  drawerContainer: {
    width: 280,
    height: '100%',
    backgroundColor: '#fff',
    paddingTop: 48,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 100,
  },
  drawerTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 16,
  },
  // Add any additional styles below this line if needed
});

export default ChatScreen;
