# Expected proposal: django-aws

| Provider | Why | Class | Catalog | Action |
| -- | -- | -- | -- | -- |
| AWS | boto3@1.35.80, infra/main.tf:10, .env.example:5 (*.amazonaws.com) | runtime | 248 | track |
| SendGrid | sendgrid@6.11.0 | runtime | 209 | track |
| Sentry | sentry-sdk@2.19.2, .env.example:7 (*.sentry.io) | runtime | 57 | track |

Self-hosted or unknown, one line: `celery`, `redis`, `psycopg` (the Postgres host is on AWS and is already covered by the AWS row; `REDIS_URL` points at a local service name).

Skipped: `Django`, `django-storages` (framework; the S3 backend it configures is evidence for AWS, not a provider of its own).

Region signal recorded for later scoping: `eu-central-1` (`.env.example:1` via `AWS_REGION`, `infra/main.tf:11`).

Must not appear: `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` placeholders, the full RDS hostname (`acme-main.cluster-example...`), the bucket name as evidence, the Sentry DSN.

The Catalog column in a live run also carries the state and the status page URL; those change, so only the id is compared.

No write before the user confirms the set.
