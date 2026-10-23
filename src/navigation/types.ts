import type { ParamListBase } from '@react-navigation/native';

/** Fiksne rute aplikacije; rute igara se registruju dinamički iz games/index.ts. */
export type RootStackParamList = ParamListBase & {
  Login: undefined;
  Playlists: undefined;
  Menu: undefined;
};
