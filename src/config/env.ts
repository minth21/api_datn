import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database config (sẽ dùng sau)
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        name: process.env.DB_NAME || 'toeic_practice',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
    },

    // JWT config (sẽ dùng sau)
    jwt: {
        secret: (process.env.JWT_SECRET || 'your-secret-key') as string,
        expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string,
    },
};
