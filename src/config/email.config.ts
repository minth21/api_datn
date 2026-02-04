import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

/**
 * Email Configuration using Gmail SMTP
 */
export const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Verify email configuration on startup
emailTransporter.verify((error) => {
    if (error) {
        logger.error('Email configuration error:', error);
        logger.warn('Email service may not work properly. Please check SMTP settings in .env file.');
    } else {
        logger.info('Email service is ready to send messages');
    }
});
