// Client for the server-backed member account API (/api/auth).
//
// Accounts used to live only in this device's local storage (users_db), so a
// reader who registered on one device could not sign in on another and lost
// their account if they cleared the browser. These helpers register/verify
// accounts on the shared server instead, so one signup works everywhere.
//
// Only a salted SHA-256 password HASH is ever sent (see utils/auth.ts) — the
// plaintext never leaves the browser, and the server returns only the public
// user object (hash stripped).

export interface AuthResult {
  ok: boolean;
  user?: any;
  error?: 'exists' | 'reserved' | 'invalid' | 'network' | 'server';
}

async function postAuth(payload: any): Promise<Response | null> {
  try {
    return await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch {
    return null; // network/offline
  }
}

export async function registerAccountOnServer(account: any): Promise<AuthResult> {
  const res = await postAuth({ action: 'register', account });
  if (!res) return { ok: false, error: 'network' };
  if (res.ok) {
    try { const d = await res.json(); return { ok: true, user: d.user }; } catch { return { ok: false, error: 'server' }; }
  }
  if (res.status === 409) return { ok: false, error: 'exists' };
  if (res.status === 403) return { ok: false, error: 'reserved' };
  return { ok: false, error: 'server' };
}

export async function loginAccountOnServer(email: string, passwordHash: string): Promise<AuthResult> {
  const res = await postAuth({ action: 'login', email, passwordHash });
  if (!res) return { ok: false, error: 'network' };
  if (res.ok) {
    try { const d = await res.json(); return { ok: true, user: d.user }; } catch { return { ok: false, error: 'server' }; }
  }
  if (res.status === 401) return { ok: false, error: 'invalid' };
  return { ok: false, error: 'server' };
}

// Best-effort: keep the reader's server profile in step with local edits so it
// follows them across devices. Failures are silently ignored (offline, legacy
// account not on the server yet).
export async function updateAccountOnServer(email: string, passwordHash: string, profile: any): Promise<void> {
  if (!email || !passwordHash) return;
  await postAuth({ action: 'update', email, passwordHash, profile });
}
