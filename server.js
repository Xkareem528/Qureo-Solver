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
  res.json({ ok: true, app: 'QUREO Solver', mode: 'prototype' });
});

app.get('/api/stats', async (req, res) => {
  try {
    const q = await pool.query('SELECT COUNT(*) AS questions FROM questions');
    const c = await pool.query('SELECT COUNT(*) AS chapters FROM chapters');
    const p = await pool.query(
      "SELECT COUNT(*) AS completed FROM progress WHERE status = 'Completed'"
    );

    res.json({
      questions: Number(q.rows[0].questions),
      chapters: Number(c.rows[0].chapters),
      completed: Number(p.rows[0].completed)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/chapters', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM chapters ORDER BY order_index, id'
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chapters', async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    if (!title) {
      return res.status(400).json({ error: 'Chapter title is required' });
    }

    const result = await pool.query(
      `INSERT INTO chapters (title, description, order_index)
       VALUES ($1, $2, $3) RETURNING id, title`,
      [
        title,
        String(req.body.description || ''),
        Number(req.body.order_index) || 0
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/progress', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM progress ORDER BY chapter_id'
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/progress', async (req, res) => {
  try {
    const b = req.body || {};
    const chapterId = Number(b.chapter_id);

    if (!Number.isInteger(chapterId) || chapterId < 1) {
      return res.status(400).json({ error: 'Valid chapter_id required' });
    }

    const done = Math.max(0, Number(b.completed_questions) || 0);
    const total = Math.max(done, Number(b.total_questions) || 0);
    const status = String(b.status || 'In Progress');

    await pool.query(
      `INSERT INTO progress
       (chapter_id, completed_questions, total_questions, status, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (chapter_id) DO UPDATE SET
       completed_questions = EXCLUDED.completed_questions,
       total_questions = EXCLUDED.total_questions,
       status = EXCLUDED.status,
       updated_at = CURRENT_TIMESTAMP`,
      [chapterId, done, total, status]
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/questions', async (req, res) => {
  try {
    const b = req.body;

    if (!validQuestion(b)) {
      return res.status(400).json({
        error: 'Provide question_text, a non-empty options array and correct_answer'
      });
    }

    const opts = b.options.map(x => x.trim());
    const h = hashQuestion(b.question_text, opts);
    const chapterId = Number(b.chapter_id) || null;

    const result = await pool.query(
      `INSERT INTO questions
       (chapter_id, question_text, options_json, correct_answer, normalized_hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (normalized_hash) DO UPDATE SET
       chapter_id = EXCLUDED.chapter_id,
       question_text = EXCLUDED.question_text,
       options_json = EXCLUDED.options_json,
       correct_answer = EXCLUDED.correct_answer
       RETURNING id`,
      [
        chapterId,
        b.question_text.trim(),
        JSON.stringify(opts),
        b.correct_answer.trim(),
        h
      ]
    );

    res.json({ success: true, id: result.rows[0].id, hash: h });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/questions/match', async (req, res) => {
  try {
    const { question_text, options } = req.body || {};

    if (typeof question_text !== 'string' || !Array.isArray(options)) {
      return res.status(400).json({
        error: 'question_text and options are required'
      });
    }

    const h = hashQuestion(question_text, options);

    const result = await pool.query(
      `SELECT id, chapter_id, question_text, options_json,
       correct_answer, created_at
       FROM questions WHERE normalized_hash = $1`,
      [h]
    );

    if (!result.rows.length) {
      return res.status(404).json({ matched: false });
    }

    const row = result.rows[0];

    res.json({
      matched: true,
      ...row,
      options: JSON.parse(row.options_json)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/questions/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').slice(0, 120);

    const result = await pool.query(
      `SELECT id, chapter_id, question_text, options_json,
       correct_answer, created_at
       FROM questions
       WHERE question_text ILIKE $1
       ORDER BY id DESC LIMIT 50`,
      [`%${q}%`]
    );

    res.json(result.rows.map(r => ({
      ...r,
      options: JSON.parse(r.options_json)
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/questions/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid question id' });
    }

    const result = await pool.query(
      'DELETE FROM questions WHERE id = $1',
      [id]
    );

    res.json({ deleted: result.rowCount > 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`QUREO Solver running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
        
