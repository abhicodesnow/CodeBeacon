import os
import re
import ast
import math
import joblib
import lizard
import httpx
import numpy as np
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from arq.connections import RedisSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

MODEL_PATHS = [
    BASE_DIR / "packages" / "ml" / "models" / "bug_probability_rf.joblib",
    BASE_DIR / "bug_probability_rf.joblib",
]

rf_model = None
for path in MODEL_PATHS:
    if path.exists():
        try:
            rf_model = joblib.load(path)
            print(f"[CodeBeacon Worker] Loaded RF model from {path}")
            break
        except Exception as e:
            print(f"[CodeBeacon Worker] Warning loading model at {path}: {e}")

LIZARD_EXT_MAP = {
    "cpp": "snippet.cpp",
    "py": "snippet.py",
    "java": "Snippet.java",
    "js": "snippet.js",
    "rs": "snippet.rs",
}


def estimate_complexity(code: str, max_loop_depth: int) -> tuple[str, str]:
    has_sort = bool(re.search(r'\b(sort|stable_sort|sorted|Arrays\.sort)\b', code))
    has_pq = bool(re.search(r'\b(priority_queue|heapq|TreeSet|TreeMap|set<|map<)\b', code))

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
        time_comp = "O(N log N)" if (has_sort or has_pq) else "O(N)"
    else:
        if is_recursive:
            time_comp = "O(2^N) / O(N)"
        elif has_sort or has_pq:
            time_comp = "O(N log N)"
        else:
            time_comp = "O(1)"

    has_2d = bool(re.search(r'vector\s*<\s*vector|\[\s*\w+\s*\]\s*\[\s*\w+\s*\]', code))
    has_1d = bool(re.search(r'\b(vector|unordered_map|unordered_set|map|set|dict|list|Vec::new|ArrayList|HashMap)\b', code))

    if has_2d:
        space_comp = "O(N^2)"
    elif has_1d or is_recursive:
        space_comp = "O(N)"
    else:
        space_comp = "O(1)"

    return time_comp, space_comp


def extract_code_forensics(code: str, language: str) -> dict:
    virtual_filename = LIZARD_EXT_MAP.get(language, "snippet.cpp")
    lizard_info = lizard.analyze_file.analyze_source_code(virtual_filename, code)

    raw_lines = code.splitlines()
    non_empty_lines = [line for line in raw_lines if line.strip()]
    loc = lizard_info.nloc if lizard_info.nloc > 0 else len(non_empty_lines)
    token_count = lizard_info.token_count

    functions_breakdown = []
    max_func_ccn = 1
    total_func_ccn = 0
    max_params = 0

    for fn in lizard_info.function_list:
        max_func_ccn = max(max_func_ccn, fn.cyclomatic_complexity)
        total_func_ccn += fn.cyclomatic_complexity
        max_params = max(max_params, fn.parameter_count)
        functions_breakdown.append({
            "name": fn.name,
            "cyclomatic_complexity": fn.cyclomatic_complexity,
            "nloc": fn.nloc,
            "tokens": fn.token_count,
            "params": fn.parameter_count,
            "start_line": getattr(fn, "start_line", 1),
            "end_line": getattr(fn, "end_line", loc),
        })

    branch_pattern = r'\b(if|else\s+if|elif|for|while|case|catch|match)\b|(\?\s*.*?:)|(&&|\|\|)'
    regex_ccn = 1 + len(re.findall(branch_pattern, code))
    cyclomatic_complexity = max(total_func_ccn, regex_ccn)

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
        except SyntaxError as e:
            max_depth = max((len(line) - len(line.lstrip())) // 4 for line in non_empty_lines) if non_empty_lines else 0
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

    # Line-aware Static & Security Diagnostics
    diagnostics = []
    warnings = []

    def add_diag(line_no: int, severity: str, msg: str):
        formatted = f"Line {line_no}: {msg}" if line_no > 0 else msg
        warnings.append(formatted)
        diagnostics.append({
            "line": max(1, line_no),
            "severity": severity,
            "message": msg,
        })

    has_smart_or_delete = bool(re.search(r'\b(delete|unique_ptr|shared_ptr)\b', code))
    has_fast_io = bool(re.search(r'ios::sync_with_stdio|ios_base::sync_with_stdio', code))

    for idx, line in enumerate(raw_lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("//") or stripped.startswith("#"):
            continue

        if language == "cpp":
            if re.search(r'\b(gets|strcpy|strcat|sprintf)\s*\(', line):
                add_diag(idx, "error", "Unsafe C buffer function detected (buffer overflow risk).")
            if re.search(r'\bnew\b', line) and not has_smart_or_delete:
                add_diag(idx, "warning", "Raw heap allocation ('new') without matching 'delete' or smart pointer.")
            if re.search(r'\bint\b', line) and re.search(r'1e1[0-8]|LLONG_MAX|10000000000', line):
                add_diag(idx, "error", "Potential 32-bit signed integer overflow near 64-bit constant (use 'long long').")
            if re.search(r'\bcin\s*>>', line) and not has_fast_io:
                add_diag(idx, "info", "Unbuffered 'cin' without 'ios::sync_with_stdio(false)' may cause TLE on large inputs.")
                has_fast_io = True  # Report once per snippet
        elif language == "py":
            if re.search(r'\b(eval|exec)\s*\(', line):
                add_diag(idx, "error", "Unsafe dynamic execution ('eval'/'exec') detected.")

        if re.search(r'/\s*0\b', line):
            add_diag(idx, "error", "Explicit division by zero detected.")

    for fn in functions_breakdown:
        if fn["cyclomatic_complexity"] > 10:
            add_diag(
                fn["start_line"],
                "warning",
                f"Function '{fn['name']}' has high cyclomatic complexity ({fn['cyclomatic_complexity']}).",
            )

    if max_depth > 4:
        add_diag(1, "warning", f"Deep control-flow nesting (depth {max_depth}) increases cognitive load.")

    # Maintainability Index (0-100)
    volume_approx = max(1.0, max(token_count, len(code)) * math.log2(max(2, len(set(code.split())))))
    raw_mi = 171 - 5.2 * math.log(volume_approx) - 0.23 * cyclomatic_complexity - 16.2 * math.log(max(1, loc))
    maintainability_index = round(max(0.0, min(100.0, (raw_mi * 100.0) / 171.0)), 1)

    # Random Forest Inference
    bug_prob = None
    if rf_model is not None:
        try:
            n_features = getattr(rf_model, "n_features_in_", 6)
            candidate_features = [loc, cyclomatic_complexity, token_count, max_params, max_depth, len(diagnostics)]
            feature_vec = (candidate_features + [0] * n_features)[:n_features]
            X = np.array([feature_vec])
            if hasattr(rf_model, "predict_proba"):
                prob = float(rf_model.predict_proba(X)[0][-1]) * 100.0
            else:
                prob = float(rf_model.predict(X)[0])
                if prob <= 1.0:
                    prob *= 100.0
            bug_prob = round(min(99.0, max(1.0, prob)), 1)
        except Exception as e:
            print(f"[CodeBeacon Worker] RF fallback triggered: {e}")

    if bug_prob is None:
        score = (cyclomatic_complexity * 2.8) + (max_depth * 6.5) + (len(diagnostics) * 14.0) + (loc * 0.15)
        bug_prob = round(min(98.0, max(2.0, score)), 1)

    # Explainable ML Risk Attribution Breakdown (sums to 100%)
    ccn_weight = max(1.0, cyclomatic_complexity * 2.8)
    depth_weight = max(1.0, max_depth * 6.5)
    hazard_weight = len(diagnostics) * 14.0
    volume_weight = max(1.0, loc * 0.2)
    total_w = ccn_weight + depth_weight + hazard_weight + volume_weight

    risk_breakdown = {
        "cyclomatic_complexity": round((ccn_weight / total_w) * 100),
        "nesting_depth": round((depth_weight / total_w) * 100),
        "static_hazards": round((hazard_weight / total_w) * 100),
        "code_volume": max(0, 100 - round((ccn_weight / total_w) * 100) - round((depth_weight / total_w) * 100) - round((hazard_weight / total_w) * 100)),
    }

    time_complexity, space_complexity = estimate_complexity(code, max_loop_depth)

    if not warnings:
        warnings.append("Control flow and AST structures look clean. No static hazards detected.")

    return {
        "bug_probability": bug_prob,
        "maintainability_index": maintainability_index,
        "cyclomatic_complexity": cyclomatic_complexity,
        "max_nesting_depth": max_depth,
        "loc": loc,
        "token_count": token_count,
        "time_complexity": time_complexity,
        "space_complexity": space_complexity,
        "functions": functions_breakdown,
        "diagnostics": diagnostics,
        "risk_breakdown": risk_breakdown,
        "warnings": warnings,
    }


async def fetch_llm_review(code: str, language: str) -> Optional[str]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None

    prompt = (
        f"You are a senior competitive programming and systems engineer. "
        f"Review this {language} snippet in 2 concise bullet points focusing on "
        f"edge cases, memory safety, or time-complexity bottlenecks:\n\n{code[:3000]}"
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
        print(f"[CodeBeacon Worker] Groq LLM skipped: {e}")
    return None


async def run_forensics_job(ctx, code: str, language: str) -> dict:
    metrics = extract_code_forensics(code, language)
    ai_review = await fetch_llm_review(code, language)
    if ai_review:
        metrics["ai_review"] = ai_review
    return metrics


class WorkerSettings:
    functions = [run_forensics_job]
    redis_settings = RedisSettings(
        host=os.getenv("REDIS_HOST", "127.0.0.1"),
        port=int(os.getenv("REDIS_PORT", 6379)),
    )