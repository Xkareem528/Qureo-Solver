const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const db = require('./database');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json({limit:'200kb'}));
app.use(express.static(path.join(__dirname,'public')));

function clean(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'').trim();}
function hashQuestion(question, options){
  const q=clean(question); const opts=(Array.isArray(options)?options:[]).map(clean).filter(Boolean).sort();
  return crypto.createHash('sha256').update(q+'|'+opts.join('|')).digest('hex');
}
function validQuestion(b){return b && typeof b.question_text==='string' && b.question_text.trim() && Array.isArray(b.options) && b.options.length>0 && b.options.length<=20 && b.options.every(x=>typeof x==='string') && typeof b.correct_answer==='string' && b.correct_answer.trim();}
app.get('/api/health',(req,res)=>res.json({ok:true,app:'QUREO Solver',mode:'prototype'}));
app.get('/api/stats',(req,res)=>{
 db.get('SELECT COUNT(*) AS questions FROM questions',[],(e,q)=>{if(e)return res.status(500).json({error:e.message});db.get('SELECT COUNT(*) AS chapters FROM chapters',[],(e2,c)=>{if(e2)return res.status(500).json({error:e2.message});db.get('SELECT COUNT(*) AS completed FROM progress WHERE status = ?', ['Completed'],(e3,p)=>{if(e3)return res.status(500).json({error:e3.message});res.json({questions:q.questions,chapters:c.chapters,completed:p.completed});});});});
});
app.get('/api/chapters',(req,res)=>db.all('SELECT * FROM chapters ORDER BY order_index,id',[],(e,rows)=>e?res.status(500).json({error:e.message}):res.json(rows)));
app.post('/api/chapters',(req,res)=>{const title=String(req.body.title||'').trim();if(!title)return res.status(400).json({error:'Chapter title is required'});db.run('INSERT INTO chapters(title,description,order_index) VALUES(?,?,?)',[title,String(req.body.description||''),Number(req.body.order_index)||0],function(e){if(e)return res.status(500).json({error:e.message});res.status(201).json({id:this.lastID,title});});});
app.get('/api/progress',(req,res)=>db.all('SELECT * FROM progress ORDER BY chapter_id',[],(e,rows)=>e?res.status(500).json({error:e.message}):res.json(rows)));
app.post('/api/progress',(req,res)=>{const b=req.body;if(!Number.isInteger(Number(b.chapter_id))||Number(b.chapter_id)<1)return res.status(400).json({error:'Valid chapter_id required'});const done=Math.max(0,Number(b.completed_questions)||0),total=Math.max(done,Number(b.total_questions)||0),status=String(b.status||'In Progress');db.run(`INSERT INTO progress(chapter_id,completed_questions,total_questions,status,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(chapter_id) DO UPDATE SET completed_questions=excluded.completed_questions,total_questions=excluded.total_questions,status=excluded.status,updated_at=CURRENT_TIMESTAMP`,[Number(b.chapter_id),done,total,status],function(e){if(e)return res.status(500).json({error:e.message});res.json({success:true});});});
app.post('/api/questions',(req,res)=>{const b=req.body;if(!validQuestion(b))return res.status(400).json({error:'Provide question_text, a non-empty options array and correct_answer'});const opts=b.options.map(x=>x.trim());const h=hashQuestion(b.question_text,opts);db.run(`INSERT INTO questions(chapter_id,question_text,options_json,correct_answer,normalized_hash) VALUES(?,?,?,?,?) ON CONFLICT(normalized_hash) DO UPDATE SET chapter_id=excluded.chapter_id,question_text=excluded.question_text,options_json=excluded.options_json,correct_answer=excluded.correct_answer`,[Number(b.chapter_id)||null,b.question_text.trim(),JSON.stringify(opts),b.correct_answer.trim(),h],function(e){if(e)return res.status(500).json({error:e.message});res.json({success:true,hash:h,updated:this.changes>0});});});
app.post('/api/questions/match',(req,res)=>{const {question_text,options}=req.body||{};if(typeof question_text!=='string'||!Array.isArray(options))return res.status(400).json({error:'question_text and options are required'});const h=hashQuestion(question_text,options);db.get('SELECT id,chapter_id,question_text,options_json,correct_answer,created_at FROM questions WHERE normalized_hash=?',[h],(e,row)=>{if(e)return res.status(500).json({error:e.message});if(!row)return res.status(404).json({matched:false});res.json({matched:true,...row,options:JSON.parse(row.options_json)});});});
app.get('/api/questions/search',(req,res)=>{const q=String(req.query.q||'').slice(0,120);db.all('SELECT id,chapter_id,question_text,options_json,correct_answer,created_at FROM questions WHERE question_text LIKE ? ORDER BY id DESC LIMIT 50',['%'+q+'%'],(e,rows)=>e?res.status(500).json({error:e.message}):res.json(rows.map(r=>({...r,options:JSON.parse(r.options_json)}))));});
app.delete('/api/questions/:id',(req,res)=>db.run('DELETE FROM questions WHERE id=?',[Number(req.params.id)],function(e){if(e)return res.status(500).json({error:e.message});res.json({deleted:this.changes>0});}));
app.listen(PORT,'0.0.0.0',()=>console.log(`QUREO Solver running on port ${PORT}`));
