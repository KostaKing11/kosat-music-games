import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import type { Track } from '../../src/services/spotifyApi';
import { colors, fonts, radius } from '../../src/theme';
import { SORT_OPTIONS, type CollectedEntry, type Collection, type SortMode } from './collection';
import { RARITIES, type RarityLevel } from './rarity';

/** Naslov kolekcije: napredak, napredak po retkosti, sortiranje. */
export function CollectionHeader({
  tracks,
  tiers,
  collection,
  sortMode,
  onSortMode,
  collectedFirst,
  onCollectedFirst,
}: {
  tracks: Track[];
  tiers: Record<string, RarityLevel>;
  collection: Collection;
  sortMode: SortMode;
  onSortMode: (mode: SortMode) => void;
  collectedFirst: boolean;
  onCollectedFirst: (value: boolean) => void;
}) {
  const progress = useMemo(() => {
    const total = [0, 0, 0, 0, 0];
    const got = [0, 0, 0, 0, 0];
    let duplicates = 0;
    for (const t of tracks) {
      const level = tiers[t.uri] ?? 0;
      total[level]++;
      const entry = collection[t.uri];
      if (entry) {
        got[level]++;
        duplicates += entry.count - 1;
      }
    }
    const collected = got.reduce((a, b) => a + b, 0);
    return { total, got, collected, duplicates };
  }, [tracks, tiers, collection]);

  const percent = tracks.length ? progress.collected / tracks.length : 0;

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>KOLEKCIJA</Text>
        <Text style={styles.count}>
          {progress.collected}/{tracks.length}
        </Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${Math.max(percent * 100, percent > 0 ? 2 : 0)}%` }]} />
      </View>
      <Text style={styles.sub}>
        Skupljeno {Math.round(percent * 100)}% · duplikata {progress.duplicates}
      </Text>

      <View style={styles.tierGrid}>
        {RARITIES.map((r, i) => (
          <View key={r.name} style={[styles.tierBox, { borderColor: progress.got[i] === progress.total[i] && progress.total[i] > 0 ? r.color : colors.border }]}>
            <Text style={[styles.tierName, { color: r.color }]} numberOfLines={1}>
              {r.name}
            </Text>
            <Text style={styles.tierValue}>
              {progress.got[i]}/{progress.total[i]}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SORT_OPTIONS.map((o) => (
          <Pressable key={o.id} onPress={() => onSortMode(o.id)} style={[styles.chip, sortMode === o.id && styles.chipActive]}>
            <Text style={[styles.chipText, sortMode === o.id && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => onCollectedFirst(!collectedFirst)} style={[styles.chip, collectedFirst && styles.chipActive]}>
          <Text style={[styles.chipText, collectedFirst && styles.chipTextActive]}>Skupljene prvo</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** Jedna pesma u kolekciji. Neskupljene su zatamnjene. */
export const CollectionCell = memo(function CollectionCell({
  track,
  level,
  entry,
  size,
  onPress,
}: {
  track: Track;
  level: RarityLevel;
  entry: CollectedEntry | undefined;
  size: number;
  onPress: (track: Track) => void;
}) {
  const rarity = RARITIES[level];
  const owned = !!entry;
  return (
    <Pressable onPress={() => onPress(track)} style={({ pressed }) => [{ width: size }, pressed && { opacity: 0.7 }]}>
      <View
        style={[
          styles.cover,
          { width: size, height: size, borderColor: owned ? rarity.color : colors.border },
        ]}
      >
        {track.thumbUrl || track.coverUrl ? (
          <Image
            source={{ uri: track.coverUrl ?? track.thumbUrl ?? undefined }}
            style={[StyleSheet.absoluteFill, !owned && styles.dimImage]}
            contentFit="cover"
            recyclingKey={track.uri}
          />
        ) : null}
        {!owned ? (
          <View style={styles.lock}>
            <Text style={styles.lockText}>?</Text>
          </View>
        ) : null}
        <View style={[styles.rarityDot, { backgroundColor: rarity.color, opacity: owned ? 1 : 0.45 }]} />
        {entry && entry.count > 1 ? (
          <View style={styles.dupe}>
            <Text style={styles.dupeText}>×{entry.count}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.name, !owned && styles.nameDim]} numberOfLines={1}>
        {track.name}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  header: {
    marginTop: 22,
    marginBottom: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { color: colors.text, fontFamily: fonts.pixelBold, fontSize: 24, letterSpacing: 2 },
  count: { color: colors.accent, fontFamily: fonts.pixelBold, fontSize: 20 },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.panelRaised, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  sub: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  tierGrid: { flexDirection: 'row', gap: 6 },
  tierBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    backgroundColor: colors.panel,
  },
  tierName: { fontFamily: fonts.pixel, fontSize: 8, letterSpacing: 0.5 },
  tierValue: { color: colors.text, fontFamily: fonts.pixelBold, fontSize: 13 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { color: colors.textMuted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  chipTextActive: { color: colors.text },
  cover: {
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: colors.panelRaised,
  },
  dimImage: { opacity: 0.16 },
  lock: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  lockText: { color: colors.textMuted, fontFamily: fonts.pixelBold, fontSize: 22, opacity: 0.8 },
  rarityDot: { position: 'absolute', left: 5, bottom: 5, width: 9, height: 9, borderRadius: 3 },
  dupe: {
    position: 'absolute',
    right: 4,
    top: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(7, 6, 15, 0.85)',
  },
  dupeText: { color: colors.text, fontFamily: fonts.pixelBold, fontSize: 11 },
  name: { color: colors.text, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  nameDim: { color: colors.textMuted, opacity: 0.6 },
});
