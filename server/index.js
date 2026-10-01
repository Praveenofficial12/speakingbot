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
if(!MONGO_URI||!JWT_SECRET){console.error('Missing MONGO_URI or JWT_SECRET');process.exit(1)}
app.set('trust proxy',1);app.use(helmet({crossOriginResourcePolicy:false}));app.use(compression());app.use(cors({origin:CLIENT_ORIGIN==='*'?true:CLIENT_ORIGIN.split(',').map(x=>x.trim()),credentials:true}));app.use(express.json({limit:'100kb'}));app.use(rateLimit({windowMs:60000,max:180,standardHeaders:true,legacyHeaders:false}));
const userSchema=new mongoose.Schema({name:{type:String,required:true,trim:true,maxlength:80},email:{type:String,required:true,unique:true,lowercase:true,trim:true,index:true},passwordHash:{type:String,required:true},role:{type:String,enum:['student','admin'],default:'student',index:true},lastSeenAt:{type:Date,default:Date.now,index:true},createdAt:{type:Date,default:Date.now}});
const attemptSchema=new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',index:true},testId:{type:String,required:true,index:true},score:Number,maxScore:Number,percentage:Number,durationSeconds:Number,completedAt:{type:Date,default:Date.now,index:true}});
const User=mongoose.model('User',userSchema);const Attempt=mongoose.model('Attempt',attemptSchema);
const auth=async(req,res,next)=>{try{const token=(req.headers.authorization||'').replace(/^Bearer\\s+/i,'');if(!token)return res.status(401).json({error:'Authentication required'});const payload=jwt.verify(token,JWT_SECRET);const user=await User.findById(payload.sub).lean();if(!user)return res.status(401).json({error:'User not found'});req.user=user;await User.updateOne({_id:user._id},{$set:{lastSeenAt:new Date()}});next()}catch{res.status(401).json({error:'Invalid or expired session'})}};
const adminOnly=(req,res,next)=>req.user.role==='admin'?next():res.status(403).json({error:'Admin access required'});
app.get('/api/health',async(_req,res)=>{const db=mongoose.connection.readyState===1;res.status(db?200:503).json({ok:db,service:'speakingbot-api',uptime:Math.round(process.uptime()),timestamp:new Date().toISOString()})});
app.post('/api/auth/register',async(req,res)=>{try{const{name,email,password}=req.body||{};if(!name||!email||!password||password.length<8)return res.status(400).json({error:'Name, valid email and password of at least 8 characters are required'});const normalized=String(email).toLowerCase().trim();if(await User.exists({email:normalized}))return res.status(409).json({error:'Email already registered'});const passwordHash=await bcrypt.hash(password,12);const role=ADMIN_EMAIL&&normalized===ADMIN_EMAIL?'admin':'student';const user=await User.create({name,email:normalized,passwordHash,role,lastSeenAt:new Date()});const token=jwt.sign({sub:user._id.toString(),role},JWT_SECRET,{expiresIn:'7d'});res.status(201).json({token,user:{id:user._id,name:user.name,email:user.email,role}})}catch{res.status(500).json({error:'Registration failed'})}});
app.post('/api/auth/login',async(req,res)=>{try{const{email,password}=req.body||{};const user=await User.findOne({email:String(email||'').toLowerCase().trim()});if(!user||!(await bcrypt.compare(password||'',user.passwordHash)))return res.status(401).json({error:'Invalid email or password'});user.lastSeenAt=new Date();await user.save();const token=jwt.sign({sub:user._id.toString(),role:user.role},JWT_SECRET,{expiresIn:'7d'});res.json({token,user:{id:user._id,name:user.name,email:user.email,role:user.role}})}catch{res.status(500).json({error:'Login failed'})}});
app.get('/api/me',auth,(req,res)=>res.json({user:{id:req.user._id,name:req.user.name,email:req.user.email,role:req.user.role}}));
app.post('/api/heartbeat',auth,async(req,res)=>{await User.updateOne({_id:req.user._id},{$set:{lastSeenAt:new Date()}});res.json({ok:true})});
app.post('/api/attempts',auth,async(req,res)=>{try{const{testId,score,maxScore,durationSeconds}=req.body||{};if(!testId||!Number.isFinite(score)||!Number.isFinite(maxScore)||maxScore<=0)return res.status(400).json({error:'Invalid attempt'});const attempt=await Attempt.create({userId:req.user._id,testId,score,maxScore,percentage:Math.round(score/maxScore*100),durationSeconds:Math.max(0,Number(durationSeconds||0))});res.status(201).json({attempt})}catch{res.status(500).json({error:'Could not save attempt'})}});
app.get('/api/my/attempts',auth,async(req,res)=>res.json({attempts:await Attempt.find({userId:req.user._id}).sort({completedAt:-1}).limit(100).lean()}));
app.get('/api/admin/metrics',auth,adminOnly,async(_req,res)=>{const since=new Date(Date.now()-300000);const[totalUsers,activeUsers,totalAttempts,recentAttempts,students]=await Promise.all([User.countDocuments(),User.countDocuments({lastSeenAt:{$gte:since}}),Attempt.countDocuments(),Attempt.find({completedAt:{$gte:new Date(Date.now()-86400000)}}).sort({completedAt:-1}).limit(20).populate('userId','name email').lean(),User.find({},'name email role lastSeenAt createdAt').sort({lastSeenAt:-1}).limit(500).lean()]);res.json({totalUsers,activeUsers,totalAttempts,recentAttempts,students,generatedAt:new Date().toISOString()})});
app.get('/api/admin/users',auth,adminOnly,async(_req,res)=>res.json({users:await User.find({},'name email role lastSeenAt createdAt').sort({lastSeenAt:-1}).limit(500).lean()}));

// In production, the same service can serve the Vite build, keeping deployment simple.
const dist=path.resolve(__dirname,'../dist');
app.use(express.static(dist));
app.get('*',(req,res)=>{ if(req.path.startsWith('/api/')) return res.status(404).json({error:'API route not found'}); res.sendFile(path.join(dist,'index.html')); });
async function start(){await mongoose.connect(MONGO_URI,{maxPoolSize:Number(process.env.DB_POOL_SIZE||30),minPoolSize:5,serverSelectionTimeoutMS:5000});app.listen(PORT,()=>console.log('SpeakingBot API listening on '+PORT))}start().catch(e=>{console.error('Database connection failed:',e.message);process.exit(1)});
