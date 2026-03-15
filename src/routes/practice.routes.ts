import { Router } from 'express';
import { submitPart, getPartHistory, getAttemptDetail } from '../controllers/practice.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/submit', submitPart);
router.get('/history/:userId/:partId', getPartHistory);
router.get('/attempt/:id', getAttemptDetail);

export default router;
