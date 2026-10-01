# SpeakingBot API

Production API for authentication, attempts and admin monitoring.

## Setup
1. Create a MongoDB Atlas database named `speakingbot`.
2. Copy `server/.env.example` to `server/.env` and set the values.
3. Run `npm install`.
4. Run `npm run server`.

## 1,000-user design
The frontend should be served from a CDN/static host. Run the API behind a managed load balancer, use MongoDB Atlas with appropriate production capacity, and keep API instances stateless. The admin active-user metric uses a 5-minute DB-backed heartbeat, so presence survives process restarts and works across instances. For higher-scale multi-instance live presence/rate limiting, add Redis.

Never commit `.env` or credentials.

## Database collections
The API creates `users`, `tests`, `questions`, and `attempts` collections automatically through Mongoose. Test IDs are indexed, question lookups are indexed by test ID, users by email/role/activity, and attempts by user/test/date. Set `SEED_DEMO=true` only for an initial demo environment; production should load your real test bank through the admin API or a controlled import.

## Secure scoring
Student submissions are sent to `/api/attempts/submit`. The server loads the published questions and calculates the score before storing the attempt, so the browser cannot choose its own score.
