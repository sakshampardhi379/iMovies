require('dotenv').config();
const express = require('express'), cors = require('cors'), mongoose = require('mongoose');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

// ---------- Models ----------
const { Schema, model } = mongoose, ref = (n) => ({ type: Schema.Types.ObjectId, ref: n });
const User = model('User', new Schema({ name: String, email: { type: String, unique: true }, password: String, role: { type: String, default: 'user' } }));
const Movie = model('Movie', new Schema({ title: String, genre: String, language: String, duration: Number, poster: String, description: String }));
const Show = model('Show', new Schema({ movie: ref('Movie'), theatre: String, time: Date, price: Number, booked: [String] }));
const Booking = model('Booking', new Schema({ user: ref('User'), show: ref('Show'), seats: [String], total: Number, status: { type: String, default: 'confirmed' } }, { timestamps: true }));

// ---------- Helpers ----------
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(500).json({ message: e.message }));
const bad = (res, message, code = 400) => res.status(code).json({ message });
const sign = (u) => ({ token: jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' }), user: { name: u.name, role: u.role } });
const auth = (role) => (req, res, next) => {
  try {
    req.user = jwt.verify((req.headers.authorization || '').split(' ')[1], process.env.JWT_SECRET);
    if (role && req.user.role !== role) return bad(res, 'Admins only', 403);
    next();
  } catch { bad(res, 'Please log in', 401); }
};

// ---------- Auth ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 6) return bad(res, 'Enter a name, a valid email and a password of 6+ characters');
  if (await User.findOne({ email })) return bad(res, 'This email is already registered');
  const role = email === process.env.ADMIN_EMAIL ? 'admin' : 'user';
  res.json(sign(await User.create({ name, email, role, password: await bcrypt.hash(password, 10) })));
}));
app.post('/api/auth/login', wrap(async (req, res) => {
  const u = await User.findOne({ email: req.body.email });
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password))) return bad(res, 'Wrong email or password', 401);
  res.json(sign(u));
}));

// ---------- Movies ----------
app.get('/api/movies', wrap(async (req, res) => {
  const { search, genre } = req.query, f = {};
  if (search) f.title = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (genre) f.genre = genre;
  res.json(await Movie.find(f).sort('-_id'));
}));
app.get('/api/movies/:id', wrap(async (req, res) => {
  const movie = await Movie.findById(req.params.id);
  if (!movie) return bad(res, 'Movie not found', 404);
  res.json({ movie, shows: await Show.find({ movie: movie._id, time: { $gte: new Date() } }).sort('time') });
}));
app.post('/api/movies', auth('admin'), wrap(async (req, res) => {
  if (!req.body.title) return bad(res, 'Title is required');
  res.json(await Movie.create(req.body));
}));
app.delete('/api/movies/:id', auth('admin'), wrap(async (req, res) => {
  await Movie.findByIdAndDelete(req.params.id); await Show.deleteMany({ movie: req.params.id }); res.json({ ok: true });
}));

// ---------- Shows ----------
app.post('/api/shows', auth('admin'), wrap(async (req, res) => {
  const { movie, theatre, time, price } = req.body;
  if (!movie || !theatre || !time || !price) return bad(res, 'Fill in movie, theatre, time and price');
  res.json(await Show.create({ movie, theatre, time, price }));
}));
app.get('/api/shows/:id', wrap(async (req, res) => {
  const s = await Show.findById(req.params.id).populate('movie');
  s ? res.json(s) : bad(res, 'Show not found', 404);
}));

// ---------- Bookings ----------
app.post('/api/bookings', auth(), wrap(async (req, res) => {
  const { show, seats } = req.body;
  if (!Array.isArray(seats) || !seats.length || seats.length > 8 || new Set(seats).size !== seats.length || !seats.every((s) => /^[A-E][1-8]$/.test(s)))
    return bad(res, 'Choose 1 to 8 valid seats');
  // One atomic update: it only succeeds if none of the seats are taken yet, so two people can never get the same seat.
  const s = await Show.findOneAndUpdate({ _id: show, booked: { $nin: seats } }, { $push: { booked: { $each: seats } } }, { new: true });
  if (!s) return bad(res, 'Some of these seats were just taken. Please pick other seats.', 409);
  res.json(await Booking.create({ user: req.user.id, show, seats, total: seats.length * s.price }));
}));
app.get('/api/bookings/mine', auth(), wrap(async (req, res) => {
  res.json(await Booking.find({ user: req.user.id }).sort('-createdAt').populate({ path: 'show', populate: 'movie' }));
}));
app.delete('/api/bookings/:id', auth(), wrap(async (req, res) => {
  const b = await Booking.findOne({ _id: req.params.id, user: req.user.id, status: 'confirmed' });
  if (!b) return bad(res, 'Booking not found', 404);
  await Show.updateOne({ _id: b.show }, { $pull: { booked: { $in: b.seats } } });
  b.status = 'cancelled'; await b.save(); res.json(b);
}));

app.get('/', (_, res) => res.send('IMovies API is running'));

// ---------- Start (adds sample movies the first time) ----------
async function seed() {
  if (await Movie.countDocuments()) return;
  const data = [
    ['Midnight Express', 'Thriller', 'English', 118, 'A train, a locked carriage and one night to find out who is lying.'],
    ['Laugh Riot', 'Comedy', 'Hindi', 132, 'Three friends try to run a wedding catering business with no money and no plan.'],
    ['Star Harbour', 'Sci-Fi', 'English', 141, 'A dock worker finds a ship that arrived from tomorrow.'],
    ['The Last Over', 'Drama', 'Hindi', 125, 'A small-town cricket coach gets one final chance to prove his team.'],
  ];
  for (const [title, genre, language, duration, description] of data) {
    const m = await Movie.create({ title, genre, language, duration, description });
    for (const [d, t, p] of [[1, 'PVR Bhopal - 6:30 PM', 220], [2, 'INOX Bhopal - 9:00 PM', 260]])
      await Show.create({ movie: m._id, theatre: t.split(' - ')[0], time: new Date(Date.now() + d * 864e5), price: p });
  }
}
mongoose.connect(process.env.MONGO_URI).then(async () => {
  await seed();
  app.listen(process.env.PORT || 5000, () => console.log('IMovies API running'));
}).catch((e) => console.error('Database connection failed:', e.message));
