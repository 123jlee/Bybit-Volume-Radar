# Bybit Volume Radar (VPS Edition)

A high-performance, client-side scanner that monitors **Bybit USDT Perpetual Futures** for anomalous volume spikes. Built with React 19, TypeScript, and Tailwind CSS.

![Status](https://img.shields.io/badge/Status-Active-success) ![License](https://img.shields.io/badge/License-MIT-blue)

## 🚀 Features

### Core Scanner
- **Multi-Timeframe Analysis**: Scans **30m** and **4H** timeframes simultaneously.
- **Anomaly Detection**: Uses **Volume Ratio** (vs 20-period avg) and **Z-Score** to detect statistical outliers.
- **Severity Grading**: Classifies events as **Mild**, **Strong**, or **Climactic**.
- **Batch Processing**: Scans symbols in chunks to prevent API rate limits.

### Terminal UI
- **Dashboard**: Real-time event feed with 20-candle sparklines and audio alerts.
- **Ticker Detail**: Deep dive into specific symbols with interactive Price/Volume charts.
- **Universe Manager**: Auto-discovers Top 25/50 symbols by **Volume** or **Open Interest**.

### VPS Ready
- **Simple Architecture**: Static frontend + Nginx Reverse Proxy (no heavy backend).
- **Persistence**: Settings (Thresholds, API Config) saved to LocalStorage.

---

## 🛠️ Local Development

The project uses Vite with a local proxy to bypass CORS during development.

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Dev Server**
   ```bash
   npm run dev
   ```
   > Access at `http://localhost:5173`
   > Requests to `/bybit_api` are proxied to `https://api.bybit.com` automatically.

---

## 📦 VPS Deployment (Nginx)

This guide assumes a fresh Ubuntu VPS with an `admin` user.

### 1. Build the App
Generate the production static files:
```bash
npm run build
```

### 2. Upload to VPS
Transfer the build files, Nginx config, and setup script to your VPS:
```bash
# Upload build artifacts
ssh admin@<VPS_IP> "mkdir -p ~/bybit-radar"
scp -r dist/* admin@<VPS_IP>:~/bybit-radar/

# Upload config & script (found in root)
scp bybit-radar.conf setup.sh admin@<VPS_IP>:~/bybit-radar/
```

### 3. Run Setup Script
SSH into your VPS and run the automated installer. This handles Nginx installation, permission setting (to `/var/www`), and port configuration.

```bash
ssh admin@<VPS_IP>
sudo bash ~/bybit-radar/setup.sh
```

**That's it!** Your scanner is now running at `http://<VPS_IP>:8080`.

---

## ⚙️ Configuration

Customization is available directly in the **Settings** page:

- **API Endpoint**: Defaults to `/bybit_api` (relative path for Nginx proxy).
- **Symbol Count**: track Top 10, 25, or 50 pairs.
- **Sort Criteria**: Rank universe by 24h Volume or Open Interest.
- **Thresholds**: Adjust Sensitivity (Min Volume Ratio, Min Z-Score).

## 🛡️ Troubleshooting

- **500 Error**: Usually permissions. Ensure files are in `/var/www/bybit-radar` and owned by `www-data`. The provided `setup.sh` handles this.
- **CORS Error**: Ensure you are accessing via the Nginx port (8080), not opening `index.html` locally file://.
