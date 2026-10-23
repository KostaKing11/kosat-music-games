import { NativeModule, requireOptionalNativeModule } from 'expo';

export type RemotePlayerState = {
  trackUri: string | null;
  trackName: string | null;
  artistName: string | null;
  albumName: string | null;
  durationMs: number;
  positionMs: number;
  isPaused: boolean;
};

export type RemoteErrorCode =
  | 'NOT_INSTALLED'
  | 'NOT_LOGGED_IN'
  | 'NOT_AUTHORIZED'
  | 'AUTH_FAILED'
  | 'OFFLINE'
  | 'UNSUPPORTED_VERSION'
  | 'DISCONNECTED'
  | 'NOT_CONNECTED'
  | 'UNKNOWN';

type SpotifyRemoteEvents = {
  onPlayerState(state: RemotePlayerState): void;
  onDisconnected(event: { code: RemoteErrorCode; message: string }): void;
};

declare class SpotifyRemoteNativeModule extends NativeModule<SpotifyRemoteEvents> {
  isSpotifyInstalled(): boolean;
  isConnected(): boolean;
  openSpotify(): boolean;
  connect(clientId: string, redirectUri: string): Promise<boolean>;
  disconnect(): Promise<void>;
  play(uri: string, positionMs: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seekTo(positionMs: number): Promise<void>;
  setShuffle(enabled: boolean): Promise<void>;
  queue(uri: string): Promise<void>;
  getPlayerState(): Promise<RemotePlayerState>;
}

/** null kada nativni modul nije dostupan (npr. Expo Go ili web). */
const SpotifyRemote = requireOptionalNativeModule<SpotifyRemoteNativeModule>('SpotifyRemote');

export default SpotifyRemote;

export function remoteErrorCode(error: unknown): RemoteErrorCode {
  const code = (error as { code?: string } | null)?.code;
  return (code as RemoteErrorCode) ?? 'UNKNOWN';
}
