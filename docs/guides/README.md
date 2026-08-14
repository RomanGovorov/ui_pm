# Project Manager UI — Documentation Index

> **Project**: Project Manager UI v1
> **Stack**: Next.js 15 + PostgreSQL 16 + Prisma + SSE + JWT Auth
> **Repository**: https://github.com/gansru/ui_pm

Welcome to the Project Manager UI documentation. This directory contains all user-facing and operational documentation.

## Quick Links

| Category | Description | Link |
|----------|-------------|------|
| **API Reference** | REST API endpoints, request/response schemas, authentication guide | [API Documentation](api/) |
| **User Guides** | How-to guides for stakeholders and agents | [User Guides](user/) |
| **Runbooks** | Operational procedures for deployment and incident response | [Runbooks](runbooks/) |
| **Release Notes** | Version changelog, migration guides, known issues | [Release Notes](release-notes/) |

## Navigation

```
docs/guides/
├── api/                    # API reference (OpenAPI spec + endpoint docs)
│   ├── README.md           # API documentation index
│   ├── openapi.yaml        # OpenAPI 3.0 specification (source of truth)
│   └── auth.md             # Auth API reference (register, login, logout, me)
├── user/                   # User guides
│   ├── README.md           # User guides index
│   ├── getting-started.md  # Setup, authentication, and first use
│   ├── authentication.md   # Login, registration, roles, sessions
│   └── troubleshooting.md  # Common issues and solutions
├── runbooks/               # Operational runbooks
│   └── README.md           # Runbooks index (links to infra runbooks)
├── release-notes/          # Release documentation
│   ├── README.md           # Release notes index
│   ├── CHANGELOG.md        # Version history
│   └── RELEASE-v1.1.0.md   # Auth feature release notes
└── README.md               # This file — main documentation index
```

## Getting Started

- **For users (stakeholders)**: Read the [Getting Started Guide](user/getting-started.md) to learn how to set up your account and use the dashboard. Then see the [Authentication Guide](user/authentication.md) for detailed login/registration info.
- **For developers/integrators**: Read the [API Documentation](api/README.md) for endpoint details. See [Auth API Reference](api/auth.md) for authentication-specific endpoints.
- **For operations**: Review the [Deployment Runbook](runbooks/README.md) for deployment procedures.
- **For changelogs**: See [Release Notes](release-notes/CHANGELOG.md) for version history.
