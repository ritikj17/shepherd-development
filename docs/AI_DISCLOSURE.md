# SHEPHERD — AI System Disclosure

Version: 1.0
Status: LOCKED

## 1. Purpose

SHEPHERD uses AI-assisted processing to help users organize and understand
information they voluntarily submit.

AI functionality is intended to:

- Extract text from supported images.
- Identify potentially relevant harassment-related language.
- Explain classification indicators.
- Calculate a transparent review-priority score.
- Suggest explainable relationships between user-reported incidents.

AI output is informational and must always remain subject to human review.

## 2. AI Components

### 2.1 OCR

Technology:

- Tesseract OCR
- pytesseract
- Pillow

Purpose:
Extract visible text from supported image evidence.

Limitations:

- OCR can misread text.
- Results may be affected by image quality, language, font, rotation,
  compression and background.
- OCR output is not guaranteed to be complete or accurate.
- Extracted text must not be treated as proof of what occurred.

The interface must distinguish OCR-extracted text from text manually
entered by the user.

### 2.2 Threat Classification

The system uses a deterministic/rule-based baseline first.

Approved taxonomy:

- cyberstalking
- threat
- sextortion
- impersonation
- doxxing
- image_based_abuse
- general_harassment
- other

The classifier may return:

- A category label.
- A model score.
- Relevant indicators.
- A plain-language explanation.
- A limitations notice.

The system must return other or insufficient information when the input
does not support a meaningful classification.

Do not force every input into a threat category.

### 2.3 Optional Generative AI

An external generative AI provider may be integrated only if:

- The team has time to implement it safely.
- The user is clearly informed before data is transmitted.
- The user explicitly consents to the relevant processing.
- Only minimum necessary text is transmitted.
- Secrets remain server-side.
- The deterministic baseline remains available as fallback.
- Provider failures are handled honestly.

Do not transmit raw evidence images or unnecessary personal information
to an external AI provider by default.

If optional AI is unavailable, SHEPHERD must still work using the
deterministic baseline.

## 3. Confidence Disclosure

Any displayed confidence value is a model score unless a separate
calibration study establishes otherwise.

Required API field:

confidence_type: model_score_not_calibrated_probability

The UI must not describe a score as:

- Probability that a crime occurred.
- Probability that a person is dangerous.
- Probability of future harm.
- Certainty that a message is threatening.

The UI may say:
"Model score: 0.78. This score is not a calibrated probability."

Do not display confidence values if the underlying implementation
does not produce a meaningful score.

## 4. Review-Priority Score

SHEPHERD may calculate a transparent review-priority score:

R = 0.30T + 0.25F + 0.20E + 0.15D + 0.10P

Where each factor is on a 0–100 scale:

T = Threat-language indicator
F = Frequency or repetition indicator
E = Evidence completeness indicator
D = Digital exposure or privacy-risk indicator
P = Persistence or recurrence indicator

The result is clamped to 0–100.

Initial display bands:

- 0–29: Low review priority
- 30–59: Moderate review priority
- 60–100: High review priority

If insufficient data exists, return insufficient_data rather than
inventing missing values.

These weights and bands are prototype design choices, not clinically,
scientifically or statistically validated thresholds.

The score:

- Is not a danger prediction.
- Is not a crime probability.
- Is not a measure of a person's character.
- Must not automatically trigger an alert or emergency action.
- Must display its factors and explanation.

## 5. Incident Relationship Graph

Approved relationship types:

1. SAME_USER_REPORTED_IDENTIFIER
2. SIMILAR_MESSAGE_CONTENT
3. REPEATED_CONTACT_PATTERN
4. USER_REPORTED_RELATED_EVENT

Every relationship must include:

- Source incident.
- Target incident.
- Relationship type.
- Confidence or similarity score, when available.
- Explanation.

Similarity suggestions must be presented as suggestions, not facts.

Never create links based only on:

- Similar names.
- Profile photographs.
- Facial similarity.
- Unverified identity assumptions.
- Demographic characteristics.

All graph results must be restricted to incidents the authenticated
user is authorized to access.

## 6. Data and Evaluation

Development and demonstration must use synthetic data.

The team should create a small labelled dataset containing examples
for the approved categories and non-harassment examples.

Separate data into:

- Development/training examples.
- Held-out evaluation examples.

Do not report performance on data used to create the rules as
independent test performance.

Recommended evaluation:

- Precision
- Recall
- Macro F1
- Per-class precision and recall
- False-positive rate
- OCR extraction success rate
- Processing latency

Report actual measurements only.

If the sample size is too small for meaningful evaluation, disclose
that limitation instead of presenting a misleading accuracy claim.

Never fabricate:

- Dataset size.
- Precision or recall.
- F1 score.
- Accuracy.
- Latency.
- Model confidence.
- Benchmark results.

## 7. User-Facing Disclosures

Display an appropriate notice near AI results:

"AI-assisted analysis: This result is an informational aid based on
the content you submitted. OCR and classification may be inaccurate
or incomplete. Review the original evidence and use your judgment.
This result does not establish that an incident occurred, identify
an offender, or predict future harm."

For the review-priority score:

"This score is an experimental review-priority indicator. It is not
a probability of crime, danger or future harm. Its values and weights
have not been independently validated."

For OCR:

"Extracted text may contain errors. Always compare it with the
original image."

For graph relationships:

"Suggested relationships indicate content or user-reported similarities.
They do not establish that two incidents involve the same person."

## 8. Human Oversight

- Users must be able to inspect original evidence.
- Users must be able to read the explanation behind classifications.
- Users must not be forced to accept AI-generated labels.
- AI output must not automatically contact trusted contacts.
- AI output must not automatically dispatch emergency services.
- AI output must not automatically report a person to authorities.
- AI output must not automatically delete or alter evidence.

## 9. Privacy and Security

- Process only user-submitted information.
- Do not secretly monitor communications or devices.
- Do not perform facial recognition.
- Do not infer sensitive personal traits.
- Do not send unnecessary profile, contact or location information to AI.
- Avoid logging raw OCR text and evidence contents.
- Keep external AI credentials server-side.
- Use explicit consent for optional external processing.
- Provide a clear failure state if AI processing is unavailable.

## 10. Demo Mode

Synthetic screenshots, incidents, contacts and analysis results may be
used during the hackathon demo.

Every precomputed or mocked result must be labelled as demo/sample data.

A demo result must never be represented as a live model result.

If an AI provider is unavailable:

- Show a clear unavailable or fallback status.
- Use the deterministic baseline if it is implemented.
- Do not fabricate successful processing.

## 11. Known Limitations

The hackathon prototype is not:

- A validated threat assessment system.
- A forensic examination tool.
- A law-enforcement intelligence system.
- A legally certified evidence platform.
- A substitute for emergency services.
- A substitute for legal, medical or professional advice.

All AI functionality is experimental and must be described accordingly.
