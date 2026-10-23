import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors, fonts, radius } from '../theme';

type Variant = 'primary' | 'spotify' | 'outline' | 'text';

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  compact,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  compact?: boolean;
}) {
  const textColor =
    variant === 'spotify' ? colors.spotifyText : variant === 'primary' ? '#1a0610' : variant === 'text' ? colors.textMuted : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        styles[variant],
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, compact && styles.labelCompact, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: 22,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: 38, paddingHorizontal: 14, borderRadius: radius.sm },
  primary: { backgroundColor: colors.accent },
  spotify: { backgroundColor: colors.spotify, borderRadius: 999 },
  outline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  text: { backgroundColor: 'transparent', paddingHorizontal: 8 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  label: { fontFamily: fonts.bodySemi, fontSize: 16, letterSpacing: 0.2 },
  labelCompact: { fontSize: 14 },
});
