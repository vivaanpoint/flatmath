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
      await prisma.refreshToken.delete({ where: { id: savedToken.id } }).catch(() => { });
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

  static async demoLogin() {
    const demoEmail = 'demo@flatmath.io';
    let user = await prisma.user.findUnique({
      where: { email: demoEmail },
    });

    const createDemoDataForUser = async (userId: number) => {
      // Create a household
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const inviteCode = `DEMO${randomSuffix}`;
      const household = await prisma.household.create({
        data: {
          name: 'Apartment 4B (Demo)',
          inviteCode,
          ownerId: userId,
        },
      });

      // Join owner as Member
      await prisma.member.create({
        data: {
          userId,
          householdId: household.id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });

      // Add two mock roommate users
      const roommate1Email = `yuvraj.demo${randomSuffix}@flatmath.io`;
      const roommate2Email = `bhavesh.demo${randomSuffix}@flatmath.io`;
      const saltRounds = 10;
      const roommatePasswordHash = await bcrypt.hash('roomiepass', saltRounds);

      const roommate1 = await prisma.user.create({
        data: {
          name: 'Yuvraj',
          email: roommate1Email,
          passwordHash: roommatePasswordHash,
        },
      });

      const roommate2 = await prisma.user.create({
        data: {
          name: 'Bhavesh',
          email: roommate2Email,
          passwordHash: roommatePasswordHash,
        },
      });

      // Join roommates as Members
      await prisma.member.create({
        data: {
          userId: roommate1.id,
          householdId: household.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });

      await prisma.member.create({
        data: {
          userId: roommate2.id,
          householdId: household.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });

      // Helper to fetch category or create it
      const getCategory = async (name: string) => {
        let cat = await prisma.category.findUnique({ where: { name } });
        if (!cat) {
          cat = await prisma.category.create({ data: { name } });
        }
        return cat;
      };

      const foodCat = await getCategory('Food');
      const internetCat = await getCategory('Internet');

      // Create expenses
      // 1. Wi-Fi (Paid by Demo User, ₹300)
      const exp1 = await prisma.expense.create({
        data: {
          title: 'Wi-Fi',
          amount: 300,
          categoryId: internetCat.id,
          paidById: userId,
          householdId: household.id,
          status: 'APPROVED',
          date: new Date(),
        },
      });

      await prisma.expenseParticipant.createMany({
        data: [
          { expenseId: exp1.id, userId: userId, amountOwed: 100, sharePercentage: 33.33, shareAmount: 100 },
          { expenseId: exp1.id, userId: roommate1.id, amountOwed: 100, sharePercentage: 33.33, shareAmount: 100 },
          { expenseId: exp1.id, userId: roommate2.id, amountOwed: 100, sharePercentage: 33.33, shareAmount: 100 },
        ],
      });

      await prisma.expenseApproval.createMany({
        data: [
          { expenseId: exp1.id, userId: roommate1.id, status: 'APPROVED' },
          { expenseId: exp1.id, userId: roommate2.id, status: 'APPROVED' },
        ],
      });

      // 2. Banana (Paid by Yuvraj, ₹50)
      const exp2 = await prisma.expense.create({
        data: {
          title: 'Banana',
          amount: 50,
          categoryId: foodCat.id,
          paidById: roommate1.id,
          householdId: household.id,
          status: 'PENDING',
          date: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      });

      await prisma.expenseParticipant.createMany({
        data: [
          { expenseId: exp2.id, userId: userId, amountOwed: 16.67, sharePercentage: 33.33, shareAmount: 16.67 },
          { expenseId: exp2.id, userId: roommate1.id, amountOwed: 16.67, sharePercentage: 33.33, shareAmount: 16.67 },
          { expenseId: exp2.id, userId: roommate2.id, amountOwed: 16.66, sharePercentage: 33.33, shareAmount: 16.66 },
        ],
      });

      await prisma.expenseApproval.createMany({
        data: [
          { expenseId: exp2.id, userId: userId, status: 'APPROVED' },
          { expenseId: exp2.id, userId: roommate2.id, status: 'PENDING' },
        ],
      });

      // 3. Bhujia (Paid by Bhavesh, ₹110)
      const exp3 = await prisma.expense.create({
        data: {
          title: 'Bhujia',
          amount: 110,
          categoryId: foodCat.id,
          paidById: roommate2.id,
          householdId: household.id,
          status: 'APPROVED',
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.expenseParticipant.createMany({
        data: [
          { expenseId: exp3.id, userId: userId, amountOwed: 55, sharePercentage: 50, shareAmount: 55 },
          { expenseId: exp3.id, userId: roommate1.id, amountOwed: 33, sharePercentage: 30, shareAmount: 33 },
          { expenseId: exp3.id, userId: roommate2.id, amountOwed: 22, sharePercentage: 20, shareAmount: 22 },
        ],
      });

      await prisma.expenseApproval.createMany({
        data: [
          { expenseId: exp3.id, userId: userId, status: 'APPROVED' },
          { expenseId: exp3.id, userId: roommate1.id, status: 'APPROVED' },
        ],
      });

      // Seed Activity Logs
      await prisma.activityLog.createMany({
        data: [
          {
            householdId: household.id,
            userId,
            action: 'CREATE_EXPENSE',
            details: `Added expense 'Wi-Fi' for ₹300.`,
          },
          {
            householdId: household.id,
            userId: roommate1.id,
            action: 'CREATE_EXPENSE',
            details: `Added expense 'Banana' for ₹50.`,
          },
          {
            householdId: household.id,
            userId: roommate2.id,
            action: 'CREATE_EXPENSE',
            details: `Added expense 'Bhujia' for ₹110.`,
          },
        ],
      });
    };

    if (!user) {
      const passwordHash = await bcrypt.hash('demopassword', 10);
      user = await prisma.user.create({
        data: {
          name: 'vivaan',
          email: demoEmail,
          passwordHash,
        },
      });
      await createDemoDataForUser(user.id);
    } else {
      // Clear out old households owned by the demo user to refresh their demo workspace
      const oldHouseholds = await prisma.household.findMany({
        where: { ownerId: user.id },
      });
      for (const oh of oldHouseholds) {
        await prisma.household.delete({
          where: { id: oh.id },
        });
      }
      await createDemoDataForUser(user.id);
    }

    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

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
