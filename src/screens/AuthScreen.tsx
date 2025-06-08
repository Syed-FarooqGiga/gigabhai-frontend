import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
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

  // Handle navigation after successful authentication
  useEffect(() => {
    if (user) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
      // Force reload on any iOS or Android mobile browser (Safari, Chrome, Firefox, Edge)
      if (
        typeof window !== 'undefined' &&
        (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) &&
        (/Safari|CriOS|FxiOS|EdgiOS|Chrome|Firefox|SamsungBrowser|UCBrowser|OPR\//i.test(navigator.userAgent))
      ) {
        // Prevent reload loop: only reload ONCE per page load
        // Reload up to two times after login
        if (typeof window !== 'undefined') {
          if (!window.__reloadCountAfterLogin) window.__reloadCountAfterLogin = 0;
          if (window.__reloadCountAfterLogin < 2) {
            window.__reloadCountAfterLogin++;
            setTimeout(() => {
              try {
                window.location.reload();
              } catch (e) {
                // Fallback: do nothing
              }
            }, 400);
          }
        }
      }
    }
  }, [user, navigation]);

  // No need for handleAuthSuccess fallback; rely on auth state
  const handleAuthSuccess = () => {
    // No-op: Navigation will be handled by the useEffect above
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
