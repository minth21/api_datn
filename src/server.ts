import { createApp } from './app';
import { config } from './config/env';
import { logger } from './utils/logger';
import PrismaService from './config/prisma';

/**
 * Start the server
 */
const startServer = async (): Promise<void> => {
    try {
        // Connect to database first
        await PrismaService.connect();

        const app = createApp();
        const port = config.port;

        app.listen(port, () => {
            logger.info('='.repeat(50));
            logger.info('🚀 TOEIC-TEST Backend Server Started');
            logger.info('='.repeat(50));
            logger.info(`📡 Server running on: http://localhost:${port}`);
            logger.info(`🔗 API Base URL: http://localhost:${port}/api`);
            logger.info(`💚 Health Check: http://localhost:${port}/api/health`);
            logger.info(`🔐 Login Endpoint: http://localhost:${port}/api/auth/login`);
            logger.info(`📝 Register Endpoint: http://localhost:${port}/api/auth/register`);
            logger.info(`👤 Current User: http://localhost:${port}/api/auth/me`);
            logger.info(`🌍 Environment: ${config.nodeEnv}`);
            logger.info('='.repeat(50));
            logger.info('🗄️  Database: PostgreSQL (Connected)');
            logger.info('🎨 Prisma Studio: http://localhost:5555');
            logger.info('='.repeat(50));
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start server
startServer();
