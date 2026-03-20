# xdesign-review-audit Checklist

## Validation Checklist

- [ ] Any sampled material decision can be replayed end-to-end
- [ ] Hash/signature validation detects log tampering
- [ ] RAG lineage includes exact chunk/version references
- [ ] Post-processing transforms are versioned and reproducible
- [ ] Audit exports are complete and regulator-readable
- [ ] Runtime config provenance is clear (GCP Secret Manager vs GH vars/secrets)
- [ ] Access-approval bootstrap failure path records `alert-user-not-sync-warning`
