import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import joblib

print("Creating training data...")

# 1. CREATE THE DATA (This defines X_train and y_train)
# X_train: The input features (Lines of Code, Complexity, Comment Density)
X_train = pd.DataFrame({
    "lines_of_code": [500, 1500, 300, 5000],
    "cyclomatic_complexity": [10, 50, 5, 90],
    "comment_density": [0.25, 0.10, 0.30, 0.05]
})

# y_train: The "answers" (Bug probability percentages for those exact files)
y_train = pd.Series([5.0, 45.0, 2.0, 85.0])

print("Training the Random Forest model...")

# 2. TRAIN THE MODEL
model = RandomForestRegressor(random_state=42)
model.fit(X_train, y_train)

# 3. SAVE THE MODEL
joblib.dump(model, "bug_probability_rf.joblib")
print("Success! Model saved as 'bug_probability_rf.joblib'")