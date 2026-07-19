import { Router } from 'express';
import { ExpenseController } from '../controllers/expenseController';
import { protect, requireMember } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { upload } from '../middleware/upload';
import { createRecurringSchema } from '../validators/schemas';

const router = Router();

// General Categories listing (accessible to authenticated users)
router.get('/categories', protect, ExpenseController.getCategories);

// Scan receipt using AI
router.post('/scan-receipt', protect, upload.single('receipt'), ExpenseController.scanReceipt);

// Expense details and mutations
router.get('/details/:expenseId', protect, ExpenseController.getExpenseDetails);
router.put('/:expenseId', protect, upload.single('receipt'), ExpenseController.update);
router.delete('/:expenseId', protect, ExpenseController.delete);

// Household scoped expense list & creation
router.post('/:householdId', protect, requireMember(), upload.single('receipt'), ExpenseController.create);
router.get('/list/:householdId', protect, requireMember(), ExpenseController.list);

// Expense Approval workflow
router.post('/approve/:expenseId', protect, ExpenseController.approve);
router.post('/reject/:expenseId', protect, ExpenseController.reject);

// Recurring Expenses schedules
router.post('/recurring/:householdId', protect, requireMember(), validate(createRecurringSchema), ExpenseController.createRecurringRule);
router.get('/recurring/list/:householdId', protect, requireMember(), ExpenseController.listRecurringRules);
router.delete('/recurring/:ruleId', protect, ExpenseController.deleteRecurringRule);
router.put('/recurring/:ruleId', protect, ExpenseController.updateRecurringRule);

export default router;
