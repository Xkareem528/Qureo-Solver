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

function clean(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .trim();
}

function hashQuestion(question, options) {
  const q = clean(question);
  const opts = (Array.isArray(options) ? options : [])
    .map(clean)
    .filter(Boolean)
    .sort();

  return crypto.createHash('sha256')
    .update(q + '|' + opts.join('|'))
    .digest('hex');
}

function validQuestion(b) {
  return b &&
    typeof b.question_text === 'string' &&
    b.question_text.trim() &&
    Array.isArray(b.options) &&
    b.options.length > 0 &&
    b.options.length <= 20 &&
    b.options.every(x => typeof x === 'string') &&
    typeof b.correct_answer === 'string' &&
    b.correct_answer.trim();
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'QUREO Solver', mode: 'polling' });
});

// طابور المهام ونظام الـ Polling للعامل في Termux
const pendingJobs = new Map();
let lastAgentSeen = 0;
let currentAgentJob = null;

function verifyAgentAuth(req, res, next) {
  const secret = process.env.AGENT_SECRET || '';
  const auth = req.headers.authorization || '';
  const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!secret || supplied.length !== secret.length ||
      !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// مسار سحب المهام للـ Termux Worker
app.get('/agent/poll', verifyAgentAuth, (req, res) => {
  lastAgentSeen = Date.now();
  
  if (pendingJobs.size > 0 && !currentAgentJob) {
    const [jobId, jobData] = pendingJobs.entries().next().value;
    currentAgentJob = jobId;
    return res.json({ job: { id: jobId, ...jobData } });
  }

  res.json({ job: null });
});

// مسار استقبال النتائج من الـ Termux Worker
app.post('/agent/result', verifyAgentAuth, (req, res) => {
  lastAgentSeen = Date.now();
  const { id, result } = req.body || {};

  if (id && pendingJobs.has(id)) {
    const job = pendingJobs.get(id);
    clearTimeout(job.timer);
    pendingJobs.delete(id);
    if (currentAgentJob === id) currentAgentJob = null;
    job.resolve(result);
    return res.json({ success: true });
  }

  res.status(404).json({ error: 'Job not found or expired' });
});

app.get('/api/qureo/agent-status', (req, res) => {
  const connected = (Date.now() - lastAgentSeen) < 20000; // متصل إذا راسل السيرفر خلال آخر 20 ثانية
  res.json({ connected });
});

// مسار تسجيل الدخول
app.post('/api/qureo/connect', async (req, res) => {
  const connected = (Date.now() - lastAgentSeen) < 20000;
  if (!connected) {
    return res.status(503).json({ success: false, error: 'Agent الموبايل غير متصل. شغّله أولاً.' });
  }

  const { student_id, password } = req.body || {};
  if (!student_id || !password) {
    return res.status(400).json({ success: false, error: 'بيانات الدخول غير صالحة' });
  }

  const id = crypto.randomUUID();

  try {
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingJobs.delete(id);
        if (currentAgentJob === id) currentAgentJob = null;
        reject(new Error('timeout'));
      }, 40000);

      pendingJobs.set(id, { resolve, reject, timer, type: 'login', student_id, password });
    });

    if (result && result.ok) {
      return res.json({ success: true, authenticated: true, user: result.user });
    }

    return res.status(401).json({ success: false, error: result?.error || 'فشل الاتصال' });
  } catch (error) {
    return res.status(error.message === 'timeout' ? 504 : 503).json({
      success: false,
      error: error.message === 'timeout' ? 'انتهت مهلة الاتصال بمنصة QUREO' : 'انقطع اتصال Agent الموبايل'
    });
  }
});

// مسار حل الفصل
app.post('/api/qureo/solve', async (req, res) => {
  const connected = (Date.now() - lastAgentSeen) < 20000;
  if (!connected) {
    return res.status(503).json({ success: false, error: 'Agent الموبايل غير متصل. شغّله أولاً.' });
  }

  const { chapter_id, student_id, password, db_answers_map } = req.body || {};
  if (!chapter_id || !student_id || !password) {
    return res.status(400).json({ success: false, error: 'بيانات الفصل أو تسجيل الدخول غير صالحة' });
  }

  const id = crypto.randomUUID();

  try {
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingJobs.delete(id);
        if (currentAgentJob === id) currentAgentJob = null;
        reject(new Error('timeout'));
      }, 300000); // 5 دقائق كاملة للحل

      pendingJobs.set(id, { resolve, reject, timer, type: 'solve', chapter_id, student_id, password, db_answers_map: db_answers_map || {} });
    });

    if (result && result.ok) {
      return res.json({ success: true, result: result.result });
    }

    return res.status(400).json({ success: false, error: result?.error || 'فشل تنفيذ عملية الحل' });
  } catch (error) {
    return res.status(error.message === 'timeout' ? 504 : 503).json({
      success: false,
      error: error.message === 'timeout' ? 'انتهت مهلة حل الفصل' : 'انقطع اتصال Agent الموبايل'
    });
  }
});

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`QUREO Solver running on port ${PORT} (Polling Mode)`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
