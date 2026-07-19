import { Router as ExpressRouter } from 'express';
import { HouseholdController } from '../controllers/householdController';
import { protect, requireMember } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createHouseholdSchema,
  inviteEmailSchema,
  joinByCodeSchema,
  changeRoleSchema,
} from '../validators/schemas';

const router = ExpressRouter();

// General routes
router.post('/', protect, validate(createHouseholdSchema), HouseholdController.create);
router.get('/', protect, HouseholdController.getUserHouseholds);
router.get('/invitations/pending', protect, HouseholdController.getPendingInvitations);
router.post('/join', protect, validate(joinByCodeSchema), HouseholdController.joinByCode);

// Specific household member protected routes
router.get('/:householdId', protect, requireMember(), HouseholdController.getHouseholdDetails);
router.put('/:householdId', protect, requireMember('OWNER'), validate(createHouseholdSchema), HouseholdController.update);
router.delete('/:householdId', protect, requireMember('OWNER'), HouseholdController.delete);

// Member management inside a household
router.post('/:householdId/invite', protect, requireMember(), validate(inviteEmailSchema), HouseholdController.inviteByEmail);
router.put('/:householdId/members/:userId/role', protect, requireMember('OWNER'), validate(changeRoleSchema), HouseholdController.changeMemberRole);
router.delete('/:householdId/members/:userId', protect, requireMember('OWNER'), HouseholdController.removeMember);

export default router;
