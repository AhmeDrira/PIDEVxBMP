# Backend Test Architecture (Unit + Integration)

## Folder structure

- tests/setup: global Jest setup (env + hooks)
- tests/unit/controllers: controller unit tests (`*.unit.test.js`)
- tests/unit/services: service unit tests (`*.unit.test.js`)
- tests/unit/middleware: middleware unit tests
- tests/unit/utils: utility unit tests
- tests/unit/models: model unit tests
- tests/unit/mocks: reusable mocks (req/res, external clients)
- tests/unit/fixtures: fixed test payloads
- tests/unit/builders: object builders for users/products/projects
- tests/integration/api: API integration tests (`*.int.test.js`)

## Rules

- 1 source file = 1 test file
- unit test suffix: `.unit.test.js`
- integration test suffix: `.int.test.js`
- Use AAA pattern in every test block (Arrange / Act / Assert)
- No real DB/API in unit tests

## Priority map (P0/P1)

### P0 controllers
- controllers/authController.js
- controllers/paymentController.js
- controllers/recommendationController.js
- controllers/projectController.js

### P0 services
- services/RecommendationEngine.js
- services/artisanAiSearchService.js
- services/quoteMLService.js
- services/geminiService.js

### P1 modules
- middleware/authMiddleware.js
- utils/actionLogger.js
- models/User.js
- models/Project.js
- models/Product.js

## Generated source-to-test mapping

- controllers/authController.js -> tests/unit/controllers/authController.unit.test.js
- controllers/paymentController.js -> tests/unit/controllers/paymentController.unit.test.js
- controllers/recommendationController.js -> tests/unit/controllers/recommendationController.unit.test.js
- controllers/projectController.js -> tests/unit/controllers/projectController.unit.test.js
- services/RecommendationEngine.js -> tests/unit/services/recommendationEngine.unit.test.js
- services/artisanAiSearchService.js -> tests/unit/services/artisanAiSearchService.unit.test.js
- services/quoteMLService.js -> tests/unit/services/quoteMLService.unit.test.js
- services/geminiService.js -> tests/unit/services/geminiService.unit.test.js
- middleware/authMiddleware.js -> tests/unit/middleware/authMiddleware.unit.test.js
- utils/actionLogger.js -> tests/unit/utils/actionLogger.unit.test.js
- models/User.js -> tests/unit/models/User.unit.test.js
- models/Project.js -> tests/unit/models/Project.unit.test.js
- models/Product.js -> tests/unit/models/Product.unit.test.js

## Shared test utilities generated

- tests/setup/jest.setup.js
- tests/unit/mocks/http.mock.js
- tests/unit/fixtures/auth.fixture.js
- tests/unit/fixtures/recommendation.fixture.js
- tests/unit/builders/user.builder.js
- tests/unit/builders/product.builder.js

## Commands

- `npm run test:unit`
- `npm run test:integration`
- `npm run test:coverage`
