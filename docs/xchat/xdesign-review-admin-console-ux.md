# xDesign Review: Admin Console UX (console.x.ai style reference)

## Findings

### High

- Batch dashboard tables are not using the styled table classes, which breaks visual hierarchy and scanability on operator-heavy screens. What: `table-wrap` and `table-grid` are used without matching CSS definitions. Where: `src/app/admin/batch/page.tsx`, `src/app/admin/batch/[batchId]/page.tsx`, `src/app/globals.css`. Suggestion: replace with `crud-table-wrap` and `crud-table` (or add consistent style aliases) to restore clean console structure.

### Medium

- Filter action on batch dashboard uses an unstyled default button, reducing affordance consistency vs the rest of admin controls. Where: `src/app/admin/batch/page.tsx`. Suggestion: apply existing CTA/tiny button system so "Apply Filters" follows the same visual language as other admin actions.
### Low

- Admin action cards are reused as navigation links for "back" actions, which can over-emphasize low-risk navigation vs primary task controls. Where: `src/app/admin/batch/page.tsx`, `src/app/admin/batch/[batchId]/page.tsx`. Suggestion: use lighter secondary link/button treatment for non-primary nav actions to keep focus on table operations.

## Reviewer Completion

- design-review-best-practices: complete
- xdesign-review: complete
- xdesign-review-adversarial: complete
- xdesign-review-reliability: complete
- xdesign-review-audit: complete

## Merge Recommendation

- accept-with-conditions

## Gaps

- missing tests: no UI regression coverage that verifies batch tables render with intended class system.
- missing docs sync: admin console style guidance was not explicitly documented before this pass.
- residual risk notes: without the table class fix, admin UX drift persists and may reduce operator efficiency during incident triage.
