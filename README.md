# CivicLens — From Complaints to Civic Priorities

[![Google Cloud](https://img.shields.io/badge/Google_Cloud-Vertex_AI_%7C_BigQuery_%7C_Cloud_Run-4285F4?logo=google-cloud&logoColor=white)](https://cloud.google.com)
[![NestJS](https://img.shields.io/badge/NestJS-v10.3-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

CivicLens is an AI-powered civic intelligence platform that converts citizen complaints into structured, prioritized, and actionable insights for municipalities.

---

## 1. Problem
Municipalities receive thousands of unstructured citizen complaints daily via text, phone calls, social media, and web portals. Most issues:
- Lack standard categorization
- Hide urgent safety hazards inside vague descriptions
- Suffer from massive duplication (multiple citizens reporting the same pothole or broken streetlight)
- Lack transparent urgency prioritization, leading to delayed municipal response times

## 2. Solution
CivicLens transforms raw citizen complaints into actionable civic priorities in seconds:
```
Citizen Complaint + Photo
        ↓
Vertex AI / Gemini Multi-modal Analysis
        ↓
Category + Severity + Department Recommendation
        ↓
Deterministic Priority Scoring (0–100)
        ↓
Duplicate & Recurrence GIS Detection (1km radius)
        ↓
BigQuery Streaming & Analytics
        ↓
Municipal Intelligence Dashboard & Looker Studio
```

---

## 3. Key Features
- **Multi-modal AI Classification**: Gemini 1.5 Flash analyzes complaint text and uploaded photos to classify issues into standard civic categories with clear reasons.
- **Explainable Priority Scoring**: Transparent 0–100 formula evaluating severity, affected population, duplicate frequency, and location sensitivity.
- **Geographic Duplicate Detection**: Automatically identifies nearby complaints within a 1km radius and 30-day window without needing a heavy vector database.
- **Civic Hotspot Clustering**: Aggregates recurring incident hotspots from BigQuery to highlight chronic infrastructure pain points.
- **Municipal Intelligence Dashboard**: Real-time KPI cards, category shares, severity distributions, department workload, and actionable complaint queues.

---

## 4. Google Cloud Architecture

```
                  ┌───────────────────────────────┐
                  │    Citizen Web Portal / UI    │
                  └──────────────┬────────────────┘
                                 │ POST /api/complaints
                                 ▼
                  ┌───────────────────────────────┐
                  │     NestJS API (Cloud Run)    │
                  └──────┬───────┬────────┬───────┘
                         │       │        │
          ┌──────────────┘       │        └──────────────┐
          ▼                      ▼                       ▼
┌──────────────────┐  ┌──────────────────┐    ┌──────────────────┐
│  Cloud Storage   │  │  Vertex AI       │    │  BigQuery        │
│  (Complaint Img) │  │  (Gemini 1.5)    │    │  (Analytics/SQL) │
└──────────────────┘  └──────────────────┘    └────────┬─────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │  Looker Studio / │
                                              │  Municipal UI    │
                                              └──────────────────┘
```

---

## 5. Technology Stack
- **Backend**: Node.js, NestJS, TypeScript, `@nestjs/config`, `class-validator`, `multer`
- **AI**: Google Cloud Vertex AI (Gemini 1.5 Flash)
- **Data & Analytics**: Google Cloud BigQuery
- **Storage**: Google Cloud Storage
- **Compute**: Google Cloud Run, Docker, Cloud Build
- **Frontend**: Vanilla HTML5, CSS3 (Modern Civic Design System), Vanilla JS

---

## 6. Priority Scoring Formula

The priority score is computed deterministically (0–100):

$$\text{Priority Score} = \text{Severity Points} + \text{Affected People Points} + \text{Recurrence Points} + \text{Location Sensitivity Points}$$

| Component | Range | Scoring Breakdown |
| :--- | :---: | :--- |
| **Severity** | 10–50 | `Critical` = 50, `High` = 40, `Medium` = 25, `Low` = 10 |
| **Affected People** | 4–20 | `> 500` = 20, `201-500` = 16, `51-200` = 12, `11-50` = 8, `≤ 10` = 4 |
| **Recurrence / Duplicates** | 0–15 | `≥ 10` = 15, `5-9` = 10, `2-4` = 6, `1` = 3, `0` = 0 |
| **Location Sensitivity** | 5–15 | Hospital / School = 15, Bus Stand / Station = 12, Market / Highway = 10, Standard = 5 |

---

## 7. Local Development Setup

### Prerequisites
- Node.js LTS (v20+)
- npm (v10+)
- Google Cloud CLI (`gcloud`) *(Optional for local fallback mode)*

### 1. Installation
```bash
cd backend
npm install
```

### 2. Environment Configuration
Create a `.env` file in the project root:
```env
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
BIGQUERY_DATASET=civiclens
BIGQUERY_TABLE=complaints
GCS_BUCKET=your-gcs-bucket-name
PORT=8080
```
*(Note: If no GCP project is provided, CivicLens automatically operates in high-fidelity local analytical fallback mode so you can test all features offline).*

### 3. Generate Synthetic Demo Data (120 Complaints)
```bash
npm --prefix backend run seed
```

### 4. Run the Application
```bash
# Development mode
npm --prefix backend run start:dev

# Or Production build & run
npm --prefix backend run build
npm --prefix backend run start:prod
```

### 5. Access the Web Interfaces
- **Citizen Portal**: [http://localhost:8080](http://localhost:8080)
- **Municipal Intelligence Dashboard**: [http://localhost:8080/dashboard.html](http://localhost:8080/dashboard.html)
- **Health Check**: [http://localhost:8080/health](http://localhost:8080/health)

### 6. Municipal Dashboard Login Credentials
To access the protected municipal command center:
- **Officer Username**: `admin@city.gov` *(or `officer@municipal.gov`)*
- **Password**: `civicadmin2026` *(or `admin123`)*
*(Note: A **✨ 1-Click Fill** button is provided on the login screen for instant demo convenience).*

---

## 8. REST API Documentation

### `POST /api/complaints`
Submits a new complaint for multi-modal AI classification and prioritization.
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `description` (string, required)
  - `locationName` (string, required)
  - `latitude` (number, required)
  - `longitude` (number, required)
  - `affectedPeople` (number, optional)
  - `image` (file: JPEG, PNG, WEBP max 5MB, optional)

**Example Request:**
```bash
curl -X POST http://localhost:8080/api/complaints \
  -F "description=Garbage has been overflowing near our apartment for three days and there is a bad smell." \
  -F "locationName=Sector 15 Main Market" \
  -F "latitude=28.5355" \
  -F "longitude=77.3910" \
  -F "affectedPeople=150"
```

**Example Response:**
```json
{
  "complaintId": "CL-84857024",
  "category": "Waste Management",
  "severity": "High",
  "department": "Municipal Sanitation",
  "priorityScore": 72,
  "duplicateCount": 8,
  "summary": "Accumulated and overflowing waste causing civic and hygiene concerns.",
  "reason": "Uncollected organic and general waste creates environmental degradation and odor.",
  "status": "OPEN",
  "locationName": "Sector 15 Main Market",
  "latitude": 28.5355,
  "longitude": 77.3910,
  "affectedPeople": 150,
  "createdAt": "2026-08-27T08:47:38.485Z"
}
```

### `GET /api/dashboard/summary`
Returns high-level operational KPIs (Total complaints, High priority count, Critical count, Average score, Top category).

### `GET /api/dashboard/categories`
Returns category breakdown with complaint counts and exact percentage shares.

### `GET /api/dashboard/hotspots`
Returns top recurring incident hotspots with average priority and coordinates.

---

## 9. Google Cloud Deployment

### 1. Enable Required Google Cloud APIs
```bash
gcloud services enable \
  run.googleapis.com \
  bigquery.googleapis.com \
  aiplatform.googleapis.com \
  storage.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### 2. Create BigQuery Dataset & Table
```bash
bq mk --location=us-central1 civiclens
bq query --use_legacy_sql=false < sql/schema.sql
```

### 3. Create Cloud Storage Bucket
```bash
gsutil mb -l us-central1 gs://civiclens-complaint-images
```

### 4. Build and Deploy with Cloud Build
```bash
gcloud builds submit --config=cloudbuild.yaml
```

---

## 10. Looker Studio Integration
1. Open [Looker Studio](https://lookerstudio.google.com).
2. Click **Create** > **Data Source** > Select **BigQuery**.
3. Choose your **Project ID** > Dataset: `civiclens` > Table: `complaints` (or use queries from `sql/dashboard_queries.sql`).
4. Build visual widgets for:
   - **Scorecard**: Total Complaints, High Priority Count, Critical Count.
   - **Pie / Donut Chart**: Complaint Share by Category.
   - **Bar Chart**: Department Workload & Urgent Incidents.
   - **Geo Map (Bubble)**: Hotspots mapped with Latitude & Longitude.

---

## 11. 5 Demo Scenarios
1. **Overflowing Garbage**: `Sector 15 Main Market` -> Category: *Waste Management*, Severity: *High*, Dept: *Municipal Sanitation*, Duplicates: *8*.
2. **Pothole Near School**: `Greenwood School Zone` -> Category: *Road Damage*, Severity: *Critical*, Dept: *Roads Department*, Priority: *85+*.
3. **Broken Streetlights**: `Government Hospital Area` -> Category: *Streetlights*, Severity: *High*, Dept: *Electrical Department*.
4. **Main Pipe Burst**: `Residential Block A` -> Category: *Water Leakage*, Severity: *Critical*, Dept: *Water Department*.
5. **Clogged Storm Drain**: `Central Bus Stand` -> Category: *Drainage*, Severity: *Critical*, Dept: *Drainage Department*.

---

## 12. Future Enhancements
- 🌐 Multilingual Voice & Vernacular Submission
- 📲 Automated WhatsApp & SMS Citizen Updates
- 🛰️ Satellite & Drone Imagery Verification
- ⏱️ SLA Auto-Escalation & Department Dispatch Bots
