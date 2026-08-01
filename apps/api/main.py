from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="CodeBeacon API",
    description="Backend for the AI-powered Code Quality Analysis Platform",
    version="1.0.0"
)

# Configure CORS to allow your Next.js frontend to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "online", "message": "CodeBeacon API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "api"}