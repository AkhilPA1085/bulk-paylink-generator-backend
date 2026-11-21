# Bulk Pay-by-Link Generator

A Node.js, Express, and TypeScript backend for creating and processing payment
links in bulk. It accepts a CSV file, processes the rows through BullMQ and
Redis, stores valid links in PostgreSQL, and provides public checkout and
demo payment-result endpoints.

> This project includes a payment simulation. It is not connected to a live
> payment gateway.

## Features

- Upload customer and payment data from a CSV file
- Process CSV uploads asynchronously with BullMQ and Redis
- Track bulk-job progress and completion status
- Validate rows and store failures with row numbers
- Generate cryptographically random public payment tokens
- Create and track individual payment transactions
- Paginate generated payment links
- Retrieve public payment-link details
- Simulate successful or failed payments for testing
- Prevent duplicate checkout and duplicate payment completion

## Technology Stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express 5 | REST API framework |
| TypeScript | Static type checking |
| PostgreSQL | Relational database |
| Prisma ORM | Database access and migrations |
| Prisma adapter-pg | PostgreSQL connection adapter |
| Redis | BullMQ data store |
| BullMQ | Asynchronous background-job queue |
| Multer | Multipart CSV uploads |
| csv-parse | CSV parsing |
| dotenv | Environment configuration |

## How It Works

```text
CSV upload
   |
   v
Express API -> create/upsert bulk job
   |
   v
BullMQ queue -> Redis
   |
   v
Payment-link worker
   |
   +-> validate CSV rows
   +-> create valid payment links
   +-> store invalid rows
   |
   v
PostgreSQL

Public customer
   |
   v
GET /pay/:token
   |
   v
POST /pay/:token/checkout
   |
   v
Payment transaction (INITIATED)
   |
   +-> POST /pay/transactions/:transactionId/simulate
   |
   v
SUCCESS or FAILED
```

## Prerequisites

- Node.js 20 or later
- npm
- PostgreSQL
- Redis

## Setup

### 1. Clone and enter the project

```bash
git clone <YOUR_REPOSITORY_URL>
cd Bulk-Pay-By-Link-Generator
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create `.env` in the project root:

```env
PORT=8080
DATABASE_URL="postgresql://postgres:<database-password>@localhost:5432/bulk_payment_links"
REDIS_URL="redis://127.0.0.1:6379"
BASE_URL="http://localhost:8080"
```

| Variable | Required | Description |
|---|---:|---|
| `PORT` | No | Express server port. Defaults to `8080`. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `REDIS_URL` | Yes | Redis connection string used by BullMQ. |
| `BASE_URL` | Yes | Public base URL used to generate `paymentUrl` values. |

> Never commit real database passwords, Redis credentials, or `.env` files.

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Apply database migrations

For local development:

```bash
npx prisma migrate dev
```

To apply existing migrations in another environment:

```bash
npx prisma migrate deploy
```

### 6. Start PostgreSQL and Redis

Start your local PostgreSQL and Redis services before running the application.

### 7. Run the application

Development mode:

```bash
npm run dev
```

Build and run the compiled application:

```bash
npm run build
npm start
```

The default base URL is:

```text
http://localhost:8080
```

## CSV Format

The upload field must be named `file`. The CSV header must contain:

```csv
customerName,customerEmail,amount,currency
Alice Johnson,alice@example.com,500,INR
Bob Wilson,bob@example.com,750.50,INR
Charlie Brown,charlie@example.com,1200,INR
```

Each row must contain all four fields. Additional validation rules:

| Field | Validation |
|---|---|
| `customerName` | Required, trimmed |
| `customerEmail` | Required, trimmed; format is not currently validated |
| `amount` | Positive number with no more than two decimal places |
| `currency` | Required and must be `INR` |

Invalid rows are stored in `FailedPaymentLink` and do not prevent valid rows
from being processed.

## API Reference

### Health and database checks

#### Health check

```http
GET /
```

Response:

```json
{
  "status": "OK",
  "message": "Payment link Backend is running successfully"
}
```

#### Database check

```http
GET /api/test-db
```

### Upload a CSV

```http
POST /api/upload-csv
Content-Type: multipart/form-data
```

Multipart fields:

| Field | Type | Required | Description |
|---|---|---:|---|
| `merchantId` | Text | Yes | Merchant identifier |
| `file` | File | Yes | CSV file |

Example using cURL:

```bash
curl -X POST "http://localhost:8080/api/upload-csv" \
  -F "merchantId=merchant-001" \
  -F "file=@bulk-payment-links.csv"
```

Example response:

```json
{
  "error": false,
  "message": "Bulk payment link processing queued successfully",
  "data": {
    "jobId": "cmwqtxlw30000akti8iwky70c",
    "status": "UPLOADED",
    "totalRecords": 0
  }
}
```

The upload returns `202 Accepted`. CSV processing continues in the background.

### Create a bulk job manually

This endpoint creates only the job record. It does not upload or process a CSV.

```http
POST /api/bulk-payment-links
Content-Type: application/json
```

```json
{
  "merchantId": "merchant-001",
  "fileName": "bulk-payment-links.csv"
}
```

### Retrieve bulk-job status

```http
GET /api/bulk-payment-links/:jobId
```

Example:

```bash
curl "http://localhost:8080/api/bulk-payment-links/cmwqtxlw30000akti8iwky70c"
```

The response includes the following counters:

- `totalRecords`
- `processedRecords`
- `successfulRecords`
- `failedRecords`
- `status`
- `createdAt`
- `completedAt`

#### Bulk-job statuses

| Status | Meaning |
|---|---|
| `UPLOADED` | CSV received; processing not started or queued |
| `PROCESSING` | Worker is processing the CSV |
| `COMPLETED` | Processing completed with no failed rows |
| `COMPLETED_WITH_ERRORS` | Processing completed with one or more failed rows |
| `FAILED` | Processing exhausted its retries or failed |

### Retrieve generated payment links

```http
GET /api/bulk-payment-links/:jobId/payment-links?page=1&limit=100
```

| Query parameter | Required | Default behavior | Constraints |
|---|---:|---|---|
| `page` | Yes | No default in this implementation | Positive integer |
| `limit` | Yes | No default in this implementation | Integer from 1 through 100 |

Example:

```bash
curl "http://localhost:8080/api/bulk-payment-links/cmwqtxlw30000akti8iwky70c/payment-links?page=1&limit=100"
```

Example response:

```json
{
  "error": false,
  "message": "Payment links retrieved successfully",
  "data": {
    "jobId": "cmwqtxlw30000akti8iwky70c",
    "totalPaymentLinks": 3,
    "currentPage": 1,
    "pageSize": 100,
    "totalPages": 1,
    "paymentlinks": [
      {
        "id": "payment-link-id",
        "customerName": "Alice Johnson",
        "customerEmail": "alice@example.com",
        "amount": "500",
        "currency": "INR",
        "status": "PENDING",
        "errorMessage": null,
        "paymentUrl": "http://localhost:8080/pay/unique-token",
        "createdAt": "2026-11-21T19:57:22.547Z"
      }
    ]
  }
}
```

When the job is still `UPLOADED` or `PROCESSING`, this endpoint returns
`409 Conflict`.

### Retrieve failed CSV rows

```http
GET /api/bulk-payment-links/:jobId/failed-rows
```

Example:

```bash
curl "http://localhost:8080/api/bulk-payment-links/cmwqtxlw30000akti8iwky70c/failed-rows"
```

### Create a payment link manually

```http
POST /api/payment-links
Content-Type: application/json
```

```json
{
  "bulkJobId": "cmwqtxlw30000akti8iwky70c",
  "customerName": "Alice Johnson",
  "customerEmail": "alice@example.com",
  "amount": "500",
  "currency": "INR",
  "idempotencyKey": "merchant-001-alice-500"
}
```

The `idempotencyKey` must be unique.

### Retrieve a public payment link

```http
GET /pay/:token
```

Example:

```bash
curl "http://localhost:8080/pay/unique-token"
```

Example response:

```json
{
  "error": false,
  "message": "Payment link retrieved successfully",
  "data": {
    "id": "payment-link-id",
    "customerName": "Alice Johnson",
    "customerEmail": "alice@example.com",
    "amount": "500",
    "currency": "INR",
    "status": "PENDING",
    "createdAt": "2026-11-21T19:57:22.547Z"
  }
}
```

An unknown token returns `404 Not Found`.

### Initiate checkout

```http
POST /pay/:token/checkout
```

No request body is required.

```bash
curl -X POST "http://localhost:8080/pay/unique-token/checkout"
```

This endpoint:

1. Looks up the payment link by token.
2. Changes `PENDING` to `PROCESSING`.
3. Creates a transaction with status `INITIATED`.
4. Performs both database operations in a Prisma transaction.

Example response:

```json
{
  "error": false,
  "message": "Payment transaction initiated successfully",
  "data": {
    "id": "transaction-database-id",
    "transactionId": "txn_unique_identifier",
    "paymentLinkId": "payment-link-id",
    "amount": "500",
    "currency": "INR",
    "status": "INITIATED",
    "createdAt": "2026-11-18T18:36:45.904Z"
  }
}
```

An unknown token or a link that is no longer `PENDING` returns `409 Conflict`.

### Simulate a payment result

```http
POST /pay/transactions/:transactionId/simulate
Content-Type: application/json
```

Request body:

```json
{
  "status": "SUCCESS"
}
```

Accepted values:

- `SUCCESS`
- `FAILED`

```bash
curl -X POST \
  "http://localhost:8080/pay/transactions/txn_unique_identifier/simulate" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"SUCCESS\"}"
```

Example success response:

```json
{
  "error": false,
  "message": "Payment result simulated successfully",
  "data": {
    "transactionId": "txn_unique_identifier",
    "paymentLinkId": "payment-link-id",
    "transactionStatus": "SUCCESS",
    "paymentLinkStatus": "SUCCESS"
  }
}
```

For a failed payment, send `"status": "FAILED"`. The transaction and
payment-link statuses will both become `FAILED`.

Only transactions with status `INITIATED` and payment links with status
`PROCESSING` can be completed. The two status updates run in one Prisma
transaction. Duplicate completion attempts return `409 Conflict`.

> This endpoint accepts a client-provided status and is intended only for
> development and demonstration. It must not be used as a real payment
> verification mechanism.

## Payment Lifecycle

```text
CSV upload
   |
   v
Payment link created
   |
   v
PENDING
   |
   | Customer calls checkout
   v
PROCESSING
   |
   v
Transaction created: INITIATED
   |
   +----------+----------+
   |                     |
   v                     v
SUCCESS               FAILED
   |                     |
   v                     v
Payment link         Payment link
SUCCESS              FAILED
```

## Database Models

### `BulkJob`

Stores CSV-upload processing information.

Important fields:

- `id`
- `merchantId`
- `fileName`
- `status`
- `totalRecords`
- `processedRecords`
- `successfulRecords`
- `failedRecords`
- `createdAt`
- `completedAt`

### `Paymentlink`

Stores an individual payment link.

Important fields:

- `id`
- `bulkJobId`
- `idempotencyKey`
- `customerName`
- `customerEmail`
- `amount`
- `currency`
- `status`
- `paymentToken`
- `paymentUrl`
- `errorMessage`
- `createdAt`

### `FailedPaymentLink`

Stores an invalid CSV row or processing failure.

Important fields:

- `id`
- `bulkJobId`
- `rowNumber`
- `rowData`
- `errorMessage`
- `createdAt`

### `PaymentTransaction`

Stores a payment attempt.

Important fields:

- `id`
- `paymentLinkId`
- `transactionId`
- `amount`
- `currency`
- `status`
- `paymentMethod`
- `createdAt`
- `updatedAt`

A payment link can have multiple payment transactions.

## Status Reference

### Payment-link statuses

| Status | Meaning |
|---|---|
| `PENDING` | Waiting for checkout |
| `PROCESSING` | Checkout started and transaction initiated |
| `SUCCESS` | Payment simulation completed successfully |
| `FAILED` | Payment simulation failed |

### Transaction statuses

| Status | Meaning |
|---|---|
| `INITIATED` | Transaction created and awaiting a result |
| `SUCCESS` | Simulated transaction succeeded |
| `FAILED` | Simulated transaction failed |

## Testing

Recommended manual test flow:

1. Upload a CSV file.
2. Get the bulk job status.
3. Retrieve generated payment links.
4. Open a public payment link.
5. Initiate checkout.
6. Inspect the transaction in Prisma Studio or PostgreSQL.
7. Simulate `SUCCESS`.
8. Confirm that the transaction and link both show `SUCCESS`.
9. Upload or create another link and simulate `FAILED`.
10. Try duplicate checkout and duplicate completion operations.

Open Prisma Studio:

```bash
npx prisma studio
```

The repository currently has no automated test script. `npm test` is a
placeholder.

## Project Structure

```text
.
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── config/
│   ├── lib/
│   ├── middlewares/
│   ├── queues/
│   ├── routes/
│   ├── utils/
│   ├── workers/
│   └── server.ts
├── bulk-payment-links.csv
├── package.json
├── prisma.config.ts
└── tsconfig.json
```

## Production Considerations

Before deploying:

- Add merchant authentication and authorization.
- Add API input and upload validation.
- Validate customer email addresses.
- Configure CORS and secure HTTP headers.
- Add request and webhook rate limiting.
- Replace payment simulation with a verified payment-gateway integration.
- Verify payment-gateway webhooks cryptographically.
- Store and rotate secrets securely.
- Use HTTPS and a production `BASE_URL`.
- Configure production PostgreSQL and Redis connections.
- Add automated unit and integration tests.
- Add logging and job monitoring.
- Restrict or remove development-only demo endpoints.

## License

`package.json` declares `ISC`, but no `LICENSE` file is currently included in
the repository. Add a corresponding license file before publishing or
distributing the project.
