import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { AppError } from '../middleware/errorHandler';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { OAuth2Client } from 'google-auth-library';

const prisma = new PrismaClient();

export class AuthService {
  static async register(name: string, email: string, password: string) {
    const trimmedEmail = email.toLowerCase().trim();
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (existingUser) {
      throw new AppError('Email address already registered', 400);
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: trimmedEmail,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
    });

    return user;
  }

  static async login(email: string, password: string) {
    const trimmedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    };
  }

  static async refresh(token: string) {
    if (!token) {
      throw new AppError('Refresh token is required', 400);
    }

    // Verify token exists in database and is not expired
    const savedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!savedToken) {
      throw new AppError('Invalid refresh token', 401);
    }

    if (savedToken.expiresAt < new Date()) {
      // Clean up expired token
      await prisma.refreshToken.delete({ where: { id: savedToken.id } });
      throw new AppError('Refresh token expired', 401);
    }

    try {
      const decoded = verifyRefreshToken(token);
      if (decoded.userId !== savedToken.userId) {
        throw new AppError('Invalid token owner', 401);
      }

      // Rotate token: Delete old, create new
      await prisma.refreshToken.delete({ where: { id: savedToken.id } });

      const newAccessToken = generateAccessToken(savedToken.user.id, savedToken.user.email);
      const newRefreshToken = generateRefreshToken(savedToken.user.id);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: savedToken.user.id,
          expiresAt,
        },
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: savedToken.user.id,
          name: savedToken.user.name,
          email: savedToken.user.email,
          avatar: savedToken.user.avatar,
        },
      };
    } catch (err) {
      // Cleanup token on error
      await prisma.refreshToken.delete({ where: { id: savedToken.id } }).catch(() => {});
      throw new AppError('Invalid refresh token signature', 401);
    }
  }

  static async logout(token: string) {
    if (!token) return;
    await prisma.refreshToken.deleteMany({
      where: { token },
    });
  }

  static async requestPasswordReset(email: string) {
    const trimmedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (!user) {
      // Return success to avoid user enumeration, but don't do anything
      return { message: 'If the email exists in our system, a reset link/code has been generated.' };
    }
    
    // In production, send email. For now, return a mock token for local testing
    // Generate a reset code that we can return or log
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[PASSWORD RESET CODE FOR ${trimmedEmail}]: ${resetCode}`);
    
    return {
      message: 'Password reset code logged to console.',
      testResetCode: resetCode, // Sending it back for easy testing
    };
  }

  static async resetPassword(email: string, code: string, passwordNew: string) {
    const trimmedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Since we mock the reset code, we check if code is provided (e.g. any 6-digit code or specific code)
    if (!code || code.length !== 6) {
      throw new AppError('Invalid or expired reset code', 400);
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(passwordNew, saltRounds);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    return { success: true };
  }

  static async googleLogin(credential: string) {
    if (!credential) {
      throw new AppError('Google credential is required', 400);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new AppError('Google Client ID is not configured on the server', 500);
    }

    const client = new OAuth2Client(clientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (err: any) {
      throw new AppError('Invalid Google credential token', 401);
    }

    if (!payload || !payload.email) {
      throw new AppError('Invalid Google token payload', 400);
    }

    const email = payload.email.toLowerCase().trim();
    const name = payload.name || email.split('@')[0];
    const avatar = payload.picture || null;

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create user with a dummy/empty password (since they log in via Google)
      const dummyPassword = Math.random().toString(36).slice(-10) + '!Google';
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(dummyPassword, saltRounds);

      user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          avatar,
        },
      });
    } else {
      // Optionally update the avatar if they didn't have one or if it changed
      if (avatar && !user.avatar) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { avatar },
        });
      }
    }

    // Generate custom application tokens
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    };
  }
}
