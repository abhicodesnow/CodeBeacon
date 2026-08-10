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
    print("--> [ML Pipeline] Loading dataset...")
    try:
        df = pd.read_csv("synthetic_code_data.csv")
    except FileNotFoundError:
        print("Error: synthetic_code_data.csv not found. Run generate_dataset.py first.")
        return

    # 2. FEATURE EXTRACTION
    print("--> [ML Pipeline] Extracting AST features using Lizard...")
    features_list = []
    
    for index, row in df.iterrows():
        features = extract_features_from_code(row["code"], row["language"])
        if features:
            features["bug_probability"] = row["historical_bug_probability"]
            features_list.append(features)

    ml_df = pd.DataFrame(features_list)

    # 3. PREPARE FOR TRAINING
    X = ml_df.drop(columns=["bug_probability"])
    y = ml_df["bug_probability"]

    # Split into 80% training data, 20% testing data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 4. TRAIN THE MODEL
    print("--> [ML Pipeline] Training Random Forest model...")
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    # 5. EVALUATE THE MODEL
    predictions = model.predict(X_test)
    mse = mean_squared_error(y_test, predictions)
    r2 = r2_score(y_test, predictions)
    
    print(f"--> [ML Pipeline] Model Evaluation:")
    print(f"    - Mean Squared Error: {mse:.2f}")
    print(f"    - R-squared Score: {r2:.2f} (Closer to 1.0 is better)")

    # 6. EXPORT
    joblib.dump(model, "bug_probability_rf.joblib")
    print("--> [ML Pipeline] Success! Model saved as 'bug_probability_rf.joblib'")

if __name__ == "__main__":
    main()