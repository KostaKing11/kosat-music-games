# Kosat Music Games

Android igrice uz muziku sa tvog Spotify naloga. Za sada postoji jedna igra, **Snake**: hrana su omoti albuma iz izabrane plejliste, a svaka pesma koju zmija pojede odmah krene na Spotify-ju.

- React Native + Expo (TypeScript), samo Android
- Grafika igre: `@shopify/react-native-skia` + `react-native-reanimated` (logika igre radi na UI niti, 60 fps)
- Spotify prijava: Authorization Code + PKCE (bez Client Secret-a)
- Puštanje muzike: Spotify App Remote SDK (lokalni Expo modul u Kotlinu), a ako on ne uspe, Web API player kao rezerva
- APK pravi GitHub Actions. Nema EAS-a i nije potreban računar.

---

## 1. Spotify Developer Dashboard

Otvori <https://developer.spotify.com/dashboard> u browseru na telefonu, izaberi svoju aplikaciju (Client ID `76827642c1ef433aa2f8eef3535ed248`), pa **Settings → Edit**.

1. **Redirect URIs**: mora da postoji tačno `kosatmusicgames://callback`. Ako ga nema, upiši ga, tapni **Add**, pa **Save** na dnu.
2. **Which API/SDKs are you planning to use**: čekiraj **Web API** i **Android**.
3. **Android packages** (pojavi se kad čekiraš Android):
   - Package name: `com.kosat.musicgames`
   - SHA1 fingerprint: `72:21:DF:61:81:2C:3B:F9:8B:7B:79:D8:FD:A9:92:FA:1C:D6:55:3C`
   - Tapni **Add**, pa **Save**.

   SHA1 je otisak release ključa kojim GitHub Actions potpisuje APK. Bez njega Spotify App Remote odbija vezu. Aplikacija tada pušta muziku preko rezervnog Web API puta, ali je on sporiji.

### Dodavanje drugara (Users and Access)

Aplikacija je u **Development mode**, pa je mogu koristiti samo nalozi koje ručno dodaš:

1. Na stranici aplikacije otvori karticu **User Management** (u novijem izgledu **Users and Access**).
2. Tapni **Add new user** i upiši ime i **email adresu kojom se drugar prijavljuje na Spotify**.
3. Sačuvaj. Drugar posle toga instalira isti APK i prijavi se svojim nalogom.

Napomene:
- U Development mode-u može da bude najviše **5 korisnika** po aplikaciji.
- Vlasnik aplikacije (ti) mora da ima **Spotify Premium**, inače aplikacija u Development mode-u ne radi.
- Za puštanje muzike i svaki igrač mora da ima Premium i instaliranu Spotify aplikaciju.
- Ako drugar dobije grešku tipa „User not registered in the Developer Dashboard“, proveri da li je upisan tačan email njegovog Spotify naloga.

---

## 2. GitHub secrets (sa telefona)

Workflow čita release keystore iz četiri secret-a. Vrednosti si dobio u chatu sa Claude-om. **Ne upisuj ih nigde u repo.**

1. U browseru (ne u GitHub aplikaciji, jer ona nema podešavanja za secrets) otvori `https://github.com/kostaking11/kosat-music-games`.
2. Ako ne vidiš karticu **Settings**, u meniju browsera uključi **Desktop site** (Prikaz za računare).
3. **Settings → Secrets and variables → Actions → New repository secret**.
4. Dodaj ova četiri secret-a. **Name** prepiši tačno ovako, a **Secret** je vrednost iz chata:

| Name | Šta je |
|---|---|
| `KEYSTORE_BASE64` | ceo keystore kao jedan dugačak base64 red |
| `KEYSTORE_PASSWORD` | lozinka keystore-a |
| `KEY_ALIAS` | `kosat-release` |
| `KEY_PASSWORD` | lozinka ključa (ista kao lozinka keystore-a) |

Kod `KEYSTORE_BASE64` pazi da kopiraš ceo tekst, od prvog do poslednjeg znaka. Ako ga skratiš, build pada na koraku „Release keystore“.

> Sačuvaj ove četiri vrednosti i na neko svoje privatno mesto (npr. menadžer lozinki). GitHub ti ih kasnije neće prikazati. Ako ključ izgubiš, novi APK neće moći da se instalira preko starog, a SHA1 u Spotify Dashboard-u moraće da se promeni.

---

## 3. Gde je APK i kako se instalira

Svaki push na granu `main` pokreće workflow **Android APK** (kartica **Actions**). Build traje oko 15–25 minuta (prvi put duže, posle radi keš). Kada se završi:

1. Otvori `https://github.com/kostaking11/kosat-music-games/releases`. Najnoviji je na vrhu (npr. `Kosat Music Games 1.0.12`).
2. Ispod **Assets** tapni na `kosat-music-games-1.0.X.apk` da ga skineš.
3. Otvori skinuti fajl. Android će tražiti dozvolu da browser (Chrome) instalira aplikacije: **Settings → Allow from this source**, pa se vrati i tapni **Install**.
4. Ako Play Protect upozori da je aplikacija nepoznata, izaberi **More details → Install anyway**. To je normalno za aplikacije koje nisu sa Play Store-a.

Nova verzija se instalira preko stare, bez brisanja: svaki build dobija veći `versionCode` i potpisuje se istim ključem.

Push na druge grane samo proverava da li build prolazi. APK je tada u **Actions → izabrani run → Artifacts**, kao zip, i ne pravi se Release.

---

## 4. Kako radi muzika

1. **Spotify App Remote** (glavni put): aplikacija se poveže sa Spotify aplikacijom na telefonu i direktno joj kaže šta da pusti. Pri prvom povezivanju Spotify prikaže ekran za odobrenje. Za ovo je neophodan SHA1 iz koraka 1.
2. **Web API rezerva**: ako App Remote ne uspe, pesma se pušta preko `PUT /me/player/play`, uvek na Spotify uređaj ovog telefona (`device_id`). Ako telefon nije među aktivnim uređajima, igra traži da otvoriš Spotify, pustiš bilo šta i vratiš se („Probaj ponovo“).
3. Ako puštanje ne uspe, igra nastavlja normalno i samo prikaže malu poruku.

**Plejliste:** Spotify od februara 2026. aplikacijama u Development mode-u daje sadržaj (`GET /playlists/{id}/items`) samo za plejliste koje si ti napravio ili u kojima si saradnik. Ostale su u listi prikazane kao nedostupne. Rešenje je da u Spotify-ju napraviš svoju kopiju plejliste. **Liked Songs** (`GET /me/tracks`) uvek radi. Pesme izabrane plejliste čuvaju se lokalno, pa igra posle prvog učitavanja kreće odmah.

---

## 5. Snake

- Tabla 12×12. Upravlja se swipe-om po tabli ili d-padom ispod nje.
- Hrana je omot albuma, a iznad nje je tag sa nazivom pesme.
- Kad pojedeš pesmu, ona krene na Spotify-ju, a njen omot postane deo repa, odmah iza glave. Pojavi se „+1“ i čestice u bojama omota. Zmija se ubrzava sa svakom pesmom.
- **Počni od refrena**: pesma kreće od ~35% trajanja.
- **Radio mod**: muzika ide shuffle kroz plejlistu, a jedenje ne menja pesmu.
- Igra se pauzira kad aplikacija ode u pozadinu. Rekord se čuva posebno za svaku plejlistu.

---

## 6. Arhitektura

```
src/
  services/
    spotifyAuth.ts     PKCE prijava, tokeni u expo-secure-store, automatski refresh
    spotifyApi.ts      Web API (plejliste, /items, /me/tracks, player endpoint-i)
    player.ts          App Remote modul + Web API rezerva, stanje veze
    playlistStore.ts   izbor plejliste i lokalni keš pesama
    coverImages.ts     omoti kao Skia slike + paleta boja (za sve igre)
  screens/             Login, izbor plejliste, meni igrica
  ui/                  zajedničke komponente (zvezdana pozadina, dugmad, poruke)
games/
  index.ts             registar igara
  types.ts             ugovor koji igra ispunjava (GameDefinition)
  snake/               Snake: engine (worklet), Skia tabla, ekrani igre i kraja
  guess-song/          „Pogodi pesmu“ (za sada zaključana kartica)
modules/spotify-remote/  lokalni Expo modul: Kotlin + Spotify App Remote SDK 0.8.0 + config plugin
plugins/withReleaseSigning.js  config plugin za release potpis iz env varijabli
.github/workflows/android.yml  build i GitHub Release
```

**Nova igra:** napravi folder `games/<ime>/` sa `index.ts` koji izvozi `GameDefinition` (naziv, ekrani, ulazna ruta) i dodaj je u niz `GAMES` u `games/index.ts`. Meni i navigacija je pokupe sami, a postojeće igre i servisi se ne menjaju.

Spotify App Remote SDK (Apache 2.0, <https://github.com/spotify/android-sdk>) nije objavljen na Maven Central-u, pa je AAR u repou kao lokalni Maven repo: `modules/spotify-remote/android/maven/`.

---

## 7. Česti problemi

| Problem | Rešenje |
|---|---|
| Prijava: „INVALID_CLIENT: Invalid redirect URI“ | U Dashboard-u dodaj tačno `kosatmusicgames://callback` i sačuvaj. |
| Prijava uspe, ali Spotify vraća 403 | Nalog nije u **Users and Access**, ili vlasnik aplikacije nema Premium. |
| „Spotify povezan preko interneta“ umesto App Remote | Proveri package name i SHA1 u Dashboard-u i da je Spotify aplikacija ažurna. |
| „Otvori Spotify i pusti bilo šta, pa se vrati“ | Spotify na telefonu nije aktivan. Pusti bilo šta u Spotify-ju pa tapni **Probaj ponovo**. |
| Build pada na „Release keystore“ | Secret `KEYSTORE_BASE64` nije dodat ili nije kopiran ceo. |
| APK neće da se instalira preko stare verzije | Stara verzija je potpisana drugim ključem. Obriši je pa instaliraj novu. |
