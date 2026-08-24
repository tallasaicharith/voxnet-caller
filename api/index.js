import express from 'express';
import cors from 'cors';
import roomRoutes from '../server/routes/roomRoutes.js';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
const healthHandler = (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API Routes
app.use('/api', roomRoutes);
app.use('/', roomRoutes);

// Global Error Handler for Serverless Function
app.use((err, req, res, next) => {
  console.error('Vercel Serverless Function Error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

export default app;
