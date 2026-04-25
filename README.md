# Flyrr 🛒

**Smart grocery price comparison + real-time deal alerts for Canadians.**

Flyrr helps you find the cheapest grocery prices across Canadian stores (Walmart, No Frills, Loblaws, Freshco, and more) using the Flipp API — and now alerts you automatically when watched products drop below your target price.

---

## Features

### Season 1 — Price Comparison
- Search any grocery product by name + postal code
- Compare prices across all local stores in real time
- Build a shopping list and find the single cheapest store for your whole cart
- Track savings history

### Season 2 — Real-Time Deal Alerts 🆕
- **Watchlist**: Add products with a target price threshold
- **Auto-polling**: Background scheduler checks prices every 30 minutes via APScheduler
- **Telegram alerts**: Get instant push notifications via Telegram Bot API when a deal is found
- **Email alerts**: HTML email notifications via SMTP (Gmail / any provider)
- **Alert history**: Full log of every triggered notification
- **Mobile UI**: Native watchlist + notification screens built in React Native / Expo

---

## Stack

| Layer | Tech |
|---|---|
| Mobile frontend | React Native + Expo (TypeScript) |
| Backend API | FastAPI + Python |
| Database | MongoDB (Motor async driver) |
| Price data | Flipp API (backflipp.wishabi.com) |
| Scheduling | APScheduler 3.x |
| Notifications | Telegram Bot API + SMTP email |
| Web scraping | Playwright (extensible) |

---

## Getting Started

### Backend

```bash
cd backend
pip install -r requirements.txt
playwright install chromium

# Copy and fill in your environment variables
cp .env.example .env

# Start the API server
uvicorn server:app --reload --port 8001

# In a second terminal — start the deal alert scheduler
python scheduler.py
```

### Frontend

```bash
cd frontend
npm install
npx expo start
```

---

## Environment Variables

Create `backend/.env`:

```env
# MongoDB
MONGO_URL=mongodb://localhost:27017
DB_NAME=flyrr

# Telegram (get token from @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Email (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your_app_password
FROM_EMAIL=you@gmail.com

# Scheduler interval (default: 30 minutes)
ALERT_INTERVAL_MINUTES=30
```

---

## Alert API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/alerts` | Create a new price watch |
| `GET` | `/api/alerts` | List all alerts |
| `PATCH` | `/api/alerts/:id` | Update target price / toggle active |
| `DELETE` | `/api/alerts/:id` | Remove an alert |
| `POST` | `/api/alerts/check` | Manually trigger a price check |
| `GET` | `/api/alerts/notifications` | Alert notification history |

---

## New Screens (React Native)

- **`/watchlist`** — Manage watched products, see current vs target prices, pause/remove alerts
- **`/notifications`** — Full history of every triggered deal alert

---

Built with ❤️ by Calvin Crasto
