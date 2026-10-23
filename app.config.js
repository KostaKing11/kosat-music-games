// Dinamička Expo konfiguracija. versionCode dolazi iz GitHub Actions-a (broj build-a),
// da bi svaki novi APK mogao da se instalira preko starog.
const versionCode = Number(process.env.KOSAT_VERSION_CODE || 1);

module.exports = () => ({
  name: 'Kosat Music Games',
  slug: 'kosat-music-games',
  scheme: 'kosatmusicgames',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#07060f',
  platforms: ['android'],
  android: {
    package: 'com.kosat.musicgames',
    versionCode,
    adaptiveIcon: {
      backgroundColor: '#07060f',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-secure-store',
    'expo-web-browser',
    'expo-font',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#07060f',
      },
    ],
    './modules/spotify-remote/app.plugin.js',
    './plugins/withReleaseSigning.js',
  ],
});
