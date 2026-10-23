import { StyleSheet, View } from 'react-native';

export const HEART_PATTERN = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];

/** Pikselasto srce od View-ova (za logo i ikonice van Skia platna). */
export function PixelHeart({ pixel = 6, color = '#ffffff' }: { pixel?: number; color?: string }) {
  return (
    <View>
      {HEART_PATTERN.map((row, y) => (
        <View key={y} style={styles.row}>
          {row.split('').map((c, x) => (
            <View
              key={x}
              style={{ width: pixel, height: pixel, backgroundColor: c === 'X' ? color : 'transparent' }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row' } });
