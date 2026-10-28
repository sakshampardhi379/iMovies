# IMovies - Movie ticket booking made simple

A full-stack MERN (MongoDB, Express, React, Node.js) app where users browse movies, pick a showtime, choose seats and book tickets. Admins manage movies and shows.

**Live demo:** _add your Vercel link here_
**Backend API:** _add your Render link here_

## Features
- Sign up and log in (passwords hashed with bcrypt, sessions with JWT)
- User and admin roles, with protected routes on the server and the client
- Browse movies, search by title, filter by genre
- Movie details with upcoming showtimes
- Seat selection grid. Booked seats are blocked, and the server uses one atomic database update so two people can never book the same seat
- Booking history and booking cancellation (cancelled seats become free again)
- Admin panel to add and delete movies and add shows

## Tech stack
React (Vite), React Router, Axios, Node.js, Express, MongoDB with Mongoose, JWT, bcryptjs

## Run locally
1. Install Node.js 16+ and MongoDB (or use a free MongoDB Atlas database).
2. Backend:
   ```
   cd server
   cp .env.example .env     # then edit the values
   npm install
   npm run dev
   ```
3. Frontend (new terminal):
   ```
   cd client
   cp .env.example .env
   npm install
   npm run dev
   ```
4. Open http://localhost:5173. Sample movies are added automatically the first time the server starts.
5. To get an admin account, set `ADMIN_EMAIL` in `server/.env`, then sign up with that email.

## API overview
| Method | Route | Access |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | Public |
| GET | /api/movies, /api/movies/:id | Public |
| POST, DELETE | /api/movies | Admin |
| POST | /api/shows | Admin |
| GET | /api/shows/:id | Public |
| POST | /api/bookings | Logged in |
| GET | /api/bookings/mine | Logged in |
| DELETE | /api/bookings/:id | Logged in (own bookings) |

## Future work
Real payment gateway, live seat updates with socket.io, notifications, API rate limiting, pagination, and more filters (theatre, location, date).
