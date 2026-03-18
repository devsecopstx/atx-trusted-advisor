---
id: test-automation
name: test-automation
description: Add or improve automated tests around changed behavior with emphasis on regression and edge-case coverage.
---

# Test Automation

## Goal

Increase confidence in changed code by adding focused automated tests with meaningful assertions.

## Use This Skill When

- New logic is merged without sufficient tests
- Bug fixes need regression protection
- Edge cases are not covered

## Workflow

1. Identify risk-bearing code paths changed recently.
2. Add tests for happy path, edge path, and failure path.
3. Prefer deterministic fixtures and minimal mocking.
4. Run affected test suite and iterate until green.

## Output

- Tests added/updated
- Coverage rationale
- Residual testing gaps
