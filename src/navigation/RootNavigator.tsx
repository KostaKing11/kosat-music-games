import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { GAME_SCREENS } from '../../games';
import { GameMenuScreen } from '../screens/GameMenuScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { PlaylistPickerScreen } from '../screens/PlaylistPickerScreen';
import { authStore } from '../services/spotifyAuth';
import { useStore } from '../services/store';
import { colors } from '../theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator({ initialRoute }: { initialRoute: 'Playlists' | 'Menu' }) {
  const auth = useStore(authStore);

  return (
    <Stack.Navigator
      initialRouteName={auth === 'signedIn' ? initialRoute : 'Login'}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {auth !== 'signedIn' ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Menu" component={GameMenuScreen} />
          <Stack.Screen name="Playlists" component={PlaylistPickerScreen} />
          {GAME_SCREENS.map((screen) => (
            <Stack.Screen key={screen.name} name={screen.name} component={screen.component} />
          ))}
        </>
      )}
    </Stack.Navigator>
  );
}
