import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PixelifySans_600SemiBold,
  PixelifySans_700Bold,
} from '@expo-google-fonts/pixelify-sans';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';

import { RootNavigator } from './navigation/RootNavigator';
import { hydrate } from './services/playlistStore';
import { authStore, restoreSession } from './services/spotifyAuth';
import { useStore } from './services/store';
import { colors } from './theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.panel,
    border: colors.border,
    text: colors.text,
    primary: colors.accent,
  },
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PixelifySans_600SemiBold,
    PixelifySans_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
  const auth = useStore(authStore);
  const [initialRoute, setInitialRoute] = useState<'Playlists' | 'Menu' | null>(null);

  useEffect(() => {
    void restoreSession();
  }, []);

  // Posle prijave: učitaj keš (poslednja plejlista) i odluči gde aplikacija počinje.
  useEffect(() => {
    if (auth === 'signedIn') {
      hydrate()
        .then((selected) => setInitialRoute(selected ? 'Menu' : 'Playlists'))
        .catch(() => setInitialRoute('Playlists'));
    } else if (auth === 'signedOut') {
      setInitialRoute(null);
    }
  }, [auth]);

  const fontsReady = fontsLoaded || !!fontError;
  const ready = fontsReady && auth !== 'loading' && (auth === 'signedOut' || initialRoute !== null);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider style={{ backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme}>
        <RootNavigator key={auth} initialRoute={initialRoute ?? 'Playlists'} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
