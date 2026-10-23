import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeIn,
  ZoomIn,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ParamListBase } from '@react-navigation/native';

import { LISTENING_SCOPES, getListeningStats, type ListeningStats } from '../../src/services/listeningStats';
import { playTrack, playerStore, preparePlayer } from '../../src/services/player';
import { selectionStore } from '../../src/services/playlistStore';
import type { Track } from '../../src/services/spotifyApi';
import { sessionVersionStore, useSpotifyLogin } from '../../src/services/spotifyAuth';
import { useStore } from '../../src/services/store';
import { colors, fonts, radius } from '../../src/theme';
import { AppButton } from '../../src/ui/AppButton';
import { Screen } from '../../src/ui/Screen';
import { SpotifyStatus } from '../../src/ui/SpotifyStatus';
import { useToast } from '../../src/ui/Toast';
import { DropStar, type DropAnimations, type Spark } from './DropStar';
import {
  RARITIES,
  TAPS_TO_OPEN,
  assignTiers,
  pickTrack,
  planUpgrades,
  rollRarity,
  type RarityLevel,
} from './rarity';
import { loadSettings, loadStats, saveSettings, saveStats, type DropStats } from './storage';

const CHORUS_FRACTION = 0.35;
const RECENT_LIMIT = 15;

type Phase = 'loading' | 'ready' | 'opening' | 'revealed';
type Pull = { track: Track; level: RarityLevel; id: number };

export function SongDropScreen({ navigation }: NativeStackScreenProps<ParamListBase>) {
  const { playlist, tracks } = useStore(selectionStore);
  const sessionVersion = useStore(sessionVersionStore);
  const player = useStore(playerStore);
  const login = useSpotifyLogin();
  const { width } = useWindowDimensions();
  const dropSize = Math.min(width - 32, 340);
  const { toast, showToast } = useToast();

  const [listening, setListening] = useState<ListeningStats | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [level, setLevel] = useState(0);
  const [taps, setTaps] = useState(0);
  const [current, setCurrent] = useState<Pull | null>(null);
  const [history, setHistory] = useState<Pull[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [upgradeLabel, setUpgradeLabel] = useState<{ id: number; text: string; color: string } | null>(null);
  const [stats, setStats] = useState<DropStats>({ opened: 0, byLevel: [0, 0, 0, 0, 0] });
  const [chorus, setChorus] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  const planRef = useRef<boolean[]>([]);
  // Ref-ovi da brzi uzastopni tapovi ne čitaju zastarelo stanje.
  const tapsRef = useRef(0);
  const levelRef = useRef(0);
  const pullRef = useRef<Pull | null>(null);
  const recentRef = useRef<string[]>([]);
  const idRef = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const chorusRef = useRef(chorus);
  chorusRef.current = chorus;

  const anim: DropAnimations = {
    entry: useSharedValue(0),
    squash: useSharedValue(1),
    shake: useSharedValue(0),
    flash: useSharedValue(0),
    open: useSharedValue(0),
  };

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  // Podaci o slušanju -> retkost svake pesme u plejlisti.
  useEffect(() => {
    let active = true;
    getListeningStats().then((s) => active && setListening(s));
    return () => {
      active = false;
    };
  }, [sessionVersion]);

  const tiers = useMemo(
    () => (listening ? assignTiers(tracks, listening.scores) : null),
    [listening, tracks]
  );
  const tierCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    if (tiers) Object.values(tiers).forEach((l) => counts[l]++);
    return counts;
  }, [tiers]);

  useEffect(() => {
    void preparePlayer();
    loadSettings().then((s) => setChorus(s.chorus));
    if (playlist) loadStats(playlist.id).then(setStats);
  }, [playlist]);

  const spark = useCallback((count: number, color: string, power: number) => {
    const id = ++idRef.current;
    setSparks((s) => [...s, { id, count, colors: [color, '#ffffff', color], power }]);
    later(() => setSparks((s) => s.filter((x) => x.id !== id)), 1200);
  }, []);

  /** Novi drop: unapred izvuci retkost i pesmu, pa animiraj pad. */
  const newDrop = useCallback(() => {
    if (!tiers || tracks.length === 0) return;
    const pull = pickTrack(tracks, tiers, rollRarity(), new Set(recentRef.current));
    if (!pull) return;
    pullRef.current = { ...pull, id: ++idRef.current };
    planRef.current = planUpgrades(pull.level);
    tapsRef.current = 0;
    levelRef.current = 0;
    setLevel(0);
    setTaps(0);
    setCurrent(null);
    setUpgradeLabel(null);
    anim.open.value = 0;
    anim.flash.value = 0;
    anim.squash.value = 1;
    anim.shake.value = 0;
    anim.entry.value = 0;
    anim.entry.value = withSpring(1, { damping: 9, stiffness: 120 });
    setPhase('ready');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiers, tracks]);

  // Prvi drop čim su retkosti izračunate.
  useEffect(() => {
    if (phase === 'loading' && tiers && tracks.length > 0) newDrop();
  }, [phase, tiers, tracks.length, newDrop]);

  const reveal = useCallback(() => {
    const pull = pullRef.current;
    if (!pull) return;
    setCurrent(pull);
    setPhase('revealed');
    setHistory((h) => [pull, ...h].slice(0, 20));
    recentRef.current = [pull.track.uri, ...recentRef.current].slice(0, RECENT_LIMIT);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

    const position = chorusRef.current ? Math.floor(pull.track.durationMs * CHORUS_FRACTION) : 0;
    playTrack(pull.track.uri, position).catch((e) => showToast(`Pesma nije puštena: ${String(e?.message ?? e)}`));

    if (playlist) {
      setStats((prev) => {
        const byLevel = prev.byLevel.slice();
        byLevel[pull.level] = (byLevel[pull.level] ?? 0) + 1;
        const next = { opened: prev.opened + 1, byLevel };
        void saveStats(playlist.id, next);
        return next;
      });
    }
  }, [playlist, showToast]);

  const onTap = () => {
    if (phase !== 'ready' || !pullRef.current || tapsRef.current >= TAPS_TO_OPEN) return;
    const tapIndex = tapsRef.current;
    const nextTaps = tapIndex + 1;
    tapsRef.current = nextTaps;
    setTaps(nextTaps);

    anim.squash.value = withSequence(withTiming(0.82, { duration: 70 }), withSpring(1, { damping: 5, stiffness: 260 }));
    anim.shake.value = withSequence(
      withTiming(0.12, { duration: 50 }),
      withTiming(-0.1, { duration: 70 }),
      withTiming(0.05, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );

    const upgraded = planRef.current[tapIndex];
    let shown = levelRef.current;
    if (upgraded) {
      shown = Math.min(shown + 1, RARITIES.length - 1);
      levelRef.current = shown;
      setLevel(shown);
      anim.flash.value = withSequence(withTiming(0.9, { duration: 70 }), withTiming(0, { duration: 420 }));
      spark(14 + shown * 4, RARITIES[shown].color, 0.4 + shown * 0.15);
      setUpgradeLabel({ id: ++idRef.current, text: `${RARITIES[shown].name}!`, color: RARITIES[shown].color });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }

    if (nextTaps >= TAPS_TO_OPEN) {
      setPhase('opening');
      later(() => {
        anim.open.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) });
        spark(40 + shown * 8, RARITIES[shown].color, 1 + shown * 0.25);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
        later(reveal, 320);
      }, upgraded ? 650 : 280);
    }
  };

  const replay = (pull: Pull) => {
    const position = chorusRef.current ? Math.floor(pull.track.durationMs * CHORUS_FRACTION) : 0;
    playTrack(pull.track.uri, position).catch((e) => showToast(`Pesma nije puštena: ${String(e?.message ?? e)}`));
  };

  const toggleChorus = (value: boolean) => {
    setChorus(value);
    void saveSettings({ chorus: value });
  };

  if (!playlist || tracks.length === 0) {
    return (
      <Screen style={styles.center}>
        <Text style={styles.title}>Nema pesama</Text>
        <Text style={styles.muted}>Izaberi plejlistu sa pesmama pa probaj ponovo.</Text>
        <AppButton label="Meni" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
      </Screen>
    );
  }

  const rarity = RARITIES[current?.level ?? level];
  const score = current && listening ? listening.scores[current.track.uri] ?? 0 : 0;

  return (
    <Screen>
      <View style={styles.topBar}>
        <AppButton label="Meni" variant="text" compact onPress={() => navigation.goBack()} />
        <Text style={styles.title}>SONG DROP</Text>
        <View style={styles.counter}>
          <Text style={styles.counterValue}>{stats.opened}</Text>
          <Text style={styles.counterLabel}>OTVORENO</Text>
        </View>
      </View>

      <Pressable style={styles.tierRow} onPress={() => setShowInfo((v) => !v)}>
        {RARITIES.map((r, i) => (
          <View key={r.name} style={styles.tierItem}>
            <View style={[styles.tierDot, { backgroundColor: r.color }]} />
            <Text style={styles.tierCount}>{tierCounts[i]}</Text>
          </View>
        ))}
        <Text style={styles.infoToggle}>{showInfo ? 'ZATVORI' : 'RETKOSTI'}</Text>
      </Pressable>

      {showInfo ? (
        <View style={styles.infoPanel}>
          {RARITIES.map((r, i) => (
            <View key={r.name} style={styles.infoRow}>
              <Text style={[styles.infoName, { color: r.color }]}>{r.name}</Text>
              <Text style={styles.infoText}>
                {tierCounts[i]} pesama · šansa {Math.round(r.odds * 100)}% · izvučeno {stats.byLevel[i] ?? 0}
              </Text>
            </View>
          ))}
          <Text style={styles.infoNote}>
            Što više slušaš pesmu (Spotify top liste za 4 nedelje, 6 meseci i godinu + nedavno slušano), to je ona češća. Pesme koje skoro ne slušaš su legendarne.
          </Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingText}>Počni od refrena</Text>
            <Switch
              value={chorus}
              onValueChange={toggleChorus}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={chorus ? '#ffe3ef' : colors.textMuted}
            />
          </View>
        </View>
      ) : null}

      {listening?.status === 'missing-scope' ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Treba još jedna Spotify dozvola</Text>
          <Text style={styles.noticeBody}>
            Da bi retkost zavisila od toga koliko slušaš pesme, Spotify mora da dozvoli čitanje tvojih top lista ({LISTENING_SCOPES.join(', ')}). Do tada je retkost po datumu dodavanja.
          </Text>
          <AppButton label="Daj dozvolu" variant="spotify" compact onPress={login.login} loading={login.busy} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
          {login.error ? <Text style={styles.error}>{login.error}</Text> : null}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.stage} showsVerticalScrollIndicator={false}>
        {phase === 'revealed' && current ? (
          <Animated.View key={current.id} entering={ZoomIn.springify().damping(12)} style={styles.reveal}>
            <View style={[styles.coverFrame, { borderColor: rarity.color, shadowColor: rarity.color }]}>
              {current.track.coverLargeUrl || current.track.coverUrl ? (
                <Image
                  source={{ uri: current.track.coverLargeUrl ?? current.track.coverUrl ?? undefined }}
                  style={{ width: dropSize * 0.72, height: dropSize * 0.72 }}
                  contentFit="cover"
                  transition={120}
                />
              ) : (
                <View style={{ width: dropSize * 0.72, height: dropSize * 0.72, backgroundColor: colors.panelRaised }} />
              )}
            </View>
            <Text style={[styles.rarityName, { color: rarity.color }]}>{rarity.name}</Text>
            <Text style={styles.songName} numberOfLines={2}>
              {current.track.name}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {current.track.artist}
            </Text>
            <Text style={styles.why}>
              {listening?.status !== 'ok'
                ? 'Retkost po datumu dodavanja'
                : score > 2
                  ? 'Jedna od tvojih najslušanijih'
                  : score > 0
                    ? 'Slušaš je s vremena na vreme'
                    : 'Skoro je ne slušaš'}
            </Text>
          </Animated.View>
        ) : (
          <Pressable onPress={onTap} disabled={phase !== 'ready'} style={styles.dropArea}>
            <DropStar size={dropSize} level={level} anim={anim} sparks={sparks} />
            <View style={styles.dropLabel}>
              {upgradeLabel ? (
                <Animated.Text key={upgradeLabel.id} entering={ZoomIn.springify().damping(8)} style={[styles.upgrade, { color: upgradeLabel.color }]}>
                  {upgradeLabel.text}
                </Animated.Text>
              ) : (
                <Text style={styles.tapHint}>{phase === 'loading' ? 'Računam retkosti…' : 'TAPNI DROP'}</Text>
              )}
              {phase !== 'loading' ? (
                <View style={styles.tapDots}>
                  {Array.from({ length: TAPS_TO_OPEN }, (_, i) => (
                    <View key={i} style={[styles.tapDot, i < taps && { backgroundColor: RARITIES[level].color }]} />
                  ))}
                </View>
              ) : null}
            </View>
          </Pressable>
        )}
      </ScrollView>

      {history.length > 0 ? (
        <Animated.View entering={FadeIn} style={styles.historyWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {history.map((p) => (
              <Pressable key={p.id} onPress={() => replay(p)}>
                {p.track.thumbUrl ? (
                  <Image source={{ uri: p.track.thumbUrl }} style={[styles.historyCover, { borderColor: RARITIES[p.level].color }]} />
                ) : (
                  <View style={[styles.historyCover, { borderColor: RARITIES[p.level].color, backgroundColor: colors.panelRaised }]} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}

      {player.mode !== 'remote' && player.mode !== 'web' && player.mode !== 'idle' && player.mode !== 'connecting' ? (
        <View style={{ marginBottom: 8 }}>
          <SpotifyStatus compact />
        </View>
      ) : null}

      {phase === 'revealed' && current ? (
        <View style={styles.actions}>
          <AppButton label="Sledeći drop" onPress={newDrop} style={{ flex: 1.4 }} />
          <AppButton label="Pusti ponovo" variant="outline" onPress={() => replay(current)} style={{ flex: 1 }} />
        </View>
      ) : null}
      {toast}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontFamily: fonts.pixelBold, fontSize: 24, letterSpacing: 2 },
  muted: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  counter: { alignItems: 'center', minWidth: 70 },
  counterValue: { color: colors.accent, fontFamily: fonts.pixelBold, fontSize: 22, lineHeight: 26 },
  counterLabel: { color: colors.textMuted, fontFamily: fonts.pixel, fontSize: 9, letterSpacing: 1 },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tierDot: { width: 10, height: 10, borderRadius: 3 },
  tierCount: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 13 },
  infoToggle: { marginLeft: 'auto', color: colors.accent, fontFamily: fonts.pixel, fontSize: 11, letterSpacing: 1 },
  infoPanel: {
    marginTop: 8,
    padding: 12,
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  infoName: { fontFamily: fonts.pixelBold, fontSize: 13, width: 104 },
  infoText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, flex: 1 },
  infoNote: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  settingText: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 14 },
  notice: {
    marginTop: 8,
    padding: 12,
    gap: 4,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noticeTitle: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 14 },
  noticeBody: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  error: { color: colors.danger, fontFamily: fonts.body, fontSize: 12 },
  stage: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  dropArea: { alignItems: 'center' },
  dropLabel: { alignItems: 'center', gap: 10, minHeight: 64 },
  tapHint: { color: colors.textMuted, fontFamily: fonts.pixel, fontSize: 16, letterSpacing: 3 },
  upgrade: { fontFamily: fonts.pixelBold, fontSize: 30, letterSpacing: 3, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  tapDots: { flexDirection: 'row', gap: 8 },
  tapDot: { width: 12, height: 12, borderRadius: 3, backgroundColor: colors.border },
  reveal: { alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  coverFrame: {
    borderWidth: 3,
    borderRadius: 18,
    overflow: 'hidden',
    shadowOpacity: 0.9,
    shadowRadius: 24,
    elevation: 16,
    marginBottom: 10,
  },
  rarityName: { fontFamily: fonts.pixelBold, fontSize: 30, letterSpacing: 3 },
  songName: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 22, textAlign: 'center' },
  artist: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 15 },
  why: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  historyWrap: { marginBottom: 10 },
  historyCover: { width: 44, height: 44, borderRadius: 8, borderWidth: 2 },
  actions: { flexDirection: 'row', gap: 12 },
});
