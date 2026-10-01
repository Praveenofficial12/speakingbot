# SpeakingBot — Practice & Assessment Platform

SpeakingBot is a full-stack practice and assessment portal built with React/Vite, Node/Express and Supabase PostgreSQL.

## Production features
- Aptitude, technical, reasoning, verbal, company and AI/ML practice tests
- Speaking Practice and Communication/SWAR Practice Lab
- Browser microphone recording and speech-transcript practice
- Secure JWT sessions with bcrypt password hashing
- Persistent Supabase PostgreSQL database
- Server-side scoring and attempt history
- Scheduled company assessments with candidate email + access password
- Protected admin control center and active-user monitoring
- Admin test/question/schedule management
- Responsive desktop/mobile interface
- Helmet security headers, compression and rate limiting

## Stack
- Frontend: React 18 + Vite
- Backend: Node.js + Express
- Database: Supabase PostgreSQL
- Authentication: application JWT + bcrypt
- Deployment: Render

## Production database
The backend connects to Supabase through its Data API using a server-only application secret header. Database tables are protected with RLS and the backend is the only component that receives the application secret. Supabase's publishable key is not a database password and may be used with appropriate RLS controls.

## Local setup
1. Run `npm install`.
2. Copy `server/.env.example` to `server/.env`.
3. Fill in the Supabase and authentication environment variables.
4. Run `npm run dev` for frontend development.
5. Run `npm start` for the production API/frontend server.

Never commit real secrets.
