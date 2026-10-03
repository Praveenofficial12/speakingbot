import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BarChart3, Bell, Bookmark, BookOpen, BrainCircuit, Check,
  Calendar, ChevronLeft, ChevronRight, CircleHelp, Clock3, Code2, FileQuestion,
  Flame, Grid2X2, KeyRound, LayoutDashboard, Mail, Menu, Moon, Play, Plus, Search,
  Settings, ShieldCheck, Sparkles, Sun, Target, Trash2, Trophy, UserRound, X, Zap, Upload, LogOut, RefreshCw
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';
const api = async (path, options = {}) => {
  const token = localStorage.getItem('sb-token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};
const TESTS = [
  { id: 'apt-1', title: 'Quantitative Aptitude — Placement Set 01', category: 'Aptitude', topic: 'Quantitative Aptitude', difficulty: 'Medium', questions: 20, duration: 20, attempts: 1240, premium: false, score: 92 },
  { id: 'sql-1', title: 'SQL & DBMS Interview Challenge', category: 'Technical', topic: 'SQL', difficulty: 'Medium', questions: 15, duration: 15, attempts: 980, premium: false, score: 88 },
  { id: 'java-1', title: 'Java OOP Mastery Test', category: 'Technical', topic: 'Java', difficulty: 'Hard', questions: 20, duration: 25, attempts: 812, premium: true, score: 94 },
  { id: 'logic-1', title: 'Logical Reasoning — Fast Track', category: 'Reasoning', topic: 'Logical Reasoning', difficulty: 'Easy', questions: 15, duration: 12, attempts: 1650, premium: false, score: 90 },
  { id: 'python-1', title: 'Python Coding Fundamentals', category: 'Technical', topic: 'Python', difficulty: 'Medium', questions: 20, duration: 20, attempts: 734, premium: true, score: 91 },
  { id: 'verbal-1', title: 'Verbal Ability & Grammar Sprint', category: 'Verbal', topic: 'Verbal Ability', difficulty: 'Easy', questions: 20, duration: 15, attempts: 1430, premium: false, score: 89 }
];

const QUESTIONS = [
  { id: 1, text: 'What is the output of 10 + 20 / 5 in Java?', options: ['6', '10', '14', '30'], answer: 2, explanation: 'Division has higher precedence than addition, so 20 / 5 = 4 and 10 + 4 = 14.', topic: 'Java', difficulty: 'Easy' },
  { id: 2, text: 'Which SQL clause is used to filter grouped records?', options: ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'], answer: 1, explanation: 'HAVING filters groups after GROUP BY, while WHERE filters individual rows before grouping.', topic: 'SQL', difficulty: 'Medium' },
  { id: 3, text: 'A train travels 60 km in 45 minutes. What is its speed in km/h?', options: ['70', '75', '80', '90'], answer: 2, explanation: '45 minutes is 0.75 hours. Speed = 60 / 0.75 = 80 km/h.', topic: 'Quantitative Aptitude', difficulty: 'Medium' },
  { id: 4, text: 'Which OOP principle allows the same method name to behave differently?', options: ['Encapsulation', 'Inheritance', 'Polymorphism', 'Abstraction'], answer: 2, explanation: 'Polymorphism allows one interface or method name to represent different implementations.', topic: 'OOP', difficulty: 'Medium' },
  { id: 5, text: 'Which Python collection stores key-value pairs?', options: ['List', 'Tuple', 'Set', 'Dictionary'], answer: 3, explanation: 'A Python dictionary stores data as key-value pairs.', topic: 'Python', difficulty: 'Easy' }
];

const CATEGORIES = [
  ['Aptitude', 'Quantitative, DI and placement maths', '42 tests', '📐', 'tests'],
  ['Technical', 'Java, Python, SQL, DBMS and coding', '68 tests', '💻', 'tests'],
  ['Reasoning', 'Logic, puzzles and analytical thinking', '31 tests', '🧩', 'tests'],
  ['Verbal', 'Grammar, vocabulary and communication', '25 tests', '🗣️', 'tests'],
  ['Company Tests', 'Placement-style company assessments', '54 tests', '🏢', 'tests'],
  ['AI & ML', 'Machine learning and AI fundamentals', '18 tests', '🤖', 'tests'],
  ['Speaking Practice', 'Timed speaking prompts with microphone and self-review', '4 practice modules', '🎙️', 'communication'],
  ['Communication Practice', 'SWAR-style speaking, HR and situational practice', '4 practice modules', '💬', 'communication']
];

function App() {
  const [page, setPage] = useState('home');
  const [dark, setDark] = useState(() => localStorage.getItem('sb-theme') === 'dark');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTest, setActiveTest] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [bookmarks, setBookmarks] = useState(() => { try { return JSON.parse(localStorage.getItem('sb-bookmarks') || '[]'); } catch { return []; } });
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('sb-user') || 'null'); } catch { return null; } });
  const [questions, setQuestions] = useState(QUESTIONS);
  const [scheduledNotice, setScheduledNotice] = useState(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sb-active-attempt');
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.attempt && saved?.activeTest && Array.isArray(saved?.questions) && saved.questions.length) {
        const remaining = Math.max(0, Math.floor((saved.activeTest.scheduledEndAt ? (new Date(saved.activeTest.scheduledEndAt).getTime()-Date.now())/1000 : saved.attempt.seconds)));
        const restored = {...saved.attempt, seconds: saved.activeTest.scheduledEndAt ? Math.min(saved.attempt.seconds, remaining) : saved.attempt.seconds};
        if (restored.seconds > 0) { setActiveTest(saved.activeTest); setQuestions(saved.questions); setAttempt(restored); setPage('test'); }
        else localStorage.removeItem('sb-active-attempt');
      }
    } catch { localStorage.removeItem('sb-active-attempt'); }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('sb-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    localStorage.setItem('sb-bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    if (!user || !localStorage.getItem('sb-token')) return;
    const heartbeat = () => api('/heartbeat', { method: 'POST' }).catch(() => {});
    heartbeat();
    const id = setInterval(heartbeat, 60000);
    return () => clearInterval(id);
  }, [user]);

  const navigate = (next) => { setPage(next); setMobileOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const startTest = async (test = TESTS[0]) => {
    let loadedQuestions = QUESTIONS;
    try {
      const data = await api('/tests/' + test.id);
      if (data.test) { test = { ...test, ...data.test, id: data.test.testId, questions: data.questions.length }; loadedQuestions = data.questions; setQuestions(data.questions); }
    } catch { setQuestions(QUESTIONS); }
    const started=Date.now();
    const nextAttempt={index:0,answers:{},marked:[],visited:[1],started,seconds:test.duration*60};
    setActiveTest(test); setAttempt(nextAttempt);
    localStorage.setItem('sb-active-attempt',JSON.stringify({attempt:nextAttempt,activeTest:test,questions:loadedQuestions}));
    setPage('test');
  };

  const startScheduled = (data) => { const endAt=new Date(data.window.endAt).getTime(); const remaining=Math.max(1,Math.floor((endAt-Date.now())/1000)); const test={...data.test,id:data.test.testId,questions:data.questions.length,questionsData:data.questions,scheduledAccessId:data.accessId,scheduledEndAt:endAt}; setActiveTest(test); setQuestions(data.questions); const started=Date.now(); const nextAttempt={index:0,answers:{},marked:[],visited:[1],started,seconds:Math.min(test.duration*60,remaining)}; setAttempt(nextAttempt); localStorage.setItem('sb-active-attempt',JSON.stringify({attempt:nextAttempt,activeTest:test,questions:data.questions})); setPage('test'); setScheduledNotice(null); };

  const submitTest = async (answers) => {
    if (localStorage.getItem('sb-submitting') === '1') return;
    localStorage.setItem('sb-submitting','1');
    const activeQuestions = activeTest?.questionsData || questions;
    const correct = activeQuestions.filter(q => answers[q._id||q.id] === q.answer || answers[q._id] === q.answer).length;
    const answered = Object.keys(answers).length;
    const result = { score:correct, max:activeQuestions.length, percentage:activeQuestions.length?Math.round((correct/activeQuestions.length)*100):0, correct, incorrect:answered-correct, skipped:activeQuestions.length-answered, time:activeTest?Math.max(1,Math.round((Date.now()-attempt.started)/1000)):1, test:activeTest||TESTS[0] };
    try {
      if(localStorage.getItem('sb-token')) await api('/attempts/submit',{method:'POST',body:JSON.stringify({testId:result.test.id,answers,durationSeconds:result.time,scheduledAccessId:activeTest?.scheduledAccessId||null})});
      setLastResult(result);setAttempt(null);localStorage.removeItem('sb-active-attempt');localStorage.removeItem('sb-submitting');setPage('result');
    } catch(e) {
      alert(e.message||'This assessment is no longer accepting answers.');
      setAttempt(null);localStorage.removeItem('sb-active-attempt');localStorage.removeItem('sb-submitting');setPage('scheduled');
    }
  };

  return (
    <div className="app">
      {page !== 'test' && <Header dark={dark} setDark={setDark} page={page} navigate={navigate} user={user} setUser={setUser} search={search} setSearch={setSearch} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />}
      {page === 'home' && <Home navigate={navigate} startTest={startTest} />}
      {page === 'tests' && <Tests navigate={navigate} startTest={startTest} search={search} />}
      {page === 'dashboard' && <Dashboard navigate={navigate} lastResult={lastResult} user={user} />}
      {page === 'scheduled' && <ScheduledTests user={user} navigate={navigate} startScheduled={startScheduled} />}
      {page === 'communication' && <CommunicationLab user={user} navigate={navigate} />}
      {page === 'test' && attempt && <TestEngine attempt={attempt} setAttempt={setAttempt} activeTest={activeTest} questions={questions} submitTest={submitTest} navigate={navigate} />}
      {page === 'result' && <Result result={lastResult} questions={questions} navigate={navigate} startTest={startTest} />}
      {page === 'bookmarks' && <Bookmarks bookmarks={bookmarks} setBookmarks={setBookmarks} navigate={navigate} />}
      {page === 'admin' && <Admin navigate={navigate} user={user} />}\n      {page === 'settings' && <SettingsPage navigate={navigate} user={user} setUser={setUser} dark={dark} setDark={setDark} />}
      {page === 'login' && <Auth navigate={navigate} setUser={setUser} />}
      {page === 'profile' && <Profile navigate={navigate} user={user} setUser={setUser} />}
      {page === 'home' || page === 'tests' ? <Footer navigate={navigate} /> : null}
    </div>
  );
}

function Header({ dark, setDark, page, navigate, search, setSearch, mobileOpen, setMobileOpen, user, setUser }) {
  return (
    <header className="header">
      <div className="header-inner">
        <button className="brand" onClick={() => navigate('home')}><span className="brand-mark"><BrainCircuit size={20}/></span><span>Speaking<span>Bot</span></span></button>
        <nav className={mobileOpen ? 'nav open' : 'nav'}>
          {['home','tests','communication','dashboard','bookmarks','scheduled'].map(item =>
            <button key={item} className={page === item ? 'active' : ''} onClick={() => navigate(item)}>
              {item === 'home' ? 'Home' : item === 'tests' ? 'Practice Tests' : item === 'dashboard' ? 'Dashboard' : item === 'communication' ? 'Communication Lab' : item === 'scheduled' ? 'Assessments' : 'Bookmarks'}
            </button>
          )}
          {user?.role==='admin' && <button onClick={() => navigate('admin')}>Admin</button>}
        </nav>
        <div className="header-actions">
          <div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tests..." onKeyDown={e => e.key === 'Enter' && navigate('tests')} /></div>
          <button className="icon-btn" onClick={() => setDark(!dark)} title="Toggle theme">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
          <button className="profile-btn" onClick={() => user ? navigate('profile') : navigate('login')}><span className="avatar">{user?.name?.slice(0,2).toUpperCase() || 'IN'}</span><span className="hide-sm">{user?.name || 'Sign in'}</span></button>
          <button className="menu-btn" onClick={() => setMobileOpen(!mobileOpen)}><Menu size={21}/></button>
        </div>
      </div>
    </header>
  );
}

function Home({ navigate, startTest }) {
  return <main>
    <section className="hero">
      <div className="hero-glow one"/><div className="hero-glow two"/>
      <div className="container hero-grid">
        <div>
          <div className="eyebrow"><Sparkles size={15}/> Smart practice for your next opportunity</div>
          <h1>Practice smarter.<br/><em>Perform better.</em></h1>
          <p className="hero-copy">Build confidence with timed aptitude, technical and placement tests. Get instant results, understand your weak areas and practice with purpose.</p>
          <div className="hero-actions"><button className="btn primary" onClick={() => navigate('tests')}>Explore Tests <ArrowRight size={18}/></button><button className="btn secondary" onClick={() => startTest(TESTS[0])}><Play size={17}/> Try a Free Test</button></div>
          <div className="trust-row"><span><Check size={15}/> 200+ practice sets</span><span><Check size={15}/> Instant analytics</span><span><Check size={15}/> Free tests available</span></div>
        </div>
        <div className="hero-card-wrap">
          <div className="floating-stat stat-a"><span className="stat-icon green"><Target size={17}/></span><div><b>87%</b><small>Accuracy</small></div></div>
          <div className="exam-card">
            <div className="exam-top"><span className="pill purple">Live Practice</span><span className="dots">•••</span></div>
            <div className="exam-title">SQL & DBMS Interview Challenge</div>
            <div className="exam-meta"><span><FileQuestion size={15}/> 15 Questions</span><span><Clock3 size={15}/> 15 min</span></div>
            <div className="progress-label"><span>Your progress</span><b>72%</b></div>
            <div className="progress"><i style={{width:'72%'}}/></div>
            <div className="mini-questions">{[1,2,3,4,5,6,7,8,9,10].map(n => <span key={n} className={n < 8 ? 'done' : n === 8 ? 'current' : ''}>{n}</span>)}</div>
            <button className="card-start" onClick={() => startTest(TESTS[1])}>Continue practice <ArrowRight size={16}/></button>
          </div>
          <div className="floating-stat stat-b"><span className="stat-icon orange"><Flame size={17}/></span><div><b>7 days</b><small>Practice streak</small></div></div>
        </div>
      </div>
    </section>
    <section className="container section">
      <SectionHeading kicker="Explore" title="Find your practice path" action="View all tests" onAction={() => navigate('tests')}/>
      <div className="category-grid">{CATEGORIES.map(([name, desc, count, icon, target]) => <button className="category-card" key={name} onClick={() => navigate(target)} aria-label={name}><span className="category-icon">{icon}</span><div><h3>{name}</h3><p>{desc}</p><small>{count} <ArrowRight size={14}/></small></div></button>)}</div>
    </section>
    <section className="section tinted"><div className="container">
      <SectionHeading kicker="Popular this week" title="Tests students are taking" action="See all" onAction={() => navigate('tests')}/>
      <div className="test-grid">{TESTS.slice(0,4).map(test => <TestCard key={test.id} test={test} onStart={startTest}/>)}</div>
    </div></section>
    <section className="container section">
      <div className="feature-grid">
        <div className="feature-copy"><div className="eyebrow">Why SpeakingBot</div><h2>Every attempt should teach you something.</h2><p>Practice is more useful when you can see exactly where you lose marks. SpeakingBot turns every test into a feedback loop.</p><div className="feature-list"><Feature icon={<Target/>} title="Focused practice" text="Target the topics that need your attention."/><Feature icon={<BarChart3/>} title="Clear analytics" text="Track accuracy, scores and progress over time."/><Feature icon={<Zap/>} title="Fast feedback" text="See answers and explanations immediately." /></div></div>
        <div className="analytics-preview"><div className="preview-head"><div><small>Weekly performance</small><h3>+18.4%</h3></div><span className="pill green">On track</span></div><div className="bars">{[45,62,52,78,66,88,82].map((h,i)=><div key={i} className="bar-col"><i style={{height:h+'%'}}/><small>{['M','T','W','T','F','S','S'][i]}</small></div>)}</div><div className="preview-footer"><span><i className="legend-dot"/> Accuracy</span><b>84.7%</b></div></div>
      </div>
    </section>
    <section className="cta-section"><div className="container cta"><div><span className="eyebrow">Ready when you are</span><h2>Turn 20 minutes of practice into real confidence.</h2></div><button className="btn white" onClick={() => navigate('tests')}>Start practicing <ArrowRight size={18}/></button></div></section>
  </main>;
}

function SectionHeading({kicker,title,action,onAction}) { return <div className="section-heading"><div><div className="kicker">{kicker}</div><h2>{title}</h2></div>{action && <button className="text-btn" onClick={onAction}>{action} <ArrowRight size={15}/></button>}</div> }
function Feature({icon,title,text}) { return <div className="feature-item"><span>{icon}</span><div><h4>{title}</h4><p>{text}</p></div></div> }

function TestCard({test,onStart}) {
  return <article className="test-card"><div className="test-card-top"><span className={'pill '+(test.premium?'gold':'green')}>{test.premium?'Premium':'Free'}</span><button className="bookmark-btn"><Bookmark size={17}/></button></div><span className="test-category">{test.category} · {test.topic}</span><h3>{test.title}</h3><div className="test-info"><span><FileQuestion size={15}/>{test.questions} questions</span><span><Clock3 size={15}/>{test.duration} min</span><span className="difficulty">{test.difficulty}</span></div><div className="test-bottom"><span><Trophy size={15}/> {test.attempts.toLocaleString()} attempts</span><button onClick={() => onStart(test)}>Start <ArrowRight size={15}/></button></div></article>
}

function Tests({navigate,startTest,search}) {
  const [filter,setFilter]=useState('All');
  const [tests,setTests]=useState(TESTS);
  useEffect(()=>{ api('/tests').then(data=>{ if(data.tests?.length) setTests(data.tests.map(t=>({...t,id:t.testId,questions:t.questions||0,attempts:t.attempts||0}))); }).catch(()=>{}); },[]);
  const filtered=useMemo(()=>tests.filter(t => (filter==='All'||t.category===filter) && (!search||JSON.stringify(t).toLowerCase().includes(search.toLowerCase()))),[tests,filter,search]);
  return <main className="container page-pad"><div className="page-hero"><div><div className="kicker">Practice library</div><h1>Choose your next challenge.</h1><p>Timed practice sets designed for placement preparation and technical interviews.</p></div><button className="btn primary" onClick={()=>startTest(filtered[0]||TESTS[0])}><Play size={17}/> Quick start</button></div>
    <div className="filter-row"><div className="filter-pills">{['All','Aptitude','Technical','Reasoning','Verbal','Company Tests','AI & ML'].map(x=><button className={filter===x?'selected':''} key={x} onClick={()=>setFilter(x)}>{x}</button>)}</div><span>{filtered.length} tests</span></div>
    <div className="test-grid large">{filtered.map(t=><TestCard key={t.id} test={t} onStart={startTest}/>)}</div>
    {!filtered.length && <Empty icon={<Search/>} title="No tests found" text="Try another search or category." action={()=>setFilter('All')}/>}
  </main>;
}

function Dashboard({navigate,lastResult,user}) {
  const [attempts,setAttempts]=useState([]);
  useEffect(()=>{ if(!user) return; api('/my/attempts').then(d=>setAttempts(d.attempts||[])).catch(()=>{}); },[user]);
  const avg=attempts.length?Math.round(attempts.reduce((s,a)=>s+(a.percentage||0),0)/attempts.length):0;
  const recent=attempts.slice(0,5);
  return <main className="container page-pad"><div className="dashboard-head"><div><div className="kicker">Good morning{user?.name ? ', ' + user.name.split(' ')[0] : ''}</div><h1>Your practice dashboard.</h1><p>Keep your streak alive and turn weak areas into strengths.</p></div><button className="btn primary" onClick={()=>navigate('tests')}><Plus size={18}/> New practice</button></div>
    <div className="stats-grid">{[['Tests attempted',attempts.length,'From your account',<BookOpen/>],['Average score',avg+'%','Across completed tests',<Target/>],['Accuracy',avg+'%','Server-recorded results',<BarChart3/>],['Practice streak','—','Keep practicing daily',<Flame/>]].map(([a,b,c,i])=><div className="metric" key={a}><span>{i}</span><small>{a}</small><strong>{b}</strong><em>{c}</em></div>)}</div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><small>Performance</small><h3>Score trend</h3></div><select><option>Last 30 days</option><option>Last 7 days</option></select></div><div className="big-chart">{[48,56,51,68,62,74,71,84,79,87].map((h,i)=><div key={i} className="chart-bar"><i style={{height:h+'%'}}/><small>{i+1}</small></div>)}</div></section><section className="panel"><div className="panel-head"><div><small>Topic mastery</small><h3>Where you stand</h3></div></div>{[['Java OOP',87],['SQL & DBMS',79],['Aptitude',74],['Logical Reasoning',68]].map(([x,v])=><div className="topic-row" key={x}><div><span>{x}</span><b>{v}%</b></div><div className="progress"><i style={{width:v+'%'}}/></div></div>)}</section></div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><small>Recent activity</small><h3>Latest attempts</h3></div><button className="text-btn" onClick={()=>navigate('tests')}>Practice more <ArrowRight size={15}/></button></div><div className="activity-list">{recent.length?recent.map(a=><div className="activity" key={a._id}><span className="activity-icon"><Check size={17}/></span><div><b>{a.testId}</b><small>{new Date(a.completedAt).toLocaleString()} · {a.maxScore} questions</small></div><strong>{a.percentage}%</strong></div>):<div className="empty"><span><BookOpen/></span><h3>No attempts yet</h3><p>Start a test to build your real performance history.</p></div>}</div></section><section className="panel recommendation"><span className="rec-icon"><Sparkles/></span><small>Recommended for you</small><h3>Strengthen SQL JOINs</h3><p>Your recent accuracy in JOIN questions is 61%. A focused 10-question set can help.</p><button className="btn primary full" onClick={()=>navigate('tests')}>Practice weak area <ArrowRight size={16}/></button></section></div>
    {lastResult && <div className="success-banner"><Check size={18}/><span>Latest result: <b>{lastResult.percentage}%</b> in {lastResult.test.title}.</span><button onClick={()=>navigate('result')}>View result <ArrowRight size={15}/></button></div>}
  </main>;
}

function TestEngine({attempt,setAttempt,activeTest,questions,submitTest,navigate}) {
  const [seconds,setSeconds]=useState(attempt.seconds),[answers,setAnswers]=useState(attempt.answers),[showSubmit,setShowSubmit]=useState(false),[online,setOnline]=useState(navigator.onLine),[submitting,setSubmitting]=useState(false);
  const q=questions[attempt.index];
  useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)}},[]);
  useEffect(()=>{const id=setInterval(()=>setSeconds(s=>s>0?s-1:0),1000);return()=>clearInterval(id)},[]);
  useEffect(()=>{if(seconds===0&&!submitting){setSubmitting(true);submitTest(answers)}},[seconds]);
  useEffect(()=>{
    const next={...attempt,answers,seconds};
    setAttempt(next);
    localStorage.setItem('sb-active-attempt',JSON.stringify({attempt:next,activeTest,questions}));
  },[answers,seconds]);
  useEffect(()=>{const save=()=>localStorage.setItem('sb-active-attempt',JSON.stringify({attempt:{...attempt,answers,seconds},activeTest,questions}));window.addEventListener('beforeunload',save);return()=>window.removeEventListener('beforeunload',save)},[attempt,answers,seconds,activeTest,questions]);
  const choose=idx=>{const key=q._id||q.id;setAnswers({...answers,[key]:idx})};
  const go=delta=>{const n=Math.max(0,Math.min(questions.length-1,attempt.index+delta));const key=questions[n]._id||questions[n].id;setAttempt({...attempt,index:n,visited:Array.from(new Set([...(attempt.visited||[]),key]))})};
  const mark=()=>{const key=q._id||q.id;setAttempt({...attempt,marked:attempt.marked.includes(key)?attempt.marked.filter(x=>x!==key):[...attempt.marked,key]})};
  const submit=()=>{if(!online){setShowSubmit(false);alert('You are offline. Your answers are safely saved on this device. Reconnect to submit the assessment.');return}setSubmitting(true);submitTest(answers)};
  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  return <div className="exam-page"><header className="exam-header"><button className="brand" onClick={()=>navigate('home')}><span className="brand-mark"><BrainCircuit size={20}/></span><span>Speaking<span>Bot</span></span></button><div className="exam-name">{activeTest?.title}</div><div className="exam-status"><span className={online?'online-dot':'offline-dot'}/>{online?'Connected':'Offline — answers saved'}</div><div className={'timer '+(seconds<120?'danger':'')}><Clock3 size={17}/>{fmt(seconds)}</div><button className="btn danger-btn" disabled={submitting} onClick={()=>setShowSubmit(true)}>{submitting?'Submitting…':'Submit test'}</button></header>
    <div className="exam-layout"><aside className="question-nav"><div className="nav-title"><b>Questions</b><small>{Object.keys(answers).length}/{questions.length} answered</small></div><div className="legend"><span><i className="answered"/>Answered</span><span><i className="review"/>Review</span></div><div className="palette">{questions.map((x,i)=><button key={x._id||x.id} className={(i===attempt.index?'current ':'')+(answers[x._id||x.id]!==undefined?'answered ':'')+(attempt.marked.includes(x._id||x.id)?'review':'')} onClick={()=>setAttempt({...attempt,index:i})}>{i+1}</button>)}</div></aside>
    <section className="question-area"><div className="question-top"><span className="pill purple">{q.topic}</span><span>{q.difficulty}</span></div><div className="question-number">Question {attempt.index+1} <span>of {questions.length}</span></div><h1>{q.text}</h1><div className="options">{q.options.map((o,i)=><button key={o} className={answers[q._id||q.id]===i?'selected':''} onClick={()=>choose(i)}><span>{String.fromCharCode(65+i)}</span>{o}{answers[q._id||q.id]===i&&<Check size={18}/>}</button>)}</div><div className="question-actions"><button className="text-btn" onClick={mark}><Bookmark size={16} fill={attempt.marked.includes(q._id||q.id)?'currentColor':'none'}/>{attempt.marked.includes(q._id||q.id)?'Marked for review':'Mark for review'}</button>{answers[q._id||q.id]!==undefined&&<button className="clear-btn" onClick={()=>{const n={...answers};delete n[q._id||q.id];setAnswers(n)}}>Clear answer</button>}</div><div className="exam-footer"><button className="btn secondary" disabled={attempt.index===0} onClick={()=>go(-1)}><ChevronLeft size={17}/> Previous</button><button className="btn primary" onClick={()=>attempt.index===questions.length-1?setShowSubmit(true):go(1)}>{attempt.index===questions.length-1?'Review & submit':'Next question'} <ChevronRight size={17}/></button></div></section></div>
    {showSubmit&&<Modal title="Submit your test?" close={()=>setShowSubmit(false)}><p>You have answered <b>{Object.keys(answers).length}</b> of {questions.length} questions. {online?'Unanswered questions will be counted as skipped.':'You are offline. Reconnect before submitting.'}</p><div className="submit-summary"><span>Answered <b>{Object.keys(answers).length}</b></span><span>Skipped <b>{questions.length-Object.keys(answers).length}</b></span><span>Marked <b>{attempt.marked.length}</b></span></div><div className="modal-actions"><button className="btn secondary" onClick={()=>setShowSubmit(false)}>Keep practicing</button><button className="btn primary" disabled={!online||submitting} onClick={submit}>{submitting?'Submitting…':'Submit now'} <ArrowRight size={16}/></button></div></Modal>}
  </div>;
}

function Result({result,questions,navigate,startTest}) {
  const r=result||{score:4,max:5,percentage:80,correct:4,incorrect:1,skipped:0,time:312,test:TESTS[1]};
  return <main className="container page-pad"><div className="result-head"><button className="back-btn" onClick={()=>navigate('dashboard')}><ChevronLeft size={17}/> Dashboard</button><div className="kicker">Test completed</div><h1>Nice work, Praveen.</h1><p>Here is what your latest attempt tells you.</p></div>
    <div className="result-card"><div className="score-ring" style={{'--p':r.percentage}}><div><strong>{r.percentage}%</strong><span>Score</span></div></div><div className="result-main"><span className="pill green">Completed</span><h2>{r.test.title}</h2><p>Completed just now · {Math.floor(r.time/60)}m {r.time%60}s spent</p><div className="result-stats"><div><span className="correct-dot"><Check size={14}/></span><b>{r.correct}</b><small>Correct</small></div><div><span className="wrong-dot">×</span><b>{r.incorrect}</b><small>Incorrect</small></div><div><span className="skip-dot">—</span><b>{r.skipped}</b><small>Skipped</small></div></div></div></div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><small>Question review</small><h3>How you performed</h3></div></div>{questions.map((q,i)=>{const correct=i<r.correct;return <div className="review-row" key={q.id}><span className={correct?'review-ok':'review-bad'}>{correct?<Check size={15}/>:'×'}</span><div><b>Question {i+1}</b><small>{q.topic} · {q.difficulty}</small></div><span>{correct?'Correct':'Review'}</span></div>})}</section><section className="panel recommendation"><span className="rec-icon"><Sparkles/></span><small>Next best step</small><h3>Keep the momentum.</h3><p>Review explanations for missed questions, then take another set from the same topic.</p><button className="btn primary full" onClick={()=>startTest(r.test)}>Retake test <ArrowRight size={16}/></button><button className="btn secondary full" onClick={()=>navigate('tests')}>Explore related tests</button></section></div>
  </main>;
}

function Bookmarks({bookmarks,setBookmarks,navigate}) {
  const items=QUESTIONS.filter(q=>bookmarks.includes(q.id));
  return <main className="container page-pad"><div className="page-hero"><div><div className="kicker">Saved for later</div><h1>Your bookmarks.</h1><p>Keep tricky questions close so you can revisit them when you practice.</p></div><button className="btn primary" onClick={()=>navigate('tests')}>Find more questions <ArrowRight size={17}/></button></div>{items.length?<div className="bookmark-list">{items.map(q=><div className="bookmark-card" key={q.id}><span className="category-icon small"><Bookmark size={18}/></span><div><span className="test-category">{q.topic}</span><h3>{q.text}</h3><p>{q.explanation}</p></div><button className="icon-btn" onClick={()=>setBookmarks(bookmarks.filter(id=>id!==q.id))}><X size={17}/></button></div>)}</div>:<Empty icon={<Bookmark/>} title="No bookmarks yet" text="Save questions while practicing to build your personal revision set." action={()=>navigate('tests')} actionText="Browse tests"/>}</main>;
}

function CommunicationLab({user,navigate}) {
  const modules=[
    {id:'listen-repeat',title:'Listen & Repeat',type:'Listening + Speaking',seconds:60,icon:'🎧',prompt:'Listen to the sentence, then repeat it as naturally and clearly as possible.',sentence:'Effective communication helps a team solve problems quickly and work together with confidence.'},
    {id:'read-repeat',title:'Read & Repeat',type:'Reading + Speaking',seconds:60,icon:'📖',prompt:'Read the sentence aloud, then repeat it with clear pronunciation and natural pace.',sentence:'The project team completed the application before the scheduled deadline and tested every major feature.'},
    {id:'incorrect-correction',title:'Listen Incorrect Sentence & Correct It',type:'Listening + Correction',seconds:60,icon:'🔊',prompt:'Listen to the incorrect sentence. Identify the mistake and say the corrected sentence aloud.',sentence:'She do not likes to attend the technical interview because she are nervous.',correct:'She does not like to attend the technical interview because she is nervous.'},
    {id:'grammar',title:'Grammar',type:'Grammar Practice',seconds:90,icon:'✍️',prompt:'Choose the grammatically correct sentence, then say the correct sentence aloud.',question:'Choose the correct sentence:',options:['He have completed the project yesterday.','He has completed the project.','He having completed the project.','He complete the project yesterday.'],answer:1,correct:'He has completed the project.'},
    {id:'story',title:'Story & Answer',type:'Story Listening + Response',seconds:120,icon:'📚',prompt:'Read or listen to the short story and answer the question in your own words.',story:'Ravi was preparing for a placement interview. Every morning, he practiced aptitude questions for one hour and spent another hour improving his communication. On the interview day, he stayed calm, explained his projects clearly, and answered the technical questions using simple examples.',question:'What did Ravi do to prepare for his placement interview, and how did it help him during the interview?'},
    {id:'jam',title:'JAM — Just A Minute',type:'Fluency + Spontaneous Speaking',seconds:60,icon:'🎤',prompt:'You have one minute. Speak continuously on the topic. Start with an introduction, give two or three points, and finish with a short conclusion.',topics:['Artificial Intelligence in Education','My Favorite Technology','Importance of Teamwork','A Day Without a Smartphone','My Career Goal','Online Learning vs Classroom Learning','The Role of Communication in a Job','A Technology I Want to Learn']}
  ];
  const [module,setModule]=useState(0),[running,setRunning]=useState(false),[seconds,setSeconds]=useState(modules[0].seconds);
  const [recording,setRecording]=useState(false),[audio,setAudio]=useState(''),[transcript,setTranscript]=useState(''),[listening,setListening]=useState(false),[grammarAnswer,setGrammarAnswer]=useState(null),[grammarChecked,setGrammarChecked]=useState(false),[jamTopic,setJamTopic]=useState('');
  const [evaluation,setEvaluation]=useState(null),[saving,setSaving]=useState(false),[results,setResults]=useState([]);
  const recorder=React.useRef(null),chunks=React.useRef([]);
  const current=modules[module],displayTopic=jamTopic||current.topics?.[0];
  useEffect(()=>{if(!running)return;if(seconds<=0){stopRecording();return}const id=setInterval(()=>setSeconds(x=>x-1),1000);return()=>clearInterval(id)},[running,seconds]);
  useEffect(()=>{if(user)api('/my/swar-results').then(x=>setResults(x.results||[])).catch(()=>{})},[user]);
  const selectModule=i=>{stopRecording();setModule(i);setSeconds(modules[i].seconds);setAudio('');setTranscript('');setGrammarAnswer(null);setGrammarChecked(false);setJamTopic('');setEvaluation(null)};
  const speak=text=>{if(!('speechSynthesis' in window)){alert('Speech playback is not supported in this browser.');return}window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-IN';u.rate=.9;window.speechSynthesis.speak(u)};
  const startRecording=async()=>{try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks.current=[];const mr=new MediaRecorder(stream);recorder.current=mr;mr.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};mr.onstop=()=>{stream.getTracks().forEach(t=>t.stop());setAudio(URL.createObjectURL(new Blob(chunks.current,{type:'audio/webm'})))};mr.start();setRecording(true);setRunning(true);try{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(SR){const sr=new SR();sr.continuous=true;sr.interimResults=true;sr.lang='en-IN';sr.onresult=e=>{let text='';for(let i=0;i<e.results.length;i++)text+=e.results[i][0].transcript+' ';setTranscript(text.trim())};sr.onend=()=>setListening(false);sr.start();window.sbRecognition=sr;setListening(true)}}catch{}}catch{alert('Microphone permission is required for speaking practice.')}};
  const stopRecording=()=>{if(recorder.current&&recorder.current.state!=='inactive')recorder.current.stop();if(window.sbRecognition){try{window.sbRecognition.stop()}catch{}window.sbRecognition=null}setRecording(false);setListening(false);setRunning(false)};
  const reset=()=>{stopRecording();setSeconds(current.seconds);setAudio('');setTranscript('');setGrammarAnswer(null);setGrammarChecked(false);setEvaluation(null)};
  const newJam=()=>{const t=current.topics[Math.floor(Math.random()*current.topics.length)];setJamTopic(t);setSeconds(current.seconds);setAudio('');setTranscript('');setRunning(false);setEvaluation(null)};
  const similarity=(a,b)=>{const A=new Set(String(a||'').toLowerCase().replace(/[^a-z0-9 ]/g,'').split(/\s+/).filter(Boolean)),B=new Set(String(b||'').toLowerCase().replace(/[^a-z0-9 ]/g,'').split(/\s+/).filter(Boolean));if(!A.size||!B.size)return 0;let hit=0;A.forEach(x=>{if(B.has(x))hit++});return Math.round(hit/B.size*100)};
  const evaluate=async()=>{if(!user)return navigate('login');if(!transcript&&current.id!=='grammar'){alert('Record your response first so the transcript can be evaluated.');return}let fluency=Math.min(100,Math.round((transcript.trim().split(/\s+/).filter(Boolean).length/Math.max(10,current.seconds*.75))*100));let grammar=70,comprehension=70,score=fluency;const expected=current.correct||current.sentence||'';if(current.id==='listen-repeat'||current.id==='read-repeat'||current.id==='incorrect-correction'){score=Math.round((similarity(transcript,expected)+fluency)/2);grammar=Math.min(100,similarity(transcript,expected));comprehension=similarity(transcript,expected)}else if(current.id==='grammar'){grammar=grammarAnswer===current.answer?100:0;comprehension=grammar;score=grammar;fluency=transcript?Math.min(100,Math.round((transcript.split(/\s+/).length/8)*100)):grammar}else if(current.id==='story'){const keys=['ravi','aptitude','communication','interview','calm','projects','technical','examples'];const hits=keys.filter(k=>transcript.toLowerCase().includes(k)).length;comprehension=Math.round(hits/keys.length*100);score=Math.round((fluency+comprehension+70)/3);grammar=70}else if(current.id==='jam'){grammar=transcript.length?Math.min(100,Math.round(75+Math.min(25,(transcript.match(/[.!?]/g)||[]).length*5))):0;score=Math.round((fluency+grammar)/2);comprehension=70}const feedback={strengths:fluency>=70?'Good speaking pace and enough content.':'Try speaking continuously with a clearer structure.',improvements:grammar<70?'Review sentence structure and grammar before repeating.':'Keep improving vocabulary and sentence variety.',note:'Scores are based on transcript and task accuracy. Browser microphone recording is not independently judged for pronunciation quality.'};const ev={score,fluencyScore:fluency,grammarScore:grammar,comprehensionScore:comprehension,feedback};setEvaluation(ev);setSaving(true);try{const r=await api('/swar-results',{method:'POST',body:JSON.stringify({moduleId:current.id,moduleTitle:current.title,...ev,transcript})});setResults([r.result,...results])}catch(e){alert(e.message||'Could not save SWAR result.')}finally{setSaving(false)}};
  const mm=String(Math.floor(seconds/60)).padStart(2,'0'),ss=String(seconds%60).padStart(2,'0');
  const completed=results.filter(x=>x.module_id===current.id).length;
  return <main className="container page-pad"><div className="page-hero"><div><div className="kicker">SWAR assessment & communication practice</div><h1>Build real speaking confidence.</h1><p>Practice six speaking activities and get transcript-based scores for fluency, grammar and comprehension.</p></div><span className="admin-badge"><ShieldCheck size={16}/> Microphone enabled</span></div>
    <div className="communication-layout"><aside className="panel communication-menu"><small>SWAR modules</small>{modules.map((x,i)=><button className={i===module?'selected':''} key={x.id} onClick={()=>selectModule(i)}><span>{x.icon}</span><div><b>{x.title}</b><small>{x.type}</small></div><ChevronRight size={15}/></button>)}</aside>
    <section className="panel speaking-stage"><div className="stage-top"><span className="pill purple">{current.type}</span><span className="timer"><Clock3 size={16}/>{mm}:{ss}</span></div>
      <div className="prompt-card"><small>{current.title}</small><h2>{current.prompt}</h2>
        {current.sentence&&<div className="swar-sentence"><p>{current.sentence}</p><button className="btn secondary" onClick={()=>speak(current.sentence)}><Play size={16}/> Listen</button></div>}
        {current.correct&&<div className="swar-sentence correction"><small>Correct sentence</small><p>{current.correct}</p></div>}
        {current.question&&<div className="story-card"><small>{current.story?'Story':'Grammar question'}</small>{current.story&&<p className="story-text">{current.story}</p>}<h3>{current.question}</h3>{current.options&&<div className="grammar-options">{current.options.map((o,i)=><button className={grammarAnswer===i?'selected':''} key={o} onClick={()=>{setGrammarAnswer(i);setGrammarChecked(false)}}><span>{String.fromCharCode(65+i)}</span>{o}</button>)}</div>}{current.answer!==undefined&&<button className="btn secondary" onClick={()=>setGrammarChecked(true)} disabled={grammarAnswer===null}>Check answer</button>}{grammarChecked&&<div className={grammarAnswer===current.answer?'success-banner':'error-banner'}><Check size={17}/>{grammarAnswer===current.answer?'Correct. '+current.correct:'Not quite. Correct answer: '+current.correct}</div>}</div>}
        {current.topics&&<div className="jam-card"><span className="pill gold">JAM Topic</span><h3>{displayTopic}</h3><button className="btn secondary" onClick={newJam}>New random topic</button></div>}
      </div>
      <div className={'mic-orb '+(recording?'recording':'')}><div><span>{recording?'●':'🎙'}</span><small>{recording?(listening?'Listening & recording':'Recording'):'Ready to speak'}</small></div></div>
      <div className="stage-actions">{!recording?<button className="btn primary" onClick={startRecording}><Play size={17}/> Start speaking</button>:<button className="btn danger" onClick={stopRecording}>Stop recording</button>}<button className="btn secondary" onClick={reset}>Reset</button>{!recording&&<button className="btn secondary" disabled={saving} onClick={evaluate}>{saving?'Saving…':'Evaluate & save score'}</button>}</div>
      {audio&&<div className="recorded"><div><Check size={17}/><b>Your response is recorded</b><small>Play it back and check your clarity, pace and confidence.</small></div><audio controls src={audio}/></div>}
      {transcript&&<div className="transcript"><div><small>Speech transcript</small><p>{transcript}</p></div><span className="pill purple">{listening?'Live':'Captured'}</span></div>}
      {evaluation&&<div className="swar-evaluation"><div className="evaluation-head"><div><small>Latest evaluation</small><h3>{evaluation.score}% overall</h3></div><span className="pill green">Saved</span></div><div className="evaluation-grid"><div><b>{evaluation.fluencyScore}%</b><small>Fluency</small></div><div><b>{evaluation.grammarScore}%</b><small>Grammar</small></div><div><b>{evaluation.comprehensionScore}%</b><small>Comprehension</small></div></div><p><b>Strength:</b> {evaluation.feedback.strengths}</p><p><b>Improve:</b> {evaluation.feedback.improvements}</p><small>{evaluation.feedback.note}</small></div>}
      <div className="self-check"><div><small>Progress</small><h3>{completed} saved attempt{completed===1?'':'s'} for this module</h3></div><div className="check-grid"><label><input type="checkbox"/> Clear pronunciation</label><label><input type="checkbox"/> Good pace</label><label><input type="checkbox"/> Confident tone</label><label><input type="checkbox"/> Logical structure</label></div></div>
      <div className="communication-note"><CircleHelp size={17}/><p><b>Evaluation note:</b> Scores use task accuracy and browser speech transcript. Pronunciation quality is not claimed unless a future audio-analysis service is connected.</p></div>
    </section></div></main>;
}

function Admin({navigate,user}) {
  const [tab,setTab]=useState('overview'); const [metrics,setMetrics]=useState(null); const [schedules,setSchedules]=useState([]); const [tests,setTests]=useState([]); const [error,setError]=useState('');
  const [form,setForm]=useState({audience:'global',email:'',testId:'swar-1',startAt:'',endAt:'',password:'',label:'Company Assessment'}); const [created,setCreated]=useState(null); const [busy,setBusy]=useState(false);
  const [attendance,setAttendance]=useState(null); const [selectedSchedule,setSelectedSchedule]=useState(''); const [uploading,setUploading]=useState(false);
  const load=async()=>{try{setError('');const [m,t,s]=await Promise.all([api('/admin/metrics'),api('/admin/tests'),api('/admin/schedules')]);setMetrics(m);setTests(t.tests||[]);setSchedules(s.schedules||[])}catch(e){setError(e.message)}};
  useEffect(()=>{if(user?.role==='admin'){load();const id=setInterval(load,15000);return()=>clearInterval(id)}},[user]);
  if(!user) return <main className="container page-pad"><Empty icon={<ShieldCheck/>} title="Admin sign-in required" text="Sign in with the configured admin account." action={()=>navigate('login')} actionText="Sign in"/></main>;
  if(user.role!=='admin') return <main className="container page-pad"><Empty icon={<ShieldCheck/>} title="Admin access required" text="Your account does not have administrator access." action={()=>navigate('home')} actionText="Go home"/></main>;
  if(error) return <main className="container page-pad"><Empty icon={<ShieldCheck/>} title="Admin access unavailable" text={error} action={load} actionText="Retry"/></main>;
  const submitSchedule=async e=>{e.preventDefault();setBusy(true);setCreated(null);try{const d=await api('/admin/schedules',{method:'POST',body:JSON.stringify(form)});setCreated(d);setForm({...form,email:'',password:'',audience:'global',testId:'swar-1'});await load()}catch(e){setError(e.message)}finally{setBusy(false)}};
  const remove=async id=>{if(!confirm('Remove this assessment access?'))return;try{await api('/admin/schedules/'+id,{method:'DELETE'});load()}catch(e){setError(e.message)}};
  const showAttendance=async id=>{try{setSelectedSchedule(id);setAttendance(await api('/admin/schedules/'+id+'/non-attendees'))}catch(e){setError(e.message)}};
  const uploadRoster=async e=>{const file=e.target.files?.[0];if(!file||!selectedSchedule)return;setUploading(true);try{const raw=await file.text();const lines=raw.split(String.fromCharCode(10)).map(x=>x.replace(String.fromCharCode(13),'')).filter(Boolean);const rows=lines.map((line,i)=>{const cells=line.split(',').map(x=>x.trim().replace(/^"|"$/g,''));if(i===0&&/email/i.test(cells[1]||cells[0]))return null;return {name:cells[0],email:cells[1]||cells[0]}}).filter(Boolean);await api('/admin/schedules/'+selectedSchedule+'/roster',{method:'POST',body:JSON.stringify({students:rows})});await showAttendance(selectedSchedule);alert(rows.length+' students imported.')}catch(e){setError(e.message)}finally{setUploading(false);e.target.value=''}};

  const active=metrics?.activeUsers||0;
  return <main className="container page-pad"><div className="admin-head"><div><div className="kicker">Company assessment operations</div><h1>Admin control center.</h1><p>Monitor students, schedule assessments, review results and track attendance.</p></div><span className="admin-badge"><ShieldCheck size={16}/> Protected admin</span></div>
    <div className="stats-grid">{[['Total users',metrics?.totalUsers||0,'Registered',<UserRound/>],['Active now',active,'Seen in last 5 min',<Zap/>],['Attempts',metrics?.totalAttempts||0,'All time',<BarChart3/>],['Scheduled',metrics?.scheduledTests||schedules.length,'Active assignments',<Calendar/>]].map(([a,b,c,i])=><div className="metric" key={a}><span>{i}</span><small>{a}</small><strong>{b}</strong><em>{c}</em></div>)}</div>
    <div className="admin-tabs">{['overview','users','attempts','schedules','attendance'].map(x=><button className={tab===x?'selected':''} key={x} onClick={()=>setTab(x)}>{x[0].toUpperCase()+x.slice(1)}</button>)}</div>
    {tab==='schedules'&&<section className="dashboard-grid"><section className="panel"><div className="panel-head"><div><small>Company-style access</small><h3>Create scheduled assessment</h3></div></div>
      <form className="admin-form" onSubmit={submitSchedule}><label><span><UserRound size={14}/> Who can take it?</span><select value={form.audience} onChange={e=>setForm({...form,audience:e.target.value})}><option value="global">All registered users</option><option value="individual">One candidate</option></select></label>{form.audience==='individual'&&<label><span><Mail size={14}/> Candidate email</span><input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="candidate@company.com"/></label>}<label><span>Assessment</span><select required value={form.testId} onChange={e=>setForm({...form,testId:e.target.value})}><option value="">Select a test</option>{tests.map(t=><option key={t.testId} value={t.testId}>{t.title}</option>)}</select></label><label><span><Calendar size={14}/> Start time</span><input required type="datetime-local" value={form.startAt} onChange={e=>setForm({...form,startAt:e.target.value})}/></label><label><span><Calendar size={14}/> End time</span><input required type="datetime-local" value={form.endAt} onChange={e=>setForm({...form,endAt:e.target.value})}/></label><label><span><KeyRound size={14}/> Assessment password</span><input required minLength={6} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Company access password"/></label><label><span>Label</span><input value={form.label} onChange={e=>setForm({...form,label:e.target.value})}/></label><button className="btn primary full" disabled={busy}>{busy?'Creating…':'Create assessment access'}</button></form>
      {created&&<div className="success-banner"><Check size={18}/><span>Access created for <b>{created.schedule.audience==='global'?'all registered users':created.schedule.email}</b>. Password: <strong>{created.accessPassword}</strong></span></div>}
    </section><section className="panel"><div className="panel-head"><div><small>Assignments</small><h3>Scheduled assessments</h3></div><button className="text-btn" onClick={load}>Refresh</button></div>{schedules.map(s=><div className="admin-row" key={s._id}><span className="rank"><Calendar size={15}/></span><div><b>{s.audience==='global'?'All registered users':s.email}</b><small>{s.label} · {s.test?.title||s.testId}</small><small>{new Date(s.startAt).toLocaleString()} → {new Date(s.endAt).toLocaleString()}</small></div><button className="text-btn" onClick={()=>showAttendance(s._id)}>Attendance</button><button className="icon-btn" title="Remove access" onClick={()=>remove(s._id)}><Trash2 size={16}/></button></div>)}{!schedules.length&&<p className="muted-copy">No scheduled assessments yet.</p>}</section></section>}
    {tab==='attendance'&&<section className="panel"><div className="panel-head"><div><small>Attendance control</small><h3>Scheduled assessment attendance</h3><p className="muted-copy">Global assessments use all registered users unless a roster is uploaded. Attendance is based on a recorded submission during the scheduled window.</p></div></div><div className="filter-row"><select value={selectedSchedule} onChange={async e=>{setSelectedSchedule(e.target.value);if(e.target.value)showAttendance(e.target.value)}}><option value="">Select scheduled assessment</option>{schedules.map(s=><option key={s._id} value={s._id}>{s.test?.title||s.testId} · {s.audience==='global'?'All users':s.email}</option>)}</select>{selectedSchedule&&<label className="btn secondary upload-btn"><Upload size={16}/>{uploading?'Uploading…':'Upload student CSV'}<input type="file" accept=".csv,text/csv" onChange={uploadRoster}/></label>}</div>{attendance&&<><div className="stats-grid attendance-stats">{[['Assigned',attendance.assignedCount],['Attended',attendance.attendedCount],['Not attended',attendance.notAttended.length]].map(([x,y])=><div className="metric" key={x}><small>{x}</small><strong>{y}</strong></div>)}</div>{attendance.notAttended.map((s,i)=><div className="admin-row" key={s.email}><span className="rank">{i+1}</span><div><b>{s.name}</b><small>{s.email}</small></div><span className="pill gold">Not attended</span></div>)}{!attendance.notAttended.length&&<div className="success-banner"><Check size={18}/><span>All assigned students have a recorded submission.</span></div>}</>}</section>}
    {(tab==='overview'||tab==='users'||tab==='attempts')&&<section className="panel admin-table"><div className="panel-head"><div><small>Live data</small><h3>{tab==='users'?'Student directory':tab==='attempts'?'Assessment results':'Platform analytics'}</h3></div><button className="text-btn" onClick={load}><RefreshCw size={15}/> Refresh</button></div>
      {tab==='overview'&&<><div className="success-banner"><Check size={18}/><span><b>{active}</b> students active in the last 5 minutes. Analytics refresh every 15 seconds.</span></div><div className="stats-grid"><div className="metric"><small>Total logins</small><strong>{(metrics?.students||[]).reduce((n,u)=>n+(u.loginCount||0),0)}</strong><em>Across registered accounts</em></div><div className="metric"><small>Recent average</small><strong>{metrics?.recentAttempts?.length?Math.round(metrics.recentAttempts.reduce((n,a)=>n+(a.percentage||0),0)/metrics.recentAttempts.length)+'%':'—'}</strong><em>Recent submissions</em></div></div></>}
      {tab==='users'&&(metrics?.students||[]).map((u,i)=><div className="admin-row" key={u._id}><span className="rank">{i+1}</span><div><b>{u.name}</b><small>{u.email} · {u.role} · Login count: {u.loginCount||0}</small></div><strong>{u.lastSeenAt?new Date(u.lastSeenAt).toLocaleString():'Never'}</strong></div>)}
      {tab==='attempts'&&(metrics?.recentAttempts||[]).map((a,i)=><div className="admin-row" key={a._id}><span className="rank">{i+1}</span><div><b>{a.user?.name||'Student'} · {a.testId}</b><small>{a.user?.email||''} · {a.completedAt?new Date(a.completedAt).toLocaleString():''}</small></div><strong>{a.percentage}%</strong></div>)}
    </section>}
  </main>;
}

function ScheduledTests({user,navigate,startScheduled}) {
  const [items,setItems]=useState([]); const [passwords,setPasswords]=useState({}); const [error,setError]=useState(''); const [busy,setBusy]=useState('');
  const load=async()=>{try{setError('');const d=await api('/my/scheduled-tests');setItems(d.tests||[])}catch(e){setError(e.message)}};
  useEffect(()=>{if(user)load()},[user]);
  if(!user)return <main className="container page-pad"><Empty icon={<KeyRound/>} title="Sign in to view assessments" text="Company-assigned assessments are linked to your registered email." action={()=>navigate('login')} actionText="Sign in"/></main>;
  const start=async item=>{try{setBusy(item._id);const d=await api('/scheduled-tests/'+item._id+'/verify',{method:'POST',body:JSON.stringify({password:passwords[item._id]||''})});startScheduled(d)}catch(e){setError(e.message)}finally{setBusy('')}};
  return <main className="container page-pad"><div className="page-hero"><div><div className="kicker">Company assessments</div><h1>Your scheduled tests.</h1><p>Use the assessment password provided by the company or placement team during the allowed time window.</p></div></div>{error&&<div className="error-text">{error}</div>}{items.length?<div className="test-grid">{items.map(item=><article className="test-card" key={item._id}><div className="test-card-top"><span className="pill purple">Scheduled</span><Calendar size={17}/></div><span className="test-category">{item.label} · {item.testId}</span><h3>{item.test?.title||'Assessment'}</h3><div className="test-info"><span><Calendar size={15}/>{new Date(item.startAt).toLocaleString()}</span><span>Until {new Date(item.endAt).toLocaleString()}</span></div><div className="auth-inline"><KeyRound size={16}/><input type="password" placeholder="Assessment password" value={passwords[item._id]||''} onChange={e=>setPasswords({...passwords,[item._id]:e.target.value})}/><button className="btn primary" disabled={busy===item._id} onClick={()=>start(item)}>{busy===item._id?'Checking…':'Enter'}</button></div></article>)}</div>:<Empty icon={<Calendar/>} title="No assigned assessments" text="If your company has scheduled a test, make sure you are signed in with the same email they used." action={()=>navigate('home')} actionText="Go home"/>}</main>;
}


function Auth({navigate,setUser}) {
  const [mode,setMode]=useState('login'); const [name,setName]=useState(''); const [identifier,setIdentifier]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');
    try{
      const body=mode==='register'?{name,email:identifier,password}:{identifier,password};
      const data=await api('/auth/'+mode,{method:'POST',body:JSON.stringify(body)});
      localStorage.setItem('sb-token',data.token);localStorage.setItem('sb-user',JSON.stringify(data.user));setUser(data.user);
      navigate(data.user.role==='admin'?'admin':'dashboard');
    }catch(err){setError(err.message)}finally{setBusy(false)}
  };
  return <main className="container page-pad"><div className="auth-card panel">
    <div className="kicker">SpeakingBot account</div>
    <h1>{mode==='login'?'Welcome back':'Create your account'}</h1>
    <p>{mode==='login'?'Sign in with your email or company admin username.':'Create an account to track your practice.'}</p>
    <form onSubmit={submit}>
      {mode==='register'&&<input required autoComplete="name" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)}/>}
      <input required autoComplete={mode==='login'?'username':'email'} type={mode==='login'?'text':'email'} placeholder={mode==='login'?'Email or admin username':'Email'} value={identifier} onChange={e=>setIdentifier(e.target.value)}/>
      <input required minLength={mode==='register'?8:1} autoComplete={mode==='login'?'current-password':'new-password'} type="password" placeholder={mode==='register'?'Password (8+ characters)':'Password'} value={password} onChange={e=>setPassword(e.target.value)}/>
      {error&&<div className="error-text">{error}</div>}
      <button className="btn primary full" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':'Create account'}</button>
    </form>
    <button className="text-btn" onClick={()=>{setMode(mode==='login'?'register':'login');setIdentifier('');setPassword('');setError('')}}>{mode==='login'?'Need an account? Register':'Already registered? Sign in'}</button>
  </div></main>;
}

function Profile({navigate,user,setUser}) {
  const [stats,setStats]=useState({attempts:[],count:0,avg:0});
  useEffect(()=>{api('/my/attempts').then(d=>{const a=d.attempts||[];setStats({attempts:a,count:a.length,avg:a.length?Math.round(a.reduce((n,x)=>n+(x.percentage||0),0)/a.length):0})}).catch(()=>{})},[]);
  const signOut=()=>{localStorage.removeItem('sb-token');localStorage.removeItem('sb-user');setUser(null);navigate('home')};
  return <main className="container page-pad"><div className="profile-card"><div className="profile-cover"/><div className="profile-content"><span className="profile-avatar">{(user?.name||'Student').slice(0,2).toUpperCase()}</span><div className="profile-title"><div><div className="kicker">Account profile</div><h1>{user?.name||'Student'}</h1><p>{user?.role==='admin'?'Administrator':'Placement learner'} · SpeakingBot member</p></div><div className="profile-actions"><button className="btn secondary" onClick={()=>navigate('settings')}><Settings size={16}/> Settings</button><button className="btn danger" onClick={signOut}><LogOut size={16}/> Sign out</button></div></div><div className="profile-grid"><div><small>Full name</small><b>{user?.name||'Not available'}</b></div><div><small>Email</small><b>{user?.email||'Not available'}</b></div><div><small>Account type</small><b>{user?.role==='admin'?'Admin':'Student'}</b></div><div><small>Tests completed</small><b>{stats.count}</b></div><div><small>Average score</small><b>{stats.avg}%</b></div><div><small>Login count</small><b>{user?.loginCount||0}</b></div></div></div></div><div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><small>Recent performance</small><h3>Your latest results</h3></div><button className="text-btn" onClick={()=>navigate('dashboard')}>Open dashboard</button></div>{stats.attempts.slice(0,5).map(a=><div className="admin-row" key={a._id}><div><b>{a.testId}</b><small>{a.completedAt?new Date(a.completedAt).toLocaleString():''}</small></div><strong>{a.percentage}%</strong></div>)}{!stats.attempts.length&&<p className="muted-copy">Complete your first test to see results here.</p>}</section><section className="panel"><div className="panel-head"><div><small>Account controls</small><h3>Quick settings</h3></div></div><button className="setting-row setting-button" onClick={()=>navigate('settings')}><div><b>Notification settings</b><small>Scheduled assessment alerts and practice reminders</small></div><ChevronRight size={17}/></button><button className="setting-row setting-button" onClick={()=>navigate('settings')}><div><b>Appearance</b><small>Choose light or dark mode</small></div><ChevronRight size={17}/></button></section></div></main>;
}

function SettingsPage({navigate,user,setUser,dark,setDark}) {
  const [notifications,setNotifications]=useState(()=>localStorage.getItem('sb-notifications')!=='off');
  const [reminders,setReminders]=useState(()=>localStorage.getItem('sb-reminders')!=='off');
  const toggle=(key,value)=>{localStorage.setItem(key,value?'on':'off'); if(key==='sb-notifications')setNotifications(value);else setReminders(value)};
  if(!user)return <main className="container page-pad"><Empty icon={<Settings/>} title="Sign in required" text="Sign in to manage account settings." action={()=>navigate('login')} actionText="Sign in"/></main>;
  return <main className="container page-pad"><div className="page-hero"><div><div className="kicker">Account settings</div><h1>Control your SpeakingBot experience.</h1><p>Manage notifications, appearance and your account session.</p></div></div><div className="settings-grid"><section className="panel"><div className="panel-head"><div><small>Notifications</small><h3>Alerts</h3></div><Bell size={20}/></div><div className="setting-row"><div><b>Scheduled assessment popup</b><small>Show a popup when an assigned assessment becomes active.</small></div><label className="switch"><input type="checkbox" checked={notifications} onChange={e=>toggle('sb-notifications',e.target.checked)}/><span/></label></div><div className="setting-row"><div><b>Practice reminders</b><small>Keep practice reminders enabled on this browser.</small></div><label className="switch"><input type="checkbox" checked={reminders} onChange={e=>toggle('sb-reminders',e.target.checked)}/><span/></label></div></section><section className="panel"><div className="panel-head"><div><small>Appearance</small><h3>Theme</h3></div><Sun size={20}/></div><div className="setting-row"><div><b>{dark?'Dark':'Light'} mode</b><small>Change the interface theme.</small></div><button className="btn secondary" onClick={()=>setDark(!dark)}>{dark?'Use light':'Use dark'}</button></div></section><section className="panel"><div className="panel-head"><div><small>Security</small><h3>Session</h3></div><ShieldCheck size={20}/></div><div className="setting-row"><div><b>Signed in as</b><small>{user.email}</small></div><button className="btn secondary" onClick={()=>{localStorage.removeItem('sb-token');localStorage.removeItem('sb-user');setUser(null);navigate('home')}}><LogOut size={16}/> Sign out</button></div></section></div></main>;
}

function ScheduledPopup({item,close,enter}) {
  return <div className="modal-backdrop"><div className="modal scheduled-popup"><button className="modal-close" onClick={close}><X size={18}/></button><span className="popup-icon"><Bell size={24}/></span><div className="kicker">Assessment is live</div><h2>{item.test?.title||'Scheduled assessment'}</h2><p>{item.label||'Company assessment'} is now available. The assessment will automatically close at {new Date(item.endAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}.</p><div className="modal-actions"><button className="btn secondary" onClick={close}>Later</button><button className="btn primary" onClick={enter}>Open assessment <ArrowRight size={16}/></button></div></div></div>;
}

function Footer({navigate}) { return <footer><div className="container footer-grid"><div><button className="brand"><span className="brand-mark"><BrainCircuit size={20}/></span><span>Speaking<span>Bot</span></span></button><p>Practice with purpose. Learn from every attempt.</p></div><div><b>Practice</b><button onClick={()=>navigate('tests')}>All tests</button><button onClick={()=>navigate('dashboard')}>Dashboard</button><button onClick={()=>navigate('bookmarks')}>Bookmarks</button></div><div><b>Platform</b><button>About</button><button>Pricing</button><button>Help center</button></div><div><b>Built for</b><span>Students</span><span>Placement prep</span><span>Technical interviews</span></div></div><div className="footer-bottom container">© 2026 SpeakingBot · Built as an original practice platform</div></footer> }

function Empty({icon,title,text,action,actionText='Browse tests'}) { return <div className="empty"><span>{icon}</span><h3>{title}</h3><p>{text}</p>{action&&<button className="btn primary" onClick={action}>{actionText}<ArrowRight size={16}/></button>}</div> }
function Modal({title,close,children}) { return <div className="modal-backdrop" onClick={close}><div className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={close}><X size={18}/></button><h2>{title}</h2>{children}</div></div> }

export default App;
