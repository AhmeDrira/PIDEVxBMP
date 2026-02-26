# Digital Construction Marketplace Backend

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Ensure MongoDB is running locally or update `MONGO_URI` in `.env`.

3.  Start the server:
    ```bash
    npm start
    ```
    Or for development with auto-restart (requires nodemon):
    ```bash
    npm run dev
    ```

## API Endpoints

### Auth

-   **POST /api/auth/register**
    -   Public
    -   Body:
        -   `firstName` (string, required)
        -   `lastName` (string, required)
        -   `email` (string, required, unique)
        -   `phone` (string, required)
        -   `password` (string, required, min 6 chars)
        -   `role` (enum: 'artisan', 'expert', 'manufacturer')
        -   **Artisan Specific:**
            -   `location` (string, required)
            -   `domain` (string, required)
            -   `yearsExperience` (number, optional)
        -   **Expert Specific:**
            -   `domain` (string, required)
        -   **Manufacturer Specific:**
            -   `companyName` (string, required)
            -   `certificationFile` (string, optional - path/name)

-   **POST /api/auth/login**
    -   Public
    -   Body:
        -   `email` (string, required)
        -   `password` (string, required)
    -   Response: User object + JWT token

-   **POST /api/auth/admin/create**
    -   **Private (Secret Key Protected)**
    -   Body:
        -   `firstName` (string, required)
        -   `lastName` (string, required)
        -   `email` (string, required)
        -   `password` (string, required)
        -   `phone` (string, required)
        -   `secretKey` (string, required - matches `ADMIN_CREATION_SECRET` in .env)

-   **GET /api/auth/me**
    -   Private (Requires Bearer Token)
    -   Headers: `Authorization: Bearer <token>`
    -   Response: Current user details

## Environment Variables (.env)

-   `PORT`: Server port (default 5000)
-   `MONGO_URI`: MongoDB connection string
-   `JWT_SECRET`: Secret for signing JWT tokens
-   `ADMIN_CREATION_SECRET`: Secret key for creating admin accounts
