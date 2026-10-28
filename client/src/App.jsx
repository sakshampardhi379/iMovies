import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import api from './api';

const getUser = () => JSON.parse(localStorage.getItem('user') || 'null');
const err = (e) => e.response?.data?.message || 'Something went wrong. Please try again.';
const bind = (o, set) => (k) => ({ value: o[k], onChange: (e) => set({ ...o, [k]: e.target.value }) });
const when = (t) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function Nav() {
  const u = getUser();
  return (
    <nav>
      <Link to="/" className="logo">IMovies</Link>
      <div>
        {u && <Link to="/bookings">My bookings</Link>}
        {u?.role === 'admin' && <Link to="/admin">Admin</Link>}
        {u ? <a onClick={() => { localStorage.clear(); window.location = '/login'; }}>Log out ({u.name})</a> : <Link to="/login">Log in</Link>}
      </div>
    </nav>
  );
}

function Auth() {
  const [reg, setReg] = useState(false), [f, setF] = useState({ name: '', email: '', password: '' }), [msg, setMsg] = useState('');
  const b = bind(f, setF);
  const go = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/' + (reg ? 'register' : 'login'), f);
      localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user)); window.location = '/';
    } catch (x) { setMsg(err(x)); }
  };
  return (
    <form className="panel narrow" onSubmit={go}>
      <h2>{reg ? 'Create your account' : 'Log in'}</h2>
      {reg && <input placeholder="Name" {...b('name')} />}
      <input placeholder="Email" {...b('email')} />
      <input type="password" placeholder="Password (6+ characters)" {...b('password')} />
      <button>{reg ? 'Sign up' : 'Log in'}</button>
      <p className="err">{msg}</p>
      <a onClick={() => setReg(!reg)}>{reg ? 'Already have an account? Log in' : 'New here? Create an account'}</a>
    </form>
  );
}

function Home() {
  const [movies, setMovies] = useState([]), [q, setQ] = useState(''), [g, setG] = useState('');
  useEffect(() => { api.get('/movies', { params: { search: q, genre: g } }).then((r) => setMovies(r.data)); }, [q, g]);
  return (
    <div>
      <h1>Now showing</h1>
      <div className="bar">
        <input placeholder="Search by title" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={g} onChange={(e) => setG(e.target.value)}>
          <option value="">All genres</option>
          {['Action', 'Drama', 'Comedy', 'Sci-Fi', 'Thriller'].map((x) => <option key={x}>{x}</option>)}
        </select>
      </div>
      <div className="grid">
        {movies.map((m) => (
          <Link key={m._id} to={'/movie/' + m._id} className="movie">
            <div className="poster" style={m.poster ? { backgroundImage: `url(${m.poster})` } : {}}>{!m.poster && m.title}</div>
            <h3>{m.title}</h3>
            <small>{m.genre}, {m.language}, {m.duration} min</small>
          </Link>
        ))}
      </div>
      {!movies.length && <p>No movies match your search. Try a different title or genre.</p>}
    </div>
  );
}

function Movie() {
  const { id } = useParams(), [d, setD] = useState(null);
  useEffect(() => { api.get('/movies/' + id).then((r) => setD(r.data)); }, [id]);
  if (!d) return <p>Loading...</p>;
  const { movie: m, shows } = d;
  return (
    <div className="panel">
      <h1>{m.title}</h1>
      <small>{m.genre}, {m.language}, {m.duration} min</small>
      <p>{m.description}</p>
      <h3>Pick a showtime</h3>
      {shows.map((s) => <Link key={s._id} className="show" to={'/book/' + s._id}><b>{s.theatre}</b> {when(s.time)} <span>Rs. {s.price}</span></Link>)}
      {!shows.length && <p>No upcoming shows for this movie yet.</p>}
    </div>
  );
}

const ROWS = 'ABCDE'.split(''), COLS = [1, 2, 3, 4, 5, 6, 7, 8];
function Book() {
  const { id } = useParams(), nav = useNavigate(), [s, setS] = useState(null), [sel, setSel] = useState([]), [msg, setMsg] = useState('');
  const load = () => api.get('/shows/' + id).then((r) => setS(r.data));
  useEffect(() => { load(); }, [id]);
  if (!s) return <p>Loading...</p>;
  const toggle = (x) => setSel(sel.includes(x) ? sel.filter((y) => y !== x) : [...sel, x]);
  const pay = async () => {
    if (!getUser()) return nav('/login');
    try { await api.post('/bookings', { show: id, seats: sel }); nav('/bookings'); }
    catch (e) { setMsg(err(e)); setSel([]); load(); }
  };
  return (
    <div className="panel">
      <h1>{s.movie.title}</h1>
      <p>{s.theatre}, {when(s.time)}</p>
      <div className="screen">Screen this way</div>
      {ROWS.map((r) => (
        <div className="row" key={r}>
          {COLS.map((c) => {
            const x = r + c, taken = s.booked.includes(x);
            return <button key={x} disabled={taken} className={'seat ' + (taken ? 'taken' : sel.includes(x) ? 'sel' : '')} onClick={() => toggle(x)}>{x}</button>;
          })}
        </div>
      ))}
      <p>Seats: {sel.join(', ') || 'none selected'}. Total: Rs. {sel.length * s.price}</p>
      <button disabled={!sel.length} onClick={pay}>Pay and book (demo payment)</button>
      <p className="err">{msg}</p>
    </div>
  );
}

function Bookings() {
  const [b, setB] = useState([]);
  const load = () => api.get('/bookings/mine').then((r) => setB(r.data));
  useEffect(() => { load(); }, []);
  const cancel = async (id) => { await api.delete('/bookings/' + id); load(); };
  return (
    <div>
      <h1>My bookings</h1>
      {b.map((x) => (
        <div className="panel" key={x._id}>
          <b>{x.show?.movie?.title}</b>, {x.show?.theatre}<br />
          {x.show && when(x.show.time)}<br />
          Seats {x.seats.join(', ')}. Rs. {x.total}. <span className={x.status}>{x.status}</span>
          {x.status === 'confirmed' && <button className="ghost" onClick={() => cancel(x._id)}>Cancel booking</button>}
        </div>
      ))}
      {!b.length && <p>You have no bookings yet. <Link to="/">Find a movie</Link></p>}
    </div>
  );
}

function Admin() {
  const [movies, setMovies] = useState([]), [msg, setMsg] = useState('');
  const [m, setM] = useState({ title: '', genre: 'Action', language: 'English', duration: 120, poster: '', description: '' });
  const [sh, setSh] = useState({ movie: '', theatre: '', time: '', price: 200 });
  const load = () => api.get('/movies').then((r) => setMovies(r.data));
  useEffect(() => { load(); }, []);
  const send = (url, body, ok) => async (e) => {
    e.preventDefault();
    try { await api.post(url, body); setMsg(ok); load(); } catch (x) { setMsg(err(x)); }
  };
  const bm = bind(m, setM), bs = bind(sh, setSh);
  return (
    <div>
      <h1>Admin panel</h1>
      <p className="err">{msg}</p>
      <form className="panel" onSubmit={send('/movies', m, 'Movie added')}>
        <h3>Add a movie</h3>
        <input placeholder="Title" {...bm('title')} />
        <input placeholder="Genre (Action, Drama, Comedy, Sci-Fi, Thriller)" {...bm('genre')} />
        <input placeholder="Language" {...bm('language')} />
        <input type="number" placeholder="Duration in minutes" {...bm('duration')} />
        <input placeholder="Poster image link (optional)" {...bm('poster')} />
        <input placeholder="Short description" {...bm('description')} />
        <button>Add movie</button>
      </form>
      <form className="panel" onSubmit={send('/shows', sh, 'Show added')}>
        <h3>Add a show</h3>
        <select {...bs('movie')}><option value="">Choose a movie</option>{movies.map((x) => <option key={x._id} value={x._id}>{x.title}</option>)}</select>
        <input placeholder="Theatre name" {...bs('theatre')} />
        <input type="datetime-local" {...bs('time')} />
        <input type="number" placeholder="Ticket price" {...bs('price')} />
        <button>Add show</button>
      </form>
      <div className="panel">
        <h3>All movies</h3>
        {movies.map((x) => <p key={x._id}>{x.title} <button className="ghost" onClick={async () => { await api.delete('/movies/' + x._id); load(); }}>Delete</button></p>)}
      </div>
    </div>
  );
}

const Guard = ({ children, admin }) => { const u = getUser(); return !u || (admin && u.role !== 'admin') ? <Navigate to="/login" /> : children; };

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/movie/:id" element={<Movie />} />
          <Route path="/book/:id" element={<Book />} />
          <Route path="/bookings" element={<Guard><Bookings /></Guard>} />
          <Route path="/admin" element={<Guard admin><Admin /></Guard>} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
