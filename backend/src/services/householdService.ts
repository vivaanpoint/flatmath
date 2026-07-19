import { PrismaClient, Role, MemberStatus, InviteStatus } from '@prisma/client';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';
import { ActivityService } from './activityService';
import { NotificationService } from './notificationService';

const prisma = new PrismaClient();

export class HouseholdService {
  private static generateInviteCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 characters
  }

  static async create(name: string, ownerId: number) {
    let inviteCode = this.generateInviteCode();

    // Ensure invite code is unique
    let codeExists = await prisma.household.findUnique({ where: { inviteCode } });
    while (codeExists) {
      inviteCode = this.generateInviteCode();
      codeExists = await prisma.household.findUnique({ where: { inviteCode } });
    }

    const household = await prisma.$transaction(async (tx) => {
      // Create household
      const hh = await tx.household.create({
        data: {
          name: name.trim(),
          inviteCode,
          ownerId,
        },
      });

      // Add owner as a member
      await tx.member.create({
        data: {
          userId: ownerId,
          householdId: hh.id,
          role: Role.OWNER,
          status: MemberStatus.ACTIVE,
        },
      });

      return hh;
    });

    await ActivityService.log({
      householdId: household.id,
      userId: ownerId,
      action: 'HOUSEHOLD_CREATED',
      details: `Household '${name}' was created.`,
    });

    return household;
  }

  static async update(householdId: number, name: string, userId: number) {
    const household = await prisma.household.findUnique({ where: { id: householdId } });
    if (!household) {
      throw new AppError('Household not found', 404);
    }

    // Verify requester is OWNER
    const member = await prisma.member.findUnique({
      where: { userId_householdId: { userId, householdId } },
    });

    if (!member || member.role !== Role.OWNER) {
      throw new AppError('Only the owner can edit the household details', 403);
    }

    const updated = await prisma.household.update({
      where: { id: householdId },
      data: { name: name.trim() },
    });

    await ActivityService.log({
      householdId,
      userId,
      action: 'HOUSEHOLD_UPDATED',
      details: `Household name updated to '${name}'.`,
    });

    return updated;
  }

  static async delete(householdId: number, userId: number) {
    const household = await prisma.household.findUnique({ where: { id: householdId } });
    if (!household) {
      throw new AppError('Household not found', 404);
    }

    if (household.ownerId !== userId) {
      throw new AppError('Only the owner can delete this household', 403);
    }

    // Deleting household cascade deletes members, expenses, etc. due to relation annotations
    await prisma.household.delete({ where: { id: householdId } });
    return { success: true };
  }

  static async getHouseholdDetails(householdId: number, userId: number) {
    const household = await prisma.household.findUnique({
      where: { id: householdId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!household) {
      throw new AppError('Household not found', 404);
    }

    const isMember = household.members.some((m) => m.userId === userId && m.status === MemberStatus.ACTIVE);
    if (!isMember) {
      throw new AppError('Access Denied: You are not a member of this household', 403);
    }

    return household;
  }

  static async inviteByEmail(householdId: number, email: string, invitedById: number) {
    const targetEmail = email.toLowerCase().trim();

    // Check if target is already a member
    const targetUser = await prisma.user.findUnique({ where: { email: targetEmail } });
    if (targetUser) {
      const isMember = await prisma.member.findUnique({
        where: { userId_householdId: { userId: targetUser.id, householdId } },
      });
      if (isMember) {
        throw new AppError('User is already a member of this household', 400);
      }
    }

    // Generate specific invite code
    let code = `INV-${this.generateInviteCode()}`;
    let codeExists = await prisma.invite.findUnique({ where: { code } });
    while (codeExists) {
      code = `INV-${this.generateInviteCode()}`;
      codeExists = await prisma.invite.findUnique({ where: { code } });
    }

    // Create or update pending invite
    const invite = await prisma.invite.create({
      data: {
        householdId,
        email: targetEmail,
        code,
        invitedById,
        status: InviteStatus.PENDING,
      },
      include: {
        household: true,
      },
    });

    // Notify user if registered
    if (targetUser) {
      await NotificationService.create({
        userId: targetUser.id,
        message: `You have been invited to join the household '${invite.household.name}' by ${invite.invitedById}.`,
        type: 'HOUSEHOLD_INVITATION',
      });
    }

    await ActivityService.log({
      householdId,
      userId: invitedById,
      action: 'MEMBER_INVITED',
      details: `Invited email '${targetEmail}' to join.`,
    });

    return invite;
  }

  static async joinByCode(inviteCodeOrInviteCodeWithPrefix: string, userId: number) {
    const code = inviteCodeOrInviteCodeWithPrefix.trim();

    // First try to join via household general inviteCode
    const household = await prisma.household.findUnique({
      where: { inviteCode: code },
    });

    if (household) {
      // Check if already a member
      const existingMember = await prisma.member.findUnique({
        where: { userId_householdId: { userId, householdId: household.id } },
      });

      if (existingMember) {
        if (existingMember.status === MemberStatus.ACTIVE) {
          throw new AppError('You are already an active member of this household', 400);
        } else {
          // Activate pending member
          await prisma.member.update({
            where: { id: existingMember.id },
            data: { status: MemberStatus.ACTIVE },
          });
          return household;
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.member.create({
          data: {
            userId,
            householdId: household.id,
            role: Role.MEMBER,
            status: MemberStatus.ACTIVE,
          },
        });
      });

      const user = await prisma.user.findUnique({ where: { id: userId } });

      await ActivityService.log({
        householdId: household.id,
        userId,
        action: 'MEMBER_JOINED',
        details: `${user?.name || 'A user'} joined the household using invite code.`,
      });

      await NotificationService.notifyHousehold(
        household.id,
        `${user?.name || 'A new roommate'} joined the household.`,
        'MEMBER_JOINED',
        userId
      );

      return household;
    }

    // Try email invitation code
    const invite = await prisma.invite.findUnique({
      where: { code },
      include: { household: true },
    });

    if (!invite || invite.status !== InviteStatus.PENDING) {
      throw new AppError('Invalid or expired invite code', 404);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invite.email) {
      throw new AppError('This invitation was sent to a different email address', 403);
    }

    // Join household
    await prisma.$transaction(async (tx) => {
      await tx.member.create({
        data: {
          userId,
          householdId: invite.householdId,
          role: Role.MEMBER,
          status: MemberStatus.ACTIVE,
        },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: { status: InviteStatus.ACCEPTED },
      });
    });

    await ActivityService.log({
      householdId: invite.householdId,
      userId,
      action: 'MEMBER_JOINED',
      details: `${user.name} accepted invitation and joined the household.`,
    });

    await NotificationService.notifyHousehold(
      invite.householdId,
      `${user.name} accepted the invite and joined the household.`,
      'MEMBER_JOINED',
      userId
    );

    return invite.household;
  }

  static async getPendingInvitations(email: string) {
    return prisma.invite.findMany({
      where: {
        email: email.toLowerCase().trim(),
        status: InviteStatus.PENDING,
      },
      include: {
        household: {
          select: {
            id: true,
            name: true,
            inviteCode: true,
          },
        },
        invitedBy: {
          select: {
            name: true,
            avatar: true,
          },
        },
      },
    });
  }

  static async removeMember(householdId: number, targetUserId: number, requesterId: number) {
    const household = await prisma.household.findUnique({ where: { id: householdId } });
    if (!household) {
      throw new AppError('Household not found', 404);
    }

    // Check requester is OWNER
    const requester = await prisma.member.findUnique({
      where: { userId_householdId: { userId: requesterId, householdId } },
    });

    if (!requester || requester.role !== Role.OWNER) {
      throw new AppError('Only the owner can remove members', 403);
    }

    if (targetUserId === household.ownerId) {
      throw new AppError('Cannot remove the household owner', 400);
    }

    const targetMember = await prisma.member.findUnique({
      where: { userId_householdId: { userId: targetUserId, householdId } },
      include: { user: true },
    });

    if (!targetMember) {
      throw new AppError('User is not a member of this household', 404);
    }

    await prisma.member.delete({
      where: { id: targetMember.id },
    });

    await ActivityService.log({
      householdId,
      userId: requesterId,
      action: 'MEMBER_REMOVED',
      details: `Removed '${targetMember.user.name}' from the household.`,
    });

    await NotificationService.create({
      userId: targetUserId,
      message: `You have been removed from the household '${household.name}'.`,
      type: 'HOUSEHOLD_REMOVAL',
    });

    return { success: true };
  }

  static async changeMemberRole(householdId: number, targetUserId: number, newRole: Role, requesterId: number) {
    const household = await prisma.household.findUnique({ where: { id: householdId } });
    if (!household) {
      throw new AppError('Household not found', 404);
    }

    // Check requester is OWNER
    const requester = await prisma.member.findUnique({
      where: { userId_householdId: { userId: requesterId, householdId } },
    });

    if (!requester || requester.role !== Role.OWNER) {
      throw new AppError('Only the owner can manage member roles', 403);
    }

    const targetMember = await prisma.member.findUnique({
      where: { userId_householdId: { userId: targetUserId, householdId } },
      include: { user: true },
    });

    if (!targetMember) {
      throw new AppError('User is not a member of this household', 404);
    }

    if (targetUserId === household.ownerId && newRole !== Role.OWNER) {
      throw new AppError('Cannot change the role of the primary household owner. Transfer ownership instead.', 400);
    }

    if (newRole === Role.OWNER) {
      // Transfer ownership
      await prisma.$transaction([
        prisma.household.update({
          where: { id: householdId },
          data: { ownerId: targetUserId },
        }),
        prisma.member.update({
          where: { id: requester.id },
          data: { role: Role.MEMBER },
        }),
        prisma.member.update({
          where: { id: targetMember.id },
          data: { role: Role.OWNER },
        }),
      ]);

      await ActivityService.log({
        householdId,
        userId: requesterId,
        action: 'OWNERSHIP_TRANSFERRED',
        details: `Ownership of the household transferred to '${targetMember.user.name}'.`,
      });
    } else {
      await prisma.member.update({
        where: { id: targetMember.id },
        data: { role: newRole },
      });

      await ActivityService.log({
        householdId,
        userId: requesterId,
        action: 'ROLE_CHANGED',
        details: `Changed role of '${targetMember.user.name}' to ${newRole}.`,
      });
    }

    return { success: true };
  }

  static async getUserHouseholds(userId: number) {
    return prisma.household.findMany({
      where: {
        members: {
          some: {
            userId,
            status: MemberStatus.ACTIVE,
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });
  }
}
