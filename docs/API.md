# API reference

Base URL: `http://localhost:3000/api` with Docker Compose (nginx proxies to the API), or `http://localhost:4000/api` when running the API directly.
All bodies are JSON, and all field names are camelCase.

- [Conventions](#conventions)
- [The inspection resource](#the-inspection-resource)
- [Endpoints](#endpoints)
- [SAP webhook (mock)](#sap-webhook-mock)

## Conventions

**Success envelope**

```jsonc
{ "data": { /* resource */ } }                                   // single resource
{ "data": [ /* resources */ ], "meta": { "page": 1, "pageSize": 20, "total": 57 } }   // list
```

**Error envelope** (every failure, including unknown routes and malformed JSON)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "machineId", "message": "Machine / line ID is required" }]
  }
}
```

`details` is only present for validation errors. `field` is the request field (or query parameter) that failed.

| HTTP | `error.code`       | When |
|------|--------------------|------|
| 400  | `VALIDATION_ERROR` | Body, query or path parameter failed validation |
| 400  | `BAD_REQUEST`      | Malformed JSON body |
| 401  | `UNAUTHORIZED`     | Missing or wrong `X-Webhook-Secret` on the SAP webhook |
| 404  | `NOT_FOUND`        | Unknown inspection id, or unknown route |
| 409  | `ALREADY_RESOLVED` | Resolving an inspection that is already resolved |
| 413  | `BAD_REQUEST`      | Body larger than 100 kB |
| 500  | `INTERNAL_ERROR`   | Unexpected error (details are logged, never returned) |

**Dates** are calendar dates as `YYYY-MM-DD` strings, never timestamps, so they can't shift with timezones. Timestamps (`createdAt`, `updatedAt`, `resolvedAt`) are ISO-8601 UTC.

## The inspection resource

```json
{
  "id": "2b0f5c3e-8d49-4d0a-9c3c-6f0d6c1d9a11",
  "inspectionDate": "2026-10-19",
  "machineId": "LOOM-07",
  "defectType": "HOLE_TEAR",
  "severity": "CRITICAL",
  "status": "OPEN",
  "remarks": "Hole near selvedge, roll R-4471",
  "resolutionNote": null,
  "resolvedAt": null,
  "source": "MANUAL",
  "externalRef": null,
  "createdAt": "2026-10-19T09:14:03.512Z",
  "updatedAt": "2026-10-19T09:14:03.512Z"
}
```

| Field | Values / rules |
|-------|----------------|
| `defectType` | `WEAVE_DEFECT`, `SHADE_VARIATION`, `HOLE_TEAR`, `COUNT_DEVIATION`, `OTHER` |
| `severity`   | `CRITICAL`, `MAJOR`, `MINOR` |
| `status`     | `OPEN`, `RESOLVED`. `RESOLVED` is terminal, and a resolved inspection always has `resolutionNote` and `resolvedAt`. |
| `machineId`  | Free text, trimmed, 1–50 characters |
| `remarks`, `resolutionNote` | Trimmed, up to 1000 characters. Blank `remarks` is stored as `null`. |
| `source`     | `MANUAL` (created through the API) or `SAP` (created by the webhook) |
| `externalRef`| The SAP notification id for `SAP` rows, otherwise `null` |

## Endpoints

### `GET /api/health`
`200 {"status":"ok"}` if the database answers, `503 {"status":"unavailable"}` otherwise.

### `POST /api/inspections`
Logs an inspection. It is created `OPEN`.

```jsonc
{
  "id": "2b0f5c3e-8d49-4d0a-9c3c-6f0d6c1d9a11",   // optional, client-generated UUID (see below)
  "inspectionDate": "2026-10-19",
  "machineId": "LOOM-07",
  "defectType": "HOLE_TEAR",
  "severity": "CRITICAL",
  "remarks": "Hole near selvedge"                  // optional
}
```

- **`201 Created`** with a `Location: /api/inspections/{id}` header and `{ data: inspection }`.
- **`200 OK`** if an inspection with that `id` already exists. The stored record is returned unchanged and nothing is written. This makes retries safe, which is how the offline queue avoids duplicates.
- **`400`** with per-field `details`.

`source` and `externalRef` are ignored if sent; only the SAP webhook can set them.

### `GET /api/inspections`
Lists inspections.

| Query param | Default | Notes |
|-------------|---------|-------|
| `severity`  | | `CRITICAL` \| `MAJOR` \| `MINOR` |
| `status`    | | `OPEN` \| `RESOLVED` |
| `from`, `to`| | Inclusive inspection-date range, `YYYY-MM-DD`. `from` must be ≤ `to`. |
| `sortBy`    | `inspectionDate` | `inspectionDate` \| `severity` \| `status` \| `machineId` \| `createdAt` |
| `order`     | `desc` | `asc` \| `desc` |
| `page`      | `1` | |
| `pageSize`  | `20` | 1–100 |

Severity sorts by importance, so `order=desc` lists `CRITICAL` first. Ties are broken by newest `createdAt`, then `id`, so pages never overlap. The response is `{ data: [...], meta: { page, pageSize, total } }`, where `total` is the number of rows matching the filters. Invalid parameters return `400`.

```bash
curl "http://localhost:3000/api/inspections?severity=CRITICAL&status=OPEN&from=2026-10-01&to=2026-10-31&sortBy=inspectionDate&order=desc"
```

### `GET /api/inspections/summary`
Counts by severity and status. All three severities are always present, zero-filled, most severe first.

```json
{
  "data": {
    "totals": { "open": 9, "resolved": 16, "total": 25 },
    "bySeverity": [
      { "severity": "CRITICAL", "open": 2, "resolved": 3, "total": 5 },
      { "severity": "MAJOR",    "open": 5, "resolved": 6, "total": 11 },
      { "severity": "MINOR",    "open": 2, "resolved": 7, "total": 9 }
    ]
  }
}
```

### `GET /api/inspections/{id}`
`200 { data: inspection }`, `404` if unknown, `400` if `id` is not a UUID.

### `POST /api/inspections/{id}/resolve`
Marks an `OPEN` inspection as `RESOLVED`.

```json
{ "resolutionNote": "Reed replaced and re-inspected" }
```

- **`200`** with the updated inspection (`status: "RESOLVED"`, `resolutionNote`, `resolvedAt` set).
- **`400`** if `resolutionNote` is missing or blank (the note is mandatory).
- **`404`** if the inspection doesn't exist.
- **`409 ALREADY_RESOLVED`** if it was already resolved. The first note is kept.

The transition is a single conditional `UPDATE ... WHERE status = 'OPEN'`, so two concurrent resolves can't both succeed.

## SAP webhook (mock)

`POST /api/sap-webhook` simulates SAP pushing a quality notification, which the API turns into an inspection. **The payload shape and code tables below are our own mock**; adjust `backend/src/modules/integrations/sap.mapper.js` once the real interface is known.

**Authentication:** send the shared secret in `X-Webhook-Secret`. It is configured through `SAP_WEBHOOK_SECRET`; the local default is `dev-sap-secret`, and **you should change it for anything other than local use**. A missing or wrong secret returns `401`.

**Payload**

```json
{
  "notificationId": "QN-100234",
  "workCenter": "LOOM-07",
  "defectCode": "HOLE",
  "priority": "1",
  "reportedOn": "2026-10-19",
  "description": "Hole near selvedge, roll R-4471"
}
```

| Field | Required | Maps to |
|-------|----------|---------|
| `notificationId` | yes, ≤ 50 chars | `externalRef`: also the idempotency key |
| `workCenter`     | yes, ≤ 50 chars | `machineId` |
| `defectCode`     | yes | `defectType`: `WEAVE`→`WEAVE_DEFECT`, `SHADE`→`SHADE_VARIATION`, `HOLE`→`HOLE_TEAR`, `COUNT`→`COUNT_DEVIATION`, anything else→`OTHER` (case-insensitive) |
| `priority`       | yes, `"1"`, `"2"` or `"3"` (numbers accepted) | `severity`: `1`→`CRITICAL`, `2`→`MAJOR`, `3`→`MINOR` |
| `reportedOn`     | yes, `YYYY-MM-DD` | `inspectionDate` |
| `description`    | no, ≤ 1000 chars | `remarks` |

The created inspection has `status: "OPEN"` and `source: "SAP"`.

**Responses**
- `201` with `{ data: inspection }` for a new notification.
- `200` with the *existing* inspection if `notificationId` was already received. SAP can retry freely and no duplicate is created.
- `400` for an invalid payload, `401` for a bad secret.

```bash
curl -X POST http://localhost:3000/api/sap-webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: dev-sap-secret" \
  -d '{"notificationId":"QN-100234","workCenter":"LOOM-07","defectCode":"HOLE","priority":"1","reportedOn":"2026-10-19","description":"Hole near selvedge"}'
```
