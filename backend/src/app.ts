import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import kycRoutes from './modules/kyc/kyc.routes';
import propertyRoutes from './modules/properties/properties.routes';
import governmentRoutes from './modules/government/government.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/government', governmentRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// must be last
app.use(errorHandler);

export default app;