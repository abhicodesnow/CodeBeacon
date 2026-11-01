import joblib
import numpy as np
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

def train_calibrated_model():
    rng = np.random.default_rng(42)
    n_samples = 4000

    # Features: [loc, cyclomatic_complexity, token_count, max_params, max_depth, warning_count]
    loc = rng.integers(5, 350, size=n_samples)
    ccn = rng.integers(1, 35, size=n_samples)
    tokens = loc * rng.integers(4, 10, size=n_samples)
    params = rng.integers(0, 8, size=n_samples)
    depth = rng.integers(1, 9, size=n_samples)
    warnings = rng.choice([0, 0, 1, 2, 3, 4], size=n_samples)

    X = np.column_stack([loc, ccn, tokens, params, depth, warnings])

    # Calibrated ground-truth risk logit
    logit = (
        -3.2
        + 0.14 * ccn
        + 0.42 * depth
        + 0.95 * warnings
        + 0.005 * loc
        + 0.12 * np.maximum(0, params - 4)
        + rng.normal(0, 0.35, size=n_samples)
    )
    probs = 1.0 / (1.0 + np.exp(-logit))
    y = (probs > 0.5).astype(int)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_leaf=4,
        random_state=42,
    )
    clf.fit(X_train, y_train)

    acc = accuracy_score(y_test, clf.predict(X_test))
    print(f"[CodeBeacon ML] Trained 6-feature Random Forest (Validation Accuracy: {acc * 100:.2f}%)")

    root_dir = Path(__file__).resolve().parent.parent.parent
    out_paths = [
        Path(__file__).resolve().parent / "models" / "bug_probability_rf.joblib",
        root_dir / "bug_probability_rf.joblib",
    ]
    for path in out_paths:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(clf, path)
        print(f"[CodeBeacon ML] Saved model -> {path}")

if __name__ == "__main__":
    train_calibrated_model()