# SHEPHERD — Product Requirements Document

Version: 1.0
Status: LOCKED
Project type: Hackathon prototype
Platform: Responsive Web App / Progressive Web App

## 1. Product Vision

SHEPHERD (Women's Safety Intelligence & Early Response Network) is a
privacy-first platform that helps users document harassment and safety
incidents, organize supporting evidence, understand potential patterns,
coordinate trusted-contact check-ins, and prepare structured incident
reports.

The platform combines user-controlled evidence management, explainable
AI-assisted analysis, incident relationship visualization and consent-based
safety workflows.

SHEPHERD is an information and documentation tool. It is not an emergency
service, law-enforcement system, legal authority, or a replacement for
professional assistance.

## 2. Problem Statement

People experiencing harassment and safety-related incidents may have
difficulty:

- Organizing screenshots, messages and other evidence.
- Maintaining a chronological record of incidents.
- Recognizing repeated patterns across reported events.
- Explaining the context of incidents to trusted contacts or authorities.
- Keeping track of check-ins and follow-up actions.
- Preparing a clear, structured incident summary.

SHEPHERD aims to make these tasks easier through one user-controlled
workspace.

## 3. Target Users

Primary:

- Individuals who want to document harassment or safety-related incidents.
- Individuals who want to organize digital evidence.
- Individuals who want to coordinate check-ins with trusted contacts.

Secondary:

- Trusted contacts explicitly invited by a user.
- Support organizations or advisors, only where the user chooses to share
  information with them.

## 4. Product Principles

1. Privacy first: users control their information and evidence.
2. Consent first: contact sharing and notifications require explicit user
   action and consent.
3. Explainability: AI-generated labels and relationships must include
   understandable reasons.
4. Human judgment: AI outputs are informational and must not be presented
   as verified facts.
5. Data minimization: collect only information required for the feature.
6. No unsupported claims: do not claim crime prediction, offender
   identification, guaranteed evidence authenticity, or emergency dispatch.
7. Clear status: distinguish saved locally, uploaded, processed, failed,
   delivered and demo-only states.
8. Synthetic demo data: use synthetic incidents, screenshots and contact
   details during demonstrations.

## 5. Core User Journey

1. User opens SHEPHERD.
2. User signs up or logs in.
3. User views the dashboard.
4. User creates an incident and enters a description, category, time and
   optional location description.
5. User uploads supporting evidence.
6. SHEPHERD calculates and stores a SHA-256 hash for each uploaded file.
7. User requests AI-assisted analysis.
8. The Intelligence API extracts text from supported images, classifies
   relevant content and returns an explainable result.
9. The user reviews the result and its limitations.
10. The user views incident relationships in PatternGraph, if relevant
    links exist.
11. The user may configure trusted contacts and initiate a safety session.
12. The user may generate a chronological PDF report.
13. The user chooses whether to download or share the report.

## 6. Functional Requirements

### 6.1 Authentication and Profile

- Sign up and sign in using Supabase Authentication.
- Access protected application features only after authentication.
- Users can view and update basic profile information.
- Every user-owned record must be scoped to the authenticated user.

### 6.2 Dashboard

- Display incident count and recent incidents.
- Display evidence count and analysis status.
- Display active safety sessions.
- Display clear empty, loading and error states.
- Do not show fabricated live statistics.

### 6.3 Incident Management

- Create, view, update and delete user-owned incidents.
- Store incident title, description, category, occurrence time and
  optional user-provided location description.
- Show incident history in chronological order.
- Validate all user inputs.
- Do not expose another user's incidents.

### 6.4 ThreatLens

- Allow the user to submit an incident description or request analysis
  of uploaded image evidence.
- Extract text from supported image files using OCR.
- Classify text into the agreed harassment taxonomy.
- Return labels, explanations, indicators and limitations.
- Display the output as AI-assisted analysis, not a factual determination.
- Never automatically contact authorities or other people.

### 6.5 EvidenceVault

- Upload supported evidence files to private storage.
- Associate evidence with an incident owned by the authenticated user.
- Calculate SHA-256 when the file is received.
- Support verification by re-hashing the stored original file.
- Display file metadata, upload time and hash.
- Never expose private evidence through public URLs.
- A matching hash indicates byte-level consistency with the stored
  reference file; it does not prove when, where or by whom the file
  was created.

### 6.6 PatternGraph

- Visualize relevant relationships between incidents.
- Show the reason behind each relationship.
- Use only the approved relationship types.
- Do not infer identity from similar names, faces or profile pictures.
- Clearly distinguish user-reported relationships from algorithmic
  similarity suggestions.
- Empty graph states must be supported.

### 6.7 Risk Intelligence

- Calculate a transparent review-priority score from available indicators.
- Display the contributing factors and explanation.
- Do not present the score as a probability of crime, danger, future harm
  or offender behavior.
- Do not use the score to make automatic decisions about a person.

### 6.8 SafeCircle

- Let users add and manage trusted contacts.
- Require explicit user consent before using a contact for a safety session.
- Let users start a check-in session with a deadline.
- Let users submit a check-in.
- Display pending, checked-in, expired and cancelled states.
- Missed check-ins may trigger a reminder workflow only.
- Never claim automatic police dispatch or guaranteed emergency response.

### 6.9 Notifications

- Notifications must be consent-based.
- Record notification delivery state.
- Distinguish queued, sent, delivered, failed and demo states.
- Only claim delivery when the provider confirms delivery.
- If no provider is configured, label the workflow as simulated/demo.

### 6.10 JusticeBridge

- Generate a chronological PDF report for a user-owned incident.
- Include user-provided incident details, evidence index, SHA-256 hashes,
  timestamps and AI analysis with an explicit AI-generated label.
- Include a report generation timestamp.
- Do not modify original evidence.
- Do not claim that the report is legally certified or guaranteed admissible.

### 6.11 PWA and Offline Experience

- Provide an installable responsive web application where supported.
- Provide a clear offline fallback.
- Any offline incident draft must be explicitly marked as locally saved
  and not uploaded.
- Do not cache private evidence or authenticated API responses.
- Clearly show sync status when connectivity returns.

## 7. Non-Functional Requirements

- Responsive on mobile, tablet and desktop.
- Accessible labels, keyboard navigation and readable contrast.
- Validate data on both frontend and backend.
- Enforce authentication and authorization on protected APIs.
- Enforce database Row Level Security.
- Use HTTPS in deployed environments.
- Never expose service-role keys or private credentials to the browser.
- Use structured errors and meaningful loading states.
- Include tests for critical functionality.
- Log operational errors without logging passwords, tokens, private
  evidence contents or unnecessary personal data.

## 8. Out of Scope

The prototype will not:

- Predict crimes or guarantee personal safety.
- Identify alleged offenders.
- Perform facial recognition or biometric matching.
- Secretly monitor messages, calls, location or devices.
- Automatically dispatch police or emergency services.
- Guarantee notification delivery.
- Certify evidence authenticity or legal admissibility.
- Provide legal, medical or emergency advice.
- Share user evidence with third parties without explicit consent.

## 9. Demo Scope

The hackathon demo should demonstrate:

1. Authentication or a clearly labelled demo account.
2. Dashboard with synthetic records.
3. Creation of a synthetic incident.
4. Upload of a synthetic harassment screenshot.
5. OCR and explainable classification.
6. Evidence hash creation and verification.
7. PatternGraph with explainable sample relationships.
8. SafeCircle check-in workflow using synthetic contacts.
9. JusticeBridge PDF generation.
10. Responsive interface and clear privacy disclosures.

Every mocked integration must be labelled as simulated. Do not present
mock notifications, fabricated metrics or sample AI outputs as live results.

## 10. Definition of Done

A feature is complete only when:

- Its assigned code is implemented.
- Its API or UI contract matches this document and the shared contracts.
- Validation and error handling exist.
- Relevant tests have actually been executed.
- Security and ownership checks are in place where applicable.
- Mocked functionality is clearly identified.
- The member's review report is updated.
- The feature can be integrated without violating another member's
  ownership.
