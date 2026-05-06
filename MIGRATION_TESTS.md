# Migration Tests Report

## Scope

Only test-related artifacts were migrated from `PIDEVxBMP` to `PIDEVxBMP1`. No application code was modified.

## Migrated Artifacts

### Backend

- `backend/tests/integration/api/auth.int.test.js`
- `backend/tests/integration/api/auth-deep.int.test.js`
- `backend/tests/integration/api/invoices.int.test.js`
- `backend/tests/integration/api/messages.int.test.js`
- `backend/tests/integration/api/payments.int.test.js`
- `backend/tests/integration/api/products.int.test.js`
- `backend/tests/integration/api/quotes.int.test.js`
- `backend/tests/integration/helpers/buildAuthApp.js`
- `backend/tests/integration/helpers/buildInvoiceApp.js`
- `backend/tests/integration/helpers/buildMessageApp.js`
- `backend/tests/integration/helpers/buildPaymentApp.js`
- `backend/tests/integration/helpers/buildProductApp.js`
- `backend/tests/integration/helpers/buildQuoteApp.js`
- `backend/tests/integration/helpers/auth.helpers.js`
- `backend/tests/integration/helpers/testDb.js`

### Frontend

- `frontend/src/tests/unit/app/App.test.tsx`
- `frontend/src/tests/unit/components/*`
- `frontend/src/tests/unit/context/*`
- `frontend/src/tests/unit/hooks/*`
- `frontend/src/tests/unit/services/*`
- `frontend/src/tests/unit/ui/*`
- `frontend/src/tests/integration/auth-flow.integration.test.tsx`

### Test-only fixes applied in the target repo

- Added missing controller mocks in `backend/tests/unit/routes/messages.unit.test.js`.
- Added `set` and `get` to the mocked Express app in `backend/tests/unit/app.unit.test.js`.
- Removed the non-transferable `LazyOnVisible` test coverage in `frontend/src/tests/unit/components/common-extra.test.tsx` because the corresponding production component does not exist in `PIDEVxBMP1`.
- Updated `frontend/src/tests/unit/app/App.test.tsx` to wait for lazy-loaded UI.
- Updated `frontend/src/tests/unit/context/SocketContext.test.tsx` to match the idle scheduling and test-environment socket origin.

## Validation

### Backend

- `npm ci`
- `npm run test`
- `npm run test:coverage`

Result: unit tests passed. Coverage ran to completion, but the coverage command still surfaced a pre-existing unrelated failure in `tests/recommendationEngine.test.js` with `estimateDeliveryDays is not a function` and `scoreBesoin is not a function`.

### Frontend

- `npm ci`
- `npm run test`
- `npm run test:coverage`

Result: the Vitest suite passed fully. Coverage artifacts were generated successfully.

## Coverage Snapshot

### Backend target repo

- Overall coverage reported by Jest was about 64.01% statements, 49.82% branches, 68.34% functions, and 65.47% lines.
- The main sub-80 areas were controllers, middleware, and services.
- Representative low-coverage files include:
  - `backend/controllers/actionLogController.js`
  - `backend/controllers/aiController.js`
  - `backend/controllers/aiShopperController.js`
  - `backend/controllers/analyticsController.js`
  - `backend/controllers/artisanController.js`
  - `backend/controllers/authController.js`
  - `backend/controllers/calendarController.js`
  - `backend/controllers/contractController.js`
  - `backend/controllers/conversationController.js`
  - `backend/controllers/expertController.js`

### Frontend target repo

- The Vitest coverage run completed successfully and produced `lcov.info` plus `lcov-report/`.
- The remaining low-coverage areas were concentrated in feature-heavy UI and context code that is not broadly exercised by the migrated test set.
- Representative files that were still below 80% statement coverage in the generated report include:
  - `frontend/src/components/figma/ImageWithFallback.tsx`
  - `frontend/src/components/manufacturer/ManufacturerProducts.tsx`
  - `frontend/src/context/GlobalCallContext.tsx`
  - `frontend/src/context/SocketContext.tsx`

### Source snapshot for reference

- The source frontend coverage summary in `PIDEVxBMP` showed a much larger amount of intentionally untested production code, including many 0% feature pages and UI primitives.
- That baseline was useful to confirm the migration stayed tests-only and did not widen the application surface.

## Artifacts Present In `PIDEVxBMP1`

- Backend coverage artifacts: `backend/coverage/clover.xml`, `backend/coverage/coverage-final.json`, `backend/coverage/lcov.info`, `backend/coverage/lcov-report/`
- Frontend coverage artifacts: `frontend/coverage/lcov.info`, `frontend/coverage/lcov-report/`

## Notes

- No temporary `coverageThreshold` was added.
- The backend coverage failure is outside the migration scope and should be handled separately if desired.

## Next Commands

- `cd backend && npm run test`
- `cd backend && npm run test:coverage`
- `cd frontend && npm run test`
- `cd frontend && npm run test:coverage`