from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import SessionLocal

app = FastAPI(
    title="CodeBeacon API",
    description="Backend for the AI-powered Code Quality Analysis Platform",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get the database session per request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"status": "online", "message": "CodeBeacon API is running"}

# NEW: Database Health Check Endpoint
@app.get("/db-health")
def db_health_check(db: Session = Depends(get_db)):
    try:
        # Execute a raw SQL query to verify the connection is alive
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected to postgres"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")