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
