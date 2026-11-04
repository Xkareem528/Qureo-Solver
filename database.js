const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname,'qureo.db'), err => {
  if (err) console.error('SQLite:',err.message);
  else db.serialize(()=>{
    db.run('PRAGMA foreign_keys = ON');
    db.run(`CREATE TABLE IF NOT EXISTS chapters(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,description TEXT,order_index INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS questions(id INTEGER PRIMARY KEY AUTOINCREMENT,chapter_id INTEGER,question_text TEXT NOT NULL,options_json TEXT NOT NULL,correct_answer TEXT NOT NULL,normalized_hash TEXT UNIQUE NOT NULL,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(chapter_id) REFERENCES chapters(id))`);
    db.run(`CREATE TABLE IF NOT EXISTS progress(id INTEGER PRIMARY KEY AUTOINCREMENT,chapter_id INTEGER UNIQUE,completed_questions INTEGER DEFAULT 0,total_questions INTEGER DEFAULT 0,status TEXT DEFAULT 'In Progress',updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(chapter_id) REFERENCES chapters(id))`);
    db.get('SELECT COUNT(*) AS n FROM chapters',[],(e,row)=>{if(!e&&row.n===0){const s=db.prepare('INSERT INTO chapters(title,description,order_index) VALUES(?,?,?)');for(let i=1;i<=42;i++)s.run(`الفصل ${i}`,'فصل تجريبي — أضف بياناته عند توفرها',i);s.finalize();}});
  });
});
module.exports=db;
