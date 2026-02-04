import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { logger } from './logger';

export interface JwtPayload {
    userId: string;
    email: string;
    role: string;
}

/**
 * Generate JWT token
 */
export const generateToken = (payload: JwtPayload): string => {
    try {
        // @ts-ignore - TypeScript has issues with jwt.sign overloads
        const token = jwt.sign(payload, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn
        });
        logger.debug(`Token generated for user: ${payload.email}`);
        return token;
    } catch (error) {
        logger.error('Error generating token:', error);
        throw new Error('Failed to generate token');
    }
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): JwtPayload | null => {
    try {
        const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
        return decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            logger.warn('Token expired');
        } else if (error instanceof jwt.JsonWebTokenError) {
            logger.warn('Invalid token');
        } else {
            logger.error('Token verification error:', error);
        }
        return null;
    }
};

/**
 * Decode token without verification (for debugging)
 */
export const decodeToken = (token: string): JwtPayload | null => {
    try {
        const decoded = jwt.decode(token) as JwtPayload;
        return decoded;
    } catch (error) {
        logger.error('Error decoding token:', error);
        return null;
    }
};
