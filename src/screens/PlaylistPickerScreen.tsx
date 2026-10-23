import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/types';
import { UNAVAILABLE_EXPLANATION, clearAll, loadPlaylists, playlistsStore, selectPlaylist } from '../services/playlistStore';
import { signOut } from '../services/spotifyAuth';
import type { PlaylistSummary } from '../services/spotifyApi';
import { useStore } from '../services/store';
import { colors, fonts, radius } from '../theme';
import { AppButton } from '../ui/AppButton';
import { PixelHeart } from '../ui/PixelHeart';
import { Screen } from '../ui/Screen';

type Props = NativeStackScreenProps<RootStackParamList, 'Playlists'>;

export function PlaylistPickerScreen({ navigation }: Props) {
  const { status, playlists, error, me } = useStore(playlistsStore);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void loadPlaylists();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await loadPlaylists();
    setRefreshing(false);
  };

  const choose = (p: PlaylistSummary) => {
    if (!p.accessible) {
      setExpanded((cur) => (cur === p.id ? null : p.id));
      return;
    }
    void selectPlaylist(p);
    if (navigation.canGoBack()) navigation.popTo('Menu');
    else navigation.replace('Menu');
  };

  const logout = async () => {
    await clearAll();
    await signOut();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Izaberi plejlistu</Text>
          {me ? <Text style={styles.muted}>Prijavljen: {me.displayName}</Text> : null}
        </View>
        <AppButton label="Odjavi se" variant="text" compact onPress={logout} />
      </View>

      {status === 'loading' && playlists.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.muted}>Učitavam plejliste…</Text>
        </View>
      ) : status === 'error' && playlists.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <AppButton label="Probaj ponovo" variant="outline" onPress={() => void loadPlaylists()} />
        </View>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.panel} />}
          renderItem={({ item }) => (
            <PlaylistRow playlist={item} expanded={expanded === item.id} onPress={() => choose(item)} />
          )}
        />
      )}
    </Screen>
  );
}

function PlaylistRow({ playlist, expanded, onPress }: { playlist: PlaylistSummary; expanded: boolean; onPress: () => void }) {
  const unavailable = !playlist.accessible;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
      <View style={styles.rowMain}>
        {playlist.kind === 'liked' ? (
          <View style={[styles.cover, styles.likedCover]}>
            <PixelHeart pixel={4} color="#fff3f8" />
          </View>
        ) : playlist.imageUrl ? (
          <Image source={{ uri: playlist.imageUrl }} style={[styles.cover, unavailable && styles.dim]} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.cover, styles.emptyCover]} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, unavailable && styles.nameDim]} numberOfLines={1}>
            {playlist.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {unavailable
              ? `Nedostupna · plejlista korisnika ${playlist.ownerName}`
              : playlist.total !== null
                ? `${playlist.total} ${playlist.total === 1 ? 'pesma' : 'pesama'}${playlist.collaborative ? ' · zajednička' : ''}`
                : 'Broj pesama nepoznat'}
          </Text>
        </View>
        {unavailable ? <Text style={styles.why}>{expanded ? 'ZATVORI' : 'ZAŠTO?'}</Text> : null}
      </View>
      {unavailable && expanded ? <Text style={styles.explain}>{UNAVAILABLE_EXPLANATION}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 4 },
  title: { color: colors.text, fontFamily: fonts.pixelBold, fontSize: 28 },
  muted: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  error: { color: colors.danger, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  row: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 10,
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 56, height: 56, borderRadius: 8 },
  likedCover: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  emptyCover: { backgroundColor: colors.panelRaised },
  dim: { opacity: 0.4 },
  name: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 16 },
  nameDim: { color: colors.textMuted },
  meta: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  why: { color: colors.accent, fontFamily: fonts.pixel, fontSize: 11, letterSpacing: 1 },
  explain: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: 10 },
});
