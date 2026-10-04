---
description: Run the security reviewer over uncommitted changes
agent: security-reviewer
subtask: true
---

Run a security review of the current working tree.

Scope the review to uncommitted changes (`git diff` plus staged and untracked files). Report
findings grouped by severity, each with a `file_path:line_number`, what the violation is, why
it matters for this product, and the specific fix.

If the change touches auth, tenant scoping, uploads, money, or the Zalo webhook, read the
matching sections of the design spec before reviewing so you check against what the project
actually promised. Close the report with what you checked and found clean.