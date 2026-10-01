# SpeakingBot — Practice & Assessment Platform

SpeakingBot is a full-stack practice and assessment portal built with React/Vite and Node/Express.

## Features
- Timed aptitude, technical, reasoning, verbal and company-style tests
- Speaking Practice and Communication/SWAR Practice Lab
- Browser microphone recording and speech-transcript practice
- Student registration and login
- Secure JWT authentication with bcrypt password hashing
- Persistent PostgreSQL storage
- Server-side test scoring
- Attempt history and dashboard data
- Scheduled company assessments with candidate email + access password
- Protected admin control center
- Active-user monitoring
- Admin test/question management
- Security headers, compression and rate limiting
- Responsive desktop/mobile interface
- Render deployment with managed PostgreSQL

## Local setup
1. Run `npm install`.
2. Create `server/.env` from `server/.env.example`.
3. Set `DATABASE_URL` to a PostgreSQL database.
4. Set a strong `JWT_SECRET`.
5. Set admin username/email/password.
6. Run `npm run dev` for frontend development.
7. Run `npm start` for the API and production frontend.

## Production
Render provisions PostgreSQL and injects its private connection string through `DATABASE_URL`. The Node API automatically creates the required tables and indexes on startup and seeds a small demo question set when needed.

Never commit real secrets.

## Architecture
- Frontend: React 18 + Vite
- Backend: Node.js + Express
- Authentication: JWT + bcrypt
- Database: PostgreSQL
- Deployment: Render
