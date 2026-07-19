import { Router } from 'express';
import { SettlementController } from '../controllers/settlementController';
import { protect, requireMember } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { recordSettlementSchema } from '../validators/schemas';

const router = Router();

router.get('/balances/:householdId', protect, requireMember(), SettlementController.getBalances);
router.get('/suggestions/:householdId', protect, requireMember(), SettlementController.getSuggestions);
router.post('/record/:householdId', protect, requireMember(), validate(recordSettlementSchema), SettlementController.recordSettlement);
router.get('/history/:householdId', protect, requireMember(), SettlementController.getHistory);
router.get('/upi/qrcode', protect, SettlementController.getUPIQRCode);
router.post('/confirm/:settlementId', protect, SettlementController.confirmSettlement);

export default router;
