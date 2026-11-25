# Expected proposal: go-gcp

| Provider | Why | Class | Catalog | Action |
| -- | -- | -- | -- | -- |
| Google Cloud | cloud.google.com/go/storage@v1.47.0, cloudbuild.yaml | runtime | 344 | track |
| Stripe | github.com/stripe/stripe-go/v81@v81.1.0 | runtime | 801 | track |
| Twilio | github.com/twilio/twilio-go@v1.23.8 | runtime | 234 | track |

No build-time signal: the fixture is not a git root, and the `github.com/acme/billing` module path and the dependency paths are names, not code-host evidence. The `gcr.io` and `*.pkg.dev` image hosts in `cloudbuild.yaml` are covered by the Google Cloud row.

Nothing skipped, nothing self-hosted.

The Catalog column in a live run also carries the state and the status page URL; those change, so only the id is compared.

No write before the user confirms the set.
