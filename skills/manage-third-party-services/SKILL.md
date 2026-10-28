---
name: manage-third-party-services
description: Track the status of third-party providers (cloud, payment and other services with public status pages) as third-party services, search the provider catalog, choose components, and update, inspect or delete what the account tracks.
tags: [third-party-services, providers, status-pages, dependencies, uptimerobot]
---

# Manage third-party services

> **Preflight, read first.** If you cannot see any `uptimerobot:*` MCP tools in your tool list, invoke the `uptimerobot:setup` skill before doing anything else. Do not tell the user the MCP is misconfigured, `setup`'s Step 0 detects the common case (server connected, tools loaded after session start) and resolves it without re-keying.

A **third-party service** tracks the public status of an outside provider (a cloud, a payment processor, a SaaS) and alerts the account when the provider reports an incident. It is a monitor of its own type, but it lives on its own tools:

- `list-monitors` does **not** return third-party services, and `monitorsCount` / `monitorLimit` from `get-user` do not count them. Use `list-third-party-services`.
- The generic tools (`get-monitor-details`, `update-monitor`, `delete-monitor`) are not for them. Use the `*-third-party-service` tools below.
- Two kinds of ID are in play. A **provider ID** identifies a provider in the catalog and is used only to find and start tracking it. A **monitor ID** identifies the tracked service on the account and is used for everything after that. Both are plain numbers. Never use a provider name, status page URL or slug as an ID, and never guess either kind.

Use this skill when the user says "track AWS status", "alert me when Stripe has an incident", "what third-party services am I tracking", "only watch these components", or "stop tracking X".

## Step 1: Find the provider

```
{"search":"stripe","limit":10}
```

Call `search-third-party-providers`. `search` matches a provider or component name; `limit` is 1-50. Each row has the provider `id`, `name`, `statusPageUrl`, `state` (`operational`, `minor`, `major` or `maintenance`), the `matchedComponent` the search hit (or `null`), and `isTracked`.

- Pick the provider by its numeric `id`. If several rows plausibly match, show the user the names and status page URLs and ask which one.
- If `isTracked` is `true`, the account already tracks it. Find the monitor ID with `list-third-party-services` instead of creating again.

## Step 2: Read the components (optional)

```
{"providerId":1234}
```

Call `get-third-party-provider`. It returns the provider's `components` as a tree (each component has `id`, `name`, `status` and `children`). Component IDs from here select what to track. The `status` values are `operational`, `minor`, `major`, `maintenance` or `unknown`.

Skip this step when the user wants the whole provider: leaving `trackedComponentIds` out tracks every component.

## Step 3: Create

```
{"providerId":1234,"trackedComponentIds":[11,12],"notify":{"severity":"major","incrementalUpdates":false}}
```

Call `create-third-party-service`.

| Field | Meaning |
| -- | -- |
| `providerId` (required) | Provider ID from Step 1. |
| `trackedComponentIds` | Component IDs from Step 2. Empty or `null` tracks every component. |
| `notify.severity` | Which incidents notify: `all`, `major` (major only) or `none`. |
| `notify.incrementalUpdates` | Also notify on every incident update. `severity` and `incrementalUpdates` are both required when `notify` is given. |
| `assignedAlertContacts` | `[{alertContactId, threshold, recurrence}]`. Get IDs from `list-integrations`. Omit to use the account default contact. |

Tracking a provider the account already tracks returns the existing service rather than creating a second one. The response has `success`, `message` and `thirdPartyService`, whose `monitorId` is the ID for every later call.

## Step 4: Verify with get

```
{"monitorId":800123456}
```

Call `get-third-party-service`. It returns the provider, `currentState`, `notify`, `maintenanceNotificationsEnabled`, `trackedComponentIds` (`null` means every component), `needsReview`, and the provider's component list. Show the user this stored state rather than echoing what you sent.

`list-third-party-services` (cursor-paginated, optional `search`, `sortField` of `name`, `state` or `createdAt`, `sortDirection` of `ASC` or `DESC`) lists everything the account tracks. Follow its `instructions` field verbatim for the next page.

`list-third-party-service-incidents` lists incidents reported by the providers of tracked services, newest first. Pass `monitorId` to see one service only. Each incident has `title`, `severity` (`minor` or `major`), `resolved`, `startedAt`, `resolvedAt` and `providerIncidentUrl`.

## Step 5: Update

```
{"monitorId":800123456,"trackedComponentIds":[11,12,13],"notify":{"severity":"all","incrementalUpdates":true},"maintenanceNotificationsEnabled":true}
```

Call `update-third-party-service`. Only the settings you pass change. Three things to know:

- `trackedComponentIds` is a **full replacement**, not a merge. To add one component, read the current list with `get-third-party-service`, add to it, and send the whole list. An empty array or `null` switches back to tracking every component.
- `notify` is replaced **as a whole**: send both `severity` and `incrementalUpdates`.
- The tool does not change the provider or the alert contacts. To track a different provider, create a new service.

Then call `get-third-party-service` again to confirm.

## Step 6: Delete

```
{"monitorId":800123456}
```

Call `delete-third-party-service`. This is **permanent**: the service and its history stop existing and it cannot be undone. Before calling it:

1. Confirm with the user which service (name and monitor ID) they want removed.
2. Call `get-user` and confirm the signed-in session account is the one the user means.

The tool only removes third-party services. It is a write tool, so a read-only grant is refused with `access_denied`.

## Limits and refusals

- **Plan limit.** Third-party services have their own allowance, separate from monitors. `get-user` returns `dependencyMonitorsCount` (how many the account tracks) and `dependencyMonitorLimit` (how many it may track); spending one does not reduce the other. Check these before creating several in a row. A plan that does not allow third-party services, or an account at its limit, makes `create-third-party-service` fail with `monitor_limit_exceeded` and the dashboard's message. Do not retry; tell the user the cap and suggest upgrading or deleting a service.
- **Pause is refused.** Third-party services cannot be paused: `update-monitor-status` with `PAUSED` on one fails with `invalid_parameters` ("Third party services cannot be paused"), because pausing would silence the alerting that is the service's whole purpose. Do not retry. To quiet it, set `notify.severity` to `none` with `update-third-party-service`; that stops incident alerts only. Also set `maintenanceNotificationsEnabled` to `false` if it is `true`, or delete the service to stop every notification.
- **Not found.** An unknown monitor ID, a monitor on another account and a monitor that is not a third-party service all return `resource_not_found` ("Third-party service not found"). An unknown provider ID returns the same error with "Third-party provider not found". Re-run Step 1 or `list-third-party-services` for the real ID.
- **Bad component or contact.** A component ID the provider does not have, or an alert contact the account cannot assign, returns `invalid_parameters` with the offending IDs. Re-read the component tree or `list-integrations`.
- **Write access.** `create-` and `update-third-party-service` need write permission; a read-only grant returns `access_denied`.

## Common mistakes

- Looking for third-party services in `list-monitors`, or passing a third-party monitor ID to `get-monitor-details`, `update-monitor` or `delete-monitor`.
- Using a provider ID where a monitor ID is needed, or the reverse.
- Passing a provider name or slug instead of the numeric provider `id` from `search-third-party-providers`.
- Sending only the new component to `trackedComponentIds` and silently dropping the rest.
- Trying to pause a third-party service instead of lowering `notify.severity` or deleting it.
- Calling `delete-third-party-service` without confirming the service and the account first.
- Retrying `monitor_limit_exceeded` or `invalid_parameters`; both are deterministic.

## Related

- [`list-integrations`](../list-integrations/SKILL.md), find `alertContactId` values for `assignedAlertContacts`.
- [`errors`](../errors/SKILL.md): error codes and recovery.
- [`manage-monitors`](../manage-monitors/SKILL.md), every other monitor type.
