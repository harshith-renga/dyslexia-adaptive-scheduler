# Run the Project

Open two separate terminals from the **project root**, then run:

## Terminal 1: Backend

```bash
# Activate the virtual environment first
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# Start the backend
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## Terminal 2: Frontend

```bash
cd frontend
npm install   # only needed the first time
npm run dev -- --host 127.0.0.1 --port 5173
```

## Open the App

| Service | URL |
|---------|-----|
| **Frontend** | http://127.0.0.1:5173 |
| **Backend API docs** | http://127.0.0.1:8000/docs |

## Stop

Press `Ctrl+C` in both terminals.
