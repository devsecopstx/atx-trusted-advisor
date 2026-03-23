# Shared Execution Context: ATX Integration

## ⚡ Live Status
- **Backend Status:** 🏗️ Implementing Auth Controller
- **Frontend Status:** 🎨 Designing Login Form
- **Reviewer Status:** 🔍 Monitoring compliance with `feature-branding.md`

---

## 🛠️ Exported Contracts (API & Types)
*These are draft specifications defined by atx-backend for atx-frontend to use.*

### Authentication Endpoint
- **URL:** `POST /api/v1/auth/login`
- **Request Body:**
  ```json
  {
    "email": "string",
    "password": "string",
    "mfaToken?": "string"
  }