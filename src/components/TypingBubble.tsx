import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@react-navigation/native';

export const TypingBubble: React.FC = () => {
  const { colors } = useTheme();
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[styles.container, styles.botContainer, { backgroundColor: colors.primary }]}>  
      <Text style={[styles.text, { color: '#fff' }]}>AI is typing{'.'.repeat(dotCount)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
    marginHorizontal: 8,
    alignSelf: 'flex-start',
  },
  botContainer: {
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 16,
  },
});
