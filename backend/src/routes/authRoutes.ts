import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { validate } from '../middleware/validate';
import { protect } from '../middleware/auth';
import {
  registerSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/schemas';

const router = Router();

router.post('/register', validate(registerSchema), AuthController.register);
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/demo', AuthController.demoLogin);
router.post('/google', AuthController.googleLogin);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', validate(requestPasswordResetSchema), AuthController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), AuthController.resetPassword);

router.get('/profile', protect, AuthController.getProfile);
router.put('/profile', protect, validate(updateProfileSchema), AuthController.updateProfile);

export default router;
