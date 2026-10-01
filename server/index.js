import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||5000);
const SUPABASE_URL=(process.env.SUPABASE_URL||'').trim();
const SUPABASE_KEY=(process.env.SUPABASE_PUBLISHABLE_KEY||'').trim();
const ADMIN_USERNAME=(process.env.ADMIN_USERNAME||'vsbec').trim();
const ADMIN_EMAIL=(process.env.ADMIN_EMAIL||'admin@vsbec.local').toLowerCase().trim();
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'';
const CLIENT_ORIGIN=process.env.CLIENT_ORIGIN||'*';
const READY=Boolean(SUPABASE_URL&&SUPABASE_KEY);

const base=READY?createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const client=(token='')=>READY?createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:token?{Authorization:`Bearer ${token}`}:undefined}}):null;

app.set('trust proxy',1);
app.use(helmet({crossOriginResourcePolicy:false}));
app.use(compression());
app.use(cors({origin:CLIENT_ORIGIN==='*'?true:CLIENT_ORIGIN.split(',').map(x=>x.trim()),credentials:true}));
app.use(express.json({limit:'150kb'}));
app.use(rateLimit({windowMs:60000,max:180,standardHeaders:true,legacyHeaders:false}));

const fail=(res,error,status=400)=>res.status(status).json({error:error?.message||String(error)});

async function profileFor(db,id){
  const {data,error}=await db.from('profiles').select('id,name,email,role,last_seen_at,created_at').eq('id',id).maybeSingle();
  if(error) throw error;
  return data;
}

async function refreshProfile(db,user){
  const p=await profileFor(db,user.id);
  if(!p) throw new Error('Profile not found');
  await db.from('profiles').update({last_seen_at:new Date().toISOString()}).eq('id',user.id);
  return p;
}

async function authFromToken(token){
  if(!READY||!token) return null;
  const db=client(token);
  const {data,error}=await db.auth.getUser(token);
  if(error||!data?.user) return null;
  const profile=await refreshProfile(db,data.user);
  return {db,user:data.user,profile};
}

const auth=async(req,res,next)=>{
  try{
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    const a=await authFromToken(token);
    if(!a) return res.status(401).json({error:'Invalid or expired session'});
    req.db=a.db;req.authUser=a.user;req.user=a.profile;next();
  }catch(e){fail(res,e,401);}
};
const adminOnly=(req,res,next)=>req.user?.role==='admin'?next():res.status(403).json({error:'Admin access required'});

async function signIn(email,password){
  const {data,error}=await base.auth.signInWithPassword({email,password});
  if(error) throw error;
  return data;
}
async function signUp(email,password,name){
  const {data,error}=await base.auth.signUp({email,password,options:{data:{name}}});
  if(error) throw error;
  return data;
}
async function confirmAndSignIn(userId,email,password){
  const db=client(arguments[3]||'');
  return {userId,email,password};
}

app.get('/api/health',async(_req,res)=>{
  if(!READY) return res.status(503).json({ok:false,database:'not-configured',service:'speakingbot-api'});
  const {error}=await base.from('tests').select('id',{count:'exact',head:true});
  res.status(error?503:200).json({ok:!error,database:error?'unavailable':'connected',service:'speakingbot-api',auth:'supabase',timestamp:new Date().toISOString(),uptime:Math.round(process.uptime())});
});

app.post('/api/auth/register',async(req,res)=>{
  if(!READY) return res.status(503).json({error:'Supabase database is not configured'});
  try{
    const {name,email,password}=req.body||{};
    if(!name||!email||!password||String(password).length<8) return res.status(400).json({error:'Name, valid email and password of at least 8 characters are required'});
    const data=await signUp(String(email).toLowerCase().trim(),String(password),String(name).trim());
    if(!data.user) return res.status(400).json({error:'Registration failed'});
    if(!data.session) return res.status(201).json({requiresEmailConfirmation:true,message:'Account created. Please confirm your email before signing in.'});
    const db=client(data.session.access_token);
    const profile=await refreshProfile(db,data.user);
    res.status(201).json({token:data.session.access_token,user:{id:profile.id,name:profile.name,email:profile.email,role:profile.role}});
  }catch(e){fail(res,e,400);}
});

app.post('/api/auth/login',async(req,res)=>{
  if(!READY) return res.status(503).json({error:'Supabase database is not configured'});
  try{
    const {identifier,email,password}=req.body||{};
    let loginEmail=String(identifier??email??'').trim().toLowerCase();
    const pwd=String(password||'');
    if(loginEmail===ADMIN_USERNAME.toLowerCase()){
      if(!ADMIN_PASSWORD||pwd!==ADMIN_PASSWORD) return res.status(401).json({error:'Invalid admin username or password'});
      loginEmail=ADMIN_EMAIL;
    }
    let data;
    try{data=await signIn(loginEmail,pwd);}
    catch(e){
      if(loginEmail===ADMIN_EMAIL&&pwd===ADMIN_PASSWORD){
        const created=await signUp(ADMIN_EMAIL,ADMIN_PASSWORD,'VSBEC Admin');
        if(!created.user) throw e;
        let token=created.session?.access_token;
        if(!token){
          try{const s=await signIn(ADMIN_EMAIL,ADMIN_PASSWORD);token=s.session?.access_token;}catch{}
        }
        if(!token) return res.status(403).json({error:'Admin account created but email confirmation is required in Supabase Auth. Disable Confirm Email in Supabase Auth settings, then retry.'});
        const db=client(token);
        await db.rpc('bootstrap_admin',{p_user_id:created.user.id,p_email:ADMIN_EMAIL});
        data={session:{access_token:token},user:created.user};
      }else throw e;
    }
    const profile=await profileFor(client(data.session.access_token),data.user.id);
    if(!profile) return res.status(500).json({error:'User profile was not created'});
    res.json({token:data.session.access_token,user:{id:profile.id,name:profile.name,email:profile.email,role:profile.role}});
  }catch(e){fail(res,e,401);}
});

app.get('/api/me',auth,(req,res)=>res.json({user:{id:req.user.id,name:req.user.name,email:req.user.email,role:req.user.role}}));
app.post('/api/heartbeat',auth,async(req,res)=>{
  const {error}=await req.db.from('profiles').update({last_seen_at:new Date().toISOString()}).eq('id',req.user.id);
  if(error)return fail(res,error,400);
  res.json({ok:true});
});

app.get('/api/tests',async(req,res)=>{
  if(!READY) return res.json({tests:[],databaseConfigured:false});
  try{
    const category=String(req.query.category||'').trim(),q=String(req.query.q||'').trim();
    let query=base.from('tests').select('*').eq('published',true).order('created_at',{ascending:false});
    if(category)query=query.eq('category',category);
    if(q)query=query.or(`title.ilike.%${q}%,topic.ilike.%${q}%,category.ilike.%${q}%`);
    const {data,error}=await query;
    if(error)throw error;
    const tests=await Promise.all((data||[]).map(async t=>{
      const {data:qs}=await base.from('questions').select('id').eq('test_id',t.test_id).eq('published',true);
      const {count}=await base.from('attempts').select('id',{count:'exact',head:true}).eq('test_id',t.test_id);
      return {...t,questions:qs?.length||0,attempts:count||0};
    }));
    res.json({tests});
  }catch(e){fail(res,e,500);}
});

app.get('/api/tests/:testId',async(req,res)=>{
  if(!READY)return res.status(503).json({error:'Supabase database is not configured'});
  try{
    const {data:test,error:te}=await base.from('tests').select('*').eq('test_id',req.params.testId).eq('published',true).maybeSingle();
    if(te)throw te;if(!test)return res.status(404).json({error:'Test not found'});
    const {data:questions,error:qe}=await base.from('questions').select('id,test_id,text,options,answer,explanation,topic,difficulty,published').eq('test_id',req.params.testId).eq('published',true).order('id');
    if(qe)throw qe;
    res.json({test,questions:questions||[]});
  }catch(e){fail(res,e,500);}
});

app.post('/api/attempts/submit',auth,async(req,res)=>{
  try{
    const {testId,answers,durationSeconds}=req.body||{};
    if(!testId||!answers||typeof answers!=='object')return res.status(400).json({error:'Invalid submission'});
    const {data:qs,error}=await req.db.from('questions').select('id,answer').eq('test_id',testId).eq('published',true);
    if(error)throw error;if(!qs?.length)return res.status(404).json({error:'Test questions not found'});
    let correct=0;
    for(const q of qs)if(Number(answers[q.id])===q.answer)correct++;
    const maxScore=qs.length,answered=Object.keys(answers).length;
    const {data:attempt,error:ae}=await req.db.from('attempts').insert({
      user_id:req.user.id,test_id:testId,score:correct,max_score:maxScore,
      percentage:Math.round(correct/maxScore*100),duration_seconds:Math.max(0,Number(durationSeconds||0))
    }).select('*').single();
    if(ae)throw ae;
    res.status(201).json({attempt,correct,answered,skipped:Math.max(0,maxScore-answered),questions:maxScore});
  }catch(e){fail(res,e,400);}
});

app.get('/api/my/attempts',auth,async(req,res)=>{
  const {data,error}=await req.db.from('attempts').select('*').eq('user_id',req.user.id).order('completed_at',{ascending:false}).limit(100);
  if(error)return fail(res,error,500);res.json({attempts:data||[]});
});

app.get('/api/my/scheduled-tests',auth,async(req,res)=>{
  const {data,error}=await req.db.from('assessment_access').select('*').eq('email',req.user.email.toLowerCase()).eq('active',true).gte('end_at',new Date().toISOString()).order('start_at');
  if(error)return fail(res,error,500);
  const rows=await Promise.all((data||[]).map(async a=>{
    const {data:t}=await req.db.from('tests').select('*').eq('test_id',a.test_id).maybeSingle();
    return {...a,_id:a.id,test:t,accessPasswordRequired:true};
  }));
  res.json({tests:rows});
});

app.post('/api/scheduled-tests/:id/verify',auth,async(req,res)=>{
  try{
    const {data:a,error}=await req.db.from('assessment_access').select('*').eq('id',req.params.id).eq('email',req.user.email.toLowerCase()).eq('active',true).maybeSingle();
    if(error)throw error;if(!a)return res.status(404).json({error:'Assessment access not found'});
    const now=Date.now();
    if(now<new Date(a.start_at).getTime())return res.status(403).json({error:'Assessment has not started yet',startAt:a.start_at});
    if(now>new Date(a.end_at).getTime())return res.status(403).json({error:'Assessment access has expired',endAt:a.end_at});
    if(!(await bcrypt.compare(String(req.body?.password||''),a.access_password_hash)))return res.status(401).json({error:'Incorrect assessment access password'});
    const {data:t}=await req.db.from('tests').select('*').eq('test_id',a.test_id).maybeSingle();
    const {data:questions,error:qe}=await req.db.from('questions').select('id,test_id,text,options,answer,explanation,topic,difficulty,published').eq('test_id',a.test_id).eq('published',true).order('id');
    if(qe)throw qe;
    res.json({accessId:a.id,test:t,questions:questions||[],window:{startAt:a.start_at,endAt:a.end_at}});
  }catch(e){fail(res,e,400);}
});

app.get('/api/admin/metrics',auth,adminOnly,async(req,res)=>{
  try{
    const [{count:totalUsers},{count:totalAttempts},{count:scheduledTests},{data:students},{data:recentAttempts}]=await Promise.all([
      req.db.from('profiles').select('id',{count:'exact',head:true}),
      req.db.from('attempts').select('id',{count:'exact',head:true}),
      req.db.from('assessment_access').select('id',{count:'exact',head:true}).eq('active',true).gte('end_at',new Date().toISOString()),
      req.db.from('profiles').select('id,name,email,role,last_seen_at,created_at').order('last_seen_at',{ascending:false}).limit(5000),
      req.db.from('attempts').select('*').order('completed_at',{ascending:false}).limit(20)
    ]);
    const active=(students||[]).filter(u=>new Date(u.last_seen_at).getTime()>=Date.now()-5*60*1000).length;
    res.json({totalUsers:totalUsers||0,activeUsers:active,totalAttempts:totalAttempts||0,recentAttempts:recentAttempts||[],students:students||[],scheduledTests:scheduledTests||0,generatedAt:new Date().toISOString()});
  }catch(e){fail(res,e,500);}
});

app.get('/api/admin/users',auth,adminOnly,async(req,res)=>{
  const {data,error}=await req.db.from('profiles').select('id,name,email,role,last_seen_at,created_at').order('last_seen_at',{ascending:false}).limit(5000);
  if(error)return fail(res,error,500);res.json({users:data||[]});
});
app.get('/api/admin/tests',auth,adminOnly,async(req,res)=>{
  const {data,error}=await req.db.from('tests').select('*').order('created_at',{ascending:false});
  if(error)return fail(res,error,500);res.json({tests:data||[]});
});
app.post('/api/admin/tests',auth,adminOnly,async(req,res)=>{
  try{
    const {testId,title,category,topic,difficulty,duration,premium,published}=req.body||{};
    const {data,error}=await req.db.from('tests').insert({test_id:testId,title,category,topic,difficulty:difficulty||'Medium',duration:Number(duration||15),premium:Boolean(premium),published:published!==false}).select('*').single();
    if(error)throw error;res.status(201).json({test:data});
  }catch(e){fail(res,e,400);}
});
app.patch('/api/admin/tests/:testId',auth,adminOnly,async(req,res)=>{
  const allowed=['title','category','topic','difficulty','duration','premium','published'];const body={};
  for(const k of allowed)if(req.body?.[k]!==undefined)body[k]=req.body[k];body.updated_at=new Date().toISOString();
  const {data,error}=await req.db.from('tests').update(body).eq('test_id',req.params.testId).select('*').maybeSingle();
  if(error)return fail(res,error,400);if(!data)return res.status(404).json({error:'Test not found'});res.json({test:data});
});
app.delete('/api/admin/tests/:testId',auth,adminOnly,async(req,res)=>{
  const {error}=await req.db.from('tests').delete().eq('test_id',req.params.testId);
  if(error)return fail(res,error,400);res.json({ok:true});
});

app.get('/api/admin/tests/:testId/questions',auth,adminOnly,async(req,res)=>{
  const {data,error}=await req.db.from('questions').select('*').eq('test_id',req.params.testId).order('id');
  if(error)return fail(res,error,500);res.json({questions:data||[]});
});
app.post('/api/admin/tests/:testId/questions',auth,adminOnly,async(req,res)=>{
  try{
    const {text,options,answer,explanation,topic,difficulty,published}=req.body||{};
    const {data,error}=await req.db.from('questions').insert({test_id:req.params.testId,text,options,answer:Number(answer),explanation:explanation||null,topic:topic||null,difficulty:difficulty||null,published:published!==false}).select('*').single();
    if(error)throw error;res.status(201).json({question:data});
  }catch(e){fail(res,e,400);}
});
app.patch('/api/admin/questions/:id',auth,adminOnly,async(req,res)=>{
  const allowed=['text','options','answer','explanation','topic','difficulty','published'];const body={};
  for(const k of allowed)if(req.body?.[k]!==undefined)body[k]=k==='answer'?Number(req.body[k]):req.body[k];
  body.updated_at=new Date().toISOString();
  const {data,error}=await req.db.from('questions').update(body).eq('id',req.params.id).select('*').maybeSingle();
  if(error)return fail(res,error,400);if(!data)return res.status(404).json({error:'Question not found'});res.json({question:data});
});
app.delete('/api/admin/questions/:id',auth,adminOnly,async(req,res)=>{
  const {error}=await req.db.from('questions').delete().eq('id',req.params.id);
  if(error)return fail(res,error,400);res.json({ok:true});
});

app.get('/api/admin/schedules',auth,adminOnly,async(req,res)=>{
  const {data,error}=await req.db.from('assessment_access').select('*').order('start_at');
  if(error)return fail(res,error,500);
  const rows=await Promise.all((data||[]).map(async a=>{const {data:t}=await req.db.from('tests').select('test_id,title,category,topic,difficulty,duration,premium').eq('test_id',a.test_id).maybeSingle();return {...a,_id:a.id,test:t};}));
  res.json({schedules:rows});
});
app.post('/api/admin/schedules',auth,adminOnly,async(req,res)=>{
  try{
    const {email,testId,startAt,endAt,password,label}=req.body||{};
    if(!email||!testId||!startAt||!endAt||!password||String(password).length<6)return res.status(400).json({error:'Email, test, start/end time and a 6+ character access password are required'});
    const hash=await bcrypt.hash(String(password),12);
    const {data,error}=await req.db.from('assessment_access').insert({email:String(email).toLowerCase().trim(),test_id:testId,start_at:startAt,end_at:endAt,access_password_hash:hash,label:label||'Company Assessment',created_by:req.user.id}).select('*').single();
    if(error)throw error;res.status(201).json({schedule:{...data,_id:data.id},accessPassword:String(password)});
  }catch(e){fail(res,e,400);}
});
app.delete('/api/admin/schedules/:id',auth,adminOnly,async(req,res)=>{
  const {error}=await req.db.from('assessment_access').delete().eq('id',req.params.id);
  if(error)return fail(res,error,400);res.json({ok:true});
});

const dist=path.resolve(__dirname,'../dist');
app.use(express.static(dist));
app.get('*',(req,res)=>req.path.startsWith('/api/')?res.status(404).json({error:'API route not found'}):res.sendFile(path.join(dist,'index.html')));

app.listen(PORT,()=>console.log(`SpeakingBot API listening on ${PORT} — Supabase ${READY?'configured':'not configured'}`));