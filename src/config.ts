export const SPOTIFY_CLIENT_ID = '76827642c1ef433aa2f8eef3535ed248';
export const SPOTIFY_REDIRECT_URI = 'kosatmusicgames://callback';

export const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'app-remote-control',
  'user-read-playback-state',
  'user-modify-playback-state',
  // Statistika slušanja (retkost pesama u igri Song Drop)
  'user-top-read',
  'user-read-recently-played',
];

export const SPOTIFY_PACKAGE = 'com.spotify.music';
export const SPOTIFY_PLAY_STORE_URL = 'market://details?id=com.spotify.music';
export const SPOTIFY_PLAY_STORE_WEB_URL = 'https://play.google.com/store/apps/details?id=com.spotify.music';
