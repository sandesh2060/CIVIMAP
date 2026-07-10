# CIVIMAP

### Real-Time AI-Powered Traffic & Civic Management System

CIVIMAP is a full-stack civic-tech platform that gives citizens a live map with the simplest route, real-time traffic-signal countdowns, and pinned locations of hospitals, schools, tourist spots, and sensitive sites — while letting them report road issues and traffic violations that are automatically verified by AI and routed to a government admin dashboard in real time.

---

## Table of Contents

1. [Vision & Problem Statement](#1-vision--problem-statement)
2. [Goals](#2-goals)
3. [Feature Breakdown](#3-feature-breakdown)
4. [Tech Stack](#4-tech-stack)
5. [System Architecture](#5-system-architecture)
6. [AI/ML Components](#6-aiml-components)
7. [Database Schema](#7-database-schema)
8. [API Documentation](#8-api-documentation)
9. [Real-Time Socket Events](#9-real-time-socket-events)
10. [Notification System](#10-notification-system)
11. [Authentication & Authorization](#11-authentication--authorization)
12. [Admin Dashboard](#12-admin-dashboard)
13. [Citizen Dashboard](#13-citizen-dashboard)
14. [Multilingual Support](#14-multilingual-support)
15. [Security & Privacy](#15-security--privacy)
16. [Error Handling & Logging](#16-error-handling--logging)
17. [Project Structure](#17-project-structure)
18. [Environment Variables](#18-environment-variables)
19. [Installation & Setup](#19-installation--setup)
20. [Running the Project](#20-running-the-project)
21. [Testing Strategy](#21-testing-strategy)
22. [Deployment Guide](#22-deployment-guide)
23. [Known Limitations](#23-known-limitations)
24. [Roadmap](#24-roadmap)
25. [License](#25-license)

---

## 1. Vision & Problem Statement

Cities generate huge amounts of civic and traffic data every day, but citizens have no single trustworthy channel to consume it or contribute to it, and local authorities have no efficient pipeline to verify citizen reports at scale.

**Citizen-side problems:**
- No single map showing the simplest route *and* live signal timing together.
- No visibility into where sensitive sites, hospitals, schools, or tourist spots are relative to their route.
- No easy way to report a pothole or road hazard with proof that gets acted on quickly.
- No way to report a traffic violation without manually writing a complaint and hoping it's read.
- No fast, one-tap way to reach the right emergency department (ambulance, fire, police, rescue) during a disaster or accident, with your exact location handed to them automatically.

**Government-side problems:**
- Manual review of every citizen report doesn't scale — most reports are simple and don't need a human.
- Violation enforcement depends on physical presence of police; citizen-sourced evidence has no verification pipeline.
- No real-time visibility into what's happening on the road network right now.
- Emergency departments often receive incomplete or vague location information from callers in distress, delaying response.

CIVIMAP solves this by pairing a **free, self-hosted mapping/routing stack** with an **AI verification layer** that removes repetitive manual work, while keeping a human admin in the loop for anything the AI isn't confident about — and adds a direct, location-aware emergency dispatch channel for time-critical situations that skips AI entirely in favor of speed.

---

## 2. Goals

- Give citizens a fast, simple, multilingual interface to navigate and stay informed.
- Automate the boring 80% of report verification (AI auto-accept) while keeping a human for the important 20% (AI-flagged or low-confidence cases).
- Build the real-time layer (sockets, live signal state, live pins) with mock data now, in a way that swaps to real hardware/registries later without rewriting the frontend or API contracts.
- Keep the entire stack on free-tier infrastructure so the project is realistically demoable and iterable without cost as a blocker.
- Give citizens a zero-friction way to alert the right emergency department with their exact location in a genuine emergency — this path is intentionally simpler and faster than the AI-verified report/violation flows, since seconds matter.

---

## 3. Feature Breakdown

### 3.1 Live Map & Simplest Routing
- Citizen enters start + destination (or uses current location).
- Backend calls a self-hosted OSRM/GraphHopper instance to compute the fastest/simplest route (fewest turns, avoids closed roads if reported).
- Route renders on the map as a polyline; ETA and distance shown.
- Route recalculates if a road-closure report is approved along the path.

**User story:** *"As a citizen, I want to enter my destination and instantly see the simplest route, so I don't need to think about which road to take."*

### 3.2 Real-Time Traffic Signal Countdown
- Every signal on the map has a marker showing current state (red/yellow/green) and a live countdown in seconds.
- Countdown updates every second via WebSocket, not polling.
- Currently backed by a **mock simulator** on the server (deterministic red→green→yellow cycles per signal), built so a real IoT feed can replace the simulator later without touching the frontend.

**User story:** *"As a driver approaching an intersection, I want to see how many seconds are left on the signal, so I can decide whether to slow down or speed up safely."*

### 3.3 Place Pins (Tourist / Hospital / School / Sensitive / Custom)
- Fixed categories: Tourist Place, Hospital, School, Sensitive/Government Site.
- Admin can add new custom categories from the dashboard.
- Pins are clickable, showing name, category, description, and (if relevant) contact info.
- Citizens can filter the map by category (e.g., "show only hospitals").

**User story:** *"As a tourist, I want to filter the map to only show tourist attractions and hospitals, so I'm not overwhelmed by irrelevant pins."*

### 3.4 Road Issue Reporting (AI-Verified)
- Logged-in citizen submits: photo + description + auto-captured GPS location.
- Report enters `pending` state, queued for AI processing.
- AI model classifies the image (genuine road damage vs irrelevant/spam/fake) and returns a confidence score.
- **High confidence (e.g. >85%)** → auto-approved, pin appears live on the map immediately.
- **Low/medium confidence** → flagged for admin's manual review queue; admin approves or rejects.
- Reporter gets notified of the final status (approved/rejected) via in-app notification.
- Covers general civic issues too, not just road damage — a `category` field (`pothole` | `streetlight` | `garbage` | `water_leak` | `civic_other`) classifies the report so admins can filter the queue and citizens can filter the map; the AI verification step and status lifecycle are identical regardless of category.

**User story:** *"As a citizen, I want to report a pothole with a photo, and have it show up on the map for others as soon as possible, without waiting days for manual approval."*

### 3.5 Traffic Violation Reporting (AI Plate Detection)
- Logged-in citizen photographs a rule-breaking vehicle and uploads it.
- AI pipeline: detect the vehicle → locate the plate region → OCR the plate number → return extracted text + confidence.
- Extracted plate is cross-checked against a **mock vehicle registry** (Nepali-style realistic seed data: plate number, owner name, phone, email, vehicle type).
- On a match, the system **immediately** and in real time:
  - Notifies the (mock) vehicle owner via Email + WhatsApp.
  - Notifies the admin/traffic dashboard via Email + WhatsApp + in-app push.
  - Logs the violation with photo, plate, extracted owner info, GPS location, and timestamp.
- Low-confidence plate reads are flagged for the admin to manually confirm before any notification goes out (prevents false accusations from bad OCR).

**User story:** *"As a citizen, I want to report a vehicle running a red light by just taking a photo, without needing to know who the owner is or how to file a complaint."*

### 3.6 Emergency & Disaster Dispatch (Ambulance / Fire / Police / Rescue)
A separate, deliberately simple flow — no AI, no review queue, no confidence threshold. In a real emergency, the goal is to get a location to the right department in one tap, not to verify anything.

- Citizen opens the **Emergency** panel and picks a department category: **Ambulance**, **Fire**, **Police / Traffic**, or **Disaster Rescue**.
- Location: **use current GPS location** (one tap, default) or **manually drop a pin** on the map (for reporting on behalf of someone else, or when GPS is unreliable indoors).
- Optional short note (e.g. "third floor, building on fire", "collision, two vehicles").
- On send, the system looks up the relevant `EmergencyContact` for that category (by coverage area, falling back to that category's default contact) and dispatches immediately over whichever channel(s) the department has on file:
  - **Email only on file** → email.
  - **Phone/WhatsApp only on file** → WhatsApp.
  - **Both on file** → both, in parallel, so the message isn't dependent on one channel being checked in time.
- The dispatched message always includes: category, citizen's name and phone (so the department can call back), a Google Maps-style link built from the coordinates, the optional note, and a timestamp.
- The alert also appears instantly on the **admin/emergency dashboard** via Socket.io (`emergency:new`), the same way a violation does — this is a monitoring view, not a review queue; there's nothing to approve.
- Citizen sees a confirmation screen with which channel(s) were used and can mark the situation resolved later, which updates `EmergencyAlert.status` and notifies the admin view (`emergency:statusChanged`).

**User story:** *"As a citizen witnessing an accident, I want to tap 'Ambulance', confirm my location, and know it reached someone — without filling out a form or waiting for anything to be reviewed."*

---

## 4. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React + Vite, TailwindCSS | Fast dev loop, already scaffolded, utility-first styling |
| Backend API | Node.js + Express | Matches existing scaffold, huge ecosystem, easy Socket.io integration |
| Real-time | Socket.io | Bi-directional live updates for signals, pins, violations, emergency alerts |
| Database | MongoDB (Atlas free tier) | Flexible schema for mixed geospatial + document data, native 2dsphere indexing |
| Job Queue | BullMQ + Redis | Decouples slow AI processing from the HTTP request/response cycle |
| AI Microservice | Python + FastAPI | Best ecosystem for CV/ML (YOLO, OpenCV, OCR libraries); kept separate from Node so it can scale/deploy independently |
| Plate Detection | YOLOv8 (open-source, self-hosted) | Free, accurate, real-time capable object detection |
| OCR | PaddleOCR / EasyOCR (open-source) | Free, strong accuracy on plate-style text, self-hosted (no per-call API cost) |
| Road Damage Classification | Fine-tuned CNN (MobileNet/ResNet backbone) | Lightweight enough for free-tier hosting, good accuracy for binary/few-class classification |
| Map Tiles | OpenStreetMap | Free, no API key limits, community-maintained |
| Map Rendering | Leaflet + react-leaflet | Free, no API key, lightweight, well-documented — matches the OSM tile choice |
| Routing Engine | OSRM or GraphHopper (self-hosted) | Free and accurate; avoids per-request Google Maps billing |
| Email | Nodemailer + free SMTP | No cost, reliable, simple integration |
| WhatsApp | Twilio WhatsApp Sandbox (dev) → WhatsApp Business API (prod) | Free for development; flagged as a real cost line for production |
| Auth | JWT (access) + refresh tokens, OTP for citizen login | Stateless, standard, and matches the "citizen records come from the registry" model (no self-service password to manage) |
| File Storage | Cloudinary (free tier) | Already integrated in scaffold, handles image uploads well |
| Hosting | Render/Railway (API + AI service), Vercel (client), MongoDB Atlas (DB) | All free tiers, zero cost to run a demo |

---

## 5. System Architecture

```
                         ┌─────────────────────────────┐
                         │        React Client          │
                         │  Map | Reports | Violations   │
                         │  Emergency | Admin Dashboard   │
                         │  i18n                          │
                         └───────────┬─────────┬─────────┘
                                     │ REST      │ WebSocket
                         ┌───────────▼───────────▼─────────┐
                         │      Node.js / Express API        │
                         │  Auth · Reports · Violations       │
                         │  Places · Signals · Route proxy    │
                         │  Emergency dispatch · Socket.io     │
                         └─────┬─────────────┬───────────┬───┘
                               │             │           │
                    ┌──────────▼──┐   ┌──────▼─────┐  ┌──▼─────────────┐
                    │ MongoDB Atlas │   │ BullMQ +   │  │ OSRM/GraphHopper│
                    │ (all data)    │   │ Redis queue │  │ (routing engine)│
                    └───────────────┘   └──────┬─────┘  └─────────────────┘
                                                │
                                     ┌──────────▼───────────┐
                                     │  AI Microservice        │
                                     │  (Python/FastAPI)        │
                                     │  - Plate detection (YOLO)│
                                     │  - OCR (Paddle/EasyOCR)  │
                                     │  - Road damage CV model  │
                                     │  - Image moderation       │
                                     └──────────┬───────────┘
                                                │ result written back
                                     ┌──────────▼───────────┐
                                     │ Notification dispatch  │
                                     │ Email · WhatsApp · Push │
                                     │ (violations + emergency │
                                     │  + OTP all share this)  │
                                     └────────────────────────┘
```

Emergency dispatch is drawn separately from the AI path above on purpose: `POST /api/emergency/alerts` goes straight from the Express controller to notification dispatch — it never touches the job queue or the AI microservice, since there's nothing to verify and any added latency works against the point of the feature.

### End-to-end flow: Road Issue Report
1. Citizen submits photo + description + GPS via `ReportForm.jsx`.
2. `POST /api/reports` saves a `Report` document with `status: pending`, uploads image to Cloudinary, enqueues a job.
3. Worker picks up the job, calls `ai-service /road-damage-verification` with the image URL.
4. AI returns `{ isValid: true/false, confidence: 0.0–1.0 }`.
5. Confidence ≥ threshold → `status: approved`, Socket.io emits `report:new` to all connected clients → pin appears live.
6. Confidence < threshold → `status: flagged`, appears in admin's manual queue (`ReportsPage.jsx` admin view).
7. Admin approves/rejects → status updates → reporter gets an in-app notification either way.

### End-to-end flow: Traffic Violation
1. Citizen uploads violation photo via `ViolationUpload.jsx`.
2. `POST /api/violations` saves a `Violation` document with `status: detected`, enqueues a job.
3. Worker calls `ai-service /plate-detection`, which returns cropped plate image + OCR text + confidence.
4. Backend queries `MockVehicleRegistry` collection for a matching plate.
5. If matched and confidence is high:
   - `Violation.status = notified`
   - Notification dispatch fires Email + WhatsApp to the mock owner's contact info.
   - Email + WhatsApp + Socket.io `violation:new` event fire to the admin dashboard.
6. If confidence is low or no match: `status = flagged` for manual admin confirmation before any notification is sent (prevents false accusations).

### End-to-end flow: Emergency Dispatch
1. Citizen opens `EmergencyPage.jsx`, picks a category (ambulance/fire/police/rescue), and picks a location (current GPS or manual pin via the same `MapView`/`MapPage` click-to-pick pattern used for reports).
2. `POST /api/emergency/alerts` — no queue, no AI. The controller synchronously looks up an active `EmergencyContact` for that category (by coverage area, falling back to that category's default contact) and saves an `EmergencyAlert` document with `status: dispatched`.
3. `notifications/index.js`'s existing `dispatch(owner, admin, payload)` entrypoint is reused, with the emergency department standing in for "owner": it inspects which of `email` / `phone` the matched `EmergencyContact` has on file and sends over exactly those channels — never guesses or sends blind to a channel with no value stored.
4. Socket.io emits `emergency:new` to `admin-room` (same room violations use) so it shows up live on the admin/emergency monitoring view.
5. Citizen's client receives the API response synchronously (not via socket — this response has to be immediate) confirming which channel(s) were actually used, and shows a confirmation screen.
6. Citizen (or admin) can later mark it resolved (`PATCH /api/emergency/alerts/:id/resolve`), which emits `emergency:statusChanged` to admin-room.

### End-to-end flow: Signal Countdown (mock)
1. `sockets/signalSocket.js` runs an in-memory timer per signal ID with a deterministic red→green→yellow cycle length.
2. Every second, the server emits `signal:update` with `{ signalId, state, countdownSeconds }` to clients subscribed to that map viewport.
3. `SignalCountdown.jsx` renders the countdown as a badge on the signal's marker.
4. This emitter is the *only* place that would change when real hardware is introduced — it would read from a hardware feed instead of an in-memory timer, and emit the identical event shape.

### End-to-end flow: Citizen Login (OTP)
1. Citizen enters their email or phone in `LoginPage.jsx`.
2. `POST /api/auth/otp/request` → `otpService.requestLoginOtp()` looks the citizen up (`User.findActiveByIdentifier`), generates a 6-digit code, hashes it (SHA-256) into `loginOtpHash` with a 5-minute expiry, and dispatches the raw code via Email (`emailService.sendOtpEmail`) or WhatsApp (`whatsappService.sendOtpWhatsapp`) depending on which identifier was used. A masked identifier (e.g. `sa***@gmail.com`) is returned so the UI can confirm where the code went.
3. Citizen enters the code in the app; `POST /api/auth/otp/verify` → `otpService.verifyLoginOtp()` runs a timing-safe comparison against the stored hash.
4. On success: OTP is cleared (single-use), the login is recorded (`registerSuccessfulLogin`), and `tokenService.issueTokenPair()` mints an access token (returned in the JSON body) + refresh token (set as an httpOnly, `sameSite: strict` cookie scoped to `/api/auth`).
5. On failure: `registerFailedLogin()` increments a shared attempt counter; after 5 failures the account locks for 15 minutes (`lockUntil`), and both request/verify routes reject with a generic error while locked.

---

## 6. AI/ML Components

### 6.1 Plate Detection Pipeline
```
Input image
   → Vehicle/plate region detector (YOLOv8, pretrained or fine-tuned on plate datasets)
   → Crop plate region
   → OCR (PaddleOCR/EasyOCR) on the cropped region
   → Post-process text (remove noise characters, normalize format)
   → Return { plateText, confidence, croppedImageUrl }
```
- Confidence threshold (configurable, e.g. 0.75) determines auto-notify vs admin-review.
- Self-hosted = no per-image API billing, but requires enough compute (GPU ideal, CPU works for low volume/demo).

### 6.2 Road Damage Verification
```
Input image
   → Preprocessing (resize, normalize)
   → CNN classifier (binary: "genuine road issue" vs "not valid") or multi-class (pothole / crack / debris / flooding / irrelevant)
   → Return { label, confidence }
```
- Can start with a pretrained public road-damage dataset (e.g. RDD2022) fine-tuned on a lightweight backbone for free-tier CPU inference.

### 6.3 Image Moderation
- A simple pre-filter before the above models run: reject non-photographic images, blank images, or obviously irrelevant content (memes, screenshots) to save compute and reduce spam load on the admin queue.

### 6.4 Confidence Threshold Governance
All three AI checks share a common response contract so the Node backend can treat them uniformly:
```json
{
  "confidence": 0.92,
  "result": { ...model-specific fields... },
  "flagForReview": false
}
```
`flagForReview` is `true` whenever confidence falls below the configured threshold for that model — this is what routes a report/violation to the admin queue instead of auto-processing.

> **Note:** the Emergency Dispatch flow (§3.6) deliberately does not go through this pipeline — there is no AI step, no confidence score, and no `flagForReview` concept for an emergency alert. Every alert dispatches immediately.

---

## 7. Database Schema

### User (`server/src/models/User.js`) — citizen accounts only; admins live in a separate `Admin` collection
```js
{
  fullName: String, required,
  email: String, required, unique, lowercase,
  phone: String, required, unique,               // E.164-style, "+" optional, 7–15 digits
  passwordHash: String, select: false,            // optional — kept for a possible legacy/admin-assisted path, never required for citizen login
  profileImage: { url: String, publicId: String },
  dateOfBirth: Date,
  gender: { type: String, enum: ["male","female","other","prefer_not_to_say"] },
  citizenshipNumber: String,                      // optional, sensitive

  address: { province, district, municipality, wardNo, street },
  location: { type: "Point", coordinates: [lng, lat] },   // 2dsphere indexed

  role: { type: String, default: "citizen", immutable: true },
  isActive: Boolean, isBanned: Boolean, banReason: String, bannedAt: Date,

  isEmailVerified: Boolean, isPhoneVerified: Boolean,
  emailVerificationToken: String, emailVerificationExpires: Date,   // select: false

  passwordChangedAt: Date, passwordResetToken: String, passwordResetExpires: Date,
  loginAttempts: Number, lockUntil: Date,          // select: false — shared lockout counter for password AND OTP brute-force
  lastLoginAt: Date, lastLoginIp: String,
  sessions: [{ deviceId, userAgent, ip, lastUsedAt }],

  // --- Login OTP (primary auth path for citizens) ---
  loginOtpHash: String,          // select: false — SHA-256 hash only, raw code never stored
  loginOtpExpires: Date,         // select: false — 5-minute TTL
  loginOtpLastSentAt: Date,      // select: false — enforces a 45s resend cooldown

  languagePref: { type: String, enum: ["en","ne"], default: "en" },
  notificationPrefs: { email, whatsapp, sms, push },
  theme: { type: String, enum: ["light","dark","system"] },

  stats: { reportsSubmitted, reportsApproved, reportsRejected, violationsSubmitted, violationsConfirmed, violationsRejected, emergencyAlertsSent },
  trustScore: { type: Number, default: 50, min: 0, max: 100 },

  isDeleted: Boolean, deletedAt: Date,
  timestamps: true   // createdAt, updatedAt
}
```
Citizen records are seeded from the national registry rather than created via self-registration, which is why login is OTP-only (email or phone, auto-detected) instead of a signup+password flow.

### Report (road issues & general civic issues)
```js
{
  reportedBy: { type: ObjectId, ref: "User", required: true },
  imageUrl: String, required,
  description: String, required,
  category: {
    type: String,
    enum: ["pothole", "streetlight", "garbage", "water_leak", "civic_other"],
    default: "civic_other",
  },
  location: { lat: Number, lng: Number },       // 2dsphere indexed
  status: { type: String, enum: ["pending","approved","flagged","rejected"], default: "pending" },
  aiConfidence: Number,
  adminReviewedBy: { type: ObjectId, ref: "User" },
  createdAt: Date, default: now
}
```

### Violation
```js
{
  reportedBy: { type: ObjectId, ref: "User", required: true },
  imageUrl: String, required,
  extractedPlateNumber: String,
  aiConfidence: Number,
  matchedOwner: {
    name: String, phone: String, email: String, vehicleType: String
  },
  location: { lat: Number, lng: Number },
  status: { type: String, enum: ["detected","notified","flagged","reviewed"], default: "detected" },
  notifiedAt: Date,
  createdAt: Date, default: now
}
```

### Place (map pins)
```js
{
  name: String, required,
  category: { type: String, required: true },   // fixed set + custom admin-added
  location: { lat: Number, lng: Number },        // 2dsphere indexed
  description: String,
  addedBy: { type: ObjectId, ref: "User" },
  createdAt: Date, default: now
}
```

### TrafficSignal
```js
{
  signalId: String, required, unique,
  location: { lat: Number, lng: Number },
  currentState: { type: String, enum: ["red","yellow","green"] },
  countdownSeconds: Number,
  isMock: { type: Boolean, default: true },
  lastUpdated: Date
}
```

### MockVehicleRegistry (seed data)
```js
{
  plateNumber: String, required, unique,   // e.g. "BA 2 PA 1234" (Nepali format)
  ownerName: String,
  phone: String,
  email: String,
  vehicleType: String   // "car" | "bike" | "truck" | "bus"
}
```

### EmergencyContact (seed data — real or mock department directory)
```js
{
  department: String, required,              // e.g. "Kathmandu Metropolitan Ambulance Service"
  category: {
    type: String,
    required: true,
    enum: ["ambulance", "fire", "police", "rescue"],
  },
  phone: String,                              // optional — WhatsApp dispatch uses this if present
  email: String,                              // optional — email dispatch uses this if present
  coverageArea: { province, district, municipality },   // used to pick the right department when several exist per category
  location: { lat: Number, lng: Number },     // optional, for "nearest department" lookups later
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false }, // fallback contact for its category if no coverage-area match
  createdAt: Date, default: now
}
```
At least one of `phone` / `email` is required (enforced at the schema level) — a contact with neither can't actually receive a dispatch.

### EmergencyAlert
```js
{
  reportedBy: { type: ObjectId, ref: "User", required: true },
  category: {
    type: String,
    required: true,
    enum: ["ambulance", "fire", "police", "rescue"],
  },
  location: { lat: Number, lng: Number, required: true },   // 2dsphere indexed
  note: String,                                              // optional free-text context from the citizen
  contactedDepartment: { type: ObjectId, ref: "EmergencyContact", required: true },
  channelsUsed: [{ type: String, enum: ["email", "whatsapp"] }],   // populated at dispatch time from what actually fired
  status: { type: String, enum: ["dispatched", "acknowledged", "resolved"], default: "dispatched" },
  dispatchedAt: Date, default: now,
  resolvedAt: Date,
  resolvedBy: { type: ObjectId, ref: "User" },   // citizen or admin who marked it resolved
  createdAt: Date, default: now
}
```

---

## 8. API Documentation

### Auth
| Method | Path | Auth | Rate limit | Body | Response |
|---|---|---|---|---|---|
| POST | `/api/auth/otp/request` | none | `otpRequestLimiter` + 45s resend cooldown per account | `{identifier}` (email or phone) | `{channel, maskedIdentifier}` |
| POST | `/api/auth/otp/verify` | none | `otpVerifyLimiter` + 5-attempt lockout | `{identifier, code, deviceId}` | `{user, accessToken}` (refresh token as httpOnly cookie) |
| POST | `/api/auth/admin/login` | none | `authLimiter` | `{email, password}` | `{admin, accessToken}` (refresh token as httpOnly cookie) |
| POST | `/api/auth/refresh` | cookie | — | — | `{accessToken}` |
| POST | `/api/auth/logout` | cookie | — | — | `{success: true}` |
| GET | `/api/auth/me` | JWT | — | — | `{account, accountType}` |

Citizens authenticate via OTP only — there is no `/register` or citizen `/login` with a password; accounts are provisioned from the national registry ahead of time. Admins are a separate collection (`models/admin/Admin.js`) and use standard email+password login.

### Reports
| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/reports` | citizen | `{image, description, category, location}` | `{report}` (status: pending) |
| GET | `/api/reports` | any | query: `status`, `category`, `bbox` | `{reports: []}` |
| GET | `/api/reports/:id` | any | — | `{report}` |
| PATCH | `/api/reports/:id/review` | admin | `{decision: "approved"|"rejected"}` | `{report}` |

### Violations
| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/violations` | citizen | `{image, location}` | `{violation}` (status: detected) |
| GET | `/api/violations` | admin | query: `status` | `{violations: []}` |
| GET | `/api/violations/:id` | admin | — | `{violation}` |
| PATCH | `/api/violations/:id/review` | admin | `{decision: "confirmed"|"rejected"}` | `{violation}` |

### Places
| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/places` | any | query: `category`, `bbox` | `{places: []}` |
| POST | `/api/places` | admin | `{name, category, location, description}` | `{place}` |
| PUT | `/api/places/:id` | admin | `{...fields}` | `{place}` |
| DELETE | `/api/places/:id` | admin | — | `{success: true}` |
| POST | `/api/places/categories` | admin | `{name}` | `{category}` |

### Signals
| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/api/signals` | any | `{signals: []}` (initial state; live updates via socket) |

### Route
| Method | Path | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/api/route` | any | `from=lat,lng&to=lat,lng` | `{polyline, distanceMeters, durationSeconds}` |

### Emergency
| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/emergency/contacts` | any | query: `category` | `{contacts: []}` (public — citizens can see who they'd be reaching before sending) |
| POST | `/api/emergency/alerts` | citizen | `{category, location, note?}` | `{alert, channelsUsed: []}` — synchronous, no queue |
| GET | `/api/emergency/alerts` | admin | query: `status`, `category` | `{alerts: []}` |
| GET | `/api/emergency/alerts/:id` | admin or the citizen who sent it | — | `{alert}` |
| PATCH | `/api/emergency/alerts/:id/resolve` | admin or the citizen who sent it | — | `{alert}` |
| POST | `/api/emergency/contacts` | admin | `{department, category, phone?, email?, coverageArea?, location?, isDefault?}` | `{contact}` |
| PUT | `/api/emergency/contacts/:id` | admin | `{...fields}` | `{contact}` |
| DELETE | `/api/emergency/contacts/:id` | admin | — | `{success: true}` |

---

## 9. Real-Time Socket Events

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `signal:update` | server → client | `{signalId, state, countdownSeconds}` | Live signal countdown, every second |
| `report:new` | server → client (all) | `{report}` | New approved report pin appears live |
| `report:statusChanged` | server → client | `{reportId, status}` | Notify reporter of admin decision |
| `violation:new` | server → admin | `{violation}` | New violation appears on admin dashboard instantly |
| `violation:notified` | server → admin | `{violationId}` | Confirms owner + police notification was dispatched |
| `place:new` / `place:updated` / `place:deleted` | server → client (all) | `{place}` | Live pin sync across all connected clients |
| `emergency:new` | server → admin | `{alert}` | New emergency alert appears on admin/emergency dashboard instantly |
| `emergency:statusChanged` | server → admin, and → the reporting citizen's room | `{alertId, status}` | Alert acknowledged/resolved |

---

## 10. Notification System

**Trigger:** AI confirms a plate match with sufficient confidence (or admin manually confirms a flagged one); an emergency alert is dispatched (§3.6) — plus the OTP login code itself (section 11). All four reuse the same Email/WhatsApp channels and the same `notifications/index.js` `dispatch(owner, admin, payload)` entrypoint.

**Channel selection logic (violations and emergency alerts both follow this — decided per-recipient from what contact info is actually on file, never assumed):**
- Only an email on file → send email only.
- Only a phone/WhatsApp number on file → send WhatsApp only.
- Both on file → send both, in parallel, so delivery isn't dependent on the recipient checking one channel in time.
- Neither on file → not possible for `EmergencyContact` (schema-enforced, see §7); for the mock vehicle registry this is treated as a dispatch failure and logged (§16).

**Dispatch (parallel, all real-time):**
1. **Email** via Nodemailer — sent to mock owner's email and admin's email (and to the citizen for OTP delivery, and to the matched emergency department when they have an email on file).
2. **WhatsApp** via Twilio WhatsApp Sandbox (dev) — sent to mock owner's phone and admin's phone (and to the citizen for OTP delivery, and to the matched emergency department when they have a phone on file).
3. **In-app push** via Socket.io — admin dashboard updates instantly without refresh (`violation:new`, `emergency:new`).

**Message template (owner-facing, violation):**
```
Subject: Traffic Violation Notice — Plate {plateNumber}
Your vehicle was reported for a traffic violation at {location} on {timestamp}.
Reference ID: {violationId}. Please contact the traffic authority if you believe this is an error.
```

**Message template (admin-facing, violation):**
```
New violation detected — Plate {plateNumber}, Location {location}, Confidence {confidence}%.
View: {dashboardLink}
```

**Message template (citizen-facing, OTP):**
```
Your CIVIMAP login code is: {code}
This code expires in 5 minutes. Didn't request this? You can ignore this message.
```

**Message template (department-facing, emergency alert):**
```
Subject: CIVIMAP Emergency Alert — {category}
{citizenName} ({citizenPhone}) reported a {category} emergency.
Location: {mapsLink}
Note: {note, or "No additional details provided"}
Reported at: {timestamp} · Alert ID: {alertId}
```

---

## 11. Authentication & Authorization

CIVIMAP uses two separate account types with two separate login mechanisms — they intentionally don't share a flow, since citizens and admins have different trust models.

### 11.1 Citizen login — OTP only
Citizen accounts have no password requirement (`passwordHash` is optional and never populated for normal citizen login). Instead:

1. **Request** (`POST /api/auth/otp/request`): citizen submits an email or phone; the server auto-detects which one (`normalizeIdentifier`) and looks up the account. If found, active, and not locked/banned, a 6-digit code is generated, **hashed with SHA-256 before storage** (the raw code is never persisted), given a **5-minute expiry**, and sent via Email or WhatsApp depending on the channel used. A **45-second cooldown** prevents resend spam.
2. **Verify** (`POST /api/auth/otp/verify`): citizen submits the code back. The server hashes the candidate and compares it to the stored hash using `crypto.timingSafeEqual` (constant-time, to resist timing attacks), and checks the expiry.
3. **On success**: the OTP is immediately cleared (single-use — it cannot be replayed), the login event is recorded (timestamp, IP, device session), and a token pair is issued (see 11.3).
4. **On failure**: a shared `loginAttempts` counter increments; after **5 failed attempts the account locks for 15 minutes** (`lockUntil`). This counter is shared between the (currently citizen-unused) password path and the OTP path, so both count toward the same lockout.
5. Error messages during verify are deliberately generic ("Invalid or expired code") so a wrong code, an expired code, and a nonexistent account can't be distinguished by an attacker at that step.

> **Note:** the `/otp/request` step currently does distinguish "no account found" from other errors, which combined with (5) means account existence can still be inferred at the request stage. If stricter enumeration resistance is required, `/otp/request` should be changed to always respond as if a code was sent, regardless of whether the identifier matches a citizen.

### 11.2 Admin login — email + password
Admins are a **separate Mongo collection** (`models/admin/Admin.js`), not a role on the `User` schema — this keeps citizen and admin security postures (and blast radius, if one is compromised) independent. Admin login (`POST /api/auth/admin/login`) follows a conventional bcrypt password check with the same lockout mechanics as above.

### 11.3 Tokens (shared by both account types)
- **Access token**: short-lived JWT (~15 min, `env.ACCESS_TOKEN_TTL`), payload `{ sub: id, accountType }`, returned in the JSON response body and sent as `Authorization: Bearer <token>` on subsequent requests.
- **Refresh token**: longer-lived, stored as an **httpOnly, `secure` (in production), `sameSite: strict`** cookie scoped to `/api/auth` only — never exposed to client-side JS, and rotated on every use (`RefreshToken.rotate`) so a stolen refresh token can only be replayed once before the rotation invalidates it.
- `middleware/auth.js` reads `accountType` off the verified JWT to know whether to load the account from the `User` or `Admin` collection, so a single `protect` middleware serves both citizen and admin routes.
- `revokeAllSessions` (in `tokenService.js`) supports a "log out of all devices" action by invalidating every refresh token tied to an account.

### 11.4 Authorization
- Role/account-type check happens via `req.accountType`, set by `protect` after verifying the JWT — admin-only routes (report review, violation review, place CRUD, emergency contact CRUD) check for `accountType === "admin"`.
- Emergency alert creation is citizen-only (`POST /api/emergency/alerts`), but resolving an alert (`PATCH /api/emergency/alerts/:id/resolve`) is allowed for either an admin *or* the citizen who originally sent it — checked as `req.accountType === "admin" || alert.reportedBy.equals(req.accountId)`.
- Rate limiting (`otpRequestLimiter`, `otpVerifyLimiter`, `authLimiter` in `middleware/rateLimiter.js`) applies per-route in addition to the account-level lockout, so both a single account and a single IP are protected against brute-force attempts. `POST /api/emergency/alerts` also gets its own limiter (`emergencyAlertLimiter`) — generous enough not to block someone in a genuine fast-moving emergency, but enough to stop automated abuse of a channel that pages a real department.

---

## 12. Admin Dashboard

- **Overview:** live counts of pending reports, flagged violations, active signals, total pins, open emergency alerts.
- **Reports queue:** list of `flagged` reports with image, description, category, location, AI confidence — approve/reject buttons.
- **Violations queue:** list of `detected`/`flagged` violations with photo, extracted plate, matched owner info, confidence — confirm/reject buttons.
- **Emergency monitor:** live list of `dispatched`/`acknowledged` alerts (no approve/reject — this is visibility, not review) with category, location, citizen contact, which channel(s) were notified, and a resolve action; updates instantly via `emergency:new`/`emergency:statusChanged`.
- **Place management:** add/edit/delete pins, create custom categories.
- **Emergency contact management:** add/edit/deactivate department contacts per category and coverage area.
- **Live map view:** same map as citizens see, plus all pending/flagged items and open emergency alerts overlaid for spatial context.

## 13. Citizen Dashboard

- **Map view:** route search, live signals, filterable place pins.
- **My Reports:** track status of submitted road-issue/civic-issue reports.
- **My Violation Reports:** track status of submitted violation reports (does not show other citizens' submissions).
- **Emergency:** one-tap category buttons (Ambulance / Fire / Police / Rescue), current-location or manual-pin location picker, optional note, send — with a confirmation of which channel(s) reached the department, and a history of the citizen's own past alerts with resolve status.
- **Settings:** language preference, notification preferences, profile.

---

## 14. Multilingual Support

- i18n scaffolded via `LanguageContext.jsx` + `translations.js`.
- Launch languages: **English, Nepali** — architecture supports adding more without code changes to components (just new translation JSON + locale entry).
- Number formatting (`numbers.js`) handles locale-specific digit/number display (e.g., Devanagari numerals if needed later).
- Emergency category labels and the confirmation/resolve copy are translated first among any new feature strings, since this flow is the one most likely to be used under stress by a non-English-comfortable citizen.

---

## 15. Security & Privacy

- Admin passwords hashed with bcrypt — never stored plain; citizens have no password to store at all in the normal flow.
- Login OTPs are **never stored in plaintext** — only a SHA-256 hash, with a 5-minute expiry and single-use enforcement.
- OTP comparison is **timing-safe** (`crypto.timingSafeEqual`) to resist timing side-channel attacks.
- Shared brute-force lockout (5 attempts → 15-minute lock) applies to both OTP verification and admin password login.
- Refresh tokens are httpOnly + `sameSite: strict` cookies, rotated on every use, so they're inaccessible to client-side JS and can't be silently replayed after rotation.
- Uploaded images scanned by the moderation model before reaching admin queue (reduces spam/abuse surface).
- Mock vehicle registry data is clearly **synthetic** — no real personal data is used or exposed; this must be explicitly documented in any public repo/demo to avoid implying real citizen data is being processed.
- Rate limiting on OTP request/verify, report/violation submission, and emergency alert creation endpoints to prevent spam or targeted harassment via mass false-reporting or false emergency pages.
- Low-confidence violation matches are never auto-notified — always require admin confirmation, to avoid falsely accusing a vehicle owner.
- Emergency alerts carry the citizen's real name and phone number to the receiving department by design (so they can call back) — this is the one place in the app where a citizen's identity is deliberately shared externally, and should be called out explicitly in any privacy notice shown before first use of the feature.
- HTTPS enforced in production (handled by Render/Railway/Vercel by default on free tiers).
- CORS locked to known frontend origin(s) only.
- **Open item:** `/api/auth/otp/request` currently reveals whether an identifier belongs to a registered citizen via a distinct error message — see section 11.1 note. Track this as a hardening task before any public-facing deployment.

---

## 16. Error Handling & Logging

- Centralized `errorHandler.js` middleware — consistent error response shape (`ApiError.js`/`ApiResponse.js` already scaffolded).
- `logger.js` (already scaffolded) should log: auth failures, AI service errors/timeouts, job queue failures, notification dispatch failures — each with enough context to debug without exposing sensitive data in logs.
- AI service failures (timeout, model error) should **not** silently drop a report/violation — fallback to `flagged` status for manual admin review rather than losing the submission.
- Emergency dispatch failures are the highest-severity log case in the app: if neither Email nor WhatsApp can be reached for the matched `EmergencyContact` (SMTP down, Twilio error, etc.), this must be logged at error level immediately and surfaced on the admin dashboard as a failed dispatch — silently swallowing a failed emergency notification is unacceptable, unlike a failed OTP resend which the citizen can just retry.

---

## 17. Project Structure

This reflects the actual current repository tree.

```
CIVIMAP/
├── ai-service/
│   ├── app.py
│   ├── requirements.txt
│   ├── models/
│   │   └── __init__.py                    # place trained/pretrained weights here
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── plate_detection.py             # YOLO + OCR endpoint
│   │   ├── road_damage_verification.py    # CNN classifier endpoint
│   │   └── image_moderation.py            # pre-filter endpoint
│   └── utils/
│       ├── __init__.py
│       └── preprocessing.py               # shared image preprocessing helpers
│
├── client/
│   ├── index.html, package.json, vite.config.js, tailwind.config.js, postcss.config.js
│   ├── public/ (favicon.svg, logo.jpg)
│   └── src/
│       ├── App.jsx, App.css, main.jsx, index.css
│       ├── components/
│       │   ├── HyperBackground.jsx, LangFade.jsx, LiquidGlass.jsx, Preloader.jsx, ProtectedRoute.jsx
│       │   ├── dashboard/ (BarChart, DashboardLayout, Sidebar, StatCard, Topbar)
│       │   ├── map/ (MapView, PlacePin, RouteLayer, SignalCountdown)
│       │   ├── report/ (ReportCard, ReportForm)
│       │   ├── violation/ (ViolationCard, ViolationUpload)
│       │   ├── emergency/ (CategoryButton, LocationPicker, EmergencyConfirmation, AlertCard)
│       │   └── ui/ (AuthCard, Button, FormField)
│       ├── config/tokens.js
│       ├── context/AuthContext.jsx
│       ├── data/                          # currently empty — reserved for static/mock data (e.g. mock signal configs, seed category lists)
│       ├── hooks/useTheme.js
│       ├── i18n/ (LanguageContext, numbers, translations)
│       ├── pages/
│       │   ├── admin/ (AdminDashboard, AdminLoginPage, ReportsPage, EmergencyMonitorPage)
│       │   └── user/
│       │       ├── LoginPage, RegisterPage, WelcomePage
│       │       └── dashboard/ (MapPage, OverviewPage, ReportsPage, EmergencyPage, SettingsPage, UserDashboard)
│       ├── services/api.js, socket.js
│       └── utils/polyline.js
│
└── server/
    └── src/
        ├── app.js, index.js, server.js
        ├── config/ (cloudinary.js, db.js, env.js)
        ├── controllers/ (authController, mapController, placeController, reportController, signalController, violationController, emergencyController)
        ├── jobs/ (queue.js, reportVerificationJob.js, violationDetectionJob.js)
        ├── middleware/ (auth.js, errorHandler.js, rateLimiter.js, upload.js, validate.js)
        ├── models/
        │   ├── Place.js, RefreshToken.js, Report.js, TrafficSignal.js, User.js, Violation.js
        │   ├── MockVehicleRegistry.js       # seed table: plate → mock owner info
        │   ├── EmergencyContact.js, EmergencyAlert.js
        │   └── admin/Admin.js
        ├── notifications/
        │   ├── emailService.js             # Nodemailer dispatch (incl. OTP email, emergency dispatch)
        │   ├── whatsappService.js          # Twilio WhatsApp dispatch (incl. OTP WhatsApp, emergency dispatch)
        │   └── index.js                    # unified dispatch(owner, admin, payload) entrypoint
        ├── routes/ (authRoutes, mapRoutes, placeRoutes, reportRoutes, signalRoutes, violationRoutes, emergencyRoutes)
        ├── services/ (authService.js, tokenService.js, otpService.js, emergencyService.js)
        ├── sockets/ (index.js, mapSocket.js, reportSocket.js, signalSocket.js, emergencySocket.js)
        ├── uploads/                        # local temp storage before Cloudinary upload (gitignored)
        ├── utils/
        │   ├── ApiError.js, ApiResponse.js, crypto.js, email.js, logger.js, tokens.js
        │   ├── identifier.js                # normalizeIdentifier — detects email vs phone for OTP login
        │   └── aiServiceClient.js          # thin HTTP client wrapping calls to ai-service
        ├── seed/emergencyContacts.seed.js  # seed script — Nepali-realistic ambulance/fire/police/rescue directory per category
        └── validators/ (authValidators.js, reportValidators.js, violationValidators.js, emergencyValidators.js)
```

**Removed from the original scaffold (cleanup applied):**
- `server/src/models/users/User.js` — duplicate of `models/User.js`
- `server/src/database/` — empty, redundant with `config/db.js`
- `server/cookies.txt` — dev artifact, should never be committed (add to `.gitignore`)
- `server/src/auth/` (top-level) — empty, redundant with `middleware/auth.js` + `services/authService.js`

**Added in this pass:**
- `models/MockVehicleRegistry.js` — required for the violation→owner lookup flow described in sections 6 and 10
- `notifications/emailService.js`, `notifications/whatsappService.js`, `notifications/index.js` — the folder existed but had no files; this is where the Email/WhatsApp dispatch logic from section 10 actually lives
- `utils/aiServiceClient.js` — centralizes all HTTP calls from Node → the Python AI service, so `reportVerificationJob.js` and `violationDetectionJob.js` don't each hand-roll their own fetch logic
- `services/otpService.js`, `utils/identifier.js` — implement the citizen OTP login flow described in section 11
- `models/EmergencyContact.js`, `models/EmergencyAlert.js`, `controllers/emergencyController.js`, `routes/emergencyRoutes.js`, `services/emergencyService.js`, `sockets/emergencySocket.js`, `seed/emergencyContacts.seed.js`, `validators/emergencyValidators.js` — the Emergency & Disaster Dispatch feature (§3.6, §7, §8, §9)
- `client/src/components/emergency/*`, `client/src/pages/user/dashboard/EmergencyPage.jsx`, `client/src/pages/admin/EmergencyMonitorPage.jsx` — citizen-facing dispatch UI and the admin monitoring view
- `client/src/services/socket.js`, `client/src/utils/polyline.js` — shared Socket.io client singleton and OSRM polyline decoder, factored out during the live-map integration pass so `MapPage`, `ReportsPage`, and `EmergencyPage` all reuse the same connection and geometry helper instead of each rolling their own

---

## 18. Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `MONGO_URI` | server | MongoDB Atlas connection string |
| `JWT_SECRET` | server | Signs access tokens |
| `REFRESH_TOKEN_SECRET` | server | Signs refresh tokens |
| `ACCESS_TOKEN_TTL` | server | Access token lifetime (defaults to `15m`) |
| `REFRESH_TOKEN_TTL_MS` | server | Refresh token cookie/DB lifetime |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | server | Image upload storage |
| `REDIS_URL` | server, jobs | BullMQ job queue backend |
| `AI_SERVICE_URL` | server | Base URL for the Python AI microservice |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | server | Email notification + OTP dispatch + emergency dispatch |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_NUMBER` | server | WhatsApp notification + OTP dispatch + emergency dispatch |
| `OSRM_SERVER_URL` | server | Self-hosted routing engine endpoint |
| `AI_CONFIDENCE_THRESHOLD` | server, ai-service | Shared threshold for auto-accept vs admin-review |
| `CLIENT_ORIGIN` | server | Used to build links in emails (verification, password reset, admin dashboard) and to lock down CORS |
| `NODE_ENV` | server | Toggles `secure` flag on the refresh-token cookie in production |
| `VITE_API_BASE_URL` | client | Points frontend to backend API |
| `VITE_SOCKET_URL` | client | Points frontend's Socket.io client to the backend socket server |

---

## 19. Installation & Setup

**Prerequisites:**
- Node.js ≥ 18, npm
- Python ≥ 3.10, pip
- MongoDB Atlas account (free tier) or local MongoDB
- Redis instance (Upstash free tier works well for hosted Redis)
- Cloudinary account (free tier)
- Twilio account (free sandbox for WhatsApp)

**Steps:**
```bash
git clone <your-repo-url>
cd CIVIMAP

# Server
cd server
npm install
cp .env.example .env   # fill in values from section 18
cd ..

# Client
cd client
npm install
cp .env.example .env
cd ..

# AI service
cd ai-service
pip install -r requirements.txt --break-system-packages
```

After the server dependencies are installed, run the emergency contact seed script once so `POST /api/emergency/alerts` has real departments to match against:
```bash
cd server
node src/seed/emergencyContacts.seed.js
```

---

## 20. Running the Project

```bash
# Terminal 1 — AI service
cd ai-service && python app.py

# Terminal 2 — Server (API + sockets + job worker)
cd server && npm run dev

# Terminal 3 — Client
cd client && npm run dev
```

Default local ports (adjust as needed): Client `5173`, Server `5000`, AI service `8000`.

---

## 21. Testing Strategy

- **Unit tests:** model validation, controller logic, AI response-parsing utilities, OTP generation/hash/expiry/lockout logic, emergency channel-selection logic (email-only / whatsapp-only / both / neither-should-be-impossible).
- **Integration tests:** full report/violation flow — submit → queue → AI mock response → status update → socket emission; full OTP flow — request → email/WhatsApp dispatch (mocked) → verify → token issuance; full emergency flow — submit alert → contact lookup → dispatch (mocked Email/WhatsApp) → socket emission → resolve.
- **AI service tests:** feed known sample images (clear plate, blurry plate, irrelevant image) and assert confidence/threshold behavior.
- **Manual QA:** verify countdown timers stay in sync across multiple browser tabs; verify admin queue updates live without refresh; verify OTP resend cooldown and lockout trigger correctly; verify an emergency alert reaches the correct department contact and that the channel(s) used match what's actually on file for that contact (no channel invented, none silently skipped).

---

## 22. Deployment Guide

1. **MongoDB Atlas** — create free-tier cluster, whitelist `0.0.0.0/0` for initial testing (restrict later), get connection string.
2. **Redis** — Upstash free tier, get connection URL.
3. **AI service** — deploy to Render/Railway as a separate web service (Python), expose its URL as `AI_SERVICE_URL` in the Node server's env.
4. **Server** — deploy to Render/Railway, set all env vars from section 18, and run the emergency contact seed script once against the production database.
5. **Client** — deploy to Vercel, set `VITE_API_BASE_URL` and `VITE_SOCKET_URL` to the deployed server URL.
6. **OSRM** — either run in a Docker container on the same host as the server (if resources allow) or use a smaller regional map extract to fit free-tier memory limits.
7. Test full flow end-to-end in the deployed environment before considering it "live," including the OTP login path with real email/WhatsApp delivery, and a real test emergency alert to a contact you control so you're not paging an actual department by mistake.

---

## 23. Known Limitations

- Signal data is mocked — not connected to real hardware yet.
- Vehicle registry is mocked/synthetic — no real owner lookup exists publicly.
- WhatsApp notifications are free only in Twilio's sandbox mode; production-scale use has a real cost.
- Free-tier hosting means cold starts and resource caps — fine for demo, not for production-scale real-time claims.
- AI model accuracy depends on image quality; admin fallback exists specifically because AI won't be perfect.
- `/api/auth/otp/request` currently allows account-existence enumeration via its error message (see sections 11.1 and 15) — flagged for hardening, not yet fixed.
- Emergency contact directory is seed/demo data unless explicitly replaced with a verified real department list — **do not point this feature at real citizens without confirming the seeded contacts are correct and monitored**, since a stale or mock department contact receiving a genuine emergency alert with nobody reading it is worse than not having the feature at all.
- There is currently no phone-call fallback (e.g. auto-dial or SMS-to-landline) if a department has no email or WhatsApp on file for their region — Email/WhatsApp are the only two dispatch channels in this version.

---

## 24. Roadmap

- Replace mock signals with real IoT hardware feed.
- Replace mock vehicle registry with a real government data-sharing integration (requires legal agreement).
- Move WhatsApp to approved Business API tier.
- Add PWA/offline support.
- Multi-role admin hierarchy if a single admin no longer scales.
- SMS fallback channel for non-smartphone users, and as an emergency-dispatch fallback channel.
- Expand language support beyond English/Nepali.
- Close the OTP enumeration gap on `/api/auth/otp/request`.
- Partner with real emergency departments to replace the seeded `EmergencyContact` directory, including a verification workflow before a department goes live.
- "Nearest department" routing for emergency dispatch using `EmergencyContact.location` + citizen coordinates, instead of coverage-area/default matching only.

---

## 25. License

Add your chosen license here (e.g., MIT) before making the repository public.


