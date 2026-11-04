# Expected proposal: go-gcp

| Provider | Why | Class | Catalog | Action |
| -- | -- | -- | -- | -- |
| Google Cloud | cloud.google.com/go/storage@v1.47.0, cloudbuild.yaml:1 | runtime | 344 | track |
| Stripe | github.com/stripe/stripe-go/v81@v81.1.0 | runtime | 801 | track |
| Twilio | github.com/twilio/twilio-go@v1.23.8 | runtime | 234 | track |

Optional, build-time: GitHub only if the checkout has a `github.com` remote; the `github.com/acme/billing` module path is a name, not a dependency, and is not evidence.

Nothing skipped, nothing self-hosted.

No write before the user confirms the set.
