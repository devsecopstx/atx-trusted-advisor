---
id: docker-setup
name: docker-setup
description: Configure and validate Docker and docker-compose for reliable local and CI development workflows.
---

# Docker Setup

## Goal

Provide a stable Docker setup for build, run, and development iteration with predictable behavior.

## Use This Skill When

- Creating or fixing `Dockerfile` or `docker-compose.yml`
- Enabling containerized local development
- Resolving image/build/runtime drift across environments

## Workflow

1. Validate base image, build stages, and dependency caching.
2. Configure runtime ports, volumes, and env vars.
3. Confirm service startup order and health checks.
4. Test cold build and fresh up/down cycle.
5. Document common troubleshooting commands.

## Output

- Docker issues found
- Proposed/final config changes
- Local validation steps and status
