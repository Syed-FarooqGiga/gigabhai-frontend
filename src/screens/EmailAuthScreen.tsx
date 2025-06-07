import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/FirebaseAuthContext';

type AuthMode = 'login' | 'signup';

type EmailAuthScreenProps = {
  onSuccess: () => void;
};

const EmailAuthScreen = ({ onSuccess }: EmailAuthScreenProps) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotMessageColor, setForgotMessageColor] = useState('#4caf50');

  const { signInWithEmail, signUpWithEmail, sendPasswordResetEmail } = useAuth();
  const { colors } = useTheme();

  const handleForgotPassword = async () => {
    setForgotLoading(true);
    setForgotMessage('');
    setForgotMessageColor('#4caf50');
    try {
      await sendPasswordResetEmail(forgotEmail.trim());
      setForgotMessage('If this email exists, a reset link has been sent.');
      setForgotMessageColor('#4caf50');
    } catch (err: any) {
      setForgotMessage('Failed to send reset link. Try again.');
      setForgotMessageColor('#f44336');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (!name.trim() || !username.trim()) {
          throw new Error('Name and username are required');
        }
        await signUpWithEmail(email, password, name, username);
      }
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    if (mode === 'login') {
      return email.includes('@') && password.length >= 6;
    } else {
      return (
        email.includes('@') &&
        password.length >= 6 &&
        password === confirmPassword &&
        name.trim().length > 0 &&
        username.trim().length > 0
      );
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </Text>
          
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder }]}
              placeholder="Enter your email"
              placeholderTextColor={colors.timestamp}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>


          {mode === 'signup' && (
            <>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Full Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder }]}
                  placeholder="Enter your full name"
                  placeholderTextColor={colors.timestamp}
                  value={name}
                  onChangeText={setName}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Username</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder }]}
                  placeholder="Choose a username"
                  placeholderTextColor={colors.timestamp}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
            </>
          )}

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder }]}
              placeholder="Enter your password"
              placeholderTextColor={colors.timestamp}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          {mode === 'signup' && (
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Confirm Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder }]}
                placeholder="Confirm your password"
                placeholderTextColor={colors.timestamp}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleSubmit}
            disabled={!isFormValid() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'login' ? 'Log In' : 'Sign Up'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Forgot Password Button (only in login mode) */}
          {mode === 'login' && (
            <TouchableOpacity
              style={{ marginTop: 10, alignItems: 'center' }}
              onPress={() => setShowForgotPassword(true)}
              disabled={loading}
            >
              <Text style={{ color: colors.primary, fontSize: 14 }}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {/* Forgot Password Modal */}
          {showForgotPassword && (
            <View style={{ marginTop: 24, padding: 16, backgroundColor: colors.background, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 }}>
              <Text style={{ color: colors.text, fontWeight: 'bold', marginBottom: 8 }}>Reset Password</Text>
              <Text style={{ color: colors.text, marginBottom: 8, fontSize: 13 }}>Enter your email address and we'll send you a reset link.</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder }]}
                placeholder="Email"
                placeholderTextColor={colors.timestamp}
                value={forgotEmail}
                onChangeText={setForgotEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!forgotLoading}
              />
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, marginTop: 12 }]}
                onPress={handleForgotPassword}
                disabled={forgotLoading || !forgotEmail.includes('@')}
              >
                {forgotLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>
              {forgotMessage ? (
                <Text style={{ color: forgotMessageColor, marginTop: 8, textAlign: 'center', fontSize: 13 }}>{forgotMessage}</Text>
              ) : null}
              <TouchableOpacity style={{ marginTop: 10, alignItems: 'center' }} onPress={() => {
                setShowForgotPassword(false);
                setForgotMessage('');
                setForgotEmail('');
              }}>
                <Text style={{ color: colors.primary, fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
            disabled={loading}
          >
            <Text style={[styles.switchModeText, { color: colors.primary }]}>
              {mode === 'login' 
                ? "Don't have an account? Sign Up" 
                : 'Already have an account? Log In'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 4,
  },
  button: {
    marginTop: 8,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchModeButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  switchModeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
  },
});

export default EmailAuthScreen;
