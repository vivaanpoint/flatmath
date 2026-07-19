import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-access-secret-12345';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-67890';

export interface AccessTokenPayload {
  userId: number;
  email: string;
}

export interface RefreshTokenPayload {
  userId: number;
}

export const generateAccessToken = (userId: number, email: string): string => {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (userId: number): string => {
  return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
};
