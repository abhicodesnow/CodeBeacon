import pandas as pd
import lizard
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import joblib

def extract_features_from_code(code_string, language):
    """
    Uses Lizard to analyze the code string and extract quantitative metrics.
    Lizard supports C++, Python, Java, JS, etc.
    """
    try:
        # Lizard usually reads files, but we can pass it a raw string by mimicking a file
        analysis = lizard.analyze_file.analyze_source_code("mock_file." + language, code_string)
        
        # Calculate averages across all functions in the file
        if analysis.function_list:
            avg_cyclomatic_complexity = sum(f.cyclomatic_complexity for f in analysis.function_list) / len(analysis.function_list)
            avg_nloc = sum(f.nloc for f in analysis.function_list) / len(analysis.function_list)
            avg_parameters = sum(f.parameter_count for f in analysis.function_list) / len(analysis.function_list)
        else:
            avg_cyclomatic_complexity = 1.0
            avg_nloc = analysis.nloc
            avg_parameters = 0.0

        return {
            "lines_of_code": analysis.nloc,
            "avg_cyclomatic_complexity": avg_cyclomatic_complexity,
            "avg_function_lines": avg_nloc,
            "avg_parameters": avg_parameters,
            "token_count": analysis.token_count
        }
    except Exception as e:
        print(f"Error parsing code: {e}")
        return None

def main():
    print("--> [ML Pipeline] Initializing training sequence...")

    # 1. LOAD THE DATASET
    # (We will replace this with a real dataset of open-source C++ and Python repos)
    print("--> [ML Pipeline] Loading dataset...")
    
    # MOCK DATASET (Until we download the real one)
    # y = target variable (bug probability 0-100)
    raw_data = {
        "language": ["py", "cpp", "py", "cpp"],
        "code": [
            "def add(a, b): return a + b", 
            "int main() { for(int i=0; i<10; i++) { if(i%2==0) { cout << i; } } return 0; }",
            "def complex_logic(x): \n for i in range(100): \n  if i == x: \n   for j in range(x): \n    print(j)",
            "void doNothing() { int x = 0; }"
        ],
        "historical_bug_probability": [2.5, 45.0, 85.0, 1.0]
    }
    
    df = pd.DataFrame(raw_data)

    # 2. FEATURE EXTRACTION
    print("--> [ML Pipeline] Extracting AST features from source code...")
    features_list = []
    
    for index, row in df.iterrows():
        features = extract_features_from_code(row["code"], row["language"])
        if features:
            features["bug_probability"] = row["historical_bug_probability"]
            features_list.append(features)

    # Convert the extracted features back into a structured DataFrame
    ml_df = pd.DataFrame(features_list)

    # 3. PREPARE FOR TRAINING
    # Separate the features (X) from the answers (y)
    X = ml_df.drop(columns=["bug_probability"])
    y = ml_df["bug_probability"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 4. TRAIN THE MODEL
    print("--> [ML Pipeline] Training Random Forest model...")
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    # 5. EVALUATE THE MODEL
    predictions = model.predict(X_test)
    mse = mean_squared_error(y_test, predictions)
    print(f"--> [ML Pipeline] Model Evaluation - Mean Squared Error: {mse:.2f}")

    # 6. EXPORT
    joblib.dump(model, "bug_probability_rf.joblib")
    print("--> [ML Pipeline] Success! Model saved as 'bug_probability_rf.joblib'")

if __name__ == "__main__":
    main()