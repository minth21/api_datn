import { Request } from 'express';
import { UserDto } from '../dto/auth.dto';

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: UserDto;
        }
    }
}

export { };
