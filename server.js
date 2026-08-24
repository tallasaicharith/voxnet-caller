import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import roomRoutes from './server/routes/roomRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', roomRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static assets from dist (or root if fallback)
const distDir = path.join(__dirname, 'dist');
const staticDir = fs.existsSync(distDir) ? distDir : __dirname;

app.use(express.static(staticDir, {
    maxAge: '1h',
    setHeaders: (res, pathname) => {
        if (pathname.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
        } else if (pathname.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
    }
}));

// Fallback to index.html for SPA routes
app.get('*', (req, res) => {
    const indexPath = fs.existsSync(path.join(distDir, 'index.html'))
        ? path.join(distDir, 'index.html')
        : path.join(__dirname, 'index.html');
    res.sendFile(indexPath);
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`=================================================`);
        console.log(`  VoxNet P2P Online Caller running on port ${PORT}`);
        console.log(`  Open in browser: http://localhost:${PORT}`);
        console.log(`=================================================`);
    });
}

export default app;
