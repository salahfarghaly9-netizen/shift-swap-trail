# Nextcare — Shift Swap System

Full-stack Node.js + MongoDB shift swap system.  
**Designed by Salah Farghaly**

---

## 📁 Project Structure

```
nextcare/                ← ROOT (no /backend, no /server subfolder issues)
├── server/
│   ├── index.js        ← entry point  (npm start runs this)
│   ├── seed.js         ← sample data
│   ├── config/db.js
│   ├── middleware/auth.js
│   ├── models/         ← User, Shift, SwapRequest, Notification
│   └── routes/         ← auth, users, shifts, swapRequests, notifications
├── public/
│   └── index.html      ← frontend (served by Express)
├── package.json        ← "start": "node server/index.js"
├── .env.example
└── .gitignore
```

---

## ⚙️ Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env
cp .env.example .env
# Edit .env and fill in MONGODB_URI and JWT_SECRET

# 3. (Optional) Seed sample data
npm run seed

# 4. Start server
npm run dev        # development (auto-reload)
npm start          # production
```

Open: http://localhost:3000

---

## 🍃 MongoDB Atlas — Step by Step

### 1. Create free cluster
- Go to https://cloud.mongodb.com
- Click **"Build a Database"** → Free tier (M0) → AWS → any region → Create

### 2. Create database user
- **Database Access** → Add New Database User
- Username: `nextcare_user`
- Password: something strong (save it!)
- Role: **Read and write to any database**

### 3. Allow all IPs (required for Render)
- **Network Access** → Add IP Address → **Allow Access From Anywhere** → `0.0.0.0/0`
- Click Confirm

### 4. Get connection string
- **Clusters** → Connect → **Drivers** → Node.js
- Copy the string: `mongodb+srv://nextcare_user:<password>@cluster0.xxxxx.mongodb.net/nextcare?retryWrites=true&w=majority`
- Replace `<password>` with your actual password

---

## 🚀 Deploy on Render — Step by Step

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/nextcare-shiftswap.git
git push -u origin main
```

### 2. Create Web Service on Render
- Go to https://render.com → **New** → **Web Service**
- Connect your GitHub repo
- Settings:
  - **Name**: nextcare-shiftswap
  - **Root Directory**: *(leave blank)*
  - **Runtime**: Node
  - **Build Command**: `npm install`
  - **Start Command**: `npm start`
  - **Plan**: Free

### 3. Add Environment Variables
In Render → your service → **Environment** tab → Add:

| Key | Value |
|-----|-------|
| `MONGODB_URI` | `mongodb+srv://salahfarghaly9_db_user:PASSWORD@cluster0.jlefqys.mongodb.net/shiftswap?retryWrites=true&w=majority` |
| `JWT_SECRET` | `shift_swap_secret_key_2026_nisect_care` |
| `NODE_ENV` | `production` |

> ⚠️ Never put real passwords in your code or GitHub

### 4. Deploy
- Click **Deploy** and watch the logs
- Look for: `✅ MongoDB Atlas connected` and `🚀 Nextcare ShiftSwap running on port ...`

---

## 🔑 Demo Credentials (after running seed)

| Role | Email | Password |
|------|-------|----------|
| Manager | manager@nextcare.com | manager123 |
| Employee | ahmed@nextcare.com | emp123456 |

---

## 📡 API Endpoints

### Auth
| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/auth/login` | Login → JWT token |
| POST | `/api/auth/register` | Register new user |
| GET | `/api/auth/me` | Get current user |

### Shifts
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/shifts/my` | My shifts this week |
| GET | `/api/shifts` | All shifts (filtered) |
| POST | `/api/shifts` | Create shift (manager) |

### Swap Requests
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/swaps` | Open swap requests |
| POST | `/api/swaps` | Post new swap |
| POST | `/api/swaps/:id/accept` | Accept a swap |
| POST | `/api/swaps/:id/approve` | Manager approves |
| POST | `/api/swaps/:id/reject` | Manager rejects |
| GET | `/api/swaps/stats/summary` | Stats (manager) |

### Notifications
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/notifications` | My notifications |
| PATCH | `/api/notifications/read-all` | Mark all read |

---

## 🆓 Free Hosting Alternatives

| Platform | Free Tier | Sleep? | Notes |
|----------|-----------|--------|-------|
| **Render** | ✅ 750h/month | Yes (15min) | Best for Node.js, easy env vars |
| **Railway** | ✅ $5 credit/month | No | Fast deploys, good DX |
| **Fly.io** | ✅ 3 shared VMs | No | More control, needs CLI |
| **Cyclic** | ✅ Unlimited apps | No | Simple, GitHub-based |
| **Vercel** | ✅ Unlimited | No | Serverless only (no persistent server) |
| **MongoDB Atlas** | ✅ 512MB M0 cluster | No | Database hosting |

**Recommendation for beginners**: Render (backend) + MongoDB Atlas (database)

---

## 🐛 Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `MONGODB_URI is not set` | Add env var in Render/Railway |
| `MongoDB connection failed: bad auth` | Wrong password in MONGODB_URI |
| `Network timeout` | Atlas IP whitelist — add `0.0.0.0/0` |
| `cd backend: no such file` | Remove wrong build command. Build = `npm install`, Start = `npm start` |
| `Cannot find module './routes/...'` | Check all route files exist and are committed to git |
| App loads but API fails | Check CORS — the server allows all origins by default |

---

## ✏️ Credits

**Designed & Developed by Salah Farghaly**  
Nextcare Shift Swap System © 2026
