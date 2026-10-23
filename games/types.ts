import type { ComponentType } from 'react';

/**
 * Ugovor koji svaka igra ispunjava. Igra živi u svom folderu (games/<id>/),
 * a u games/index.ts se dodaje jedna linija – ostatak aplikacije se ne dira.
 *
 * Igre koriste zajedničke servise iz src/services:
 * spotifyAuth, spotifyApi, player, playlistStore (+ coverImages).
 */
export type GameScreen = {
  /** Jedinstveno ime rute, konvencija: "<id>/<ekran>" */
  name: string;
  component: ComponentType<any>;
};

export type GameDefinition = {
  id: string;
  title: string;
  tagline: string;
  status: 'available' | 'soon';
  /** Ruta koja se otvara iz menija. */
  entryScreen?: string;
  screens: GameScreen[];
  /** Minimalan broj pesama u plejlisti da bi igra mogla da krene. */
  minTracks?: number;
  /** Mala ilustracija na kartici u meniju. */
  Preview?: ComponentType;
  /** Kratak tekst na kartici (npr. "Rekord: 12") za izabranu plejlistu. */
  getBadge?: (playlistId: string) => Promise<string | null>;
};
