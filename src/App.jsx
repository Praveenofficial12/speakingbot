import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BarChart3, Bell, Bookmark, BookOpen, BrainCircuit, Check,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Code2, FileQuestion,
  Flame, Grid2X2, Home, LayoutDashboard, Menu, Moon, Play, Plus, Search,
  Settings, ShieldCheck, Sparkles, Sun, Target, Trophy, UserRound, X, Zap
} from 'lucide-react';

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
  ['Aptitude', 'Quantitative, DI and placement maths', '42 tests', '📐'],
  ['Technical', 'Java, Python, SQL, DBMS and coding', '68 tests', '💻'],
  ['Reasoning', 'Logic, puzzles and analytical thinking', '31 tests', '🧩'],
  ['Verbal', 'Grammar, vocabulary and communication', '25 tests', '🗣️'],
  ['Company Tests', 'Placement-style company assessments', '54 tests', '🏢'],
  ['AI & ML', 'Machine learning and AI fundamentals', '18 tests', '🤖']
];

function App() {
  const [page, setPage] = useState('home');
  const [dark, setDark] = useState(() => localStorage.getItem('sb-theme') === 'dark');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTest, setActiveTest] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [bookmarks, setBookmarks] = useState(() => JSON.parse(localStorage.getItem('sb-bookmarks') || '[]'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('sb-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    localStorage.setItem('sb-bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  const navigate = (next) => { setPage(next); setMobileOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const startTest = (test = TESTS[0]) => {
    setActiveTest(test);
    setAttempt({ index: 0, answers: {}, marked: [], visited: [1], started: Date.now(), seconds: test.duration * 60 });
    setPage('test');
  };

  const submitTest = (answers) => {
    const correct = QUESTIONS.filter(q => answers[q.id] === q.answer).length;
    const answered = Object.keys(answers).length;
    const result = {
      score: correct,
      max: QUESTIONS.length,
      percentage: Math.round((correct / QUESTIONS.length) * 100),
      correct,
      incorrect: answered - correct,
      skipped: QUESTIONS.length - answered,
      time: activeTest ? Math.max(1, Math.round((Date.now() - attempt.started) / 1000)) : 1,
      test: activeTest || TESTS[0]
    };
    setLastResult(result);
    setAttempt(null);
    setPage('result');
  };

  return (
    <div className="app">
      {page !== 'test' && <Header dark={dark} setDark={setDark} page={page} navigate={navigate} search={search} setSearch={setSearch} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />}
      {page === 'home' && <Home navigate={navigate} startTest={startTest} />}
      {page === 'tests' && <Tests navigate={navigate} startTest={startTest} search={search} />}
      {page === 'dashboard' && <Dashboard navigate={navigate} lastResult={lastResult} />}
      {page === 'test' && attempt && <TestEngine attempt={attempt} setAttempt={setAttempt} activeTest={activeTest} submitTest={submitTest} navigate={navigate} />}
      {page === 'result' && <Result result={lastResult} navigate={navigate} startTest={startTest} />}
      {page === 'bookmarks' && <Bookmarks bookmarks={bookmarks} setBookmarks={setBookmarks} navigate={navigate} />}
      {page === 'admin' && <Admin navigate={navigate} />}
      {page === 'profile' && <Profile navigate={navigate} />}
      {page === 'home' || page === 'tests' ? <Footer navigate={navigate} /> : null}
    </div>
  );
}

function Header({ dark, setDark, page, navigate, search, setSearch, mobileOpen, setMobileOpen }) {
  return (
    <header className="header">
      <div className="header-inner">
        <button className="brand" onClick={() => navigate('home')}><span className="brand-mark"><BrainCircuit size={20}/></span><span>Speaking<span>Bot</span></span></button>
        <nav className={mobileOpen ? 'nav open' : 'nav'}>
          {['home','tests','dashboard','bookmarks'].map(item =>
            <button key={item} className={page === item ? 'active' : ''} onClick={() => navigate(item)}>
              {item === 'home' ? 'Home' : item === 'tests' ? 'Practice Tests' : item === 'dashboard' ? 'Dashboard' : 'Bookmarks'}
            </button>
          )}
          <button onClick={() => navigate('admin')}>Admin</button>
        </nav>
        <div className="header-actions">
          <div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tests..." onKeyDown={e => e.key === 'Enter' && navigate('tests')} /></div>
          <button className="icon-btn" onClick={() => setDark(!dark)} title="Toggle theme">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
          <button className="profile-btn" onClick={() => navigate('profile')}><span className="avatar">PK</span><span className="hide-sm">Praveen</span></button>
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
      <div className="category-grid">{CATEGORIES.map(([name, desc, count, icon]) => <button className="category-card" key={name} onClick={() => navigate('tests')}><span className="category-icon">{icon}</span><div><h3>{name}</h3><p>{desc}</p><small>{count} <ArrowRight size={14}/></small></div></button>)}</div>
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
  const filtered=useMemo(()=>TESTS.filter(t => (filter==='All'||t.category===filter) && (!search||JSON.stringify(t).toLowerCase().includes(search.toLowerCase()))),[filter,search]);
  return <main className="container page-pad"><div className="page-hero"><div><div className="kicker">Practice library</div><h1>Choose your next challenge.</h1><p>Timed practice sets designed for placement preparation and technical interviews.</p></div><button className="btn primary" onClick={()=>startTest(filtered[0]||TESTS[0])}><Play size={17}/> Quick start</button></div>
    <div className="filter-row"><div className="filter-pills">{['All','Aptitude','Technical','Reasoning','Verbal'].map(x=><button className={filter===x?'selected':''} key={x} onClick={()=>setFilter(x)}>{x}</button>)}</div><span>{filtered.length} tests</span></div>
    <div className="test-grid large">{filtered.map(t=><TestCard key={t.id} test={t} onStart={startTest}/>)}</div>
    {!filtered.length && <Empty icon={<Search/>} title="No tests found" text="Try another search or category." action={()=>setFilter('All')}/>}
  </main>;
}

function Dashboard({navigate,lastResult}) {
  return <main className="container page-pad"><div className="dashboard-head"><div><div className="kicker">Good morning, Praveen</div><h1>Your practice dashboard.</h1><p>Keep your streak alive and turn weak areas into strengths.</p></div><button className="btn primary" onClick={()=>navigate('tests')}><Plus size={18}/> New practice</button></div>
    <div className="stats-grid">{[['Tests attempted','24','+4 this month',<BookOpen/>],['Average score','78%','+6.2% vs last month',<Target/>],['Accuracy','84.7%','+8.1% this month',<BarChart3/>],['Practice streak','7 days','Best: 14 days',<Flame/>]].map(([a,b,c,i])=><div className="metric" key={a}><span>{i}</span><small>{a}</small><strong>{b}</strong><em>{c}</em></div>)}</div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><small>Performance</small><h3>Score trend</h3></div><select><option>Last 30 days</option><option>Last 7 days</option></select></div><div className="big-chart">{[48,56,51,68,62,74,71,84,79,87].map((h,i)=><div key={i} className="chart-bar"><i style={{height:h+'%'}}/><small>{i+1}</small></div>)}</div></section><section className="panel"><div className="panel-head"><div><small>Topic mastery</small><h3>Where you stand</h3></div></div>{[['Java OOP',87],['SQL & DBMS',79],['Aptitude',74],['Logical Reasoning',68]].map(([x,v])=><div className="topic-row" key={x}><div><span>{x}</span><b>{v}%</b></div><div className="progress"><i style={{width:v+'%'}}/></div></div>)}</section></div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><small>Recent activity</small><h3>Latest attempts</h3></div><button className="text-btn" onClick={()=>navigate('tests')}>Practice more <ArrowRight size={15}/></button></div><div className="activity-list">{[['SQL & DBMS Interview Challenge','88%','Today'],['Java OOP Mastery Test','82%','Yesterday'],['Logical Reasoning — Fast Track','93%','Sep 28']].map(([x,v,d])=><div className="activity" key={x}><span className="activity-icon"><Check size={17}/></span><div><b>{x}</b><small>{d} · 15 questions</small></div><strong>{v}</strong></div>)}</div></section><section className="panel recommendation"><span className="rec-icon"><Sparkles/></span><small>Recommended for you</small><h3>Strengthen SQL JOINs</h3><p>Your recent accuracy in JOIN questions is 61%. A focused 10-question set can help.</p><button className="btn primary full" onClick={()=>navigate('tests')}>Practice weak area <ArrowRight size={16}/></button></section></div>
    {lastResult && <div className="success-banner"><Check size={18}/><span>Latest result: <b>{lastResult.percentage}%</b> in {lastResult.test.title}.</span><button onClick={()=>navigate('result')}>View result <ArrowRight size={15}/></button></div>}
  </main>;
}

function TestEngine({attempt,setAttempt,activeTest,submitTest,navigate}) {
  const [seconds,setSeconds]=useState(attempt.seconds);
  const [answers,setAnswers]=useState(attempt.answers);
  const [showSubmit,setShowSubmit]=useState(false);
  const q=QUESTIONS[attempt.index];
  useEffect(()=>{ const id=setInterval(()=>setSeconds(s=>s>0?s-1:0),1000); return()=>clearInterval(id)},[]);
  useEffect(()=>{ if(seconds===0) submitTest(answers); },[seconds]);
  const choose=(idx)=>{ const next={...answers,[q.id]:idx}; setAnswers(next); setAttempt({...attempt,answers:next}); };
  const go=(delta)=>{ const n=Math.max(0,Math.min(QUESTIONS.length-1,attempt.index+delta)); setAttempt({...attempt,index:n,visited:Array.from(new Set([...(attempt.visited||[]),QUESTIONS[n].id]))}); };
  const mark=()=>setAttempt({...attempt,marked:attempt.marked.includes(q.id)?attempt.marked.filter(x=>x!==q.id):[...attempt.marked,q.id]});
  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  return <div className="exam-page"><header className="exam-header"><button className="brand" onClick={()=>navigate('home')}><span className="brand-mark"><BrainCircuit size={20}/></span><span>Speaking<span>Bot</span></span></button><div className="exam-name">{activeTest?.title}</div><div className={'timer '+(seconds<120?'danger':'')}><Clock3 size={17}/>{fmt(seconds)}</div><button className="btn danger-btn" onClick={()=>setShowSubmit(true)}>Submit test</button></header>
    <div className="exam-layout"><aside className="question-nav"><div className="nav-title"><b>Questions</b><small>{Object.keys(answers).length}/{QUESTIONS.length} answered</small></div><div className="legend"><span><i className="answered"/>Answered</span><span><i className="review"/>Review</span></div><div className="palette">{QUESTIONS.map((x,i)=><button key={x.id} className={(i===attempt.index?'current ':'')+(answers[x.id]!==undefined?'answered ':'')+(attempt.marked.includes(x.id)?'review':'')} onClick={()=>setAttempt({...attempt,index:i})}>{i+1}</button>)}</div></aside>
    <section className="question-area"><div className="question-top"><span className="pill purple">{q.topic}</span><span>{q.difficulty}</span></div><div className="question-number">Question {attempt.index+1} <span>of {QUESTIONS.length}</span></div><h1>{q.text}</h1><div className="options">{q.options.map((o,i)=><button key={o} className={answers[q.id]===i?'selected':''} onClick={()=>choose(i)}><span>{String.fromCharCode(65+i)}</span>{o}{answers[q.id]===i&&<Check size={18}/>}</button>)}</div><div className="question-actions"><button className="text-btn" onClick={mark}><Bookmark size={16} fill={attempt.marked.includes(q.id)?'currentColor':'none'}/>{attempt.marked.includes(q.id)?'Marked for review':'Mark for review'}</button>{answers[q.id]!==undefined&&<button className="clear-btn" onClick={()=>{const n={...answers};delete n[q.id];setAnswers(n);setAttempt({...attempt,answers:n})}}>Clear answer</button>}</div><div className="exam-footer"><button className="btn secondary" disabled={attempt.index===0} onClick={()=>go(-1)}><ChevronLeft size={17}/> Previous</button><button className="btn primary" onClick={()=>attempt.index===QUESTIONS.length-1?setShowSubmit(true):go(1)}>{attempt.index===QUESTIONS.length-1?'Review & submit':'Next question'} <ChevronRight size={17}/></button></div></section></div>
    {showSubmit&&<Modal title="Submit your test?" close={()=>setShowSubmit(false)}><p>You have answered <b>{Object.keys(answers).length}</b> of {QUESTIONS.length} questions. Unanswered questions will be counted as skipped.</p><div className="submit-summary"><span>Answered <b>{Object.keys(answers).length}</b></span><span>Skipped <b>{QUESTIONS.length-Object.keys(answers).length}</b></span><span>Marked <b>{attempt.marked.length}</b></span></div><div className="modal-actions"><button className="btn secondary" onClick={()=>setShowSubmit(false)}>Keep practicing</button><button className="btn primary" onClick={()=>submitTest(answers)}>Submit now <ArrowRight size={16}/></button></div></Modal>}
  </div>;
}

function Result({result,navigate,startTest}) {
  const r=result||{score:4,max:5,percentage:80,correct:4,incorrect:1,skipped:0,time:312,test:TESTS[1]};
  return <main className="container page-pad"><div className="result-head"><button className="back-btn" onClick={()=>navigate('dashboard')}><ChevronLeft size={17}/> Dashboard</button><div className="kicker">Test completed</div><h1>Nice work, Praveen.</h1><p>Here is what your latest attempt tells you.</p></div>
    <div className="result-card"><div className="score-ring"><div><strong>{r.percentage}%</strong><span>Score</span></div></div><div className="result-main"><span className="pill green">Completed</span><h2>{r.test.title}</h2><p>Completed just now · {Math.floor(r.time/60)}m {r.time%60}s spent</p><div className="result-stats"><div><span className="correct-dot"><Check size={14}/></span><b>{r.correct}</b><small>Correct</small></div><div><span className="wrong-dot">×</span><b>{r.incorrect}</b><small>Incorrect</small></div><div><span className="skip-dot">—</span><b>{r.skipped}</b><small>Skipped</small></div></div></div></div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><small>Question review</small><h3>How you performed</h3></div></div>{QUESTIONS.map((q,i)=>{const correct=i<r.correct;return <div className="review-row" key={q.id}><span className={correct?'review-ok':'review-bad'}>{correct?<Check size={15}/>:'×'}</span><div><b>Question {i+1}</b><small>{q.topic} · {q.difficulty}</small></div><span>{correct?'Correct':'Review'}</span></div>})}</section><section className="panel recommendation"><span className="rec-icon"><Sparkles/></span><small>Next best step</small><h3>Keep the momentum.</h3><p>Review explanations for missed questions, then take another set from the same topic.</p><button className="btn primary full" onClick={()=>startTest(r.test)}>Retake test <ArrowRight size={16}/></button><button className="btn secondary full" onClick={()=>navigate('tests')}>Explore related tests</button></section></div>
  </main>;
}

function Bookmarks({bookmarks,setBookmarks,navigate}) {
  const items=QUESTIONS.filter(q=>bookmarks.includes(q.id));
  return <main className="container page-pad"><div className="page-hero"><div><div className="kicker">Saved for later</div><h1>Your bookmarks.</h1><p>Keep tricky questions close so you can revisit them when you practice.</p></div><button className="btn primary" onClick={()=>navigate('tests')}>Find more questions <ArrowRight size={17}/></button></div>{items.length?<div className="bookmark-list">{items.map(q=><div className="bookmark-card" key={q.id}><span className="category-icon small"><Bookmark size={18}/></span><div><span className="test-category">{q.topic}</span><h3>{q.text}</h3><p>{q.explanation}</p></div><button className="icon-btn" onClick={()=>setBookmarks(bookmarks.filter(id=>id!==q.id))}><X size={17}/></button></div>)}</div>:<Empty icon={<Bookmark/>} title="No bookmarks yet" text="Save questions while practicing to build your personal revision set." action={()=>navigate('tests')} actionText="Browse tests"/>}</main>;
}

function Admin({navigate}) {
  const [tab,setTab]=useState('overview');
  return <main className="container page-pad"><div className="admin-head"><div><div className="kicker">Content studio</div><h1>Admin workspace.</h1><p>Manage tests, questions and student performance from one place.</p></div><span className="admin-badge"><ShieldCheck size={16}/> Admin mode</span></div><div className="admin-tabs">{['overview','tests','questions','users'].map(x=><button className={tab===x?'selected':''} key={x} onClick={()=>setTab(x)}>{x[0].toUpperCase()+x.slice(1)}</button>)}</div>{tab==='overview'?<><div className="stats-grid">{[['Total users','2,481','+12.4%',<UserRound/>],['Published tests','214','+18',<BookOpen/>],['Questions','6,842','+312',<FileQuestion/>],['Attempts','18,920','+9.7%',<BarChart3/>]].map(([a,b,c,i])=><div className="metric" key={a}><span>{i}</span><small>{a}</small><strong>{b}</strong><em>{c} this month</em></div>)}</div><div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><small>Most popular</small><h3>Tests by attempts</h3></div><button className="text-btn">Export <ArrowRight size={15}/></button></div>{TESTS.map((t,i)=><div className="admin-row" key={t.id}><span className="rank">{i+1}</span><div><b>{t.title}</b><small>{t.category} · {t.difficulty}</small></div><strong>{t.attempts.toLocaleString()}</strong></div>)}</section><section className="panel"><div className="panel-head"><div><small>Quick actions</small><h3>Content management</h3></div></div><div className="quick-actions">{[['Create test',<Plus/>],['Add question',<FileQuestion/>],['Import question bank',<ArrowRight/>],['Manage users',<UserRound/>]].map(([x,i])=><button key={x} onClick={()=>setTab(x==='Manage users'?'users':x==='Add question'?'questions':'tests')}><span>{i}</span><b>{x}</b><ChevronRight size={16}/></button>)}</div></section></div></>:<section className="panel admin-table"><div className="panel-head"><div><small>{tab}</small><h3>{tab==='tests'?'Test library':tab==='questions'?'Question bank':'User directory'}</h3></div><button className="btn primary"><Plus size={16}/> Add new</button></div>{Array.from({length:6},(_,i)=><div className="admin-row" key={i}><span className="rank">{i+1}</span><div><b>{tab==='questions'?QUESTIONS[i%QUESTIONS.length].text:tab==='users'?['Praveen Kumar','Arun Raj','Divya S','Karthik M','Nisha P','Rahul V'][i]:TESTS[i%TESTS.length].title}</b><small>{tab==='users'?'Student · Active':tab==='questions'?'Multiple choice · Published': 'Published · '+(20+i)+' questions'}</small></div><button className="icon-btn"><Settings size={16}/></button></div>)}</section>}</main>;
}

function Profile({navigate}) {
  return <main className="container page-pad"><div className="profile-card"><div className="profile-cover"/><div className="profile-content"><span className="profile-avatar">PK</span><div className="profile-title"><div><h1>Praveen Kumar</h1><p>AI & Data Science · Placement learner</p></div><button className="btn secondary"><Settings size={16}/> Edit profile</button></div><div className="profile-grid"><div><small>Email</small><b>praveenkumark1204@gmail.com</b></div><div><small>Practice level</small><b>Intermediate</b></div><div><small>Tests completed</small><b>24</b></div><div><small>Current streak</small><b>7 days</b></div></div></div></div><div className="panel profile-preferences"><div className="panel-head"><div><small>Account</small><h3>Preferences</h3></div></div>{[['Notifications','Receive reminders and weekly progress summaries'],['Personalized recommendations','Use your performance to suggest practice topics'],['Public leaderboard','Show my display name on public rankings']].map(([x,y],i)=><div className="setting-row" key={x}><div><b>{x}</b><small>{y}</small></div><label className="switch"><input type="checkbox" defaultChecked={i<2}/><span/></label></div>)}</div></main>;
}

function Footer({navigate}) { return <footer><div className="container footer-grid"><div><button className="brand"><span className="brand-mark"><BrainCircuit size={20}/></span><span>Speaking<span>Bot</span></span></button><p>Practice with purpose. Learn from every attempt.</p></div><div><b>Practice</b><button onClick={()=>navigate('tests')}>All tests</button><button onClick={()=>navigate('dashboard')}>Dashboard</button><button onClick={()=>navigate('bookmarks')}>Bookmarks</button></div><div><b>Platform</b><button>About</button><button>Pricing</button><button>Help center</button></div><div><b>Built for</b><span>Students</span><span>Placement prep</span><span>Technical interviews</span></div></div><div className="footer-bottom container">© 2026 SpeakingBot · Built as an original practice platform</div></footer> }

function Empty({icon,title,text,action,actionText='Browse tests'}) { return <div className="empty"><span>{icon}</span><h3>{title}</h3><p>{text}</p>{action&&<button className="btn primary" onClick={action}>{actionText}<ArrowRight size={16}/></button>}</div> }
function Modal({title,close,children}) { return <div className="modal-backdrop" onClick={close}><div className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={close}><X size={18}/></button><h2>{title}</h2>{children}</div></div> }

export default App;
