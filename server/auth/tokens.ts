import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const AUTH_COOKIE_NAME = 'pulsebeat_token';

function getSecret(): string {
  const s = process.env.PULSEBEAT_JWT_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[Pulsebeat] FATAL: Set PULSEBEAT_JWT_SECRET in the environment (at least 16 characters).'
    );
    process.exit(1);
  }
  const ephemeral = crypto.randomBytes(32).toString('base64url');
  console.warn(
    '[Pulsebeat] PULSEBEAT_JWT_SECRET is not set; using an ephemeral development secret for this process.'
  );
  return ephemeral;
}

const secret = getSecret();

interface TokenUser {
  id: number;
  username: string;
}

export function signUserToken(user: TokenUser): string {
  return jwt.sign({ sub: String(user.id), username: user.username }, secret, { expiresIn: '7d' });
}

interface VerifiedToken {
  sub: string;
  username: string;
}

export function verifyUserToken(token: string): VerifiedToken {
  const payload = jwt.verify(token, secret) as jwt.JwtPayload & { username: string };
  return { sub: String(payload.sub), username: payload.username };
}
