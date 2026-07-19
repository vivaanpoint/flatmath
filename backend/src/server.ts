import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initSocket } from './utils/socket';

// Load environment variables
dotenv.config();

import authRoutes from './routes/authRoutes';
import householdRoutes from './routes/householdRoutes';
import expenseRoutes from './routes/expenseRoutes';
import settlementRoutes from './routes/settlementRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { errorHandler } from './middleware/errorHandler';
import { ExpenseService } from './services/expenseService';

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow loading receipt images on frontend
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Set constant high threshold for local development and testing
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});
app.use('/api', limiter);

// Request Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple Cookie Parser Middleware (zero-dependency)
app.use((req: any, _res, next) => {
  const cookieHeader = req.headers.cookie;
  req.cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie: string) => {
      const [key, ...valueParts] = cookie.split('=');
      if (key) {
        req.cookies[key.trim()] = valueParts.join('=').trim();
      }
    });
  }
  next();
});

// Serve Static Uploads (Receipts)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/households', householdRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);

// Health Check
app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'FlatMate Ledger API is running smoothly' });
});

// Global Error Handler
app.use(errorHandler);

// Start Recurring Bills Scheduler
const startRecurringBillsScheduler = () => {
  console.log('Initializing recurring bill scheduler...');
  // Run check immediately on start
  ExpenseService.processRecurringExpenses().catch((err) => {
    console.error('Error processing recurring bills on startup:', err);
  });

  // Run check every 1 hour
  setInterval(() => {
    ExpenseService.processRecurringExpenses().catch((err) => {
      console.error('Error processing recurring bills in cron:', err);
    });
  }, 60 * 60 * 1000);
};

// Start Server
const httpServer = createServer(app);
initSocket(httpServer, process.env.FRONTEND_URL || 'http://localhost:5173');

httpServer.listen(PORT, () => {
  console.log(`Server started successfully on port ${PORT} in ${process.env.NODE_ENV} mode.`);
  startRecurringBillsScheduler();
});
