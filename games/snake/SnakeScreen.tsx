import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { Easing, withTiming } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ParamListBase } from '@react-navigation/native';

import { FALLBACK_COLORS, loadCover, prefetchCovers, type Cover } from '../../src/services/coverImages';
import { playTrack, preparePlayer, startRadio } from '../../src/services/player';
import { selectionStore } from '../../src/services/playlistStore';
import type { Track } from '../../src/services/spotifyApi';
import { useStore } from '../../src/services/store';
import { colors, fonts, radius } from '../../src/theme';
import { AppButton } from '../../src/ui/AppButton';
import { Screen } from '../../src/ui/Screen';
import { SpotifyStatus } from '../../src/ui/SpotifyStatus';
import { useToast } from '../../src/ui/Toast';
import { CHORUS_FRACTION, GRID, SNAKE_ROUTES } from './constants';
import { DPad } from './DPad';
import type { GameOverParams } from './GameOverScreen';
import { NextUpBar } from './NextUpBar';
import { SnakeBoard, type Burst, type PlusOne } from './SnakeBoard';
import { DEFAULT_SETTINGS, loadRecord, loadSettings, saveRecord, saveSettings, type SnakeSettings } from './storage';
import { useSnakeEngine, type GameOverReason } from './useSnakeEngine';

type Phase = 'ready' | 'playing' | 'paused' | 'over';

const EMPTY_COVER: Cover = { image: null, colors: FALLBACK_COLORS };

function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function SnakeScreen({ navigation }: NativeStackScreenProps<ParamListBase>) {
  const selection = useStore(selectionStore);
  const playlist = selection.playlist;
  const tracks = selection.tracks;
  const { width, height } = useWindowDimensions();
  const boardSize = Math.floor(Math.min(width - 32, height * 0.5, 560) / GRID) * GRID;

  const [phase, setPhase] = useState<Phase>('ready');
  const [settings, setSettings] = useState<SnakeSettings>(DEFAULT_SETTINGS);
  const [record, setRecord] = useState(0);
  const [foodTrack, setFoodTrack] = useState<Track | null>(null);
  // Brojač hrane – ista pesma može ponovo da bude hrana (npr. plejlista sa jednom pesmom).
  const [foodSeq, setFoodSeq] = useState(0);
  const [foodCover, setFoodCover] = useState<Cover | null>(null);
  const [eaten, setEaten] = useState<Track[]>([]);
  const [covers, setCovers] = useState<Cover[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [plusOnes, setPlusOnes] = useState<PlusOne[]>([]);
  const { toast, showToast } = useToast();

  const phaseRef = useRef<Phase>('ready');
  const settingsRef = useRef(settings);
  const recordRef = useRef(0);
  const foodTrackRef = useRef<Track | null>(null);
  const foodCoverRef = useRef<{ trackId: string; cover: Cover } | null>(null);
  const eatenRef = useRef<Track[]>([]);
  const deckRef = useRef<Track[]>([]);
  const idRef = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  settingsRef.current = settings;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  /** Sledeća pesma za hranu: prolazi kroz promešanu plejlistu, bez ponavljanja dok se ne potroši. */
  const drawTrack = useCallback((): Track | null => {
    if (tracks.length === 0) return null;
    if (deckRef.current.length === 0) {
      let deck = shuffle(tracks);
      const last = foodTrackRef.current;
      if (last && deck.length > 1 && deck[deck.length - 1].id === last.id) deck = [deck[deck.length - 1], ...deck.slice(0, -1)];
      deckRef.current = deck;
    }
    const next = deckRef.current.pop() ?? null;
    prefetchCovers(deckRef.current.slice(-3).map((t) => t.coverUrl));
    return next;
  }, [tracks]);

  const setFood = useCallback((track: Track | null) => {
    foodTrackRef.current = track;
    setFoodTrack(track);
    setFoodSeq((n) => n + 1);
  }, []);

  const playEaten = useCallback(
    (track: Track) => {
      const position = settingsRef.current.chorus ? Math.floor(track.durationMs * CHORUS_FRACTION) : 0;
      playTrack(track.uri, position).catch((e) => showToast(`Pesma nije puštena: ${String(e?.message ?? e)}`));
    },
    [showToast]
  );

  const onEat = useCallback(
    (cell: number) => {
      const track = foodTrackRef.current;
      if (track) {
        const known = foodCoverRef.current?.trackId === track.id ? foodCoverRef.current.cover : null;
        eatenRef.current = [track, ...eatenRef.current];
        setEaten(eatenRef.current);
        setCovers((prev) => [known ?? EMPTY_COVER, ...prev]);
        if (!known) {
          loadCover(track.coverUrl).then((cover) =>
            setCovers((prev) => prev.map((c, i) => (eatenRef.current[i]?.id === track.id ? cover : c)))
          );
        }
        if (!settingsRef.current.radio) playEaten(track);

        const id = ++idRef.current;
        setBursts((b) => [...b, { id, cell, colors: known?.colors ?? FALLBACK_COLORS }]);
        setPlusOnes((p) => [...p, { id, cell }]);
        later(() => {
          setBursts((b) => b.filter((x) => x.id !== id));
          setPlusOnes((p) => p.filter((x) => x.id !== id));
        }, 950);
      }
      setFood(drawTrack());
    },
    [drawTrack, playEaten, setFood]
  );

  const onGameOver = useCallback(
    (reason: GameOverReason) => {
      if (phaseRef.current === 'over') return;
      setPhaseBoth('over');
      const score = eatenRef.current.length;
      const previous = recordRef.current;
      const isNewRecord = score > previous;
      if (isNewRecord && playlist) void saveRecord(playlist.id, score);
      const params: GameOverParams = {
        score,
        record: Math.max(score, previous),
        isNewRecord,
        reason,
        playlistName: playlist?.name ?? '',
        eaten: eatenRef.current,
        chorus: settingsRef.current.chorus,
      };
      later(() => navigation.replace(SNAKE_ROUTES.over, params), 700);
    },
    [navigation, playlist]
  );

  const engine = useSnakeEngine({ onEat, onGameOver });

  // Početno stanje: podešavanja, rekord, veza sa Spotify-jem, prva hrana.
  useEffect(() => {
    loadSettings().then(setSettings);
    if (playlist) {
      loadRecord(playlist.id).then((r) => {
        recordRef.current = r;
        setRecord(r);
      });
    }
    void preparePlayer();
    engine.reset();
    setFood(drawTrack());
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Omot trenutne hrane + animacija iskakanja.
  useEffect(() => {
    if (!foodTrack) return;
    let cancelled = false;
    setFoodCover(null);
    engine.foodReveal.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.back(2)) });
    loadCover(foodTrack.coverUrl).then((cover) => {
      if (cancelled) return;
      foodCoverRef.current = { trackId: foodTrack.id, cover };
      setFoodCover(cover);
    });
    return () => {
      cancelled = true;
    };
  }, [foodTrack, foodSeq, engine.foodReveal]);

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    engine.pause();
    setPhaseBoth('paused');
  }, [engine]);

  // Pauza kad aplikacija ode u pozadinu.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pauseGame();
    });
    return () => sub.remove();
  }, [pauseGame]);

  // Sistemsko "nazad" tokom igre = pauza.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phaseRef.current === 'playing') {
        pauseGame();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [pauseGame]);

  const startGame = () => {
    setPhaseBoth('playing');
    engine.start();
    if (settings.radio && playlist) {
      startRadio(playlist, tracks).catch((e) => showToast(`Radio nije pokrenut: ${String(e?.message ?? e)}`));
    }
  };

  const resumeGame = () => {
    setPhaseBoth('playing');
    engine.resume();
  };

  const updateSettings = (patch: Partial<SnakeSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    void saveSettings(next);
  };

  const onTurn = useCallback(
    (dir: number) => {
      if (phaseRef.current === 'playing') engine.turn(dir);
    },
    [engine]
  );

  if (!playlist || tracks.length === 0) {
    return (
      <Screen style={styles.center}>
        <Text style={styles.overlayTitle}>Nema pesama</Text>
        <Text style={styles.muted}>Izaberi plejlistu sa pesmama pa probaj ponovo.</Text>
        <AppButton label="Meni" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
      </Screen>
    );
  }

  const score = eaten.length;

  return (
    <Screen>
      <View style={styles.topBar}>
        <AppButton label="Meni" variant="text" compact onPress={() => navigation.goBack()} />
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{score}</Text>
            <Text style={styles.statLabel}>PESME</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, styles.statRecord]}>{Math.max(record, score)}</Text>
            <Text style={styles.statLabel}>REKORD</Text>
          </View>
        </View>
        <AppButton label="Pauza" variant="text" compact onPress={pauseGame} disabled={phase !== 'playing'} />
      </View>

      <View style={styles.boardWrap}>
        <SnakeBoard
          size={boardSize}
          engine={engine}
          covers={covers}
          foodCover={foodCover}
          foodTitle={foodTrack?.name ?? ''}
          bursts={bursts}
          plusOnes={plusOnes}
          onSwipe={onTurn}
        />
        {phase === 'over' && (
          <View style={[styles.boardOverlay, { width: boardSize, height: boardSize }]} pointerEvents="none">
            <Text style={styles.overText}>KRAJ</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <DPad onTurn={onTurn} disabled={phase !== 'playing'} size={Math.min(56, Math.max(44, (height - boardSize) / 9))} />
      </View>

      <NextUpBar track={foodTrack} />

      {phase === 'ready' && (
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.overlayTitle}>SNAKE</Text>
            <Text style={styles.muted} numberOfLines={1}>
              {playlist.name} · {tracks.length} pesama
            </Text>
            <SettingRow
              title="Počni od refrena"
              subtitle="Pesma krene od ~35% trajanja"
              value={settings.chorus}
              onChange={(v) => updateSettings({ chorus: v })}
              disabled={settings.radio}
            />
            <SettingRow
              title="Radio mod"
              subtitle="Shuffle kroz plejlistu, jedenje ne menja pesmu"
              value={settings.radio}
              onChange={(v) => updateSettings({ radio: v })}
            />
            <SpotifyStatus compact />
            <AppButton label="Kreni" onPress={startGame} style={{ marginTop: 6 }} />
            <Text style={styles.hint}>Upravljaj swipe-om po tabli ili d-padom.</Text>
          </View>
        </View>
      )}

      {phase === 'paused' && (
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.overlayTitle}>PAUZA</Text>
            <Text style={styles.muted}>Pojedeno pesama: {score}</Text>
            <AppButton label="Nastavi" onPress={resumeGame} style={{ marginTop: 10 }} />
            <AppButton label="Meni" variant="outline" onPress={() => navigation.goBack()} />
          </View>
        </View>
      )}

      {toast}
    </Screen>
  );
}

function SettingRow({
  title,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable style={[styles.setting, disabled && { opacity: 0.45 }]} onPress={() => !disabled && onChange(!value)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={value ? '#ffe3ef' : colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  stats: { flexDirection: 'row', gap: 22 },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontFamily: fonts.pixelBold, fontSize: 26, lineHeight: 30 },
  statRecord: { color: colors.accent },
  statLabel: { color: colors.textMuted, fontFamily: fonts.pixel, fontSize: 10, letterSpacing: 1 },
  boardWrap: { alignItems: 'center' },
  boardOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 6, 15, 0.45)',
    borderRadius: 14,
  },
  overText: { color: colors.accent, fontFamily: fonts.pixelBold, fontSize: 44, letterSpacing: 4 },
  controls: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 6, 15, 0.78)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 18,
    gap: 10,
  },
  overlayTitle: { color: colors.text, fontFamily: fonts.pixelBold, fontSize: 32, textAlign: 'center', letterSpacing: 2 },
  muted: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  hint: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.panelRaised,
  },
  settingTitle: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15 },
  settingSubtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
});
