import joblib
import lizard
import pandas as pd
from arq.connections import RedisSettings

# 1. Load the model into memory when the worker starts
MODEL_PATH = "models/bug_probability_rf.joblib"
bug_model = joblib.load(MODEL_PATH)

def extract_features(code_string, language):
    """Parses incoming code from the API request."""
    analysis = lizard.analyze_file.analyze_source_code("temp." + language, code_string)
    
    if analysis.function_list:
        avg_cyc = sum(f.cyclomatic_complexity for f in analysis.function_list) / len(analysis.function_list)
        avg_nloc = sum(f.nloc for f in analysis.function_list) / len(analysis.function_list)
        avg_params = sum(f.parameter_count for f in analysis.function_list) / len(analysis.function_list)
    else:
        avg_cyc, avg_nloc, avg_params = 1.0, analysis.nloc, 0.0

    return pd.DataFrame([{
        "lines_of_code": analysis.nloc,
        "avg_cyclomatic_complexity": avg_cyc,
        "avg_function_lines": avg_nloc,
        "avg_parameters": avg_params,
        "token_count": analysis.token_count
    }])

async def analyze_code_task(ctx, code: str, language: str):
    """The background task triggered by FastAPI."""
    print(f"--> [Worker] Analyzing {language} code...")
    
    # 2. Extract features using Lizard
    features_df = extract_features(code, language)
    
    # 3. Run the prediction
    prediction = bug_model.predict(features_df)[0]
    
    print(f"--> [Worker] Prediction complete: {prediction:.2f}% bug probability")
    return {"bug_probability": round(prediction, 2)}

# 4. Worker Configuration
# This tells Arq which functions to expose and how to connect to Redis
class WorkerSettings:
    functions = [analyze_code_task]
    # Connects to localhost:6379 by default
    redis_settings = RedisSettings()