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

app.get('/api/source-questions/stats', async (req, res) => {
  try {
    const [total, statuses, levels, answers] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM source_questions'),
      pool.query(`
        SELECT review_status, COUNT(*) AS count
        FROM source_questions
        GROUP BY review_status
        ORDER BY review_status
      `),
      pool.query(`
        SELECT level, COUNT(*) AS count
        FROM source_questions
        GROUP BY level
        ORDER BY level
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE has_answer_marker = TRUE) AS explicit_answers,
          COUNT(*) FILTER (WHERE has_answer_marker = FALSE) AS missing_markers,
          COUNT(*) FILTER (
            WHERE proposed_answer IS NOT NULL AND proposed_answer <> ''
          ) AS proposed_answers
        FROM source_questions
      `)
    ]);

    res.json({
      total: Number(total.rows[0].total),
      review_statuses: statuses.rows.map(row => ({
        status: row.review_status,
        count: Number(row.count)
      })),
      levels: levels.rows.map(row => ({
        level: Number(row.level),
        count: Number(row.count)
      })),
      answers: {
        explicit: Number(answers.rows[0].explicit_answers),
        missing_markers: Number(answers.rows[0].missing_markers),
        proposed: Number(answers.rows[0].proposed_answers)
      }
    });
  } catch (error) {
    console.error('Source stats error:', error.message);
    res.status(500).json({ error: 'Failed to retrieve source statistics' });
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


app.post('/api/source-questions/import', async (req, res) => {
  const token = process.env.IMPORT_TOKEN;

  if (!token || req.get('x-import-token') !== token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const records = req.body?.records;

  if (!Array.isArray(records) || records.length < 1 || records.length > 100) {
    return res.status(400).json({
      error: 'records must be an array containing 1 to 100 items'
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    let imported = 0;
    let updated = 0;

    for (const r of records) {
      if (
        !r ||
        !Number.isInteger(r.level) ||
        r.level < 1 || r.level > 42 ||
        typeof r.fingerprint !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(r.fingerprint) ||
        typeof r.question !== 'string' ||
        !r.question.trim() ||
        typeof r.answer !== 'string' ||
        typeof r.answer_type !== 'string' ||
        !r.answer_type.trim() ||
        (r.lesson != null && typeof r.lesson !== 'string') ||
        (r.question_label != null && typeof r.question_label !== 'string') ||
        (r.proposed_answer != null && typeof r.proposed_answer !== 'string') ||
        (r.proposed_answer_type != null && typeof r.proposed_answer_type !== 'string') ||
        typeof r.has_answer_marker !== 'boolean' ||
        (r.review_status != null && ![
          'pending',
          'classified_not_verified',
          'verified',
          'rejected'
        ].includes(r.review_status)) ||
        !Number.isInteger(r.source_line) ||
        r.source_line < 1
      ) {
        throw new Error('Invalid source record');
      }

      const status = [
        'pending',
        'classified_not_verified',
        'verified',
        'rejected'
      ].includes(r.review_status) ? r.review_status : 'pending';

      const result = await client.query(`
        INSERT INTO source_questions (
          fingerprint, level, lesson, question_label, question_text,
          original_answer, original_answer_type, proposed_answer,
          proposed_answer_type, has_answer_marker, source_line,
          source_file, review_status
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (source_file, source_line) DO UPDATE SET
          lesson = CASE
            WHEN source_questions.review_status IN ('verified', 'rejected')
              THEN source_questions.lesson
            ELSE EXCLUDED.lesson
          END,
          question_label = CASE
            WHEN source_questions.review_status IN ('verified', 'rejected')
              THEN source_questions.question_label
            ELSE EXCLUDED.question_label
          END,
          question_text = CASE
            WHEN source_questions.review_status IN ('verified', 'rejected')
              THEN source_questions.question_text
            ELSE EXCLUDED.question_text
          END,
          original_answer = CASE
            WHEN source_questions.review_status IN ('verified', 'rejected')
              THEN source_questions.original_answer
            ELSE EXCLUDED.original_answer
          END,
          original_answer_type = CASE
            WHEN source_questions.review_status IN ('verified', 'rejected')
              THEN source_questions.original_answer_type
            ELSE EXCLUDED.original_answer_type
          END,
          proposed_answer = CASE
            WHEN source_questions.review_status IN ('verified', 'rejected')
              THEN source_questions.proposed_answer
            ELSE EXCLUDED.proposed_answer
          END,
          proposed_answer_type = CASE
            WHEN source_questions.review_status IN ('verified', 'rejected')
              THEN source_questions.proposed_answer_type
            ELSE EXCLUDED.proposed_answer_type
          END,
          has_answer_marker = CASE
            WHEN source_questions.review_status IN ('verified', 'rejected')
              THEN source_questions.has_answer_marker
            ELSE EXCLUDED.has_answer_marker
          END,
          source_line = CASE
            WHEN source_questions.review_status IN ('verified', 'rejected')
              THEN source_questions.source_line
            ELSE EXCLUDED.source_line
          END,
          source_file = CASE
            WHEN source_questions.review_status IN ('verified', 'rejected')
              THEN source_questions.source_file
            ELSE EXCLUDED.source_file
          END,
          review_status = CASE
            WHEN source_questions.review_status IN ('verified', 'rejected')
              THEN source_questions.review_status
            WHEN source_questions.review_status = 'classified_not_verified'
              AND EXCLUDED.review_status = 'pending'
              THEN source_questions.review_status
            ELSE EXCLUDED.review_status
          END
        RETURNING (xmax = 0) AS inserted
      `, [
        r.fingerprint,
        r.level,
        r.lesson || null,
        r.question_label || null,
        r.question.trim(),
        r.answer,
        r.answer_type,
        r.proposed_answer || null,
        r.proposed_answer_type || null,
        Boolean(r.has_answer_marker),
        r.source_line,
        'Qureo_prompts_levels_1_to_42-3.txt',
        status
      ]);

      if (result.rows[0].inserted) imported++;
      else updated++;
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      received: records.length,
      inserted: imported,
      updated
    });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError.message);
      }
    }
    console.error('Source import error:', error.message);
    const isValidationError = error.message === 'Invalid source record';
    res.status(isValidationError ? 400 : 500).json({
      error: isValidationError ? error.message : 'Import failed due to a server error'
    });
  } finally {
    if (client) client.release();
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
app.get('/api/qureo/status', async (req, res) => {
  try {
    const result = await openQureo();

    res.json({
      success: true,
      message: 'تم فحص صفحة QUREO',
      ...result
    });

  } catch (error) {
    console.error('QUREO connection error:', error.message);

    res.status(500).json({
      success: false,
      error: 'تعذر فتح صفحة QUREO',
      details: error.message
    });
  }
});

startServer();
        
