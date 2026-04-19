# AI Engine - Liquid OS (v1)

## Overview
Liquid OS leverages Generative AI to automate the creation of high-quality evaluation content and to perform forensic analysis of student work. The platform primarily utilizes **NVIDIA NIM** (Gemma-7B/Llama-3) for content generation and **Ollama** (DeepSeek) for on-premise integrity checks.

---

### Pipeline 1: Debugging Variant Generation
To prevent answer-key sharing, administrators can generate multiple unique, bugged variants of a single "Correct Code" baseline.

#### Prompt Strategy
The system uses a structured system prompt to ensure variants are valid, logical, and varied:
```text
System: You are an expert programming instructor.
Task: Given this correct code, generate {n} buggy variants.
Constraints:
- Each variant must have EXACTLY {bug_count} logical errors.
- Do NOT change the function signature or input/output format.
- Use distinct variable/logic names per variant.
- Return a JSON array with 'buggy_code' and 'diff' fields.
```

#### Selection Model
- **NVIDIA NIM (Gemma-3-Pro)**: Preferred for its precision in coding tasks and fast inference times.
- **Approval Workflow**: Variants are staged in a "Pending" state in `debug_variants`. Administrators must approve them via a side-by-side Diff View before they enter the test pool.

---

### Pipeline 2: Evaluation & Grading
For debugging questions, the AI ensures that the student's solution not only fixes the bugs but also adheres to optimal coding patterns.

- **Piston-based Execution**: The primary source of truth for correctness (passes test cases).
- **AI Feedback**: For complex problems, the AI provides a narrative explanation of *why* a student's code failed or how it could be improved, which is displayed in the **Results App**.

---

### Pipeline 3: Forensic Integrity Audit
Managed by `auditor.js`, this pipeline runs post-submission to identify suspicious patterns.

- **Offline Processing**: Unlike generation, the audit is a "background task" that doesn't block the student's submission flow.
- **Privacy First**: By default, this runs on-premise using **Ollama** to ensure student code and session metadata never leave the secure environment.

---

## Configuration & Environment
Key environment variables governing the AI Engine:
- `NVIDIA_API_KEY`: For cloud-based variant generation.
- `OLLAMA_MODEL`: Default model for local audits (e.g., `deepseek-coder-v2`).
- `AI_TEMPERATURE`: Set to `0.1` for deterministic, repeatable code generation.

---

## Future Roadmap
- **Dynamic Question Generation**: Generating MCQs directly from project documentation.
- **Voice Proctroing**: Integration of audio-based integrity checks for remote assessments.
