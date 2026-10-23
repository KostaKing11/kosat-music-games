import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import {
  AuthRequest,
  ResponseType,
  exchangeCodeAsync,
  refreshAsync,
  useAuthRequest,
  type DiscoveryDocument,
  type TokenResponse,
} from 'expo-auth-session';

import { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPES } from '../config';
import { createStore } from './store';

WebBrowser.maybeCompleteAuthSession();

const SESSION_KEY = 'spotify_session_v1';
const EXPIRY_MARGIN_MS = 60_000;

export const discovery: DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

type Session = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
};

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export const authStore = createStore<AuthStatus>('loading');

let session: Session | null = null;
let refreshing: Promise<string> | null = null;

export class AuthExpiredError extends Error {
  constructor() {
    super('Spotify sesija je istekla, prijavi se ponovo.');
    this.name = 'AuthExpiredError';
  }
}

function toSession(token: TokenResponse, previousRefresh?: string): Session {
  const expiresIn = token.expiresIn ?? 3600;
  const issuedAt = token.issuedAt ? token.issuedAt * 1000 : Date.now();
  const refreshToken = token.refreshToken ?? previousRefresh;
  if (!refreshToken) throw new Error('Spotify nije vratio refresh token.');
  return {
    accessToken: token.accessToken,
    refreshToken,
    expiresAt: issuedAt + expiresIn * 1000,
    scope: token.scope,
  };
}

async function saveSession(next: Session | null) {
  session = next;
  if (next) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
  } else {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}

/** Čita sačuvanu sesiju iz SecureStore-a pri pokretanju aplikacije. */
export async function restoreSession(): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Session;
      if (parsed.accessToken && parsed.refreshToken) {
        session = parsed;
        authStore.set('signedIn');
        return;
      }
    }
  } catch {
    // Oštećen zapis – tretiraj kao odjavljen.
  }
  session = null;
  authStore.set('signedOut');
}

async function refreshSession(current: Session): Promise<string> {
  try {
    const token = await refreshAsync(
      { clientId: SPOTIFY_CLIENT_ID, refreshToken: current.refreshToken },
      discovery
    );
    const next = toSession(token, current.refreshToken);
    await saveSession(next);
    return next.accessToken;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    const message = String((error as Error)?.message ?? error);
    // invalid_grant = refresh token više ne važi (opozvan pristup ili promenjen nalog).
    if (code === 'invalid_grant' || /invalid_grant|revoked/i.test(message)) {
      await signOut();
      throw new AuthExpiredError();
    }
    throw error;
  }
}

/** Vraća važeći access token; automatski osvežava kada je blizu isteka. */
export async function getAccessToken(forceRefresh = false): Promise<string> {
  const current = session;
  if (!current) throw new AuthExpiredError();
  if (!forceRefresh && current.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return current.accessToken;
  }
  if (!refreshing) {
    refreshing = refreshSession(current).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function signOut(): Promise<void> {
  await saveSession(null);
  authStore.set('signedOut');
}

/**
 * Hook za Login ekran: Authorization Code + PKCE preko expo-auth-session.
 * Client Secret se ne koristi nigde.
 */
export function useSpotifyLogin() {
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID,
      redirectUri: SPOTIFY_REDIRECT_URI,
      scopes: SPOTIFY_SCOPES,
      responseType: ResponseType.Code,
      usePKCE: true,
      extraParams: { show_dialog: 'false' },
    },
    discovery
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!response || !request) return;
    if (response.type === 'success') {
      const code = response.params.code;
      setBusy(true);
      exchangeCode(request, code)
        .then(() => setError(null))
        .catch((e) => setError(`Prijava nije uspela: ${String(e?.message ?? e)}`))
        .finally(() => setBusy(false));
    } else if (response.type === 'error') {
      const desc = response.params?.error_description || response.params?.error || response.error?.message;
      setError(`Spotify je odbio prijavu: ${desc ?? 'nepoznata greška'}`);
    }
  }, [response, request]);

  const login = async () => {
    setError(null);
    await promptAsync();
  };

  return { ready: !!request, busy, error, login };
}

async function exchangeCode(request: AuthRequest, code: string) {
  if (!request.codeVerifier) throw new Error('Nedostaje PKCE code verifier.');
  const token = await exchangeCodeAsync(
    {
      clientId: SPOTIFY_CLIENT_ID,
      code,
      redirectUri: SPOTIFY_REDIRECT_URI,
      extraParams: { code_verifier: request.codeVerifier },
    },
    discovery
  );
  await saveSession(toSession(token));
  authStore.set('signedIn');
}
