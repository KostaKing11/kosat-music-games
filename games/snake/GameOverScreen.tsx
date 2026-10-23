import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ParamListBase } from '@react-navigation/native';

import { playTrack } from '../../src/services/player';
import type { Track } from '../../src/services/spotifyApi';
import { colors, fonts, radius } from '../../src/theme';
import { AppButton } from '../../src/ui/AppButton';
import { Screen } from '../../src/ui/Screen';
import { useToast } from '../../src/ui/Toast';
import { CHORUS_FRACTION, SNAKE_ROUTES } from './constants';
import type { GameOverReason } from './useSnakeEngine';

export type GameOverParams = {
  score: number;
  record: number;
  isNewRecord: boolean;
  reason: GameOverReason;
  playlistName: string;
  /** Najnovija prva. */
  eaten: Track[];
  chorus: boolean;
};

const REASON_TEXT: Record<GameOverReason, string> = {
  wall: 'Udario si u zid.',
  self: 'Ujeo si sopstveni rep.',
  win: 'Pojeo si celu tablu!',
};

export function GameOverScreen({ navigation, route }: NativeStackScreenProps<ParamListBase>) {
  const params = route.params as GameOverParams;
  const [playingId, setPlayingId] = useState<string | null>(null);
  const { toast, showToast } = useToast();
  // Hronološki redosled: prva pojedena je prva u listi.
  const list = useMemo(() => params.eaten.slice().reverse(), [params.eaten]);

  const play = (track: Track) => {
    setPlayingId(track.id);
    const position = params.chorus ? Math.floor(track.durationMs * CHORUS_FRACTION) : 0;
    playTrack(track.uri, position).catch((e) => {
      setPlayingId(null);
      showToast(`Pesma nije puštena: ${String(e?.message ?? e)}`);
    });
  };

  return (
    <Screen>
      <Text style={styles.title}>KRAJ IGRE</Text>
      <Text style={styles.reason}>{REASON_TEXT[params.reason]}</Text>

      <View style={styles.scoreRow}>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreValue}>{params.score}</Text>
          <Text style={styles.scoreLabel}>POJEDENIH PESAMA</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreValue, { color: colors.accent }]}>{params.record}</Text>
          <Text style={styles.scoreLabel}>{params.isNewRecord ? 'NOVI REKORD' : 'REKORD'}</Text>
        </View>
      </View>
      <Text style={styles.playlist} numberOfLines={1}>
        {params.playlistName}
      </Text>

      <FlatList
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 12, gap: 8 }}
        data={list}
        keyExtractor={(t, i) => `${t.id}-${i}`}
        ListEmptyComponent={<Text style={styles.empty}>Ovaj put nijedna pesma nije pojedena.</Text>}
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => play(item)}
            style={({ pressed }) => [styles.row, playingId === item.id && styles.rowActive, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.index}>{index + 1}</Text>
            {item.thumbUrl ? (
              <Image source={{ uri: item.thumbUrl }} style={styles.cover} contentFit="cover" />
            ) : (
              <View style={[styles.cover, { backgroundColor: colors.panelRaised }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.trackName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.artist} numberOfLines={1}>
                {item.artist}
              </Text>
            </View>
            <Text style={[styles.playLabel, playingId === item.id && { color: colors.spotify }]}>
              {playingId === item.id ? 'SVIRA' : 'PUSTI'}
            </Text>
          </Pressable>
        )}
      />

      <View style={styles.actions}>
        <AppButton label="Opet" onPress={() => navigation.replace(SNAKE_ROUTES.play)} style={{ flex: 1 }} />
        <AppButton label="Meni" variant="outline" onPress={() => navigation.popTo('Menu')} style={{ flex: 1 }} />
      </View>
      {toast}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontFamily: fonts.pixelBold, fontSize: 36, textAlign: 'center', marginTop: 8, letterSpacing: 2 },
  reason: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  scoreRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  scoreBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoreValue: { color: colors.text, fontFamily: fonts.pixelBold, fontSize: 42, lineHeight: 48 },
  scoreLabel: { color: colors.textMuted, fontFamily: fonts.pixel, fontSize: 11, letterSpacing: 1 },
  playlist: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginVertical: 12 },
  list: { flex: 1 },
  empty: { color: colors.textMuted, fontFamily: fonts.body, textAlign: 'center', marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowActive: { borderColor: colors.spotify },
  index: { width: 24, color: colors.textMuted, fontFamily: fonts.pixel, fontSize: 14, textAlign: 'center' },
  cover: { width: 44, height: 44, borderRadius: 6 },
  trackName: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15 },
  artist: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  playLabel: { color: colors.textMuted, fontFamily: fonts.pixel, fontSize: 12, letterSpacing: 1 },
  actions: { flexDirection: 'row', gap: 12, paddingTop: 10 },
});
