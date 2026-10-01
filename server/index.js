import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5000);
const DATABASE_URL = process.env.DATABASE_URL || '';
const JWT_SECRET = process.env.JWT_SECRET || 'speakingbot-preview-secret-change-before-production';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || '').trim();
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DB_CONFIGURED = Boolean(DATABASE_URL);

const pool = DB_CONFIGURED
  ? new Pool({
      connectionString: DATABASE_URL,
      max: Number(process.env.DB_POOL_SIZE || 20),
      min: 0,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : undefined
    })
  : null;

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors({
  origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN.split(',').map(x => x.trim()),
  credentials: true
}));
app.use(express.json({ limit: '100kb' }));
app.use(rateLimit({
  windowMs: 60000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false
}));

const query = (text, params = []) => {
  if (!pool) throw new Error('Database is not configured');
  return pool.query(text, params);
};

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    CREATE TABLE IF NOT EXISTS tests (
      id SERIAL PRIMARY KEY,
      test_id VARCHAR(120) NOT NULL UNIQUE,
      title VARCHAR(200) NOT NULL,
      category VARCHAR(80),
      topic VARCHAR(120),
      difficulty VARCHAR(20) NOT NULL DEFAULT 'Medium',
      duration INTEGER NOT NULL DEFAULT 15,
      premium BOOLEAN NOT NULL DEFAULT FALSE,
      published BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tests_category ON tests(category);
    CREATE INDEX IF NOT EXISTS idx_tests_published ON tests(published);

    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      test_id VARCHAR(120) NOT NULL REFERENCES tests(test_id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      options JSONB NOT NULL,
      answer INTEGER NOT NULL CHECK (answer >= 0),
      explanation TEXT,
      topic VARCHAR(120),
      difficulty VARCHAR(20),
      published BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_questions_test ON questions(test_id);

    CREATE TABLE IF NOT EXISTS attempts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      test_id VARCHAR(120) NOT NULL REFERENCES tests(test_id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      percentage INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_test ON attempts(test_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_completed ON attempts(completed_at);

    CREATE TABLE IF NOT EXISTS assessment_access (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      test_id VARCHAR(120) NOT NULL REFERENCES tests(test_id) ON DELETE CASCADE,
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      access_password_hash TEXT NOT NULL,
      label VARCHAR(200) NOT NULL DEFAULT 'Company Assessment',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_access_email ON assessment_access(email);
    CREATE INDEX IF NOT EXISTS idx_access_window ON assessment_access(start_at, end_at);
    CREATE INDEX IF NOT EXISTS idx_access_active ON assessment_access(active);
  `);
}

async function seedDemo() {
  if (!DB_CONFIGURED || process.env.SEED_DEMO === 'false') return;
  const tests = [
    ['apt-1','Quantitative Aptitude — Placement Set 01','Aptitude','Quantitative Aptitude','Medium',20],
    ['sql-1','SQL & DBMS Interview Challenge','Technical','SQL','Medium',15],
    ['java-1','Java OOP Mastery Test','Technical','Java','Hard',25],
    ['logic-1','Logical Reasoning — Fast Track','Reasoning','Logical Reasoning','Easy',12],
    ['python-1','Python Coding Fundamentals','Technical','Python','Medium',20],
    ['verbal-1','Verbal Ability & Grammar Sprint','Verbal','Verbal Ability','Easy',15]
  ];
  for (const t of tests) {
    await query(`
      INSERT INTO tests(test_id,title,category,topic,difficulty,duration)
      VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(test_id) DO NOTHING
    `, t);
  }
  const questions = [
    ['sql-1','Which SQL clause filters grouped records?',['WHERE','HAVING','ORDER BY','LIMIT'],1,'HAVING filters groups after GROUP BY.','SQL','Medium'],
    ['java-1','Which OOP principle allows the same method name to behave differently?',['Encapsulation','Inheritance','Polymorphism','Abstraction'],2,'Polymorphism supports different implementations through a common interface.','OOP','Medium'],
    ['python-1','Which Python collection stores key-value pairs?',['List','Tuple','Set','Dictionary'],3,'A dictionary stores key-value pairs.','Python','Easy']
  ];
  for (const q of questions) {
    const exists = await query('SELECT id FROM questions WHERE test_id=$1 AND text=$2 LIMIT 1', [q[0], q[1]]);
    if (!exists.rowCount) {
      await query(`
        INSERT INTO questions(test_id,text,options,answer,explanation,topic,difficulty)
        VALUES($1,$2,$3::jsonb,$4,$5,$6,$7)
      `, [q[0], q[1], JSON.stringify(q[2]), q[3], q[4], q[5], q[6]]);
    }
  }
}

const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const publicQuestion = q => ({
  ...q,
  _id: q.id,
  options: Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]')
});

async function loadUser(id) {
  const r = await query(
    'SELECT id,name,email,role,last_seen_at AS "lastSeenAt",created_at AS "createdAt" FROM users WHERE id=$1 LIMIT 1',
    [id]
  );
  return r.rows[0] || null;
}

const auth = async (req, res, next) => {
  if (!DB_CONFIGURED) return res.status(503).json({ error: 'Database is not configured yet' });
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await loadUser(payload.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    await query('UPDATE users SET last_seen_at=NOW() WHERE id=$1', [user.id]);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
};

const adminOnly = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin access required' });

app.get('/api/health', async (_req, res) => {
  let database = 'not-configured';
  if (DB_CONFIGURED) {
    try {
      await query('SELECT 1');
      database = 'connected';
    } catch {
      database = 'unavailable';
    }
  }
  res.status(database === 'unavailable' ? 503 : 200).json({
    ok: database !== 'unavailable',
    database,
    service: 'speakingbot-api',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/auth/register', async (req, res) => {
  if (!DB_CONFIGURED) return res.status(503).json({ error: 'Database is not configured yet' });
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password || String(password).length < 8)
      return res.status(400).json({ error: 'Name, valid email and password of at least 8 characters are required' });
    const normalized = String(email).toLowerCase().trim();
    const exists = await query('SELECT id FROM users WHERE email=$1 LIMIT 1', [normalized]);
    if (exists.rowCount) return res.status(409).json({ error: 'Email already registered' });
    const passwordHash = await bcrypt.hash(String(password), 12);
    const r = await query(
      'INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role',
      [String(name).trim(), normalized, passwordHash, 'student']
    );
    const user = r.rows[0];
    const token = jwt.sign({ sub: String(user.id), role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: publicUser(user) });
  } catch {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  if (!DB_CONFIGURED) return res.status(503).json({ error: 'Database is not configured yet' });
  try {
    const { identifier, email, password } = req.body || {};
    const rawIdentifier = String(identifier ?? email ?? '').trim();
    const normalized = rawIdentifier.toLowerCase();
    let r = await query(
      'SELECT id,name,email,password_hash AS "passwordHash",role FROM users WHERE email=$1 LIMIT 1',
      [normalized]
    );
    let user = r.rows[0];

    if (!user && ADMIN_USERNAME && rawIdentifier === ADMIN_USERNAME && ADMIN_PASSWORD && String(password || '') === ADMIN_PASSWORD) {
      const adminEmail = ADMIN_EMAIL || 'admin@vsbec.local';
      r = await query(
        'SELECT id,name,email,password_hash AS "passwordHash",role FROM users WHERE email=$1 LIMIT 1',
        [adminEmail]
      );
      user = r.rows[0];
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      if (!user) {
        r = await query(
          'INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,password_hash AS "passwordHash",role',
          ['VSBEC Admin', adminEmail, hash, 'admin']
        );
        user = r.rows[0];
      } else if (user.role !== 'admin') {
        r = await query(
          'UPDATE users SET role=$1,password_hash=$2,last_seen_at=NOW() WHERE id=$3 RETURNING id,name,email,password_hash AS "passwordHash",role',
          ['admin', hash, user.id]
        );
        user = r.rows[0];
      }
    }

    if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash)))
      return res.status(401).json({ error: 'Invalid email/username or password' });

    await query('UPDATE users SET last_seen_at=NOW() WHERE id=$1', [user.id]);
    const token = jwt.sign({ sub: String(user.id), role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: publicUser(user) });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/tests', async (req, res) => {
  if (!DB_CONFIGURED) return res.json({ tests: [], databaseConfigured: false });
  try {
    const category = String(req.query.category || '').trim();
    const q = String(req.query.q || '').trim();
    const params = [];
    const where = ['t.published=TRUE'];
    if (category) { params.push(category); where.push(`t.category=$${params.length}`); }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(t.title ILIKE $${params.length} OR t.topic ILIKE $${params.length} OR t.category ILIKE $${params.length})`);
    }
    const r = await query(`
      SELECT t.*,
        (SELECT COUNT(*)::int FROM questions q WHERE q.test_id=t.test_id AND q.published=TRUE) AS questions,
        (SELECT COUNT(*)::int FROM attempts a WHERE a.test_id=t.test_id) AS attempts
      FROM tests t WHERE ${where.join(' AND ')} ORDER BY t.created_at DESC
    `, params);
    res.json({ tests: r.rows });
  } catch {
    res.status(500).json({ error: 'Could not load tests' });
  }
});

app.get('/api/tests/:testId', async (req, res) => {
  if (!DB_CONFIGURED) return res.status(503).json({ error: 'Database not configured yet' });
  try {
    const t = await query('SELECT * FROM tests WHERE test_id=$1 AND published=TRUE LIMIT 1', [req.params.testId]);
    if (!t.rowCount) return res.status(404).json({ error: 'Test not found' });
    const q = await query('SELECT id,test_id AS "testId",text,options,answer,explanation,topic,difficulty,published,created_at AS "createdAt",updated_at AS "updatedAt" FROM questions WHERE test_id=$1 AND published=TRUE ORDER BY id', [req.params.testId]);
    res.json({ test: t.rows[0], questions: q.rows.map(publicQuestion) });
  } catch {
    res.status(500).json({ error: 'Could not load test' });
  }
});

app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.post('/api/heartbeat', auth, async (req, res) => {
  await query('UPDATE users SET last_seen_at=NOW() WHERE id=$1', [req.user.id]);
  res.json({ ok: true });
});

app.post('/api/attempts/submit', auth, async (req, res) => {
  try {
    const { testId, answers, durationSeconds } = req.body || {};
    if (!testId || !answers || typeof answers !== 'object') return res.status(400).json({ error: 'Invalid submission' });
    const qr = await query('SELECT id,answer FROM questions WHERE test_id=$1 AND published=TRUE', [testId]);
    if (!qr.rowCount) return res.status(404).json({ error: 'Test questions not found' });
    let correct = 0;
    for (const q of qr.rows) {
      if (Number(answers[q.id]) === q.answer || Number(answers[q._id]) === q.answer) correct++;
    }
    const maxScore = qr.rowCount;
    const answered = Object.keys(answers).length;
    const duration = Math.max(0, Number(durationSeconds || 0));
    const ar = await query(`
      INSERT INTO attempts(user_id,test_id,score,max_score,percentage,duration_seconds)
      VALUES($1,$2,$3,$4,$5,$6)
      RETURNING id, user_id AS "userId", test_id AS "testId", score, max_score AS "maxScore",
      percentage, duration_seconds AS "durationSeconds", completed_at AS "completedAt"
    `, [req.user.id, testId, correct, maxScore, Math.round(correct / maxScore * 100), duration]);
    res.status(201).json({
      attempt: ar.rows[0],
      correct,
      answered,
      skipped: Math.max(0, maxScore - answered),
      questions: maxScore
    });
  } catch {
    res.status(500).json({ error: 'Could not submit attempt' });
  }
});

app.get('/api/my/attempts', auth, async (req, res) => {
  const r = await query(`
    SELECT id,user_id AS "userId",test_id AS "testId",score,max_score AS "maxScore",
    percentage,duration_seconds AS "durationSeconds",completed_at AS "completedAt"
    FROM attempts WHERE user_id=$1 ORDER BY completed_at DESC LIMIT 100
  `, [req.user.id]);
  res.json({ attempts: r.rows });
});

app.get('/api/my/scheduled-tests', auth, async (req, res) => {
  const r = await query(`
    SELECT a.id,a.email,a.test_id AS "testId",a.start_at AS "startAt",a.end_at AS "endAt",
    a.label,a.active,t.title,t.category,t.topic,t.difficulty,t.duration,t.premium
    FROM assessment_access a
    LEFT JOIN tests t ON t.test_id=a.test_id
    WHERE a.email=$1 AND a.active=TRUE AND a.end_at>=NOW()
    ORDER BY a.start_at
  `, [req.user.email]);
  res.json({ tests: r.rows.map(x => ({ ...x, _id: x.id, test: x.title ? {
    testId:x.testId,title:x.title,category:x.category,topic:x.topic,difficulty:x.difficulty,duration:x.duration,premium:x.premium
  } : null, accessPasswordRequired:true })) });
});

app.post('/api/scheduled-tests/:id/verify', auth, async (req, res) => {
  try {
    const r = await query(`
      SELECT a.*,t.title,t.category,t.topic,t.difficulty,t.duration,t.premium,t.published
      FROM assessment_access a JOIN tests t ON t.test_id=a.test_id
      WHERE a.id=$1 AND a.email=$2 AND a.active=TRUE LIMIT 1
    `, [req.params.id, req.user.email]);
    if (!r.rowCount) return res.status(404).json({ error: 'Assessment access not found' });
    const a = r.rows[0];
    const now = new Date();
    if (now < new Date(a.start_at)) return res.status(403).json({ error:'Assessment has not started yet', startAt:a.start_at });
    if (now > new Date(a.end_at)) return res.status(403).json({ error:'Assessment access has expired', endAt:a.end_at });
    if (!(await bcrypt.compare(String(req.body?.password || ''), a.access_password_hash)))
      return res.status(401).json({ error:'Incorrect assessment access password' });
    const qr = await query('SELECT id,test_id AS "testId",text,options,answer,explanation,topic,difficulty,published FROM questions WHERE test_id=$1 AND published=TRUE ORDER BY id', [a.test_id]);
    res.json({
      accessId:a.id,
      test:{testId:a.test_id,title:a.title,category:a.category,topic:a.topic,difficulty:a.difficulty,duration:a.duration,premium:a.premium},
      questions:qr.rows.map(publicQuestion),
      window:{startAt:a.start_at,endAt:a.end_at}
    });
  } catch {
    res.status(500).json({ error:'Could not verify assessment access' });
  }
});

app.get('/api/admin/schedules', auth, adminOnly, async (_req, res) => {
  const r = await query(`
    SELECT a.id,a.email,a.test_id AS "testId",a.start_at AS "startAt",a.end_at AS "endAt",
    a.label,a.active,a.created_at AS "createdAt",u.name AS "createdByName",u.email AS "createdByEmail"
    FROM assessment_access a LEFT JOIN users u ON u.id=a.created_by ORDER BY a.start_at
  `);
  res.json({ schedules:r.rows.map(x=>({...x,_id:x.id,createdBy:x.createdByName?{name:x.createdByName,email:x.createdByEmail}:null})) });
});

app.post('/api/admin/schedules', auth, adminOnly, async (req, res) => {
  try {
    const { email,testId,startAt,endAt,password,label } = req.body || {};
    if (!email || !testId || !startAt || !endAt || !password || String(password).length < 6)
      return res.status(400).json({error:'Email, test, start/end time and a 6+ character access password are required'});
    const start = new Date(startAt), end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start)
      return res.status(400).json({error:'Invalid assessment time window'});
    if (!(await query('SELECT 1 FROM tests WHERE test_id=$1 LIMIT 1',[testId])).rowCount)
      return res.status(404).json({error:'Test not found'});
    const hash = await bcrypt.hash(String(password),12);
    const r = await query(`
      INSERT INTO assessment_access(email,test_id,start_at,end_at,access_password_hash,label,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7)
      RETURNING id,email,test_id AS "testId",start_at AS "startAt",end_at AS "endAt",label
    `, [String(email).toLowerCase().trim(),testId,start,end,hash,label||'Company Assessment',req.user.id]);
    res.status(201).json({schedule:{...r.rows[0],_id:r.rows[0].id},accessPassword:String(password)});
  } catch {
    res.status(400).json({error:'Could not create scheduled assessment'});
  }
});

app.delete('/api/admin/schedules/:id', auth, adminOnly, async (req,res) => {
  const r = await query('DELETE FROM assessment_access WHERE id=$1 RETURNING id',[req.params.id]);
  if (!r.rowCount) return res.status(404).json({error:'Schedule not found'});
  res.json({ok:true});
});

app.get('/api/admin/metrics', auth, adminOnly, async (_req,res) => {
  const r = await Promise.all([
    query('SELECT COUNT(*)::int AS count FROM users'),
    query('SELECT COUNT(*)::int AS count FROM users WHERE last_seen_at>=NOW()-INTERVAL \'5 minutes\''),
    query('SELECT COUNT(*)::int AS count FROM attempts'),
    query(`
      SELECT a.id,a.test_id AS "testId",a.score,a.max_score AS "maxScore",a.percentage,
      a.duration_seconds AS "durationSeconds",a.completed_at AS "completedAt",
      u.id AS "userId",u.name AS "userName",u.email AS "userEmail"
      FROM attempts a JOIN users u ON u.id=a.user_id
      WHERE a.completed_at>=NOW()-INTERVAL '24 hours'
      ORDER BY a.completed_at DESC LIMIT 20
    `),
    query('SELECT id,name,email,role,last_seen_at AS "lastSeenAt",created_at AS "createdAt" FROM users ORDER BY last_seen_at DESC LIMIT 5000'),
    query('SELECT COUNT(*)::int AS count FROM assessment_access WHERE active=TRUE AND end_at>=NOW()')
  ]);
  res.json({
    totalUsers:r[0].rows[0].count,
    activeUsers:r[1].rows[0].count,
    totalAttempts:r[2].rows[0].count,
    recentAttempts:r[3].rows,
    students:r[4].rows,
    scheduledTests:r[5].rows[0].count,
    generatedAt:new Date().toISOString()
  });
});

app.get('/api/admin/tests', auth, adminOnly, async (_req,res) => {
  const r = await query('SELECT * FROM tests ORDER BY created_at DESC');
  res.json({tests:r.rows});
});

app.post('/api/admin/tests', auth, adminOnly, async (req,res) => {
  try {
    const {testId,title,category,topic,difficulty,duration,premium,published} = req.body || {};
    if (!testId || !title) return res.status(400).json({error:'testId and title are required'});
    const r = await query(`
      INSERT INTO tests(test_id,title,category,topic,difficulty,duration,premium,published)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `,[testId,title,category||null,topic||null,difficulty||'Medium',Number(duration||15),Boolean(premium),published!==false]);
    res.status(201).json({test:r.rows[0]});
  } catch(e) {
    res.status(400).json({error:e.code==='23505'?'Test ID already exists':'Could not create test'});
  }
});

app.patch('/api/admin/tests/:testId', auth, adminOnly, async (req,res) => {
  const allowed=['title','category','topic','difficulty','duration','premium','published'];
  const fields=[],params=[];
  for(const key of allowed) if(req.body?.[key]!==undefined){params.push(req.body[key]);fields.push(`${key}=$${params.length}`);}
  if(!fields.length) return res.status(400).json({error:'No supported fields to update'});
  params.push(req.params.testId);
  const r=await query(`UPDATE tests SET ${fields.join(',')},updated_at=NOW() WHERE test_id=$${params.length} RETURNING *`,params);
  if(!r.rowCount) return res.status(404).json({error:'Test not found'});
  res.json({test:r.rows[0]});
});

app.delete('/api/admin/tests/:testId', auth, adminOnly, async (req,res) => {
  const r=await query('DELETE FROM tests WHERE test_id=$1 RETURNING test_id',[req.params.testId]);
  if(!r.rowCount) return res.status(404).json({error:'Test not found'});
  res.json({ok:true});
});

app.get('/api/admin/tests/:testId/questions', auth, adminOnly, async (req,res) => {
  const r=await query('SELECT id,test_id AS "testId",text,options,answer,explanation,topic,difficulty,published,created_at AS "createdAt",updated_at AS "updatedAt" FROM questions WHERE test_id=$1 ORDER BY id',[req.params.testId]);
  res.json({questions:r.rows.map(publicQuestion)});
});

app.post('/api/admin/tests/:testId/questions', auth, adminOnly, async (req,res) => {
  try {
    const {text,options,answer,explanation,topic,difficulty,published}=req.body||{};
    if(!text || !Array.isArray(options) || options.length<2 || answer===undefined)
      return res.status(400).json({error:'Question text, at least two options and an answer are required'});
    const r=await query(`
      INSERT INTO questions(test_id,text,options,answer,explanation,topic,difficulty,published)
      VALUES($1,$2,$3::jsonb,$4,$5,$6,$7,$8)
      RETURNING id,test_id AS "testId",text,options,answer,explanation,topic,difficulty,published,created_at AS "createdAt",updated_at AS "updatedAt"
    `,[req.params.testId,text,JSON.stringify(options),Number(answer),explanation||null,topic||null,difficulty||null,published!==false]);
    res.status(201).json({question:publicQuestion(r.rows[0])});
  } catch {
    res.status(400).json({error:'Could not create question'});
  }
});

app.patch('/api/admin/questions/:id', auth, adminOnly, async (req,res) => {
  const allowed=['text','options','answer','explanation','topic','difficulty','published'];
  const fields=[],params=[];
  for(const key of allowed) if(req.body?.[key]!==undefined){
    params.push(key==='options'?JSON.stringify(req.body[key]):req.body[key]);
    fields.push(key==='options'?`options=$${params.length}::jsonb`:`${key}=$${params.length}`);
  }
  if(!fields.length) return res.status(400).json({error:'No supported fields to update'});
  params.push(req.params.id);
  const r=await query(`UPDATE questions SET ${fields.join(',')},updated_at=NOW() WHERE id=$${params.length} RETURNING id,test_id AS "testId",text,options,answer,explanation,topic,difficulty,published,created_at AS "createdAt",updated_at AS "updatedAt"`,params);
  if(!r.rowCount) return res.status(404).json({error:'Question not found'});
  res.json({question:publicQuestion(r.rows[0])});
});

app.delete('/api/admin/questions/:id', auth, adminOnly, async (req,res) => {
  const r=await query('DELETE FROM questions WHERE id=$1 RETURNING id',[req.params.id]);
  if(!r.rowCount) return res.status(404).json({error:'Question not found'});
  res.json({ok:true});
});

app.get('/api/admin/users', auth, adminOnly, async (_req,res) => {
  const r=await query('SELECT id,name,email,role,last_seen_at AS "lastSeenAt",created_at AS "createdAt" FROM users ORDER BY last_seen_at DESC LIMIT 5000');
  res.json({users:r.rows});
});

const dist=path.resolve(__dirname,'../dist');
app.use(express.static(dist));
app.get('*',(req,res)=>{
  if(req.path.startsWith('/api/')) return res.status(404).json({error:'API route not found'});
  res.sendFile(path.join(dist,'index.html'));
});

async function start() {
  if (DB_CONFIGURED) {
    try {
      await query('SELECT 1');
      await ensureSchema();
      await seedDemo();
      console.log('PostgreSQL connected and schema ready');
    } catch (e) {
      console.error('Database startup failed:', e.message);
      process.exitCode = 1;
    }
  } else {
    console.log('DATABASE_URL not configured; running frontend/public preview mode');
  }
  app.listen(PORT, () => console.log('SpeakingBot API listening on ' + PORT));
}
start();
