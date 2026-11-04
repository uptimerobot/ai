# Expected proposal: nextjs-vercel

Runtime providers proposed by default (catalog ids as of November 2026):

| Provider | Why | Class | Catalog | Action |
| -- | -- | -- | -- | -- |
| Stripe | stripe@17.4.0 | runtime | 801 | track |
| Supabase | @supabase/supabase-js@2.47.0, .env.example:1 (*.supabase.co) | runtime | 1124 | track |
| Sentry | @sentry/nextjs@8.42.0, .env.example:5 (*.sentry.io) | runtime | 57 | track |
| Resend | resend@4.0.1 | runtime | 3221 | track |
| Vercel | vercel.json | runtime | 861 | track |

Optional, build-time, not searched until the user asks: GitHub (`.github/workflows/ci.yml`; the fixture is not a git root, so no remote signal).

Skipped: `next`, `react`, `react-dom` (framework and UI). `typescript` and `eslint` are devDependencies with no provider.

Must not appear: any `.env.example` value, the Supabase project label (`abcd1234`), the Sentry DSN, any key placeholder.

The Catalog column in a live run also carries the state and the status page URL; those change, so only the id is compared.

No write before the user confirms the set.
