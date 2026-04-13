# 🔍 Nexus – Custom Search Engine

A full-stack search engine with web crawler, indexer, and React frontend.

## 🚀 Features

- 🕷️ Web crawler with robots.txt support
- 📊 BM25 + PageRank ranking algorithm
- ⚛️ React frontend with modern UI
- 🐳 Docker deployment ready
- 🔍 Fast search API

## 🛠️ Tech Stack

- **Backend**: Python, Flask, SQLite
- **Frontend**: React, Vite
- **Deployment**: Docker, Docker Compose

## 📂 Project Structure

```
NEXUS/
├── app.py              # Flask API + React serving
├── crawler.py          # Web crawler
├── indexer.py          # BM25 + PageRank indexer
├── main.py             # CLI interface
├── requirements.txt    # Python dependencies
├── Dockerfile          # Docker build
├── docker-compose.yml  # Deployment
├── frontend/           # React app
│   ├── src/
│   ├── dist/           # Built files
│   └── ...
└── search.db           # SQLite database (generated)
```

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker (optional)

### 1. Clone and Setup
```bash
git clone <repo>
cd NEXUS
pip install -r requirements.txt
```

### 2. Crawl and Index
```bash
# Crawl a website
python main.py crawl https://example.com --max 100

# Build search index
python main.py index
```

### 3. Run Development
```bash
# Backend
python main.py serve

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5000` for the full app.

## 🐳 Docker Deployment

### Build and Run
```bash
# Build image
docker build -t pythonsearch .

# Run container
docker run -p 5000:5000 -v $(pwd)/search.db:/app/search.db pythonsearch
```

### Using Docker Compose
```bash
docker-compose up --build
```

The app will be available at `http://localhost:5000`.

## 📖 Usage

### CLI Commands
```bash
# Crawl website
python main.py crawl <url> [--max N]

# Build index
python main.py index

# Start server
python main.py serve [--port 5000]

# Combined crawl + index + serve
python main.py run <url> [--max N] [--port 5000]

# Query from CLI
python main.py query "search term" [--n 10]
```

### API Endpoints
- `GET /search?q=<query>&n=10` - Search API
- `GET /stats` - Index statistics
- `GET /` - React frontend

## 🔧 Development

### Frontend Development
```bash
cd frontend
npm install
npm run dev  # Runs on :5173 with proxy to :5000
npm run build  # Production build
```

### Backend Development
```bash
pip install -r requirements.txt
python main.py serve  # With debug=True
```

## 📊 Search Algorithm

Combines BM25 scoring with PageRank for relevance:

- **BM25**: Term frequency, document length normalization
- **PageRank**: Link-based importance scoring
- **Combined Score**: BM25 × (1 + α × PageRank), α=5.0

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 📂 Project Structure

NEXUS/
│── backend/
│ ├── app.py
│ ├── search.py
│ └── data.csv
│
│── frontend/
│ ├── index.html
│ ├── style.css
│ └── script.js
│
│── static/
│── templates/
│── README.md
│── requirements.txt

---

## 🔎 How It Works

1. Dataset is loaded from CSV  
2. Data is preprocessed and indexed  
3. User enters search query  
4. Backend processes query:
   - Tokenization  
   - Matching  
   - Scoring  
5. Results are ranked and returned  
6. UI displays results dynamically  

---

## 🧠 Search Algorithm

The ranking system is based on:

- 📌 Keyword frequency  
- 📌 Relevance score  
- 📌 Position of keywords  
- 📌 Matching accuracy  

### Basic Flow:
Query → Tokenize → Match → Score → Sort → Display

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo  
2. Create a new branch  
3. Make your changes  
4. Submit a Pull Request  

---

## 📜 License

This project is licensed under the **MIT License**.

---

## 👨‍💻 Author

**Anand Pandey**  
BTech Student | Developer | Data Enthusiast  

---

## ⭐ Support

If you like this project, give it a ⭐ on GitHub!