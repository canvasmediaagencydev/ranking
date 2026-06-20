import type { AdminRole } from './models/AdminUser';

const SECRET = process.env.ADMIN_SESSION_SECRET ?? 'fallback-secret';
const COOKIE_NAME = 'gpa_admin_token';
const EXPIRY_DAYS = 7;

interface TokenPayload {
  email: string;
  role: AdminRole;
  exp: number; // unix timestamp ms
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function b64url(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString('base64url');
}

function b64urlDecode(s: string): ArrayBuffer {
  return Buffer.from(s, 'base64url').buffer.slice(0) as ArrayBuffer;
}

export async function signAdminToken(payload: Omit<TokenPayload, 'exp'>): Promise<string> {
  const exp = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const data = JSON.stringify({ ...payload, exp });
  const encoded = b64url(new TextEncoder().encode(data).buffer as ArrayBuffer);
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded).buffer as ArrayBuffer);
  return `${encoded}.${b64url(sig)}`;
}

export async function verifyAdminToken(token: string): Promise<TokenPayload | null> {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const key = await getKey();
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlDecode(sig),
      new TextEncoder().encode(encoded).buffer as ArrayBuffer,
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(encoded))) as TokenPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export { COOKIE_NAME, EXPIRY_DAYS };
