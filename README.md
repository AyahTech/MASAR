# MASAR — Multi-Agentic Skill Adaptive Roadmap

![Status](https://img.shields.io/badge/status-MVP%20Challenge-5B2C8F)
![Made with](https://img.shields.io/badge/made%20with-AI%20Agents-3B1E63)
![Region](https://img.shields.io/badge/focus-Oman%20%7C%20Higher%20Education-F2C14E)
![License](https://img.shields.io/badge/license-MIT-blue)

> An AI-powered, multi-agentic learning companion that adapts to how each university student actually learns — instead of asking them to adapt to static content.

---

##  Table of Contents

- [Description](#-description)
- [Why We Built This](#-why-we-built-this)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [How It Works](#-how-it-works)
- [Getting Started](#-getting-started)
- [Usage](#-usage)
- [Challenges We Faced](#-challenges-we-faced)
- [Roadmap](#-roadmap)
- [Team](#-team)
- [Acknowledgements](#-acknowledgements)
- [License](#-license)

---

##  Description

**MASAR** (Arabic: مسار, "path") is a multi-agent AI platform built for Omani university students. Instead of delivering the same static lecture, PDF, or course structure to every learner, MASAR deploys a coordinated system of specialized AI agents that observe how a student engages with material, diagnose where they're struggling, and adapt content, pacing, and format in real time.

The result: a learning path shaped around the student, not a fixed curriculum applied uniformly to everyone.

MASAR was built for the **AI Agent MVP Challenge**, in partnership with **Riyada**, the **Youth Center**, and **Dhofar**.

---

##  Why We Built This

Behind every Omani university student who opens an online lecture and closes it within five minutes lies one overlooked cause: no one has ever asked them *how* they learn. Internet access, platforms, and content all exist — yet thousands of students still disengage, and every course drop-off represents tuition paid, time invested, and confidence lost.

MASAR exists to close that gap between **access to education** and **actually learning from it**.

---

## ✨ Key Features

-  **Adaptive Learning Path** — content, difficulty, and pacing adjust to each student in real time
-  **Multi-Agent System** — an orchestrator (LLM) coordinates specialized Diagnostic, Content, and Engagement agents
-  **Companion Chat** — a conversational AI companion available throughout the course
-  **Lecturer Analytics Portal** — engagement trends and at-risk-student flags for instructors
-  **Secure Data Handling** — student data stored in an encrypted, access-controlled cloud database
-  **Local Context (Roadmap)** — future support for the Omani dialect and locally-tuned AI

---

##  Tech Stack

| Layer | Technology |
|---|---|
| Orchestration / Brain | LLM-based agent orchestrator |
| Agents | Diagnostic Agent, Content Agent, Engagement Agent |
| Memory | Short-term (session) + long-term (student profile) |
| Data Sources | Course materials, engagement signals, student goals |
| Storage | Encrypted cloud database |
| Frontend | Web-based student dashboard + lecturer analytics portal |

---

## How It Works

1. The student shares a goal and interacts with course material through MASAR.
2. The **Diagnostic Agent** analyzes their current level from quiz results and engagement signals.
3. The **Content Agent** generates or retrieves content matched to that level.
4. The **Engagement Agent** monitors real-time signals (time-on-lecture, drop-off points, inactivity) and triggers timely nudges.
5. Routine adjustments happen autonomously; sustained disengagement or at-risk performance is escalated to the lecturer or academic advisor.

---

##  Getting Started

> This project is currently at the MVP / concept-validation stage for the AI Agent MVP Challenge. Setup instructions will be added as the technical build progresses.

```bash
# Clone the repository
git clone https://github.com/<your-org>/masar.git
cd masar

# Install dependencies (once the codebase is added)
npm install

# Configure environment variables
cp .env.example .env
# add your LLM API key and database credentials

# Run locally
npm run dev
```

---

##  Usage

Once running, students can:
- Set a learning goal and receive a personalized path
- Chat with the MASAR companion for explanations and follow-up questions
- Track their progress on the adaptive dashboard

Lecturers and institutions can:
- View cohort-level engagement on the analytics portal
- Review at-risk-student flags
- Export course-level reports

---

##  Challenges We Faced

- Designing agent **decision logic** for when the system should act autonomously versus escalate to a human
- Balancing **personalization** with **student data privacy**
- Scoping a **realistic MVP** within the challenge timeline while keeping the long-term multi-agent vision intact

---

##  Roadmap

- [ ] Local AI tuned for Omani language, culture, and educational context
- [ ] Lock-screen micro-content and reminders
- [ ] VR-based immersive learning experiences
- [ ] Native Omani dialect conversational support
- [ ] Expansion beyond Oman into the wider Arab world

---

## 👥 Team

**Team MASAR** — AI Agent MVP Challenge (Riyada × Youth Center × Dhofar)

| Name | Role |
|---|---|
| آية الشنفري (Aya Al Shanfari) | Electrical Engineering |
| رتاج الشنفري (Retaj Al Shanfari) | Artificial Intelligence |
| هدى الشنفري (Huda Al Shanfari) | Artificial Intelligence |
| خديجة البلوشي (Khadija Al Balushi) | Artificial Intelligence |

---

##  Acknowledgements

- [Riyada](https://riyada.om) — Youth entrepreneurship ecosystem
- Youth Center (مركز الشباب) — Program host
- Dhofar — Program partner

---

##  License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details, or learn more at [choosealicense.com](https://choosealicense.com/).
