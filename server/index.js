import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||5000);
const MONGO_URI=process.env.MONGO_URI;
const JWT_SECRET=process.env.JWT_SECRET;
const CLIENT_ORIGIN=process.env.CLIENT_ORIGIN||'*';
const ADMIN_EMAIL=(process.env.ADMIN_EMAIL||'').toLowerCase();
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'';
if(!MONGO_URI||!JWT_SECRET){console.error('Missing MONGO_URI or JWT_SECRET');process.exit(1)}
app.set('trust proxy',1);app.use(helmet({crossOriginResourcePolicy:false}));app.use(compression());app.use(cors({origin:CLIENT_ORIGIN==='*'?true:CLIENT_ORIGIN.split(',').map(x=>x.trim()),credentials:true}));app.use(express.json({limit:'100kb'}));app.use(rateLimit({windowMs:60000,max:180,standardHeaders:true,legacyHeaders:false}));
const userSchema=new mongoose.Schema({name:{type:String,required:true,trim:true,maxlength:80},email:{type:String,required:true,unique:true,lowercase:true,trim:true,index:true},passwordHash:{type:String,required:true},role:{type:String,enum:['student','admin'],default:'student',index:true},lastSeenAt:{type:Date,default:Date.now,index:true},createdAt:{type:Date,default:Date.now}});
const testSchema=new mongoose.Schema({
  testId:{type:String,required:true,unique:true,index:true}, title:{type:String,required:true}, category:String, topic:String,
  difficulty:{type:String,enum:['Easy','Medium','Hard'],default:'Medium'}, duration:Number, premium:{type:Boolean,default:false},
  published:{type:Boolean,default:true}, createdAt:{type:Date,default:Date.now}, updatedAt:{type:Date,default:Date.now}
});
const questionSchema=new mongoose.Schema({
  testId:{type:String,required:true,index:true}, text:{type:String,required:true}, options:{type:[String],required:true},
  answer:{type:Number,required:true,min:0}, explanation:String, topic:String, difficulty:String, published:{type:Boolean,default:true},
  createdAt:{type:Date,default:Date.now}, updatedAt:{type:Date,default:Date.now}
});
const attemptSchema=new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',index:true},testId:{type:String,required:true,index:true},score:Number,maxScore:Number,percentage:Number,durationSeconds:Number,completedAt:{type:Date,default:Date.now,index:true}});
const User=mongoose.model('User',userSchema);const Test=mongoose.model('Test',testSchema);const Question=mongoose.model('Question',questionSchema);const Attempt=mongoose.model('Attempt',attemptSchema);
const auth=async(req,res,next)=>{try{const token=(req.headers.authorization||'').replace(/^Bearer\\s+/i,'');if(!token)return res.status(401).json({error:'Authentication required'});const payload=jwt.verify(token,JWT_SECRET);const user=await User.findById(payload.sub).lean();if(!user)return res.status(401).json({error:'User not found'});req.user=user;await User.updateOne({_id:user._id},{$set:{lastSeenAt:new Date()}});next()}catch{res.status(401).json({error:'Invalid or expired session'})}};
const adminOnly=(req,res,next)=>req.user.role==='admin'?next():res.status(403).json({error:'Admin access required'});
app.get('/api/health',async(_req,res)=>{const db=mongoose.connection.readyState===1;res.status(db?200:503).json({ok:db,service:'speakingbot-api',uptime:Math.round(process.uptime()),timestamp:new Date().toISOString()})});
app.post('/api/auth/register',async(req,res)=>{try{const{name,email,password}=req.body||{};if(!name||!email||!password||password.length<8)return res.status(400).json({error:'Name, valid email and password of at least 8 characters are required'});const normalized=String(email).toLowerCase().trim();if(await User.exists({email:normalized}))return res.status(409).json({error:'Email already registered'});const passwordHash=await bcrypt.hash(password,12);const role='student';const user=await User.create({name,email:normalized,passwordHash,role,lastSeenAt:new Date()});const token=jwt.sign({sub:user._id.toString(),role},JWT_SECRET,{expiresIn:'7d'});res.status(201).json({token,user:{id:user._id,name:user.name,email:user.email,role}})}catch{res.status(500).json({error:'Registration failed'})}});
app.post('/api/auth/login',async(req,res)=>{try{const{email,password}=req.body||{};const normalized=String(email||'').toLowerCase().trim();let user=await User.findOne({email:normalized});if(!user&&ADMIN_EMAIL&&normalized===ADMIN_EMAIL&&ADMIN_PASSWORD&&password===ADMIN_PASSWORD){const passwordHash=await bcrypt.hash(ADMIN_PASSWORD,12);user=await User.create({name:'Administrator',email:normalized,passwordHash,role:'admin',lastSeenAt:new Date()})}if(!user||!(await bcrypt.compare(password||'',user.passwordHash)))return res.status(401).json({error:'Invalid email or password'});user.lastSeenAt=new Date();await user.save();const token=jwt.sign({sub:user._id.toString(),role:user.role},JWT_SECRET,{expiresIn:'7d'});res.json({token,user:{id:user._id,name:user.name,email:user.email,role:user.role}})}catch{res.status(500).json({error:'Login failed'})}});
app.get('/api/tests',async(req,res)=>{
  const category=req.query.category; const q=String(req.query.q||'').trim();
  const filter={published:true}; if(category) filter.category=category;
  if(q) filter.$or=[{title:{$regex:q,$options:'i'}},{topic:{$regex:q,$options:'i'}},{category:{$regex:q,$options:'i'}}];
  const tests=await Test.find(filter).sort({createdAt:-1}).lean(); res.json({tests});
});
app.get('/api/tests/:testId',async(req,res)=>{
  const test=await Test.findOne({testId:req.params.testId,published:true}).lean();
  if(!test)return res.status(404).json({error:'Test not found'});
  const questions=await Question.find({testId:test.testId,published:true}).sort({createdAt:1}).lean();
  res.json({test,questions});
});
app.get('/api/me',auth,(req,res)=>res.json({user:{id:req.user._id,name:req.user.name,email:req.user.email,role:req.user.role}}));
app.post('/api/heartbeat',auth,async(req,res)=>{await User.updateOne({_id:req.user._id},{$set:{lastSeenAt:new Date()}});res.json({ok:true})});
app.post('/api/attempts',auth,async(req,res)=>{try{const{testId,score,maxScore,durationSeconds}=req.body||{};if(!testId||!Number.isFinite(score)||!Number.isFinite(maxScore)||maxScore<=0)return res.status(400).json({error:'Invalid attempt'});const attempt=await Attempt.create({userId:req.user._id,testId,score,maxScore,percentage:Math.round(score/maxScore*100),durationSeconds:Math.max(0,Number(durationSeconds||0))});res.status(201).json({attempt})}catch{res.status(500).json({error:'Could not save attempt'})}});
app.get('/api/my/attempts',auth,async(req,res)=>res.json({attempts:await Attempt.find({userId:req.user._id}).sort({completedAt:-1}).limit(100).lean()}));
app.get('/api/admin/metrics',auth,adminOnly,async(_req,res)=>{const since=new Date(Date.now()-300000);const[totalUsers,activeUsers,totalAttempts,recentAttempts,students]=await Promise.all([User.countDocuments(),User.countDocuments({lastSeenAt:{$gte:since}}),Attempt.countDocuments(),Attempt.find({completedAt:{$gte:new Date(Date.now()-86400000)}}).sort({completedAt:-1}).limit(20).populate('userId','name email').lean(),User.find({},'name email role lastSeenAt createdAt').sort({lastSeenAt:-1}).limit(500).lean()]);res.json({totalUsers,activeUsers,totalAttempts,recentAttempts,students,generatedAt:new Date().toISOString()})});
app.get('/api/admin/tests',auth,adminOnly,async(_req,res)=>res.json({tests:await Test.find().sort({createdAt:-1}).lean()}));
app.post('/api/admin/tests',auth,adminOnly,async(req,res)=>{try{const test=await Test.create(req.body);res.status(201).json({test})}catch(e){res.status(400).json({error:e.code===11000?'Test ID already exists':e.message})}});
app.patch('/api/admin/tests/:testId',auth,adminOnly,async(req,res)=>{const test=await Test.findOneAndUpdate({testId:req.params.testId},{$set:{...req.body,updatedAt:new Date()}},{new:true});if(!test)return res.status(404).json({error:'Test not found'});res.json({test})});
app.delete('/api/admin/tests/:testId',auth,adminOnly,async(req,res)=>{const test=await Test.findOneAndDelete({testId:req.params.testId});if(!test)return res.status(404).json({error:'Test not found'});await Question.deleteMany({testId:req.params.testId});res.json({ok:true})});
app.get('/api/admin/tests/:testId/questions',auth,adminOnly,async(req,res)=>res.json({questions:await Question.find({testId:req.params.testId}).sort({createdAt:1}).lean()}));
app.post('/api/admin/tests/:testId/questions',auth,adminOnly,async(req,res)=>{try{const question=await Question.create({...req.body,testId:req.params.testId});res.status(201).json({question})}catch(e){res.status(400).json({error:e.message})}});
app.patch('/api/admin/questions/:id',auth,adminOnly,async(req,res)=>{const question=await Question.findByIdAndUpdate(req.params.id,{$set:{...req.body,updatedAt:new Date()}},{new:true});if(!question)return res.status(404).json({error:'Question not found'});res.json({question})});
app.delete('/api/admin/questions/:id',auth,adminOnly,async(req,res)=>{const question=await Question.findByIdAndDelete(req.params.id);if(!question)return res.status(404).json({error:'Question not found'});res.json({ok:true})});
app.get('/api/admin/users',auth,adminOnly,async(_req,res)=>res.json({users:await User.find({},'name email role lastSeenAt createdAt').sort({lastSeenAt:-1}).limit(500).lean()}));

// In production, the same service can serve the Vite build, keeping deployment simple.
const dist=path.resolve(__dirname,'../dist');
app.use(express.static(dist));
app.get('*',(req,res)=>{ if(req.path.startsWith('/api/')) return res.status(404).json({error:'API route not found'}); res.sendFile(path.join(dist,'index.html')); });

async function seedDemo(){if(process.env.SEED_DEMO!=='true')return;const existing=await Test.countDocuments();if(existing)return;const tests=[{testId:'apt-1',title:'Quantitative Aptitude — Placement Set 01',category:'Aptitude',topic:'Quantitative Aptitude',difficulty:'Medium',questions:20,duration:20},{testId:'sql-1',title:'SQL & DBMS Interview Challenge',category:'Technical',topic:'SQL',difficulty:'Medium',duration:15},{testId:'java-1',title:'Java OOP Mastery Test',category:'Technical',topic:'Java',difficulty:'Hard',duration:25},{testId:'logic-1',title:'Logical Reasoning — Fast Track',category:'Reasoning',topic:'Logical Reasoning',difficulty:'Easy',duration:12},{testId:'python-1',title:'Python Coding Fundamentals',category:'Technical',topic:'Python',difficulty:'Medium',duration:20},{testId:'verbal-1',title:'Verbal Ability & Grammar Sprint',category:'Verbal',topic:'Verbal Ability',difficulty:'Easy',duration:15}];await Test.insertMany(tests);await Question.insertMany([{testId:'sql-1',text:'Which SQL clause filters grouped records?',options:['WHERE','HAVING','ORDER BY','LIMIT'],answer:1,explanation:'HAVING filters groups after GROUP BY.',topic:'SQL',difficulty:'Medium'},{testId:'java-1',text:'Which OOP principle allows the same method name to behave differently?',options:['Encapsulation','Inheritance','Polymorphism','Abstraction'],answer:2,explanation:'Polymorphism supports different implementations through a common interface.',topic:'OOP',difficulty:'Medium'},{testId:'python-1',text:'Which Python collection stores key-value pairs?',options:['List','Tuple','Set','Dictionary'],answer:3,explanation:'A dictionary stores key-value pairs.',topic:'Python',difficulty:'Easy'}])}
async function start(){await mongoose.connect(MONGO_URI,{maxPoolSize:Number(process.env.DB_POOL_SIZE||30),minPoolSize:5,serverSelectionTimeoutMS:5000});await seedDemo();app.listen(PORT,()=>console.log('SpeakingBot API listening on '+PORT))}start().catch(e=>{console.error('Database connection failed:',e.message);process.exit(1)});
