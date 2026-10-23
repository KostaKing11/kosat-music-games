import { StyleSheet, Text, View } from 'react-native';

import { useSpotifyLogin } from '../services/spotifyAuth';
import { colors, fonts, radius } from '../theme';
import { AppButton } from '../ui/AppButton';
import { PixelHeart } from '../ui/PixelHeart';
import { Screen } from '../ui/Screen';

export function LoginScreen() {
  const { ready, busy, error, login } = useSpotifyLogin();

  return (
    <Screen style={styles.root}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <PixelHeart pixel={9} color="#fff3f8" />
        </View>
        <Text style={styles.kosat}>KOSAT</Text>
        <Text style={styles.subtitle}>MUSIC GAMES</Text>
        <Text style={styles.body}>Igrice uz muziku sa tvog Spotify naloga. Svaka pesma koju „pojedeš“ krene da svira.</Text>
      </View>

      <View style={styles.bottom}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton label="Prijavi se preko Spotify-ja" variant="spotify" onPress={login} disabled={!ready} loading={busy} />
        <Text style={styles.note}>Za puštanje muzike potreban je Spotify Premium i Spotify aplikacija na telefonu.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  logo: {
    width: 110,
    height: 110,
    borderRadius: radius.lg + 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 12,
  },
  kosat: { color: colors.text, fontFamily: fonts.pixelBold, fontSize: 54, letterSpacing: 6, lineHeight: 60 },
  subtitle: { color: colors.accent, fontFamily: fonts.pixel, fontSize: 22, letterSpacing: 5 },
  body: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 12,
  },
  bottom: { gap: 12, paddingBottom: 12 },
  error: { color: colors.danger, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  note: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
});
