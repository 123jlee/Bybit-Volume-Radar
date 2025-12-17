# Bybit Volume Radar (Tactical Stream Edition)

A high-performance, client-side tactical scanner that monitors **Bybit USDT Perpetual Futures** for anomalous volume spikes. Re-engineered as a live tactical stream with historical backfill replay.

![Status](https://img.shields.io/badge/Status-Active-success) ![License](https://img.shields.io/badge/License-MIT-blue) ![Tech](https://img.shields.io/badge/Tech-React_19_|_Vite_|_Tailwind-purple)

## 🚀 Key Features

### 1. Tactical Stream Dashboard
The core of the application has been overhauled into a **Session-Based Live Stream**.
-   **Historical Replay (Backfill)**: On "START", the engine fetches the last **100 candles (5m)** for the entire universe and replays history to detect anomalies that occurred in the last ~8 hours.
-   **Live Polling**: After backfill, the scanner polls every **60s** to append the latest anomalies to the feed.
-   **View Filters**: Toggle visibility for **[ 5m ]** and **[ 30m ]** signals independently.
-   **Precision Timing**: Toggle between **[ UTC ]** and **[ LOCAL ]** time.
-   **Smart Pagination**: Client-side pagination handles large event feeds (1000+ rows) with ease.
-   **Context-Aware**: Dashboard timer and state persist across navigation (`ScannerContext`).

### 2. Advanced Reports
-   **Persistence**: Report configuration and results are saved to LocalStorage—never lose your analysis on refresh.
-   **Multi-Select**: Filter reports by multiple specific symbols.
-   **Interactive Table**: Sortable columns, filtration, and pagination for deep-diving into historical data.

### 3. Universe Manager
-   **Auto-Discovery**: Automatically fetches the Top 25/50 symbols by **Volume** or **Open Interest**.
-   **Dynamic List**: The scanner adapts to market shifts automatically.

---

## 🏗️ Architecture

The app runs entirely in the browser (Client-Side), using **Nginx** only as a reverse proxy to bypass CORS.

-   **Scanner Engine**: A dedicated class that manages polling loops, backfill logic, and Z-Score calculation.
-   **State Management**: `StoreService` (Observer Pattern) + `ScannerContext` (React Context) ensures efficient data flow.
-   **Persistence**: `localStorage` helps retain Universe, Settings, and Reports between sessions.

### Limits
-   **Feed Capacity**: Rolling limit of **1000** events to prevent memory leaks during long sessions.
-   **Backfill Depth**: Scans last 100 candles (approx 8 hours on 5m timeframe).

---

## 🛠️ Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Dev Server**
   ```bash
   npm run dev
   ```
   > Access at `http://localhost:5173`.
   > Requests to `/bybit_api` are proxied to `https://api.bybit.com` via Vite config.

---

## 📦 VPS Deployment

Deploying to a Linux VPS (Ubuntu recommended) is automated via the included script.

### 1. Build
```bash
npm run build
```

### 2. Upload
Transfer the `dist/` folder and setup scripts to your VPS user (e.g., `admin`).
```bash
# Example
scp -r dist/* admin@<VPS_IP>:~/bybit-radar/
scp bybit-radar.conf setup.sh admin@<VPS_IP>:~/bybit-radar/
```

### 3. Run Setup
SSH into the VPS and run the script. It configures Nginx to serve the app on port **8080**.
```bash
ssh admin@<VPS_IP>
sudo bash ~/bybit-radar/setup.sh
```

---

## ⚙️ Configuration (Settings Page)

-   **Symbol Count**: Track Top 10, 25, or 50 pairs.
-   **Sort Criteria**: Rank universe by 24h Volume or Open Interest.
-   **Audio Alerts**: Toggle sound on strictly "High Severity" (Z > 3.0) events.
