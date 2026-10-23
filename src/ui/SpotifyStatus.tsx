import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { openPlayStore, openSpotify, preparePlayer, playerStore } from '../services/player';
import { useStore } from '../services/store';
import { colors, fonts, radius } from '../theme';
import { AppButton } from './AppButton';

/**
 * Stanje veze sa Spotify-jem + akcije za oporavak.
 * Prikazuju ga igre pre starta; igra uvek može da krene i bez muzike.
 */
export function SpotifyStatus({ compact }: { compact?: boolean }) {
  const { mode, message } = useStore(playerStore);

  if (mode === 'connecting' || mode === 'idle') {
    return (
      <View style={styles.row}>
        <ActivityIndicator color={colors.spotify} size="small" />
        <Text style={styles.muted}>Povezujem se sa Spotify-jem…</Text>
      </View>
    );
  }

  if (mode === 'remote' || mode === 'web') {
    return (
      <View style={styles.row}>
        <View style={styles.dot} />
        <Text style={styles.muted}>{mode === 'remote' ? 'Spotify povezan' : 'Spotify povezan preko interneta'}</Text>
      </View>
    );
  }

  if (mode === 'not-installed') {
    return (
      <View style={[styles.panel, compact && styles.panelCompact]}>
        <Text style={styles.title}>Spotify nije instaliran</Text>
        <Text style={styles.body}>Muzika se pušta kroz Spotify aplikaciju. Instaliraj je sa Play Store-a i prijavi se istim nalogom.</Text>
        <View style={styles.actions}>
          <AppButton label="Otvori Play Store" variant="spotify" compact onPress={openPlayStore} />
          <AppButton label="Probaj ponovo" variant="outline" compact onPress={() => void preparePlayer()} />
        </View>
      </View>
    );
  }

  if (mode === 'no-device') {
    return (
      <View style={[styles.panel, compact && styles.panelCompact]}>
        <Text style={styles.title}>Otvori Spotify i pusti bilo šta, pa se vrati</Text>
        <Text style={styles.body}>Telefon se ne vidi među Spotify uređajima. Kad Spotify nešto svira, vrati se i pritisni „Probaj ponovo“.</Text>
        <View style={styles.actions}>
          <AppButton label="Otvori Spotify" variant="spotify" compact onPress={() => void openSpotify()} />
          <AppButton label="Probaj ponovo" variant="outline" compact onPress={() => void preparePlayer()} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.panel, compact && styles.panelCompact]}>
      <Text style={styles.title}>Spotify ne odgovara</Text>
      <Text style={styles.body}>{message ?? 'Nepoznata greška.'}</Text>
      <View style={styles.actions}>
        <AppButton label="Probaj ponovo" variant="outline" compact onPress={() => void preparePlayer()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.spotify },
  muted: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    gap: 6,
  },
  panelCompact: { padding: 12 },
  title: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15 },
  body: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap' },
});
