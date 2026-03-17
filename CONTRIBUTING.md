# Contributing

## Branching

- Create a feature branch from `main`.
- Keep changes scoped to one logical objective per PR.

## Local Quality Gate

Before opening a PR, run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Pull Request Expectations

- Explain **why** the change is needed.
- Include test/validation steps performed.
- Call out env/config impacts explicitly.
- Keep docs updated when APIs, setup, or workflows change.

## Security and Secrets

- Never commit `.env` or raw credentials.
- Use `.env.example` for placeholder keys only.
