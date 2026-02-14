import { Router } from 'express';
import { submitPart, getPartHistory } from '../controllers/practice.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/submit', submitPart);
router.get('/history/:userId/:partId', getPartHistory);

export default router;
