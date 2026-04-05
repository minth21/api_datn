import { Router } from 'express';
import * as NotificationController from '../controllers/notification.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', NotificationController.getNotifications);
router.patch('/:id/read', NotificationController.markRead);

export default router;
