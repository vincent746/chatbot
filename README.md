# 🤖 WhatsApp RAG Chatbot

Chatbot WhatsApp pintar yang menggunakan teknologi RAG (Retrieval-Augmented Generation) untuk memberikan jawaban yang akurat berdasarkan dokumen PDF dan data real-time dari Google Sheets.

## 📋 Fitur Utama

- **🤖 AI Response**: Menggunakan OpenRouter API untuk respons AI yang natural
- **📄 PDF Knowledge Base**: Membaca dan memahami dokumen PDF sebagai sumber pengetahuan
- **📊 Real-time Data**: Integrasi dengan Google Sheets untuk data stok (coming soon)
- **💬 WhatsApp Integration**: Bot WhatsApp menggunakan whatsapp-web.js
- **🔍 RAG Technology**: Menggabungkan retrieval dan generation untuk jawaban yang akurat
- **📱 QR Code Management**: Penyimpanan QR code dengan struktur folder berdasarkan tanggal
- **📝 Logging System**: Sistem logging lengkap untuk monitoring
- **🚀 REST API**: API endpoints untuk kontrol dan monitoring bot

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────┐
│  CHATBOT RAG + WHATSAPP                     │
│                                             │
│  📄 PDF: Info perusahaan, jam buka, dll     │
│  📊 Google Sheets: Data stok real-time      │
│  🤖 AI: Baca & jawab otomatis               │
└─────────────────────────────────────────────┘
```

### Flow Kerja RAG:
```
User bertanya
     ↓
AI cari di database knowledge (PDF/Excel)
     ↓
AI temukan info yang relevan
     ↓
AI gabungkan dengan GPT untuk jawab natural
     ↓
Bot kirim jawaban yang akurat
```

## 🚀 Quick Start

### 1. Prerequisites

- Node.js >= 16.x
- npm atau yarn
- OpenRouter API Token
- Google Chrome/Chromium (untuk whatsapp-web.js)

### 2. Installation

```bash
# Clone repository
git clone <repository-url>
cd chatbot-rag-whatsapp

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 3. Environment Setup

Buat file `.env` dengan konfigurasi berikut:

```env
# OpenRouter API Configuration
OPENROUTER_API_TOKEN=your_openrouter_api_token_here

# Bot Configuration
BOT_NAME=Toko Sepatu Assistant
STORE_NAME=Toko Sepatu Berkualitas

# File Paths
PDF_RULES_PATH=./storage/rules/info_toko_sepatu.pdf
QR_STORAGE_PATH=./storage/qrcode

# Server Configuration
PORT=3000
NODE_ENV=development
AUTO_START_BOT=false

# Optional: Google Sheets (untuk implementasi masa depan)
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SHEETS_API_KEY=your_api_key
```

### 4. Persiapan Knowledge Base

Pastikan file PDF sudah ada di `storage/rules/info_toko_sepatu.pdf`. File ini akan menjadi sumber pengetahuan bot.

### 5. Menjalankan Bot

```bash
# Development mode dengan auto-reload
npm run dev

# Production mode
npm start
```

### 6. Inisialisasi WhatsApp Bot

Setelah server berjalan, ada 2 cara untuk menginisialisasi bot:

**Cara 1: Via API**
```bash
curl -X POST http://localhost:3000/api/bot/initialize
```

**Cara 2: Auto-start**
Set `AUTO_START_BOT=true` di file `.env`

### 7. Scan QR Code

- QR code akan muncul di terminal
- Scan dengan WhatsApp mobile app
- QR code juga disimpan di `storage/qrcode/YYYY/MM/DD/`

## 📡 API Endpoints

### Bot Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bot/initialize` | Inisialisasi WhatsApp bot |
| GET | `/api/bot/status` | Status bot dan sistem |
| POST | `/api/bot/shutdown` | Matikan bot |
| GET | `/api/bot/health` | Health check |

### Messaging

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bot/send` | Kirim pesan ke nomor tertentu |
| POST | `/api/bot/broadcast` | Broadcast ke multiple users |
| POST | `/api/bot/query` | Test RAG query |

### Cache Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bot/cache/clear` | Clear response cache |

### Contoh API Calls

**Inisialisasi Bot:**
```bash
curl -X POST http://localhost:3000/api/bot/initialize
```

**Cek Status:**
```bash
curl http://localhost:3000/api/bot/status
```

**Kirim Pesan:**
```bash
curl -X POST http://localhost:3000/api/bot/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "6281234567890@c.us",
    "message": "Halo dari bot!"
  }'
```

**Test RAG Query:**
```bash
curl -X POST http://localhost:3000/api/bot/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Jam buka toko berapa?"
  }'
```

## 💬 Contoh Interaksi

```
User: "Halo"
Bot: "Halo! Selamat datang di Toko Sepatu Berkualitas 👋
     Kami menjual sepatu berkualitas tinggi.
     Ada yang bisa saya bantu?"

User: "Toko buka jam berapa?"
Bot: [Baca PDF] 
     "Hari ini kami buka jam 09:00 - 18:00 WIB"

User: "Stok sepatu sneakers masih ada?"
Bot: [Baca Google Sheets - coming soon]
     "Sepatu sneakers saat ini masih tersedia 9 unit.
     Mau pesan berapa unit?"

User: "Kalian jual apa aja?"
Bot: [Baca PDF]
     "Kami menjual berbagai jenis sepatu seperti:
     - Sneakers
     - Sepatu formal
     - Sepatu casual
     - Boots
     - Dan lainnya"
```

## 🔧 Konfigurasi Lanjutan

### Mengubah Model AI

Edit `src/services/aiService.js`:
```javascript
this.defaultModel = 'openai/gpt-4'; // atau model lain dari OpenRouter
```

### Menambah Knowledge Base

1. Tambahkan file PDF ke `storage/rules/`
2. Update `PDF_RULES_PATH` di `.env`
3. Restart bot

### Rate Limiting

Edit `src/bot/botHandler.js`:
```javascript
this.rateLimitWindow = 5000; // 5 detik antar pesan per user
```

### Cache Settings

Edit `src/bot/botHandler.js`:
```javascript
this.cacheExpiry = 10 * 60 * 1000; // 10 menit cache
```

## 📊 Monitoring & Logging

### Log Files

Logs disimpan di folder `logs/` dengan format:
- `YYYY-MM-DD.log` - Log harian
- Auto-cleanup log lama (>30 hari)

### Log Levels

- **INFO**: Aktivitas normal
- **ERROR**: Error dan exception
- **WARN**: Peringatan
- **DEBUG**: Debug info (development only)
- **SUCCESS**: Operasi berhasil

### Monitoring Endpoints

```bash
# Health check
curl http://localhost:3000/api/bot/health

# Detailed status
curl http://localhost:3000/api/bot/status
```

## 🔮 Roadmap

### Phase 1 (Current)
- ✅ WhatsApp bot integration
- ✅ PDF knowledge base
- ✅ OpenRouter AI integration
- ✅ RAG implementation
- ✅ Basic logging

### Phase 2 (Coming Soon)
- 🔄 Google Sheets integration
- 🔄 Real-time stock checking
- 🔄 Order management
- 🔄 User session management

### Phase 3 (Future)
- 📱 Web dashboard
- 📊 Analytics & reporting
- 🔔 Notification system
- 🌐 Multi-language support

## 🛠️ Development

### Menjalankan dalam Development Mode

```bash
npm run dev
```

### Testing RAG System

```bash
# Test PDF service
node -e "
const pdfService = require('./src/services/pdfService');
pdfService.searchInPdf('jam buka').then(console.log);
"

# Test AI service
node -e "
const aiService = require('./src/services/aiService');
aiService.generateResponse('Halo', 'Toko buka 09:00-18:00').then(console.log);
"
```

### Debugging

Set environment variable untuk debug:
```bash
NODE_ENV=development npm run dev
```

## 🤝 Contributing

1. Fork repository
2. Buat feature branch
3. Commit changes
4. Push ke branch
5. Buat Pull Request

## 📄 License

MIT License - lihat file LICENSE untuk detail.

## 🆘 Troubleshooting

### Bot tidak bisa connect WhatsApp
- Pastikan Chrome/Chromium terinstall
- Cek firewall dan network
- Hapus folder `storage/session` dan coba lagi

### PDF tidak terbaca
- Pastikan file PDF ada di path yang benar
- Cek permission file
- Pastikan PDF tidak ter-password

### AI tidak merespon
- Cek OPENROUTER_API_TOKEN
- Cek koneksi internet
- Cek quota API OpenRouter

### QR Code tidak muncul
- Pastikan terminal support UTF-8
- Cek folder `storage/qrcode` permission
- Restart bot
---

**Dibuat dengan ❤️ untuk otomasi customer service WhatsApp**
