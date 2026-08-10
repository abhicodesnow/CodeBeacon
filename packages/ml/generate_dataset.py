import pandas as pd
import random
import os

def generate_synthetic_data(num_samples=1000):
    print(f"--> Generating {num_samples} synthetic code samples...")
    data = []
    
    for _ in range(num_samples):
        lang = random.choice(["py", "cpp"])
        # Randomize how complex the code is
        complexity_level = random.randint(1, 15)
        lines = random.randint(10, 150)

        if lang == "py":
            code = "def process_data(x):\n"
            code += "    val = x\n" * (lines // 2)
            code += "    if val > 0:\n        val -= 1\n" * complexity_level
            # Hidden formula: Complexity and length increase bug chance
            bug_prob = (complexity_level * 5.0) + (lines * 0.1) + random.uniform(-5, 5)
        else:
            code = "void processData(int x) {\n"
            code += "    int val = x;\n" * (lines // 2)
            code += "    if (val > 0) { val -= 1; }\n" * complexity_level
            code += "}\n"
            bug_prob = (complexity_level * 5.2) + (lines * 0.1) + random.uniform(-5, 5)

        # Cap probability between 0 and 100
        bug_prob = max(0.0, min(100.0, bug_prob))
        
        data.append({
            "language": lang, 
            "code": code, 
            "historical_bug_probability": round(bug_prob, 2)
        })

    df = pd.DataFrame(data)
    output_path = "synthetic_code_data.csv"
    df.to_csv(output_path, index=False)
    print(f"--> Success! Dataset saved to {output_path}")

if __name__ == "__main__":
    generate_synthetic_data()