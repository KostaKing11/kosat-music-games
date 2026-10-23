import { StyleSheet, View } from 'react-native';

import { colors } from '../../src/theme';
import { PixelHeart } from '../../src/ui/PixelHeart';

const TILE = 18;
const BODY_COLORS = ['#7c4dff', '#ff9f43', '#2ec4b6', '#3a1630'];

/** Mala ilustracija zmije za karticu u meniju. */
export function SnakePreview() {
  return (
    <View style={styles.row}>
      {BODY_COLORS.slice()
        .reverse()
        .map((c, i) => (
          <View key={i} style={[styles.tile, { backgroundColor: c }]} />
        ))}
      <View style={[styles.tile, styles.head]}>
        <PixelHeart pixel={2} color="#fff3f8" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  tile: { width: TILE, height: TILE, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,79,154,0.6)' },
  head: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderColor: 'rgba(255,255,255,0.3)' },
});
