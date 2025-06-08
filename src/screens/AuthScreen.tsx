import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../contexts/FirebaseAuthContext';
import EmailAuthScreen from './EmailAuthScreen';

declare global {
  interface Window {
    __alreadyReloadedAfterLogin?: boolean;
    __reloadCountAfterLogin?: number;
  }
}

type AuthScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Auth'>;
};

const AuthScreen = ({ navigation }: AuthScreenProps) => {
  const { isDark } = useTheme();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) {
      // Web-specific reload logic after signup
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
        const lastAuthAction = sessionStorage.getItem('lastAuthAction');
        if (lastAuthAction === 'signup') {
          sessionStorage.removeItem('lastAuthAction'); // Clear the action flag
          if (!sessionStorage.getItem('hasReloadedAfterSignup')) {
            sessionStorage.setItem('hasReloadedAfterSignup', 'true');
            window.location.reload();
            return; // Prevent navigation until after reload
          } else {
            // Already reloaded, clear the reload flag for next time
            sessionStorage.removeItem('hasReloadedAfterSignup');
          }
        }
      }

      // If not returned by signup reload logic, proceed with navigation
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });

      // Mobile browser reload logic (iOS or Android mobile browsers)
      if (
        Platform.OS === 'web' && // Ensure this runs only on web platform
        typeof window !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) &&
        (/Safari|CriOS|FxiOS|EdgiOS|Chrome|Firefox|SamsungBrowser|UCBrowser|OPR\//i.test(navigator.userAgent))
      ) {
        // Prevent reload loop: only reload ONCE per page load
        // Reload up to two times after login
        if (!window.__reloadCountAfterLogin) window.__reloadCountAfterLogin = 0;
        if (window.__reloadCountAfterLogin < 2) {
          window.__reloadCountAfterLogin++;
          setTimeout(() => {
            try {
              window.location.reload();
            } catch (e) {
              console.error('Failed to reload:', e);
              // Fallback: do nothing
            }
          }, 400);
        }
      }
    }
  }, [user, navigation]);

  const handleAuthSuccess = () => {
    // This function is called by EmailAuthScreen on successful login/signup.
    // Navigation is handled by the useEffect hook above, reacting to `user` state change.
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: isDark ? '#000' : '#fff' }]}>
        <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      <EmailAuthScreen onSuccess={handleAuthSuccess} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AuthScreen;
