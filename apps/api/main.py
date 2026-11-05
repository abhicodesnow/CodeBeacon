import os
import re
import json
import time
import shutil
import hashlib
import tempfile
import resource
import subprocess
from pathlib import Path
from typing import List, Optional

import redis
import httpx
from arq import create_pool
from arq.jobs import Job
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from worker import extract_code_forensics, fetch_llm_review, WorkerSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="CodeBeacon Forensics & Execution Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
redis_client = None
try:
    rc = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1)
    rc.ping()
    redis_client = rc
    print(f"[CodeBeacon API] Connected to Redis at {REDIS_URL}")
except Exception as e:
    print(f"[CodeBeacon API] Redis cache unavailable: {e}")


class AnalyzeRequest(BaseModel):
    code: str
    language: str = "cpp"


class ExecuteRequest(BaseModel):
    code: str
    language: str = "cpp"
    stdin: str = ""


class RefactorRequest(BaseModel):
    code: str
    language: str = "cpp"
    warnings: Optional[List[str]] = None


class GenerateRequest(BaseModel):
    prompt: str
    language: str = "cpp"
    current_code: str = ""


def limit_sandbox_resources():
    try:
        resource.setrlimit(resource.RLIMIT_CPU, (3, 3))
        mem_bytes = 256 * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
    except Exception:
        pass


def deterministic_local_refactor(code: str, language: str) -> tuple[str, str]:
    fixed = code
    notes = []

    if language == "cpp":
        if re.search(r'\bcin\s*>>', fixed) and not re.search(r'ios::sync_with_stdio', fixed):
            fixed = re.sub(
                r'(int\s+main\s*\([^)]*\)\s*\{)',
                r'\1\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);',
                fixed,
                count=1,
            )
            notes.append("Injected fast I/O ('ios::sync_with_stdio(false); cin.tie(nullptr);').")

        if re.search(r'<<\s*(?:std::)?endl\b', fixed):
            fixed = re.sub(r'<<\s*(?:std::)?endl\b', r"<< '\\n'", fixed)
            notes.append("Replaced buffer-flushing 'endl' with '\\n'.")

        if re.search(r'\bstrcpy\s*\(\s*([a-zA-Z_]\w*)\s*,', fixed):
            fixed = re.sub(
                r'\bstrcpy\s*\(\s*([a-zA-Z_]\w*)\s*,\s*([^)]+)\)',
                r'snprintf(\1, sizeof(\1), "%s", \2)',
                fixed,
            )
            notes.append("Replaced unsafe 'strcpy' with bounds-checked 'snprintf'.")

        if re.search(r'\bgets\s*\(\s*([a-zA-Z_]\w*)\s*\)', fixed):
            fixed = re.sub(
                r'\bgets\s*\(\s*([a-zA-Z_]\w*)\s*\)',
                r'fgets(\1, sizeof(\1), stdin)',
                fixed,
            )
            notes.append("Replaced unsafe 'gets' with bounds-checked 'fgets'.")

        if re.search(r'\bint\b([^;]*?)(1e1[0-8]|10000000000)', fixed):
            fixed = re.sub(r'\bint(\s+[a-zA-Z_]\w*\s*=\s*(?:1e1[0-8]|10000000000))', r'long long\1', fixed)
            notes.append("Upgraded 32-bit 'int' to 64-bit 'long long' near large constants.")

    elif language == "py":
        if "input()" in fixed and "sys.stdin" not in fixed:
            fixed = "import sys\ninput = lambda: sys.stdin.readline().rstrip('\\r\\n')\n" + fixed
            notes.append("Aliased 'input()' to 'sys.stdin.readline' for fast competitive I/O.")

    if not notes:
        notes.append("Verified static safety guards (set GROQ_API_KEY in .env for full LLM code rewriting).")

    return fixed, " • ".join(notes)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "codebeacon-api"}


@app.post("/analyze")
async def analyze_code(payload: AnalyzeRequest):
    if not payload.code.strip():
        raise HTTPException(status_code=400, detail="Code snippet cannot be empty.")

    cache_key = f"codebeacon:analyze:v4:{payload.language}:{hashlib.sha256(payload.code.encode()).hexdigest()}"
    if redis_client:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                return {"status": "success", "cached": True, "data": json.loads(cached)}
        except Exception:
            pass

    metrics = extract_code_forensics(payload.code, payload.language)
    metrics["ai_review"] = await fetch_llm_review(payload.code, payload.language, metrics)

    if redis_client:
        try:
            redis_client.setex(cache_key, 3600, json.dumps(metrics))
        except Exception:
            pass

    return {"status": "success", "cached": False, "data": metrics}


@app.post("/refactor")
async def refactor_code(payload: RefactorRequest):
    if not payload.code.strip():
        raise HTTPException(status_code=400, detail="Code snippet cannot be empty.")

    api_key = os.getenv("GROQ_API_KEY")
    if api_key:
        hazards_text = "\n".join(payload.warnings or [])
        prompt = (
            f"Refactor this {payload.language} code to fix all memory, overflow, and complexity hazards "
            f"while preserving its exact I/O behavior.\n"
            f"Detected diagnostics:\n{hazards_text}\n\n"
            f"Return ONLY valid JSON with two keys: \"refactored_code\" (string) and \"summary\" (1-sentence string).\n\n"
            f"Code:\n{payload.code[:4000]}"
        )
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": [{"role": "user", "content": prompt}],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.1,
                    },
                )
                if resp.status_code == 200:
                    parsed = json.loads(resp.json()["choices"][0]["message"]["content"])
                    if parsed.get("refactored_code"):
                        return {
                            "status": "success",
                            "engine": "llama-3.3-70b",
                            "refactored_code": parsed["refactored_code"],
                            "summary": parsed.get("summary", "Refactored with Groq Llama 3.3."),
                        }
        except Exception as e:
            print(f"[CodeBeacon API] Groq refactor fallback: {e}")

    fixed_code, summary = deterministic_local_refactor(payload.code, payload.language)
    return {
        "status": "success",
        "engine": "static-ast-fixer",
        "refactored_code": fixed_code,
        "summary": summary,
    }


@app.post("/generate")
async def generate_with_groq(payload: GenerateRequest):
    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="GROQ_API_KEY is missing in your root .env file.",
        )

    lang_map = {"cpp": "C++", "py": "Python", "java": "Java", "js": "JavaScript", "rs": "Rust"}
    target_lang = lang_map.get(payload.language, payload.language)

    context_block = (
        f"\n\nCurrent editor code (modify or reference if relevant):\n{payload.current_code[:3000]}"
        if payload.current_code.strip()
        else ""
    )

    system_prompt = (
        f"You are an expert competitive programmer and systems engineer. "
        f"Generate clean, optimal, bug-free {target_lang} code for the user's request. "
        f"Return ONLY valid JSON with two keys: "
        f"\"code\" (the raw {target_lang} source code with no markdown fences) and "
        f"\"explanation\" (a concise 1-2 sentence explanation of the approach and complexity)."
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Task: {payload.prompt}{context_block}"},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2,
                },
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=resp.text)

            parsed = json.loads(resp.json()["choices"][0]["message"]["content"])
            return {
                "status": "success",
                "code": parsed.get("code", ""),
                "explanation": parsed.get("explanation", "Generated with Groq Llama 3.3 70B."),
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq generation failed: {e}")


@app.post("/analyze/async")
async def analyze_code_async(payload: AnalyzeRequest):
    if not payload.code.strip():
        raise HTTPException(status_code=400, detail="Code snippet cannot be empty.")
    pool = await create_pool(WorkerSettings.redis_settings)
    job = await pool.enqueue_job("run_forensics_job", payload.code, payload.language)
    return {"status": "queued", "job_id": job.job_id}


@app.get("/jobs/{job_id}")
async def get_job_result(job_id: str):
    pool = await create_pool(WorkerSettings.redis_settings)
    job = Job(job_id, pool)
    status = await job.status()
    if status == "complete":
        result = await job.result()
        return {"status": "complete", "data": result}
    return {"status": status}


@app.post("/execute")
async def execute_code(payload: ExecuteRequest):
    if not payload.code.strip():
        raise HTTPException(status_code=400, detail="Code snippet cannot be empty.")

    tmpdir = tempfile.mkdtemp(prefix="cb_sandbox_")
    try:
        lang = payload.language
        compile_cmd = None
        run_cmd = None

        if lang == "cpp":
            src = os.path.join(tmpdir, "main.cpp")
            bin_path = os.path.join(tmpdir, "main.out")
            with open(src, "w") as f:
                f.write(payload.code)
            compile_cmd = ["g++", "-O2", "-std=c++20", src, "-o", bin_path]
            run_cmd = [bin_path]
        elif lang == "py":
            src = os.path.join(tmpdir, "main.py")
            with open(src, "w") as f:
                f.write(payload.code)
            run_cmd = ["python3", "-I", src]
        elif lang == "js":
            src = os.path.join(tmpdir, "main.js")
            with open(src, "w") as f:
                f.write(payload.code)
            run_cmd = ["node", src]
        elif lang == "rs":
            src = os.path.join(tmpdir, "main.rs")
            bin_path = os.path.join(tmpdir, "main.out")
            with open(src, "w") as f:
                f.write(payload.code)
            compile_cmd = ["rustc", "-O", src, "-o", bin_path]
            run_cmd = [bin_path]
        elif lang == "java":
            src = os.path.join(tmpdir, "Main.java")
            with open(src, "w") as f:
                f.write(payload.code)
            compile_cmd = ["javac", src]
            run_cmd = ["java", "-cp", tmpdir, "Main"]
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported language: {lang}")

        if compile_cmd:
            comp_proc = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                timeout=8.0,
                cwd=tmpdir,
            )
            if comp_proc.returncode != 0:
                return {
                    "status": "compile_error",
                    "stdout": comp_proc.stdout,
                    "stderr": comp_proc.stderr,
                    "exit_code": comp_proc.returncode,
                    "exec_time_ms": 0.0,
                }

        start_t = time.perf_counter()
        try:
            exec_proc = subprocess.run(
                run_cmd,
                input=payload.stdin,
                capture_output=True,
                text=True,
                timeout=3.0,
                cwd=tmpdir,
                preexec_fn=limit_sandbox_resources if os.name == "posix" else None,
            )
            elapsed_ms = round((time.perf_counter() - start_t) * 1000.0, 2)
            return {
                "status": "success" if exec_proc.returncode == 0 else "runtime_error",
                "stdout": exec_proc.stdout[:10000],
                "stderr": exec_proc.stderr[:10000],
                "exit_code": exec_proc.returncode,
                "exec_time_ms": elapsed_ms,
            }
        except subprocess.TimeoutExpired:
            return {
                "status": "tle",
                "stdout": "",
                "stderr": "Time Limit Exceeded (Execution exceeded 3.0 seconds).",
                "exit_code": 124,
                "exec_time_ms": 3000.0,
            }
    except FileNotFoundError as e:
        return {
            "status": "system_error",
            "stdout": "",
            "stderr": f"Compiler/runtime not installed on host: {e}",
            "exit_code": 127,
            "exec_time_ms": 0.0,
        }
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)