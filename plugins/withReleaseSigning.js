const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// kosat: release signing';

// Release build se potpisuje keystore-om iz GitHub secrets-a. Workflow dekodira
// keystore u fajl i prosleđuje putanju i lozinke kroz environment varijable.
// Ako varijable nisu postavljene (npr. lokalni build), koristi se debug potpis.
const SIGNING_CONFIG = `
        ${MARKER}
        release {
            def ksPath = System.getenv('KOSAT_KEYSTORE_PATH')
            if (ksPath) {
                storeFile file(ksPath)
                storePassword System.getenv('KOSAT_KEYSTORE_PASSWORD')
                keyAlias System.getenv('KOSAT_KEY_ALIAS')
                keyPassword System.getenv('KOSAT_KEY_PASSWORD')
            }
        }`;

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) return cfg;

    const signingRe = /signingConfigs\s*\{/;
    if (!signingRe.test(contents)) {
      throw new Error('withReleaseSigning: signingConfigs blok nije pronađen u app/build.gradle');
    }
    contents = contents.replace(signingRe, (m) => `${m}${SIGNING_CONFIG}`);

    const releaseRe = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
    if (!releaseRe.test(contents)) {
      throw new Error('withReleaseSigning: release signingConfig nije pronađen u app/build.gradle');
    }
    contents = contents.replace(
      releaseRe,
      "$1signingConfig System.getenv('KOSAT_KEYSTORE_PATH') ? signingConfigs.release : signingConfigs.debug"
    );

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = withReleaseSigning;
