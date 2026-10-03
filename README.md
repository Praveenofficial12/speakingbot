# 🎙️ SpeakingBot

<p align="center">
  <strong>AI-powered speaking practice, assessment, and interview preparation platform</strong>
</p>

<p align="center">
  Practice • Assess • Track • Improve
</p>

<p align="center">
  <a href="https://github.com/Praveenofficial12/speakingbot">GitHub</a>
  •
  <a href="https://github.com/Praveenofficial12/speakingbot/issues">Issues</a>
</p>

---

## 🚀 What is SpeakingBot?

**SpeakingBot** is a full-stack learning and assessment platform designed to help students prepare for aptitude tests, technical assessments, communication practice, speaking activities, and company-specific evaluations.

The platform combines a modern React interface with an Express backend and Supabase PostgreSQL database to provide authenticated practice, server-side assessment scoring, attempt history, scheduled assessments, and administrative management.

> **Think of SpeakingBot as a digital practice room:** students can practice independently, take assessments, review their progress, and build confidence before real interviews or placement tests.

---

## ✨ Key Features

### 🎯 Practice & Assessment
- 🧠 Aptitude practice
- 💻 Technical practice
- 🔎 Reasoning practice
- 📚 Verbal practice
- 🏢 Company-specific assessments
- 🤖 AI/ML practice
- 🗣️ Speaking Practice
- 🎤 Communication / SWAR Practice Lab
- 📝 Browser-based microphone recording and speech-transcript practice

### 📊 Assessment System
- Server-side scoring
- Persistent attempt history
- Scheduled company assessments
- Candidate email and access-password based assessment access
- Assessment cutoff based on schedules
- Structured practice and assessment workflows

### 🛡️ Authentication & Security
- JWT-based application sessions
- bcrypt password hashing
- Protected admin routes
- Admin control center
- Active-user monitoring
- Helmet security headers
- Compression
- API rate limiting
- Environment-based secret management

### 👨‍💼 Admin Control Center
Administrators can manage:
- Tests
- Questions
- Assessment schedules
- Candidate access
- Active-user monitoring
- Assessment administration

---

## 🧩 Technology Stack

| Layer | Technology |
|---|---|
| 🎨 Frontend | React 18 |
| ⚡ Build Tool | Vite |
| 🖥️ Backend | Node.js + Express |
| 🗄️ Database | Supabase PostgreSQL |
| 🔐 Authentication | JWT + bcrypt |
| 🛡️ Security | Helmet + Express Rate Limit |
| 🎤 Speech Practice | Browser microphone + speech transcript workflow |
| 📦 Icons | Lucide React |
| ☁️ Deployment | Render |

---

## 🏗️ Architecture

```text
                    ┌─────────────────────────┐
                    │       👩‍🎓 Student       │
                    │  Practice / Assessment  │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     ⚛️ React + Vite      │
                    │      Frontend UI         │
                    └────────────┬────────────┘
                                 │
                           HTTP / API
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   🟢 Node.js + Express   │
                    │   Auth • Scoring • API  │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   🟩 Supabase PostgreSQL │
                    │  Users • Tests • Results│
                    │      • Assessments       │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │      👨‍💼 Admin Panel      │
                    │ Tests • Questions •      │
                    │ Schedules • Monitoring   │
                    └─────────────────────────┘
```

---

## 🔄 How SpeakingBot Works

### 1️⃣ Student Authentication
Students sign in through the application and receive an authenticated application session.

### 2️⃣ Choose a Practice Area
Students can select aptitude, technical, reasoning, verbal, AI/ML, speaking, communication/SWAR, or company-oriented practice.

### 3️⃣ Practice & Submit
The student completes questions or speaking activities and submits the attempt.

### 4️⃣ Server-Side Evaluation
Assessment scoring is handled by the backend rather than relying only on the browser.

### 5️⃣ Save the Attempt
Results and attempt history are persisted in Supabase PostgreSQL.

### 6️⃣ Scheduled Assessments
For company assessments, administrators can configure schedules and candidate access details.

### 7️⃣ Administration
Authorized administrators can manage questions, tests, schedules, and active-user monitoring.

---

## 🎤 Speaking & Communication Practice

SpeakingBot also includes a dedicated communication practice experience.

Students can:

- Practice speaking prompts
- Use the browser microphone
- Work with speech-transcript based activities
- Improve fluency and confidence
- Practice communication before interviews and assessments

The goal is simple:

> **Speak → Practice → Review → Improve**

---

## 🗄️ Database & Security

SpeakingBot uses **Supabase PostgreSQL** for persistent application data.

The backend connects to Supabase through the Data API using a **server-only application secret**.

Security principles include:

- 🔒 Database access controlled through Row Level Security (RLS)
- 🔑 Server-side handling of the application database secret
- 🪪 JWT-based application authentication
- 🔐 bcrypt password hashing
- 🛡️ Helmet security headers
- 🚦 Rate limiting for API protection
- 🌱 Secrets stored through environment variables

### ⚠️ Important

Never commit real credentials, JWT secrets, database secrets, or administrator passwords to GitHub.

Use the provided environment template:

```text
server/.env.example
```

---

## 💻 Local Development

### Prerequisites

Make sure you have:

- Node.js
- npm
- A Supabase project
- Git

### 1. Clone the repository

```bash
git clone https://github.com/Praveenofficial12/speakingbot.git
cd speakingbot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp server/.env.example server/.env
```

Then configure your Supabase and authentication values.

Example structure:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
APP_DB_SECRET=your_server_database_secret
JWT_SECRET=your_jwt_secret
ADMIN_USERNAME=your_admin_username
ADMIN_EMAIL=your_admin_email
ADMIN_PASSWORD=your_admin_password
CLIENT_ORIGIN=http://localhost:5173
```

### 4. Start the frontend

```bash
npm run dev
```

### 5. Start the application server

```bash
npm start
```

---

## 📜 Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production frontend build |
| `npm run preview` | Preview the production frontend build |
| `npm run server` | Start the Node.js server |
| `npm start` | Start the production application server |

---

## ☁️ Deployment

SpeakingBot is designed to work with a Render-based deployment setup.

A typical production flow is:

```text
GitHub
   │
   ▼
Render
   │
   ├── Web Application
   │      ├── React / Vite
   │      └── Node / Express
   │
   └──────────────► Supabase PostgreSQL
```

For production deployment, configure the required environment variables in the hosting platform rather than committing them to the repository.

---

## 📁 Project Highlights

The repository follows a full-stack application approach with:

```text
speakingbot/
│
├── ⚛️ React frontend
├── ⚡ Vite configuration
├── 🟢 Express backend
├── 🗄️ Supabase integration
├── 🔐 Authentication & security
├── 📝 Practice & assessment workflows
├── 🎤 Speaking / communication practice
└── 👨‍💼 Administrative functionality
```

---

## 🎯 Project Goals

SpeakingBot is built around four main goals:

**1. Practice**  
Give students a single place to practice multiple placement-oriented skills.

**2. Assess**  
Provide structured tests and company-style assessments.

**3. Communicate**  
Help students improve speaking and communication skills.

**4. Improve**  
Maintain assessment history so students can learn from repeated practice.

---

## 🔮 Future Enhancement Ideas

Potential extensions include:

- 📈 Advanced student progress analytics
- 🎯 Personalized practice recommendations
- 🤖 AI-generated interview questions
- 🗣️ More advanced speaking evaluation
- 📊 Detailed performance dashboards
- 🏆 Streaks, achievements, and practice milestones
- 📱 Further mobile optimization
- 🔔 Automated assessment notifications

---

## 👨‍💻 Developer

**Praveen Kumar K**

B.Tech — Artificial Intelligence & Data Science

Interested in:

- Artificial Intelligence
- Machine Learning
- Full-Stack Development
- Frontend Development
- UI/UX Design
- Prompt Engineering

---

## ⭐ Support the Project

If you find SpeakingBot useful, consider giving the repository a ⭐ on GitHub.

Your feedback and suggestions are welcome through GitHub Issues.

---

<p align="center">
  <strong>🎙️ SpeakingBot — Practice today. Speak with confidence tomorrow.</strong>
</p>
