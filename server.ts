import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// In-memory live sync state for real-time classroom synchronization
let currentLiveSync: any = null;
const sseClients: Set<express.Response> = new Set();

// CORS for local and preview domains
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// API endpoint to fetch latest classroom state
app.get('/api/sync', (req, res) => {
  if (!currentLiveSync) {
    return res.json({ ok: false, data: null });
  }
  return res.json({ ok: true, data: currentLiveSync });
});

// API endpoint for instructor to broadcast state changes
app.post('/api/sync', (req, res) => {
  const payload = req.body;
  if (payload && typeof payload === 'object') {
    currentLiveSync = {
      ...payload,
      updatedAt: payload.updatedAt || Date.now(),
    };

    // Broadcast immediately to all connected participant SSE streams
    const eventPayload = `data: ${JSON.stringify(currentLiveSync)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(eventPayload);
      } catch {
        sseClients.delete(client);
      }
    }

    return res.json({ ok: true, updatedAt: currentLiveSync.updatedAt });
  }
  return res.status(400).json({ ok: false, error: 'Payload inválido' });
});

// Server-Sent Events (SSE) for sub-10ms instant live delivery to all participants
app.get('/api/sync/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Send initial state immediately upon participant connection if present
  if (currentLiveSync) {
    res.write(`data: ${JSON.stringify(currentLiveSync)}\n\n`);
  }

  sseClients.add(res);

  // Keep-alive ping every 12 seconds to prevent proxy timeout
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(pingInterval);
      sseClients.delete(res);
    }
  }, 12000);

  req.on('close', () => {
    clearInterval(pingInterval);
    sseClients.delete(res);
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Mount Vite dev middleware in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static build
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Classroom Hub] Servidor rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer();
