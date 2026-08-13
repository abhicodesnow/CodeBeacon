from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from arq import create_pool
from arq.connections import RedisSettings
import asyncio

app = FastAPI(title="CodeBeacon AI API")

# Define what the API expects to receive
class CodePayload(BaseModel):
    code: str
    language: str

# Connect to the Redis queue when the server starts
@app.on_event("startup")
async def startup():
    print("--> [API] Connecting to task queue...")
    app.state.redis = await create_pool(RedisSettings())

@app.post("/analyze")
async def analyze_code(payload: CodePayload):
    try:
        # 1. Send the code to the background worker
        job = await app.state.redis.enqueue_job('analyze_code_task', payload.code, payload.language)
        
        if not job:
            raise HTTPException(status_code=500, detail="Failed to enqueue task")

        # 2. Wait for the worker to finish the prediction (timeout after 10 seconds)
        # This keeps the frontend experience simple and instant
        result = await job.result(timeout=10)
        
        return {
            "status": "success",
            "job_id": job.job_id,
            "data": result
        }

    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Task timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))