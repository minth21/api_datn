import express, { Application } from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config/env';
import { APP_CONSTANTS } from './config/constants';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { logger } from './utils/logger';

/**
 * Create and configure Express application
 */
export const createApp = (): Application => {
    const app = express();

    // Middlewares
    app.use(cors({
        origin: '*', // Allow all origins for development
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: true,
    }));

    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Serve static files from uploads directory
    app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

    // Request logging
    app.use((req, res, next) => {
        logger.info(`${req.method} ${req.path}`);
        next();
    });

    // Routes
    app.use(APP_CONSTANTS.API_PREFIX, routes);

    // Error handlers (must be last)
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
};
