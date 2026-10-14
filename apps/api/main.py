import os
import re
import ast
import json
import math
import time
import shutil
import hashlib
import tempfile
import resource
import subprocess
from pathlib import Path
from typing import Optional

import httpx
import redis
import joblib
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="CodeBeacon Forensics & Execution Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Connect to Redis (Graceful fallback if offline)
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
redis_client = None
try:
    rc = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1)
    rc.ping()
    redis_client = rc
    print(f"[CodeBeacon] Connected to Redis at {REDIS_URL}")
except Exception as e:
    print(f"[CodeBeacon] Redis cache unavailable (running uncached): {e}")

# 2. Load Trained Random Forest Model
MODEL_PATHS = [
    BASE_DIR / "packages" / "ml" / "models" / "bug_probability_rf.joblib",
    BASE_DIR / "bug_probability_rf.joblib",
]

rf_model = None
for path in MODEL_PATHS:
    if path.exists():
        try:
            rf_model = joblib.load(path)
            print(f"[CodeBeacon] Loaded Random Forest model from {path}")
            break
        except Exception as e:
            print(f"[CodeBeacon] Warning: Could not load model at {path}: {e}")


class AnalyzeRequest(BaseModel):
    code: str
    language: str = "cpp"


class ExecuteRequest(BaseModel):
    code: str
    language: str = "cpp"
    stdin: str = ""


def estimate_complexity(code: str, max_loop_depth: int, language: str) -> tuple[str, str]:
    """Estimates Time & Space Big-O complexity from loop nesting, sorting, and recursion."""
    has_sort = bool(re.search(r'\b(sort|stable_sort|sorted|Arrays\.sort)\b', code))
    has_priority_queue = bool(re.search(r'\b(priority_queue|heapq|TreeSet|TreeMap|set<|map<)\b', code))
    
    # Check recursion
    is_recursive = False
    func_names = re.findall(r'\b(?:void|int|long|bool|string|auto|def|fn)\s+([a-zA-Z_]\w*)\s*\(', code)
    for fn in func_names:
        if fn != "main" and len(re.findall(rf'\b{re.escape(fn)}\s*\(', code)) >= 2:
            is_recursive = True
            break

    if max_loop_depth >= 3:
        time_comp = f"O(N^{max_loop_depth})"
    elif max_loop_depth == 2:
        time_comp = "O(N^2)"
    elif max_loop_depth == 1:
        time_comp = "O(N log N)" if (has_sort or has_priority_queue) else "O(N)"
    else:
        if is_recursive:
            time_comp = "O(2^N) / O(N)"
        elif has_sort or has_priority_queue:
            time_comp = "O(N log N)"
        else:
            time_comp = "O(1)"

    has_2d_alloc = bool(re.search(r'vector\s*<\s*vector|\[\s*\w+\s*\]\s*\[\s*\w+\s*\]|for\s+.*in\s+range.*\[.*for', code))
    has_1d_alloc = bool(re.search(r'\b(vector|unordered_map|unordered_set|map|set|dict|list|Vec::new|ArrayList|HashMap)\b', code))

    if has_2d_alloc:
        space_comp = "O(N^2)"
    elif has_1d_alloc or is_recursive:
        space_comp = "O(N)"
    else:
        space_comp = "O(1)"

    return time_comp, space_comp


async def fetch_llm_review(code: str, language: str) -> Optional[str]:
    """Optional Groq Llama 3 diagnostic review if GROQ_API_KEY is configured."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None

    prompt = (
        f"You are a senior competitive programming and systems engineer. "
        f"Briefly review this {language} snippet in 2 concise bullet points focusing on "
        f"edge cases, memory safety, or algorithmic bottlenecks:\n\n{code[:3000]}"
    )
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "max_tokens": 180,
                },
            )
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[CodeBeacon] Groq LLM call skipped: {e}")
    return None


def extract_code_forensics(code: str, language: str) -> dict:
    lines = [line for line in code.splitlines() if line.strip()]
    loc = len(lines)

    branch_pattern = r'\b(if|else\s+if|elif|for|while|case|catch|match)\b|(\?\s*.*?:)|(&&|\|\|)'
    branches = len(re.findall(branch_pattern, code))
    cyclomatic_complexity = 1 + branches

    max_depth = 0
    max_loop_depth = 0

    if language == "py":
        try:
            tree = ast.parse(code)
            def walk_ast(node, depth=0, loop_depth=0):
                nonlocal max_depth, max_loop_depth
                max_depth = max(max_depth, depth)
                max_loop_depth = max(max_loop_depth, loop_depth)
                for child in ast.iter_child_nodes(node):
                    is_branch = isinstance(child, (ast.If, ast.For, ast.While, ast.FunctionDef, ast.Try))
                    is_loop = isinstance(child, (ast.For, ast.While))
                    walk_ast(child, depth + (1 if is_branch else 0), loop_depth + (1 if is_loop else 0))
            walk_ast(tree)
        except SyntaxError:
            max_depth = max((len(line) - len(line.lstrip())) // 4 for line in lines) if lines else 0
            max_loop_depth = min(max_depth, len(re.findall(r'\b(for|while)\b', code)))
    else:
        current_depth = 0
        for char in code:
            if char == '{':
                current_depth += 1
                max_depth = max(max_depth, current_depth)
            elif char == '}':
                current_depth = max(0, current_depth - 1)
        loop_count = len(re.findall(r'\b(for|while)\s*\(', code))
        max_loop_depth = min(max_depth, loop_count)

    warnings = []
    if language == "cpp":
        if re.search(r'\b(gets|strcpy|strcat|sprintf)\s*\(', code):
            warnings.append("Unsafe C buffer function detected (buffer overflow risk).")
        if re.search(r'\bnew\b', code) and not re.search(r'\b(delete|unique_ptr|shared_ptr)\b', code):
            warnings.append("Raw heap allocation ('new') without corresponding 'delete' or smart pointer.")
        if re.search(r'\bint\b', code) and re.search(r'1e1[0-8]|LLONG_MAX|10000000000', code):
            warnings.append("Potential 32-bit signed integer overflow near 64-bit constants (use 'long long').")
        if re.search(r'\bcin\s*>>', code) and not re.search(r'ios::sync_with_stdio|ios_base::sync_with_stdio', code):
            warnings.append("Unbuffered 'cin' without 'ios::sync_with_stdio(false)' may cause I/O TLE on large inputs.")
        if re.search(r'/\s*0\b', code):
            warnings.append("Explicit division by zero detected.")
    elif language == "py":
        if re.search(r'\b(eval|exec)\s*\(', code):
            warnings.append("Unsafe dynamic execution ('eval'/'exec') detected.")
        if "input()" in code and "sys.stdin" not in code and loc > 25:
            warnings.append("Consider 'sys.stdin.readline' instead of 'input()' for fast competitive I/O.")

    if cyclomatic_complexity > 15:
        warnings.append(f"High cyclomatic complexity ({cyclomatic_complexity}). Consider decomposing helper functions.")
    if max_depth > 4:
        warnings.append(f"Deep control-flow nesting (depth {max_depth}) increases cognitive load.")

    volume_approx = max(1.0, len(code) * math.log2(max(2, len(set(code.split())))))
    raw_mi = 171 - 5.2 * math.log(volume_approx) - 0.23 * cyclomatic_complexity - 16.2 * math.log(max(1, loc))
    maintainability_index = round(max(0.0, min(100.0, (raw_mi * 100.0) / 171.0)), 1)

    bug_prob = None
    if rf_model is not None:
        try:
            n_features = getattr(rf_model, "n_features_in_", 4)
            base_features = [loc, cyclomatic_complexity, max_depth, len(warnings)]
            feature_vec = (base_features + [0] * n_features)[:n_features]
            X = np.array([feature_vec])
            if hasattr(rf_model, "predict_proba"):
                prob = float(rf_model.predict_proba(X)[0][-1]) * 100.0
            else:
                prob = float(rf_model.predict(X)[0])
                if prob <= 1.0:
                    prob *= 100.0
            bug_prob = round(min(99.0, max(1.0, prob)), 1)
        except Exception as e:
            print(f"[CodeBeacon] RF inference fallback triggered: {e}")

    if bug_prob is None:
        score = (cyclomatic_complexity * 2.8) + (max_depth * 6.5) + (len(warnings) * 14.0) + (loc * 0.15)
        bug_prob = round(min(98.0, max(2.0, score)), 1)

    time_complexity, space_complexity = estimate_complexity(code, max_loop_depth, language)

    if not warnings:
        warnings.append("Control flow and syntax structures look clean. No obvious static hazards found.")

    return {
        "bug_probability": bug_prob,
        "maintainability_index": maintainability_index,
        "cyclomatic_complexity": cyclomatic_complexity,
        "max_nesting_depth": max_depth,
        "loc": loc,
        "time_complexity": time_complexity,
        "space_complexity": space_complexity,
        "warnings": warnings,
    }


def limit_sandbox_resources():
    """Linux preexec_fn to cap child process CPU time (3s) and RAM (256MB)."""
    try:
        resource.setrlimit(resource.RLIMIT_CPU, (3, 3))
        mem_bytes = 256 * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
    except Exception:
        pass


@app.post("/analyze")
async def analyze_code(payload: AnalyzeRequest):
    if not payload.code.strip():
        raise HTTPException(status_code=400, detail="Code snippet cannot be empty.")

    cache_key = f"codebeacon:analyze:{payload.language}:{hashlib.sha256(payload.code.encode()).hexdigest()}"
    if redis_client:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                return {"status": "success", "cached": True, "data": json.loads(cached)}
        except Exception:
            pass

    metrics = extract_code_forensics(payload.code, payload.language)
    ai_review = await fetch_llm_review(payload.code, payload.language)
    if ai_review:
        metrics["ai_review"] = ai_review

    if redis_client:
        try:
            redis_client.setex(cache_key, 3600, json.dumps(metrics))
        except Exception:
            pass

    return {"status": "success", "cached": False, "data": metrics}


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

        # Step 1: Compile if required
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

        # Step 2: Execute with resource limits & timeout
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