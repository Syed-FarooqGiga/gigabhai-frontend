import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@react-navigation/native';

type TypingBubbleProps = { personalityEmoji?: string };

export const TypingBubble: React.FC<TypingBubbleProps> = ({ personalityEmoji }) => {
  const { colors } = useTheme();
  const [dotCount, setDotCount] = useState(1);
  const dotScales = [useRef(new Animated.Value(1)).current, useRef(new Animated.Value(1)).current, useRef(new Animated.Value(1)).current];

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Bouncing animation for dots
    dotScales.forEach((scale, idx) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(idx * 100),
          Animated.timing(scale, {
            toValue: 1.5,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.delay(300 - idx * 100),
        ])
      ).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '80%', marginVertical: 4, marginHorizontal: 8 }}>
      {personalityEmoji && <Text style={styles.emoji}>{personalityEmoji}</Text>}
      <View style={[styles.container, styles.botContainer, { backgroundColor: colors.primary, marginLeft: personalityEmoji ? 4 : 0 }]}>  
        <Text style={[styles.text, { color: '#fff' }]}>AI is typing{' '}
          {[0, 1, 2].map(i => (
            <Animated.Text
              key={i}
              style={{
                transform: [{ scale: dotScales[i] }],
                color: '#fff',
                fontSize: 18,
                marginHorizontal: 1,
              }}>
              .
            </Animated.Text>
          ))}
        </Text>
      </View>
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
  emoji: {
    fontSize: 24,
    marginRight: 4,
    alignSelf: 'center',
  },
});

  text: {
    fontSize: 16,
  },
});
