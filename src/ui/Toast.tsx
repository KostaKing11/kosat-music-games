import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { colors, fonts, radius } from '../theme';

/** Mala nenametljiva poruka (npr. kad puštanje pesme ne uspe). */
export function useToast(durationMs = 2600) {
  const [message, setMessage] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage({ id: Date.now(), text });
      timer.current = setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs]
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const node = message ? (
    <Animated.View key={message.id} entering={FadeInUp.duration(180)} exiting={FadeOutUp.duration(180)} style={styles.toast} pointerEvents="none">
      <Text style={styles.text} numberOfLines={2}>
        {message.text}
      </Text>
    </Animated.View>
  ) : null;

  return { toast: node, showToast: show };
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(17, 15, 29, 0.96)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    zIndex: 50,
  },
  text: { color: colors.text, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
});
