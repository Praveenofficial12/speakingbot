# SpeakingBot — Practice & Assessment Platform

A scalable React/Vite practice-test portal with a Node/Express + MongoDB API.

## Features
- Timed practice tests with auto-submit
- Results, review, bookmarks and dashboard
- Student registration/login with JWT authentication
- Persistent test attempts
- Protected admin dashboard
- Live active-user monitoring using a 5-minute presence window
- Automatic admin refresh every 15 seconds
- Rate limiting, security headers and response compression
- API health endpoint
- Production single-service deployment configuration for Render

## Local setup
1. Run `npm install`.
2. Run `npm run dev` for the frontend.
3. Copy `server/.env.example` to `server/.env` and configure MongoDB Atlas, JWT and admin credentials.
4. Run `npm run server` for the API.
5. For separate frontend/API ports, set `VITE_API_URL=http://localhost:5000/api` in `.env`.

## Production
Run `npm run build`, then `npm start`. The API serves the Vite `dist` folder, allowing one Node service to host both frontend and backend.

Required production variables: `MONGO_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CLIENT_ORIGIN`.

## 1,000-user architecture
Serve the frontend through the host/CDN, run the Node API behind a managed load balancer, and use MongoDB Atlas with appropriate production capacity. The API is stateless and uses a connection pool. The admin presence metric is database-backed, so it survives process restarts and works across instances. If traffic grows further, add Redis for distributed rate limiting/presence and scale API instances horizontally.

Never commit real secrets.
