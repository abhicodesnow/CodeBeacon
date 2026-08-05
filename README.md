# CodeBeacon 

CodeBeacon is an advanced, cloud-based SaaS platform designed to help developers and teams analyze the quality of their source code. By bridging the gap between traditional static analysis techniques and custom Machine Learning models trained on vast open-source repositories, CodeBeacon provides deep, predictive insights into codebase health.

**Author:** Abhinav Jha

---

##  Core Features

CodeBeacon moves beyond simple linting by utilizing a multi-model ML pipeline to predict critical code metrics:

*   **Bug Probability:** Evaluates structural patterns and outputs a 0-100% likelihood of hidden bugs.
*   **Code Maintainability:** Scores the overall health and readability of the codebase on a scale of 0-100.
*   **Code Complexity:** Analyzes cyclomatic complexity, nested loops, and inheritance depth to output a Low, Medium, or High prediction.
*   **Security Risk:** Assesses potential vulnerabilities and outputs a Low, Medium, or High risk level.

### Platform Capabilities
*   **Seamless Ingestion:** Import repositories via GitHub OAuth integration or upload ZIP files manually.
*   **Multi-Language Support:** Full analysis support for Python, Java, C++, JavaScript, and TypeScript (with Go and Rust planned for the future).
*   **Team Collaboration:** Granular Role-Based Access Control (Owner, Admin, Developer, Viewer) for shared organizational repositories.
*   **Rich Reporting:** Export detailed analysis metrics, graphs, and ML predictions in PDF, JSON, and CSV formats.
*   **Developer API:** Robust REST API with JWT authentication and rate limiting for external integrations.

---

##  Technology Stack

CodeBeacon is built using a modern, scalable monorepo architecture managed by **pnpm workspaces**.

**Frontend:**
*   Next.js (App Router) & React
*   TypeScript & Tailwind CSS
*   shadcn/ui, TanStack Query, Zustand, React Hook Form, Zod

**Backend & ML:**
*   FastAPI (Python)
*   scikit-learn, XGBoost, Random Forest, LightGBM
*   Background processing via Redis Queue and Celery/Dramatiq

**Database & Infrastructure:**
*   PostgreSQL with Drizzle ORM
*   Docker & Docker Compose for local dev and orchestration
*   AWS S3 (Storage) and AWS ECS/EC2 (Deployment)

---

##  Monorepo Architecture

The workspace is strictly organized to separate concerns between the client, API, machine learning services, and shared packages:

```text
code-beacon/
├── apps/
│   ├── web/                # Next.js Frontend App
│   └── api/                # FastAPI Backend Web Server
├── services/
│   ├── ml-service/         # Dedicated Machine Learning Service
│   └── worker/             # Background Task Processor (Redis Queue)
├── packages/
│   ├── ui/                 # Shared React Components (shadcn/ui)
│   ├── config/             # Shared Configurations
│   ├── types/              # Global TypeScript Definitions
│   ├── utils/              # Shared Helper Functions
│   ├── database/           # Drizzle ORM Schemas & Migrations
│   ├── eslint-config/      # Standardized Linting Rules
│   └── tsconfig/           # Standardized TypeScript Configs
├── docker/                 # Nginx, PostgreSQL, Redis Configurations
├── docs/                   # Project Documentation
├── scripts/                # Utility & CI/CD Scripts
└── .github/                # GitHub Actions Workflows
```

---

## Local Initialization Guide

Follow these steps to set up the CodeBeacon monorepo on your local development machine. 

### Prerequisites
Ensure you have the following installed on your system:
*   **Node.js** (v18+) & **pnpm** (Package Manager)
*   **Python** (v3.10+) 
*   **Docker & Docker Compose** (Required for PostgreSQL and Redis)

### 1. Clone the Repository
```bash
git clone [https://github.com/yourusername/code-beacon.git](https://github.com/yourusername/code-beacon.git)
cd code-beacon
```

### 2. Infrastructure Setup (Database & Queue)
CodeBeacon relies on PostgreSQL for relational data and Redis for background job queuing. Start the local infrastructure using Docker:
```bash
cd docker
docker-compose up -d
cd ..
```

### 3. Frontend & Shared Packages Setup
Install all JavaScript/TypeScript dependencies across the monorepo using pnpm:
```bash
pnpm install
```

### 4. Backend & Worker Setup (Python)
Navigate to the API application and set up your isolated Python environment for FastAPI.
```bash
cd apps/api
# Create and activate your virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install backend dependencies
pip install -r requirements.txt
```

### 5. Environment Variables
Create `.env` files in both `apps/web` and `apps/api` using the provided `.env.example` templates. Ensure you add your local PostgreSQL connection string, Redis URL, and JWT secrets.

### 6. Run the Development Servers
You will need multiple terminal windows (or a terminal multiplexer) to run the full stack locally.

**Terminal 1 (Next.js Frontend):**
```bash
pnpm --filter web dev
```

**Terminal 2 (FastAPI Backend):**
```bash
cd apps/api
source venv/bin/activate
uvicorn main:app --reload
```

**Terminal 3 (Background Worker):**
```bash
cd services/worker
source venv/bin/activate
# Run your specific queue worker (e.g., Arq, Celery)
```

---

##  Development Roadmap

*   **Phase 1:** Monorepo Setup, pnpm Workspaces, Drizzle ORM, PostgreSQL, Authentication, Landing Page.
*   **Phase 2:** Repository Upload, GitHub OAuth, Dashboard, Queue System.
*   **Phase 3:** Static Analysis, Feature Extraction, Database Storage.
*   **Phase 4:** Train Initial ML Models, Prediction API, Dashboard Integration.
*   **Phase 5:** Team Workspace, Billing, API Keys.
*   **Phase 6:** Docker, AWS Deployment, CI/CD, Monitoring, Logging.