import { Personality } from '../types';

export const PERSONALITIES: Record<string, Personality> = {
  swag: {
    id: 'swag',
    name: 'Swag Bhai',
    avatar: '🕶️',
    description: "Yo bro! Let's keep it real and swaggy!",
    theme: {
      primary: '#1a1a1a',
      secondary: '#2d2d2d',
      background: '#000000',
      text: '#ffffff',
      inputBorder: '#404040'
    }
  },
  ceo: {
    id: 'ceo',
    name: 'CEO Bhai',
    avatar: '👔',
    description: "Let's discuss business and success strategies.",
    theme: {
      primary: '#1a1a1a',
      secondary: '#2d2d2d',
      background: '#000000',
      text: '#ffffff',
      inputBorder: '#404040'
    }
  },
  roast: {
    id: 'roast',
    name: 'Roast Bhai',
    avatar: '🔥',
    description: "Ready for some spicy roasts?",
    theme: {
      primary: '#1a1a1a',
      secondary: '#2d2d2d',
      background: '#000000',
      text: '#ffffff',
      inputBorder: '#404040'
    }
  },
  vidhyarthi: {
    id: 'vidhyarthi',
    name: 'Vidhyarthi Bhai',
    avatar: '📚',
    description: "Let's learn and grow together!",
    theme: {
      primary: '#1a1a1a',
      secondary: '#2d2d2d',
      background: '#000000',
      text: '#ffffff',
      inputBorder: '#404040'
    }
  },
  jugadu: {
    id: 'jugadu',
    name: 'Jugadu Bhai',
    avatar: '🔧',
    description: "Need a jugaad? I'm your guy!",
    theme: {
      primary: '#1a1a1a',
      secondary: '#2d2d2d',
      background: '#000000',
      text: '#ffffff',
      inputBorder: '#404040'
    }
  }
};

export const API_URL = 'http://82.29.162.54:8000';
