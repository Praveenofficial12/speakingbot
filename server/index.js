import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||5000);
const SUPABASE_URL=(process.env.SUPABASE_URL||'').trim();
const SUPABASE_KEY=(process.env.SUPABASE_PUBLISHABLE_KEY||'').trim();
const APP_DB_SECRET=process.env.APP_DB_SECRET||'';
const JWT_SECRET=process.env.JWT_SECRET||'speakingbot-change-this-secret';
const ADMIN_USERNAME=(process.env.ADMIN_USERNAME||'vsbec').trim();
const ADMIN_EMAIL=(process.env.ADMIN_EMAIL||'admin@vsbec.local').toLowerCase().trim();
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'';
const CLIENT_ORIGIN=process.env.CLIENT_ORIGIN||'*';
const READY=Boolean(SUPABASE_URL&&SUPABASE_KEY&&APP_DB_SECRET);

const db=READY?createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{'x-app-secret':APP_DB_SECRET}}}):null;

app.set('trust proxy',1);
app.use(helmet({crossOriginResourcePolicy:false}));
app.use(compression());
app.use(cors({origin:CLIENT_ORIGIN==='*'?true:CLIENT_ORIGIN.split(',').map(x=>x.trim()),credentials:true}));
app.use(express.json({limit:'150kb'}));
app.use(rateLimit({windowMs:60000,max:180,standardHeaders:true,legacyHeaders:false}));

const safe=u=>u?({id:u.id,name:u.name,email:u.email,role:u.role}):null;
const err=(res,e,status=400)=>res.status(status).json({error:e?.message||String(e)});

async function getUser(id){
  const {data,error}=await db.from('profiles').select('id,name,email,role,last_seen_at,created_at').eq('id',id).maybeSingle();
  if(error)throw error;
  return data;
}
async function auth(req,res,next){
  if(!READY)return res.status(503).json({error:'Database is not configured yet'});
  try{
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!token)return res.status(401).json({error:'Authentication required'});
    const p=jwt.verify(token,JWT_SECRET);
    const user=await getUser(p.sub);
    if(!user)return res.status(401).json({error:'User not found'});
    await db.from('profiles').update({last_seen_at:new Date().toISOString()}).eq('id',user.id);
    req.user=user;next();
  }catch(e){err(res,new Error('Invalid or expired session'),401);}
}
const adminOnly=(req,res,next)=>req.user?.role==='admin'?next():res.status(403).json({error:'Admin access required'});
const tokenFor=u=>jwt.sign({sub:u.id,role:u.role},JWT_SECRET,{expiresIn:'7d'});

app.get('/api/health',async(_req,res)=>{
  if(!READY)return res.status(503).json({ok:false,database:'not-configured',service:'speakingbot-api'});
  const {error}=await db.from('tests').select('id',{count:'exact',head:true});
  res.status(error?503:200).json({ok:!error,database:error?'unavailable':'connected',service:'speakingbot-api',auth:'jwt+bcrypt',provider:'supabase-postgres',timestamp:new Date().toISOString(),uptime:Math.round(process.uptime())});
});

app.post('/api/auth/register',async(req,res)=>{
  if(!READY)return res.status(503).json({error:'Database is not configured yet'});
  try{
    const {name,email,password}=req.body||{};
    const normalized=String(email||'').toLowerCase().trim();
    if(!name||!normalized||!password||String(password).length<8)return res.status(400).json({error:'Name, valid email and password of at least 8 characters are required'});
    const exists=await db.from('profiles').select('id').eq('email',normalized).maybeSingle();
    if(exists.data)return res.status(409).json({error:'Email already registered'});
    const user={id:randomUUID(),name:String(name).trim(),email:normalized,role:'student',password_hash:await bcrypt.hash(String(password),12),last_seen_at:new Date().toISOString()};
    const {data,error}=await db.from('profiles').insert(user).select('id,name,email,role').single();
    if(error)throw error;
    res.status(201).json({token:tokenFor(data),user:safe(data)});
  }catch(e){err(res,e,400);}
});

app.post('/api/auth/login',async(req,res)=>{
  if(!READY)return res.status(503).json({error:'Database is not configured yet'});
  try{
    const {identifier,email,password}=req.body||{};
    let value=String(identifier??email??'').trim();
    if(value===ADMIN_USERNAME){
      if(!ADMIN_PASSWORD||String(password||'')!==ADMIN_PASSWORD)return res.status(401).json({error:'Invalid admin username or password'});
      value=ADMIN_EMAIL;
    }
    const normalized=value.toLowerCase();
    let {data:user,error}=await db.from('profiles').select('id,name,email,role,password_hash').eq('email',normalized).maybeSingle();
    if(error)throw error;
    if(!user&&normalized===ADMIN_EMAIL&&String(password||'')===ADMIN_PASSWORD){
      const created={id:randomUUID(),name:'VSBEC Admin',email:ADMIN_EMAIL,role:'admin',password_hash:await bcrypt.hash(ADMIN_PASSWORD,12),last_seen_at:new Date().toISOString()};
      const r=await db.from('profiles').insert(created).select('id,name,email,role,password_hash').single();
      if(r.error)throw r.error;user=r.data;
    }
    if(!user||!(await bcrypt.compare(String(password||''),user.password_hash)))return res.status(401).json({error:'Invalid email/username or password'});
    if(normalized===ADMIN_EMAIL&&String(password||'')===ADMIN_PASSWORD&&user.role!=='admin'){
      const r=await db.from('profiles').update({role:'admin'}).eq('id',user.id).select('id,name,email,role').single();
      if(r.error)throw r.error;user={...user,...r.data};
    }
    await db.from('profiles').update({last_seen_at:new Date().toISOString()}).eq('id',user.id);
    res.json({token:tokenFor(user),user:safe(user)});
  }catch(e){err(res,e,401);}
});

app.get('/api/me',auth,(req,res)=>res.json({user:safe(req.user)}));
app.post('/api/heartbeat',auth,async(req,res)=>{await db.from('profiles').update({last_seen_at:new Date().toISOString()}).eq('id',req.user.id);res.json({ok:true});});

app.get('/api/tests',async(req,res)=>{
  if(!READY)return res.json({tests:[],databaseConfigured:false});
  try{
    let q=db.from('tests').select('*').eq('published',true).order('created_at',{ascending:false});
    const category=String(req.query.category||'').trim(),search=String(req.query.q||'').trim();
    if(category)q=q.eq('category',category);
    if(search)q=q.or(`title.ilike.%${search}%,topic.ilike.%${search}%,category.ilike.%${search}%`);
    const {data,error}=await q;if(error)throw error;
    const tests=await Promise.all((data||[]).map(async t=>{
      const [{data:qs},{count}]=await Promise.all([
        db.from('questions').select('id').eq('test_id',t.test_id).eq('published',true),
        db.from('attempts').select('id',{count:'exact',head:true}).eq('test_id',t.test_id)
      ]);
      return {...t,questions:qs?.length||0,attempts:count||0};
    }));
    res.json({tests});
  }catch(e){err(res,e,500);}
});

app.get('/api/tests/:testId',async(req,res)=>{
  if(!READY)return res.status(503).json({error:'Database is not configured yet'});
  try{
    const {data:test,error:te}=await db.from('tests').select('*').eq('test_id',req.params.testId).eq('published',true).maybeSingle();
    if(te)throw te;if(!test)return res.status(404).json({error:'Test not found'});
    const {data:questions,error:qe}=await db.from('questions').select('id,test_id,text,options,answer,explanation,topic,difficulty,published').eq('test_id',req.params.testId).eq('published',true).order('id');
    if(qe)throw qe;res.json({test,questions:questions||[]});
  }catch(e){err(res,e,500);}
});

app.post('/api/attempts/submit',auth,async(req,res)=>{
  try{
    const {testId,answers,durationSeconds}=req.body||{};
    const {data:qs,error}=await db.from('questions').select('id,answer').eq('test_id',testId).eq('published',true);
    if(error)throw error;if(!qs?.length)return res.status(404).json({error:'Test questions not found'});
    let correct=0;for(const q of qs)if(Number(answers?.[q.id])===q.answer)correct++;
    const maxScore=qs.length,answered=Object.keys(answers||{}).length;
    const {data:attempt,error:ae}=await db.from('attempts').insert({user_id:req.user.id,test_id:testId,score:correct,max_score:maxScore,percentage:Math.round(correct/maxScore*100),duration_seconds:Math.max(0,Number(durationSeconds||0))}).select('*').single();
    if(ae)throw ae;res.status(201).json({attempt,correct,answered,skipped:Math.max(0,maxScore-answered),questions:maxScore});
  }catch(e){err(res,e,400);}
});
app.get('/api/my/attempts',auth,async(req,res)=>{const {data,error}=await db.from('attempts').select('*').eq('user_id',req.user.id).order('completed_at',{ascending:false}).limit(100);if(error)return err(res,error,500);res.json({attempts:data||[]});});

app.get('/api/my/scheduled-tests',auth,async(req,res)=>{
  const {data,error}=await db.from('assessment_access').select('*').eq('active',true).gte('end_at',new Date().toISOString()).or(`email.eq.${req.user.email},audience.eq.global`).order('start_at');
  if(error)return err(res,error,500);
  const rows=await Promise.all((data||[]).map(async a=>{const {data:test}=await db.from('tests').select('*').eq('test_id',a.test_id).maybeSingle();return {...a,_id:a.id,test,accessPasswordRequired:true};}));
  res.json({tests:rows});
});
app.post('/api/scheduled-tests/:id/verify',auth,async(req,res)=>{
  try{
    const {data:a,error}=await db.from('assessment_access').select('*').eq('id',req.params.id).eq('active',true).or(`email.eq.${req.user.email},audience.eq.global`).maybeSingle();
    if(error)throw error;if(!a)return res.status(404).json({error:'Assessment access not found'});
    const now=Date.now();if(now<new Date(a.start_at).getTime())return res.status(403).json({error:'Assessment has not started yet',startAt:a.start_at});if(now>new Date(a.end_at).getTime())return res.status(403).json({error:'Assessment access has expired',endAt:a.end_at});
    if(!(await bcrypt.compare(String(req.body?.password||''),a.access_password_hash)))return res.status(401).json({error:'Incorrect assessment access password'});
    const [{data:test},{data:questions,error:qe}]=await Promise.all([db.from('tests').select('*').eq('test_id',a.test_id).maybeSingle(),db.from('questions').select('id,test_id,text,options,answer,explanation,topic,difficulty,published').eq('test_id',a.test_id).eq('published',true).order('id')]);
    if(qe)throw qe;res.json({accessId:a.id,test,questions:questions||[],window:{startAt:a.start_at,endAt:a.end_at}});
  }catch(e){err(res,e,400);}
});

app.get('/api/admin/metrics',auth,adminOnly,async(req,res)=>{
  try{
    const [{count:totalUsers},{count:totalAttempts},{count:scheduledTests},{data:students},{data:recentAttempts}]=await Promise.all([
      db.from('profiles').select('id',{count:'exact',head:true}),db.from('attempts').select('id',{count:'exact',head:true}),db.from('assessment_access').select('id',{count:'exact',head:true}).eq('active',true).gte('end_at',new Date().toISOString()),db.from('profiles').select('id,name,email,role,last_seen_at,created_at').order('last_seen_at',{ascending:false}).limit(5000),db.from('attempts').select('*').order('completed_at',{ascending:false}).limit(20)
    ]);
    const active=(students||[]).filter(u=>new Date(u.last_seen_at).getTime()>=Date.now()-300000).length;
    res.json({totalUsers:totalUsers||0,activeUsers:active,totalAttempts:totalAttempts||0,recentAttempts:recentAttempts||[],students:students||[],scheduledTests:scheduledTests||0,generatedAt:new Date().toISOString()});
  }catch(e){err(res,e,500);}
});
app.get('/api/admin/users',auth,adminOnly,async(req,res)=>{const {data,error}=await db.from('profiles').select('id,name,email,role,last_seen_at,created_at').order('last_seen_at',{ascending:false}).limit(5000);if(error)return err(res,error,500);res.json({users:data||[]});});
app.get('/api/admin/tests',auth,adminOnly,async(req,res)=>{const {data,error}=await db.from('tests').select('*').order('created_at',{ascending:false});if(error)return err(res,error,500);res.json({tests:data||[]});});
app.post('/api/admin/tests',auth,adminOnly,async(req,res)=>{try{const {testId,title,category,topic,difficulty,duration,premium,published}=req.body||{};const {data,error}=await db.from('tests').insert({test_id:testId,title,category,topic,difficulty:difficulty||'Medium',duration:Number(duration||15),premium:Boolean(premium),published:published!==false}).select('*').single();if(error)throw error;res.status(201).json({test:data});}catch(e){err(res,e,400);}});
app.patch('/api/admin/tests/:testId',auth,adminOnly,async(req,res)=>{const allowed=['title','category','topic','difficulty','duration','premium','published'],body={};for(const k of allowed)if(req.body?.[k]!==undefined)body[k]=req.body[k];body.updated_at=new Date().toISOString();const {data,error}=await db.from('tests').update(body).eq('test_id',req.params.testId).select('*').maybeSingle();if(error)return err(res,error,400);if(!data)return res.status(404).json({error:'Test not found'});res.json({test:data});});
app.delete('/api/admin/tests/:testId',auth,adminOnly,async(req,res)=>{const {error}=await db.from('tests').delete().eq('test_id',req.params.testId);if(error)return err(res,error,400);res.json({ok:true});});

app.get('/api/admin/tests/:testId/questions',auth,adminOnly,async(req,res)=>{const {data,error}=await db.from('questions').select('*').eq('test_id',req.params.testId).order('id');if(error)return err(res,error,500);res.json({questions:data||[]});});
app.post('/api/admin/tests/:testId/questions',auth,adminOnly,async(req,res)=>{try{const {text,options,answer,explanation,topic,difficulty,published}=req.body||{};const {data,error}=await db.from('questions').insert({test_id:req.params.testId,text,options,answer:Number(answer),explanation:explanation||null,topic:topic||null,difficulty:difficulty||null,published:published!==false}).select('*').single();if(error)throw error;res.status(201).json({question:data});}catch(e){err(res,e,400);}});
app.patch('/api/admin/questions/:id',auth,adminOnly,async(req,res)=>{const allowed=['text','options','answer','explanation','topic','difficulty','published'],body={};for(const k of allowed)if(req.body?.[k]!==undefined)body[k]=k==='answer'?Number(req.body[k]):req.body[k];body.updated_at=new Date().toISOString();const {data,error}=await db.from('questions').update(body).eq('id',req.params.id).select('*').maybeSingle();if(error)return err(res,error,400);if(!data)return res.status(404).json({error:'Question not found'});res.json({question:data});});
app.delete('/api/admin/questions/:id',auth,adminOnly,async(req,res)=>{const {error}=await db.from('questions').delete().eq('id',req.params.id);if(error)return err(res,error,400);res.json({ok:true});});

app.get('/api/admin/schedules',auth,adminOnly,async(req,res)=>{const {data,error}=await db.from('assessment_access').select('*').order('start_at');if(error)return err(res,error,500);const rows=await Promise.all((data||[]).map(async a=>{const {data:test}=await db.from('tests').select('test_id,title,category,topic,difficulty,duration,premium').eq('test_id',a.test_id).maybeSingle();return {...a,_id:a.id,test};}));res.json({schedules:rows});});
app.post('/api/admin/schedules',auth,adminOnly,async(req,res)=>{try{const {email,testId,startAt,endAt,password,label,audience}=req.body||{};const global=audience==='global'||!email;if(!testId||!startAt||!endAt||!password||String(password).length<6)return res.status(400).json({error:'Assessment, start/end time and a 6+ character access password are required'});const hash=await bcrypt.hash(String(password),12);const {data:errorCheck}=await db.from('tests').select('test_id').eq('test_id',testId).maybeSingle();if(!errorCheck)return res.status(404).json({error:'Selected assessment was not found'});const {data,error}=await db.from('assessment_access').insert({email:global?null:String(email).toLowerCase().trim(),audience:global?'global':'individual',test_id:testId,start_at:startAt,end_at:endAt,access_password_hash:hash,label:label||'Company Assessment',created_by:req.user.id}).select('*').single();if(error)throw error;res.status(201).json({schedule:{...data,_id:data.id},accessPassword:String(password)});}catch(e){err(res,e,400);}});
app.delete('/api/admin/schedules/:id',auth,adminOnly,async(req,res)=>{const {error}=await db.from('assessment_access').delete().eq('id',req.params.id);if(error)return err(res,error,400);res.json({ok:true});});

const dist=path.resolve(__dirname,'../dist');
app.use(express.static(dist));
app.get('*',(req,res)=>req.path.startsWith('/api/')?res.status(404).json({error:'API route not found'}):res.sendFile(path.join(dist,'index.html')));
app.listen(PORT,()=>console.log(`SpeakingBot API listening on ${PORT} — Supabase PostgreSQL ${READY?'connected':'not configured'}`));