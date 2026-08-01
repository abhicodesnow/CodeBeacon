from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# This matches the credentials in your docker-compose.yml
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:password@localhost:5432/codebeacon"

# The engine is responsible for establishing the actual connection
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# This creates a database session factory for our API routes
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for future database models
Base = declarative_base()