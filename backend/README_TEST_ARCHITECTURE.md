# Test Architecture (Backend Unit Tests)

## Scope

The backend uses a dedicated `tests/unit` suite for isolated tests of:
- controllers
- services and business utilities
- mongoose models (schema validations)

## Core Principles

- One source module -> one unit test file under `tests/unit`.
- All external dependencies are mocked (JWT, axios/OpenAI, nodemailer, socket, filesystem, PDF, payment providers).
- No real MongoDB, no external HTTP calls, no side effects.
- Controller tests always validate:
  - HTTP status
  - response payload shape and business-critical fields
  - critical dependency calls with explicit arguments (`toHaveBeenCalledWith`)
- Mongoose chainables are mocked with thenable query objects so `find().select().sort().lean()` remains testable.

## Directory Layout

- `tests/jest.setup.js`: global setup (`jest.clearAllMocks()` before each test and `jest.restoreAllMocks()` after each test).
- `tests/http.mock.js`: reusable `buildReq`, `buildRes`, and `chainableQuery` helpers.
- `tests/unit/**/*.unit.test.js`: one test file per source module.

## Recommended Test Structure

Use AAA in every test:
- Arrange: build request/response and prepare mocks.
- Act: call the unit under test.
- Assert: verify HTTP status/payload/calls and edge behavior.

Use explicit sections in larger files:
- `describe('Nominal cases')`
- `describe('Validation and edge cases')`
- `describe('Error handling')`

## Sonar-Focused Quality Checklist

When adding or updating tests, verify:
- Assertions are specific (avoid bare `toBeDefined` and generic `toHaveBeenCalled`).
- For controllers, assert call order when relevant: `res.status(...)` before `res.json(...)`.
- Inputs cover edge values (`null`, `undefined`, `''`, empty arrays/objects, invalid numeric query params).
- Async tests fail safely (use `await` consistently; add `expect.assertions(...)` when testing rejection paths with manual `try/catch`).
- Mocks are isolated and reset between tests.
- Test names describe expected business behavior, not generic "should work" text.

## Running Tests

From `backend`:

- Run all unit tests:
  - `npm run test:unit`
- Run full test suite:
  - `npm test`
- Run one file:
  - `npx jest tests/unit/controllers/aiController.unit.test.js --runInBand`
- Run one test by name:
  - `npx jest tests/unit/controllers/aiController.unit.test.js -t "copilotChat" --runInBand`

## Debugging Jest Tests

From `backend`:

- Start Jest in Node inspector mode:
  - `node --inspect-brk ./node_modules/jest/bin/jest.js tests/unit/controllers/aiController.unit.test.js --runInBand`
- Then attach a debugger from VS Code to the Node process and place breakpoints inside test or source files.

## Adding a New Unit Test Module

1. Create a matching file in `tests/unit` (same module name + `.unit.test.js`).
2. Reuse helpers from `tests/http.mock.js` for controllers.
3. Mock only external dependencies, keep business logic real.
4. Cover at least:
   - nominal behavior
   - validation/edge cases
   - error/fallback path
5. Run the single file first, then run `npm run test:unit`.
