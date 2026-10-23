const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// spotify-remote: lokalni maven repo';
const REPO = `        ${MARKER}\n        maven { url = uri("\${rootDir}/../modules/spotify-remote/android/maven") }`;

/**
 * Dodaje lokalni Maven repo sa Spotify App Remote AAR-om u allprojects.repositories
 * root build.gradle fajla, da bi :app projekat mogao da razreši tranzitivnu zavisnost.
 */
function withSpotifyRemoteRepo(config) {
  return withProjectBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) return cfg;
    const re = /allprojects\s*\{\s*repositories\s*\{/;
    if (re.test(contents)) {
      contents = contents.replace(re, (m) => `${m}\n${REPO}`);
    } else {
      contents += `\nallprojects {\n    repositories {\n${REPO}\n    }\n}\n`;
    }
    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = withSpotifyRemoteRepo;
