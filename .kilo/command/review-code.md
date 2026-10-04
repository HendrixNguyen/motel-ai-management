---
description: Run the code quality reviewer over uncommitted changes
agent: code-reviewer
subtask: true
---

Run a code quality and architecture review of the current working tree.

Scope the review to uncommitted changes (`git diff` plus staged and untracked files). Check
module boundaries first (ADR-0004), then correctness against the design spec, then types,
structure, tests, and documentation drift.

Report findings grouped by severity, each with a `file_path:line_number`, the concrete
violation, the consequence for this product, and the specific fix. Close with what you
checked and found clean.