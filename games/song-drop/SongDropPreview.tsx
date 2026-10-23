import { StyleSheet, View } from 'react-native';

import { RARITIES } from './rarity';

/** Mala ilustracija za karticu u meniju: dropovi u bojama retkosti. */
export function SongDropPreview() {
  return (
    <View style={styles.row}>
      {RARITIES.map((r, i) => (
        <View
          key={r.name}
          style={[styles.gem, { backgroundColor: r.color, width: 14 + i * 2, height: 14 + i * 2, borderColor: r.dark }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gem: { borderRadius: 4, borderWidth: 2, transform: [{ rotate: '45deg' }] },
});
