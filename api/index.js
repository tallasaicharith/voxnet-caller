import express from 'express';
import cors from 'cors';
import roomRoutes from '../server/routes/roomRoutes.js';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', roomRoutes);

// Health Check
const healthHandler = (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

export default app;
