const { openQureo } = require('./automation/browser');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { pool, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'QUREO Solver', mode: 'polling' });
});

// طابور المهام البسيط والمستقر
const pendingJobs = new Map();
let lastAgentSeen = 0;

function verifyAgentAuth(req, res, next) {
  const secret = process.env.AGENT_SECRET || '';
  const auth = req.headers.authorization || '';
  const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!secret || supplied !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/agent/poll', verifyAgentAuth, (req, res) => {
  try {
    lastAgentSeen = Date.now();
    if (pendingJobs.size > 0) {
      const [jobId, jobData] = pendingJobs.entries().next().value;
      return res.json({ job: { id: jobId, ...jobData } });
    }
    return res.json({ job: null });
  } catch (err) {
    console.error('Poll error:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/agent/result', verifyAgentAuth, (req, res) => {
  try {
    lastAgentSeen = Date.now();
    const { id, result } = req.body || {};

    if (id && pendingJobs.has(id)) {
      const job = pendingJobs.get(id);
      clearTimeout(job.timer);
      pendingJobs.delete(id);
      job.resolve(result);
      return res.json({ success: true });
    }

    return res.status(404).json({ error: 'Job not found' });
  } catch (err) {
    console.error('Result error:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/qureo/agent-status', (req, res) => {
  const connected = (Date.now() - lastAgentSeen) < 25000;
  res.json({ connected });
});

app.post('/api/qureo/connect', async (req, res) => {
  const connected = (Date.now() - lastAgentSeen) < 25000;
  if (!connected) {
    return res.status(503).json({ success: false, error: 'Agent الموبايل غير متصل.' });
  }

  const { student_id, password } = req.body || {};
  const id = crypto.randomUUID();

  try {
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingJobs.delete(id);
        reject(new Error('timeout'));
      }, 40000);

      pendingJobs.set(id, { resolve, reject, timer, type: 'login', student_id, password });
    });

    if (result && result.ok) {
      return res.json({ success: true, authenticated: true, user: result.user });
    }
    return res.status(401).json({ success: false, error: result?.error || 'فشل الاتصال' });
  } catch (error) {
    return res.status(504).json({ success: false, error: 'انتهت مهلة الاتصال' });
  }
});

app.post('/api/qureo/solve', async (req, res) => {
  const connected = (Date.now() - lastAgentSeen) < 25000;
  if (!connected) {
    return res.status(503).json({ success: false, error: 'Agent الموبايل غير متصل.' });
  }

  const { chapter_id, student_id, password, db_answers_map } = req.body || {};
  const id = crypto.randomUUID();

  try {
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingJobs.delete(id);
        reject(new Error('timeout'));
      }, 300000);

      pendingJobs.set(id, { resolve, reject, timer, type: 'solve', chapter_id, student_id, password, db_answers_map: db_answers_map || {} });
    });

    if (result && result.ok) {
      return res.json({ success: true, result: result.result });
    }
    return res.status(400).json({ success: false, error: result?.error || 'فشل الحل' });
  } catch (error) {
    return res.status(504).json({ success: false, error: 'انتهت مهلة حل الفصل' });
  }
});

async function startServer() {
  await initDatabase();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
