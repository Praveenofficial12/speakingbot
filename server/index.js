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
const mapTest=t=>t?({...t,id:t.test_id,testId:t.test_id,createdAt:t.created_at,updatedAt:t.updated_at}):t;
const mapQuestion=q=>q?({...q,_id:q.id,testId:q.test_id}):q;
const mapAttempt=a=>a?({...a,_id:a.id,userId:a.user_id,testId:a.test_id,maxScore:a.max_score,durationSeconds:a.duration_seconds,scheduledAccessId:a.scheduled_access_id,completedAt:a.completed_at}):a;
const mapSchedule=a=>a?({...a,_id:a.id,email:a.email,audience:a.audience||'individual',testId:a.test_id,startAt:a.start_at,endAt:a.end_at,accessPasswordRequired:true,createdAt:a.created_at}):a;
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
    let {data:user,error}=await db.from('profiles').select('id,name,email,role,password_hash,login_count,last_login_at').eq('email',normalized).maybeSingle();
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
    const loginNow=new Date().toISOString();
    await db.from('profiles').update({last_seen_at:loginNow,last_login_at:loginNow,login_count:(user.login_count||0)+1}).eq('id',user.id);
    res.json({token:tokenFor(user),user:safe({...user,login_count:(user.login_count||0)+1,last_login_at:loginNow})});
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
      return {...mapTest(t),questions:qs?.length||0,attempts:count||0};
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
    if(qe)throw qe;res.json({test:mapTest(test),questions:(questions||[]).map(mapQuestion)});
  }catch(e){err(res,e,500);}
});

app.post('/api/attempts/submit',auth,async(req,res)=>{
  try{
    const {testId,answers,durationSeconds,scheduledAccessId}=req.body||{};
    if(scheduledAccessId){
      const {data:access,error:accessError}=await db.from('assessment_access').select('*').eq('id',scheduledAccessId).eq('active',true).maybeSingle();
      if(accessError)throw accessError;
      if(!access||access.test_id!==testId||(access.audience!=='global'&&access.email!==req.user.email))return res.status(403).json({error:'Invalid scheduled assessment access'});
      const now=Date.now(),start=new Date(access.start_at).getTime(),end=new Date(access.end_at).getTime();
      if(now<start)return res.status(403).json({error:'Assessment has not started yet'});
      if(now>end)return res.status(403).json({error:'Assessment time has ended. Your answers were not accepted.'});
    }
    if(scheduledAccessId){
      const {data:existing,error:existingError}=await db.from('attempts').select('id').eq('user_id',req.user.id).eq('scheduled_access_id',Number(scheduledAccessId)).maybeSingle();
      if(existingError)throw existingError;
      if(existing)return res.status(409).json({error:'This scheduled assessment has already been submitted.'});
    }
    const {data:qs,error}=await db.from('questions').select('id,answer').eq('test_id',testId).eq('published',true);
    if(error)throw error;if(!qs?.length)return res.status(404).json({error:'Test questions not found'});
    let correct=0;for(const q of qs)if(Number(answers?.[q.id])===q.answer)correct++;
    const maxScore=qs.length,answered=Object.keys(answers||{}).length;
    const {data:attempt,error:ae}=await db.from('attempts').insert({user_id:req.user.id,test_id:testId,score:correct,max_score:maxScore,percentage:Math.round(correct/maxScore*100),duration_seconds:Math.max(0,Number(durationSeconds||0)),scheduled_access_id:scheduledAccessId?Number(scheduledAccessId):null}).select('*').single();
    if(ae)throw ae;res.status(201).json({attempt:mapAttempt(attempt),correct,answered,skipped:Math.max(0,maxScore-answered),questions:maxScore});
  }catch(e){err(res,e,400);}
});
app.post('/api/swar-results',auth,async(req,res)=>{try{const {moduleId,moduleTitle,score,fluencyScore,grammarScore,comprehensionScore,transcript,feedback}=req.body||{};if(!moduleId||!moduleTitle)return res.status(400).json({error:'SWAR module is required'});const row={user_id:req.user.id,module_id:String(moduleId),module_title:String(moduleTitle),score:Math.max(0,Math.min(100,Number(score)||0)),fluency_score:Math.max(0,Math.min(100,Number(fluencyScore)||0)),grammar_score:Math.max(0,Math.min(100,Number(grammarScore)||0)),comprehension_score:Math.max(0,Math.min(100,Number(comprehensionScore)||0)),transcript:String(transcript||'').slice(0,5000),feedback:feedback&&typeof feedback==='object'?feedback:{}};const {data,error}=await db.from('swar_results').insert(row).select('*').single();if(error)throw error;res.status(201).json({result:data});}catch(e){err(res,e,400);}});
app.get('/api/my/swar-results',auth,async(req,res)=>{const {data,error}=await db.from('swar_results').select('*').eq('user_id',req.user.id).order('created_at',{ascending:false}).limit(100);if(error)return err(res,error,500);res.json({results:data||[]});});
app.get('/api/admin/swar-results',auth,adminOnly,async(req,res)=>{const {data,error}=await db.from('swar_results').select('*').order('created_at',{ascending:false}).limit(1000);if(error)return err(res,error,500);res.json({results:data||[]});});
app.get('/api/my/attempts',auth,async(req,res)=>{const {data,error}=await db.from('attempts').select('*').eq('user_id',req.user.id).order('completed_at',{ascending:false}).limit(100);if(error)return err(res,error,500);res.json({attempts:(data||[]).map(mapAttempt)});});

app.get('/api/my/recommendations',auth,async(req,res)=>{
  try{
    const [{data:attempts,error:ae},{data:swar,error:se},{data:tests,error:te}]=await Promise.all([
      db.from('attempts').select('test_id,percentage,completed_at').eq('user_id',req.user.id).order('completed_at',{ascending:false}).limit(100),
      db.from('swar_results').select('module_id,module_title,score,created_at').eq('user_id',req.user.id).order('created_at',{ascending:false}).limit(100),
      db.from('tests').select('*').eq('published',true).order('created_at',{ascending:false}).limit(200)
    ]);
    if(ae)throw ae;if(se)throw se;if(te)throw te;
    const testMap=new Map((tests||[]).map(t=>[t.test_id,t])),topicMap=new Map(),moduleMap=new Map();
    for(const a of attempts||[]){const t=testMap.get(a.test_id),topic=t?.topic||t?.category||a.test_id,m=topicMap.get(topic)||{score:0,count:0,latest:a.completed_at};m.score+=Number(a.percentage)||0;m.count++;if(new Date(a.completed_at)>new Date(m.latest))m.latest=a.completed_at;topicMap.set(topic,m);}
    for(const s of swar||[]){const key=s.module_id||s.module_title,m=moduleMap.get(key)||{title:s.module_title,score:0,count:0,latest:s.created_at};m.score+=Number(s.score)||0;m.count++;if(new Date(s.created_at)>new Date(m.latest))m.latest=s.created_at;moduleMap.set(key,m);}
    const weak=[...topicMap.entries()].map(([topic,m])=>({type:'test',focus:topic,score:Math.round(m.score/m.count),latest:m.latest}));
    const swarWeak=[...moduleMap.entries()].map(([id,m])=>({type:'swar',focus:m.title,score:Math.round(m.score/m.count),latest:m.latest,id}));
    const ordered=[...weak,...swarWeak].sort((a,b)=>a.score-b.score||new Date(b.latest)-new Date(a.latest)),recs=[];
    const moduleTitles={'listen-repeat':'Listen & Repeat','read-repeat':'Read & Repeat','incorrect-correction':'Listen Incorrect Sentence & Correct It','grammar':'Grammar','story':'Story & Answer','jam':'JAM — Just A Minute'};
    for(const w of ordered){if(recs.length>=6)break;if(w.type==='test'){const matches=(tests||[]).filter(t=>String(t.topic||t.category||'').toLowerCase().includes(String(w.focus).toLowerCase())||String(w.focus).toLowerCase().includes(String(t.topic||'').toLowerCase())).slice(0,2);for(const t of matches){if(recs.length>=6)break;recs.push({key:'test-'+t.test_id,type:'test',title:t.title,test:mapTest(t),difficulty:t.difficulty||'Medium',duration:Number(t.duration||15),focus:w.focus,score:w.score,reason:'Your '+w.focus+' average is '+w.score+'%. Practice this set to target that area.'});}}else{recs.push({key:'swar-'+w.id,type:'swar',title:w.focus||moduleTitles[w.id]||'SWAR Communication Practice',difficulty:'Adaptive',duration:w.id==='story'?2:1,focus:w.focus,score:w.score,reason:'Your '+w.focus+' average is '+w.score+'%. Repeat this module to strengthen your communication performance.'});}}
    if(!recs.length)(tests||[]).slice(0,3).forEach(t=>recs.push({key:'starter-'+t.test_id,type:'test',title:t.title,test:mapTest(t),difficulty:t.difficulty||'Medium',duration:Number(t.duration||15),focus:t.topic||t.category||'Placement skills',score:null,reason:'You have limited result history, so this starter set helps build your performance profile.'}));
    const allScores=[...(attempts||[]).map(x=>Number(x.percentage)||0),...(swar||[]).map(x=>Number(x.score)||0)],focus=ordered[0];
    res.json({focusTopic:focus?.focus||null,focusScore:focus?.score??null,overallAverage:allScores.length?Math.round(allScores.reduce((a,b)=>a+b,0)/allScores.length):null,recommendations:recs});
  }catch(e){err(res,e,500);}
});
app.get('/api/my/scheduled-tests',auth,async(req,res)=>{
  const {data,error}=await db.from('assessment_access').select('*').eq('active',true).gte('end_at',new Date().toISOString()).or(`email.eq.${req.user.email},audience.eq.global`).order('start_at');
  if(error)return err(res,error,500);
  const rows=await Promise.all((data||[]).map(async a=>{const {data:test}=await db.from('tests').select('*').eq('test_id',a.test_id).maybeSingle();return {...mapSchedule(a),test:mapTest(test)};}));
  res.json({tests:rows});
});
app.post('/api/scheduled-tests/:id/verify',auth,async(req,res)=>{
  try{
    const {data:a,error}=await db.from('assessment_access').select('*').eq('id',req.params.id).eq('active',true).or(`email.eq.${req.user.email},audience.eq.global`).maybeSingle();
    if(error)throw error;if(!a)return res.status(404).json({error:'Assessment access not found'});
    const now=Date.now();if(now<new Date(a.start_at).getTime())return res.status(403).json({error:'Assessment has not started yet',startAt:a.start_at});if(now>new Date(a.end_at).getTime())return res.status(403).json({error:'Assessment access has expired',endAt:a.end_at});
    if(!(await bcrypt.compare(String(req.body?.password||''),a.access_password_hash)))return res.status(401).json({error:'Incorrect assessment access password'});
    const [{data:test},{data:questions,error:qe}]=await Promise.all([db.from('tests').select('*').eq('test_id',a.test_id).maybeSingle(),db.from('questions').select('id,test_id,text,options,answer,explanation,topic,difficulty,published').eq('test_id',a.test_id).eq('published',true).order('id')]);
    if(qe)throw qe;res.json({accessId:a.id,test:mapTest(test),questions:(questions||[]).map(mapQuestion),window:{startAt:a.start_at,endAt:a.end_at}});
  }catch(e){err(res,e,400);}
});

app.get('/api/admin/schedules/:id/non-attendees',auth,adminOnly,async(req,res)=>{
  try{
    const {data:s,error:se}=await db.from('assessment_access').select('*').eq('id',req.params.id).maybeSingle();
    if(se)throw se;if(!s)return res.status(404).json({error:'Assessment not found'});
    const {data:roster,error:re}=await db.from('assessment_roster').select('name,email').eq('assessment_access_id',s.id).order('name');
    if(re)throw re;
    let assigned=roster||[];
    if(!assigned.length&&s.audience==='global'){
      const {data:users,error:ue}=await db.from('profiles').select('name,email,login_count').eq('role','student').order('name');
      if(ue)throw ue;assigned=users||[];
    } else if(!assigned.length&&s.email){
      const {data:u}=await db.from('profiles').select('name,email,login_count').eq('email',s.email).maybeSingle();
      assigned=u?[u]:[];
    }
    const {data:attempts,error:ae}=await db.from('attempts').select('user_id,completed_at,percentage,score,max_score').eq('test_id',s.test_id).gte('completed_at',s.start_at).lte('completed_at',s.end_at);
    if(ae)throw ae;
    const attended=new Set((attempts||[]).map(a=>a.user_id));
    const {data:users,error:ue}=await db.from('profiles').select('id,name,email,login_count,last_login_at');
    if(ue)throw ue;
    const byEmail=new Map((users||[]).map(u=>[u.email.toLowerCase(),u]));
    const notAttended=assigned.filter(x=>!attended.has(byEmail.get(String(x.email).toLowerCase())?.id)).map(x=>({...x,user:byEmail.get(String(x.email).toLowerCase())||null}));
    res.json({assessment:mapSchedule(s),assignedCount:assigned.length,attendedCount:assigned.length-notAttended.length,notAttended});
  }catch(e){err(res,e,500);}
});
app.post('/api/admin/schedules/:id/roster',auth,adminOnly,async(req,res)=>{
  try{
    const {data:s,error:se}=await db.from('assessment_access').select('id').eq('id',req.params.id).maybeSingle();if(se)throw se;if(!s)return res.status(404).json({error:'Assessment not found'});
    const students=Array.isArray(req.body?.students)?req.body.students:[];if(!students.length)return res.status(400).json({error:'No students found in the uploaded list'});
    const rows=students.map(x=>({assessment_access_id:s.id,name:String(x.name||x.email||'Student').trim(),email:String(x.email||'').toLowerCase().trim(),created_by:req.user.id})).filter(x=>x.email&&x.email.includes('@'));
    const {error}=await db.from('assessment_roster').upsert(rows,{onConflict:'assessment_access_id,email'});if(error)throw error;res.json({ok:true,count:rows.length});
  }catch(e){err(res,e,400);}
});
app.get('/api/admin/metrics',auth,adminOnly,async(req,res)=>{
  try{
    const [{count:totalUsers},{count:totalAttempts},{count:scheduledTests},{data:students},{data:recentAttempts}]=await Promise.all([
      db.from('profiles').select('id',{count:'exact',head:true}),db.from('attempts').select('id',{count:'exact',head:true}),db.from('assessment_access').select('id',{count:'exact',head:true}).eq('active',true).gte('end_at',new Date().toISOString()),db.from('profiles').select('id,name,email,role,last_seen_at,created_at').order('last_seen_at',{ascending:false}).limit(5000),db.from('attempts').select('*').order('completed_at',{ascending:false}).limit(20)
    ]);
    const active=(students||[]).filter(u=>new Date(u.last_seen_at).getTime()>=Date.now()-300000).length;
    const recent=(recentAttempts||[]).map(a=>{const u=(students||[]).find(x=>x.id===a.user_id);return {...mapAttempt(a),user:u?{id:u.id,name:u.name,email:u.email}:null};}); res.json({totalUsers:totalUsers||0,activeUsers:active,totalAttempts:totalAttempts||0,recentAttempts:recent,students:(students||[]).map(u=>({...u,_id:u.id,lastSeenAt:u.last_seen_at,createdAt:u.created_at,loginCount:u.login_count||0,lastLoginAt:u.last_login_at})),scheduledTests:scheduledTests||0,generatedAt:new Date().toISOString()});
  }catch(e){err(res,e,500);}
});
app.get('/api/admin/swar-results',auth,adminOnly,async(req,res)=>{try{const {moduleId,from,to,userId}=req.query||{};let q=db.from('swar_results').select('*').order('created_at',{ascending:false}).limit(5000);if(moduleId)q=q.eq('module_id',String(moduleId));if(userId)q=q.eq('user_id',String(userId));if(from)q=q.gte('created_at',String(from));if(to)q=q.lte('created_at',String(to));const {data,error}=await q;if(error)throw error;const rows=data||[];const ids=[...new Set(rows.map(x=>x.user_id))];let users=[];if(ids.length){const r=await db.from('profiles').select('id,name,email').in('id',ids);if(r.error)throw r.error;users=r.data||[]}const byId=new Map(users.map(u=>[u.id,u]));res.json({results:rows.map(x=>({...x,user:byId.get(x.user_id)||null})),generatedAt:new Date().toISOString()});}catch(e){err(res,e,500);}});
app.get('/api/admin/swar-results.csv',auth,adminOnly,async(req,res)=>{try{const {data,error}=await db.from('swar_results').select('*').order('created_at',{ascending:false}).limit(5000);if(error)throw error;const ids=[...new Set((data||[]).map(x=>x.user_id))];let users=[];if(ids.length){const r=await db.from('profiles').select('id,name,email').in('id',ids);if(r.error)throw r.error;users=r.data||[]}const byId=new Map(users.map(u=>[u.id,u]));const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const lines=[['Date','Student','Email','Module','Score','Fluency','Grammar','Comprehension','Transcript'].map(esc).join(',')];for(const x of data||[]){const u=byId.get(x.user_id)||{};lines.push([x.created_at,u.name,u.email,x.module_title,x.score,x.fluency_score,x.grammar_score,x.comprehension_score,x.transcript].map(esc).join(','));}res.setHeader('Content-Type','text/csv');res.setHeader('Content-Disposition','attachment; filename="swar-results.csv"');res.send(lines.join('\n'));}catch(e){err(res,e,500);}});
app.get('/api/admin/users',auth,adminOnly,async(req,res)=>{const {data,error}=await db.from('profiles').select('id,name,email,role,last_seen_at,created_at').order('last_seen_at',{ascending:false}).limit(5000);if(error)return err(res,error,500);res.json({users:(data||[]).map(u=>({...u,_id:u.id,lastSeenAt:u.last_seen_at,createdAt:u.created_at}))});});
app.get('/api/admin/tests',auth,adminOnly,async(req,res)=>{const {data,error}=await db.from('tests').select('*').order('created_at',{ascending:false});if(error)return err(res,error,500);res.json({tests:(data||[]).map(mapTest)});});
app.post('/api/admin/tests',auth,adminOnly,async(req,res)=>{try{const {testId,title,category,topic,difficulty,duration,premium,published}=req.body||{};const {data,error}=await db.from('tests').insert({test_id:testId,title,category,topic,difficulty:difficulty||'Medium',duration:Number(duration||15),premium:Boolean(premium),published:published!==false}).select('*').single();if(error)throw error;res.status(201).json({test:mapTest(data)});}catch(e){err(res,e,400);}});
app.patch('/api/admin/tests/:testId',auth,adminOnly,async(req,res)=>{const allowed=['title','category','topic','difficulty','duration','premium','published'],body={};for(const k of allowed)if(req.body?.[k]!==undefined)body[k]=req.body[k];body.updated_at=new Date().toISOString();const {data,error}=await db.from('tests').update(body).eq('test_id',req.params.testId).select('*').maybeSingle();if(error)return err(res,error,400);if(!data)return res.status(404).json({error:'Test not found'});res.json({test:mapTest(data)});});
app.delete('/api/admin/tests/:testId',auth,adminOnly,async(req,res)=>{const {error}=await db.from('tests').delete().eq('test_id',req.params.testId);if(error)return err(res,error,400);res.json({ok:true});});

app.get('/api/admin/tests/:testId/questions',auth,adminOnly,async(req,res)=>{const {data,error}=await db.from('questions').select('*').eq('test_id',req.params.testId).order('id');if(error)return err(res,error,500);res.json({questions:(data||[]).map(mapQuestion)});});
app.post('/api/admin/tests/:testId/questions',auth,adminOnly,async(req,res)=>{try{const {text,options,answer,explanation,topic,difficulty,published}=req.body||{};const {data,error}=await db.from('questions').insert({test_id:req.params.testId,text,options,answer:Number(answer),explanation:explanation||null,topic:topic||null,difficulty:difficulty||null,published:published!==false}).select('*').single();if(error)throw error;res.status(201).json({question:mapQuestion(data)});}catch(e){err(res,e,400);}});
app.patch('/api/admin/questions/:id',auth,adminOnly,async(req,res)=>{const allowed=['text','options','answer','explanation','topic','difficulty','published'],body={};for(const k of allowed)if(req.body?.[k]!==undefined)body[k]=k==='answer'?Number(req.body[k]):req.body[k];body.updated_at=new Date().toISOString();const {data,error}=await db.from('questions').update(body).eq('id',req.params.id).select('*').maybeSingle();if(error)return err(res,error,400);if(!data)return res.status(404).json({error:'Question not found'});res.json({question:mapQuestion(data)});});
app.delete('/api/admin/questions/:id',auth,adminOnly,async(req,res)=>{const {error}=await db.from('questions').delete().eq('id',req.params.id);if(error)return err(res,error,400);res.json({ok:true});});

app.get('/api/admin/schedules',auth,adminOnly,async(req,res)=>{const {data,error}=await db.from('assessment_access').select('*').order('start_at');if(error)return err(res,error,500);const rows=await Promise.all((data||[]).map(async a=>{const {data:test}=await db.from('tests').select('test_id,title,category,topic,difficulty,duration,premium').eq('test_id',a.test_id).maybeSingle();return {...mapSchedule(a),test:mapTest(test)};}));res.json({schedules:rows});});
app.post('/api/admin/schedules',auth,adminOnly,async(req,res)=>{try{const {email,testId,startAt,endAt,password,label,audience}=req.body||{};const global=audience==='global'||!email;if(!testId||!startAt||!endAt||!password||String(password).length<6)return res.status(400).json({error:'Assessment, start/end time and a 6+ character access password are required'});const hash=await bcrypt.hash(String(password),12);const {data:errorCheck}=await db.from('tests').select('test_id').eq('test_id',testId).maybeSingle();if(!errorCheck)return res.status(404).json({error:'Selected assessment was not found'});const {data,error}=await db.from('assessment_access').insert({email:global?null:String(email).toLowerCase().trim(),audience:global?'global':'individual',test_id:testId,start_at:startAt,end_at:endAt,access_password_hash:hash,label:label||'Company Assessment',created_by:req.user.id}).select('*').single();if(error)throw error;res.status(201).json({schedule:mapSchedule(data),accessPassword:String(password)});}catch(e){err(res,e,400);}});
app.delete('/api/admin/schedules/:id',auth,adminOnly,async(req,res)=>{const {error}=await db.from('assessment_access').delete().eq('id',req.params.id);if(error)return err(res,error,400);res.json({ok:true});});

const dist=path.resolve(__dirname,'../dist');
app.use(express.static(dist));
app.get('*',(req,res)=>req.path.startsWith('/api/')?res.status(404).json({error:'API route not found'}):res.sendFile(path.join(dist,'index.html')));
app.listen(PORT,()=>console.log(`SpeakingBot API listening on ${PORT} — Supabase PostgreSQL ${READY?'connected':'not configured'}`));