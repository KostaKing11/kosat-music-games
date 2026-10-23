import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { GAMES, type GameDefinition } from '../../games';
import type { RootStackParamList } from '../navigation/types';
import { isSpotifyInstalled, playerStore, preparePlayer } from '../services/player';
import { UNAVAILABLE_EXPLANATION, retrySelection, selectionStore } from '../services/playlistStore';
import { useStore } from '../services/store';
import { colors, fonts, radius } from '../theme';
import { AppButton } from '../ui/AppButton';
import { PixelHeart } from '../ui/PixelHeart';
import { Screen } from '../ui/Screen';
import { SpotifyStatus } from '../ui/SpotifyStatus';

type Props = NativeStackScreenProps<RootStackParamList, 'Menu'>;

export function GameMenuScreen({ navigation }: Props) {
  const selection = useStore(selectionStore);
  const player = useStore(playerStore);
  const { playlist, status, tracks, loaded, total } = selection;
  const [badges, setBadges] = useState<Record<string, string | null>>({});

  // Poveži se sa Spotify-jem unapred, da igra odmah krene sa muzikom.
  useEffect(() => {
    if (playerStore.get().mode === 'idle') void preparePlayer();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!playlist) return;
      let active = true;
      Promise.all(GAMES.map(async (g) => [g.id, g.getBadge ? await g.getBadge(playlist.id) : null] as const)).then(
        (entries) => active && setBadges(Object.fromEntries(entries))
      );
      return () => {
        active = false;
      };
    }, [playlist])
  );

  const openGame = (game: GameDefinition) => {
    if (game.status !== 'available' || !game.entryScreen) return;
    navigation.navigate(game.entryScreen);
  };

  const ready = status === 'ready' && tracks.length > 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.brand}>KOSAT</Text>
          <Text style={styles.brandSub}>MUSIC GAMES</Text>
        </View>

        <Pressable style={styles.playlistCard} onPress={() => navigation.navigate('Playlists')}>
          {playlist?.kind === 'liked' ? (
            <View style={[styles.cover, styles.likedCover]}>
              <PixelHeart pixel={4} color="#fff3f8" />
            </View>
          ) : playlist?.imageUrl ? (
            <Image source={{ uri: playlist.imageUrl }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, { backgroundColor: colors.panelRaised }]} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>PLEJLISTA</Text>
            <Text style={styles.playlistName} numberOfLines={1}>
              {playlist?.name ?? 'Nije izabrana'}
            </Text>
            <PlaylistState status={status} loaded={loaded} total={total} count={tracks.length} refreshing={selection.refreshing} />
          </View>
          <Text style={styles.change}>PROMENI</Text>
        </Pressable>

        {status === 'unavailable' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Ova plejlista nije dostupna</Text>
            <Text style={styles.noticeBody}>{UNAVAILABLE_EXPLANATION}</Text>
          </View>
        ) : null}
        {status === 'error' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Pesme nisu učitane</Text>
            <Text style={styles.noticeBody}>{selection.error}</Text>
            <AppButton label="Probaj ponovo" variant="outline" compact onPress={retrySelection} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
          </View>
        ) : null}

        {!isSpotifyInstalled() || player.mode === 'not-installed' ? <SpotifyStatus /> : null}

        <Text style={styles.section}>IGRE</Text>
        {GAMES.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            badge={badges[game.id] ?? null}
            disabled={game.status === 'available' && !ready}
            onPress={() => openGame(game)}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

function PlaylistState({
  status,
  loaded,
  total,
  count,
  refreshing,
}: {
  status: string;
  loaded: number;
  total: number | null;
  count: number;
  refreshing: boolean;
}) {
  if (status === 'loading') {
    return (
      <View style={styles.stateRow}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.stateText}>
          Učitavam pesme {loaded}
          {total ? ` / ${total}` : ''}
        </Text>
      </View>
    );
  }
  if (status === 'ready') {
    return (
      <Text style={styles.stateText}>
        {count} pesama spremno{refreshing ? ' · proveravam izmene' : ''}
      </Text>
    );
  }
  if (status === 'unavailable') return <Text style={[styles.stateText, { color: colors.danger }]}>Nedostupna</Text>;
  if (status === 'error') return <Text style={[styles.stateText, { color: colors.danger }]}>Greška pri učitavanju</Text>;
  return <Text style={styles.stateText}>Izaberi plejlistu</Text>;
}

function GameCard({
  game,
  badge,
  disabled,
  onPress,
}: {
  game: GameDefinition;
  badge: string | null;
  disabled: boolean;
  onPress: () => void;
}) {
  const locked = game.status === 'soon';
  const Preview = game.Preview;
  return (
    <Pressable
      onPress={onPress}
      disabled={locked || disabled}
      style={({ pressed }) => [styles.gameCard, locked && styles.gameLocked, pressed && { transform: [{ scale: 0.985 }] }]}
    >
      <View style={styles.gameTop}>
        <Text style={[styles.gameTitle, locked && { color: colors.textMuted }]}>
          {locked ? `${game.title} – uskoro` : game.title}
        </Text>
        {locked ? <Text style={styles.lockTag}>ZAKLJUČANO</Text> : badge ? <Text style={styles.badge}>{badge}</Text> : null}
      </View>
      {!locked ? <Text style={styles.gameTagline}>{game.tagline}</Text> : <Text style={styles.gameTagline}>Nova igra stiže uskoro.</Text>}
      <View style={styles.gameBottom}>
        {Preview ? <Preview /> : <View />}
        {!locked ? <Text style={[styles.play, disabled && { color: colors.textMuted }]}>{disabled ? 'ČEKAM PESME' : 'IGRAJ'}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brand: { color: colors.text, fontFamily: fonts.pixelBold, fontSize: 34, letterSpacing: 4, lineHeight: 38 },
  brandSub: { color: colors.accent, fontFamily: fonts.pixel, fontSize: 14, letterSpacing: 4 },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: { width: 60, height: 60, borderRadius: 8 },
  likedCover: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.textMuted, fontFamily: fonts.pixel, fontSize: 10, letterSpacing: 1 },
  playlistName: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 17 },
  change: { color: colors.accent, fontFamily: fonts.pixel, fontSize: 12, letterSpacing: 1 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stateText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  notice: {
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  noticeTitle: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15 },
  noticeBody: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  section: { color: colors.textMuted, fontFamily: fonts.pixel, fontSize: 12, letterSpacing: 2, marginTop: 6 },
  gameCard: {
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.accent,
    gap: 8,
  },
  gameLocked: { borderColor: colors.border, opacity: 0.6 },
  gameTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  gameTitle: { color: colors.text, fontFamily: fonts.pixelBold, fontSize: 26, flexShrink: 1 },
  lockTag: {
    color: colors.textMuted,
    fontFamily: fonts.pixel,
    fontSize: 10,
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badge: {
    color: colors.accent,
    fontFamily: fonts.pixel,
    fontSize: 12,
    backgroundColor: colors.accentSoft,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  gameTagline: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
  gameBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  play: { color: colors.accent, fontFamily: fonts.pixelBold, fontSize: 18, letterSpacing: 2 },
});
