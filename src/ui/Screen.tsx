import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme';
import { StarField } from './StarField';

export function Screen({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <StarField />
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 },
          padded && styles.padded,
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  padded: { paddingHorizontal: 16 },
});
