import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import type { Track } from '../../src/services/spotifyApi';
import { colors, fonts, radius } from '../../src/theme';

/** Traka "Sledeća na meniju": pesma koja je trenutno hrana. */
export function NextUpBar({ track }: { track: Track | null }) {
  return (
    <View style={styles.bar}>
      {track?.thumbUrl || track?.coverUrl ? (
        <Image source={{ uri: track.coverUrl ?? track.thumbUrl ?? undefined }} style={styles.cover} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.cover, styles.placeholder]} />
      )}
      <View style={styles.texts}>
        <Text style={styles.label}>SLEDEĆA NA MENIJU</Text>
        <Text style={styles.title} numberOfLines={1}>
          {track?.name ?? '—'}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track?.artist ?? ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: { width: 46, height: 46, borderRadius: 8 },
  placeholder: { backgroundColor: colors.panelRaised },
  texts: { flex: 1 },
  label: { color: colors.accent, fontFamily: fonts.pixel, fontSize: 11, letterSpacing: 1 },
  title: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15 },
  artist: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
});
