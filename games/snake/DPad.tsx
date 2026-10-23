import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../../src/theme';

const BUTTONS: { label: string; dir: number; area: 'up' | 'left' | 'right' | 'down' }[] = [
  { label: 'GORE', dir: 0, area: 'up' },
  { label: 'LEVO', dir: 3, area: 'left' },
  { label: 'DESNO', dir: 1, area: 'right' },
  { label: 'DOLE', dir: 2, area: 'down' },
];

/** D-pad ispod table. onPressIn umesto onPress – skretanje bez kašnjenja. */
export function DPad({ onTurn, size = 56, disabled }: { onTurn: (dir: number) => void; size?: number; disabled?: boolean }) {
  const button = (area: (typeof BUTTONS)[number]['area']) => {
    const b = BUTTONS.find((x) => x.area === area)!;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={b.label}
        disabled={disabled}
        onPressIn={() => onTurn(b.dir)}
        style={({ pressed }) => [styles.btn, { width: size * 1.45, height: size }, pressed && styles.pressed]}
      >
        <Text style={styles.label}>{b.label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[styles.root, disabled && styles.disabled]}>
      {button('up')}
      <View style={styles.middle}>
        {button('left')}
        <View style={{ width: size * 0.9 }} />
        {button('right')}
      </View>
      {button('down')}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 4 },
  middle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btn: {
    borderRadius: 12,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  label: { color: colors.text, fontFamily: fonts.pixel, fontSize: 14, letterSpacing: 1 },
  disabled: { opacity: 0.5 },
});
