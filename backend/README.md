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

### Artisan mini site

-   **GET /api/check-slug?slug=...**
    -   Public, rate limited to 60 requests/minute per IP
    -   Always answers `200`, even for an invalid slug (called on every keystroke)
    -   Response: `{ available, slug, reason?, message?, suggestion? }`

-   **GET /api/public/artisan/:slug**
    -   Public, no authentication
    -   Response: public profile only (name, trade, area, bio, phone, WhatsApp
        link, portfolio, reviews)
    -   `404` if the slug does not exist or the artisan is suspended

-   **GET /site/:slug**
    -   Public, server-rendered mini site (EJS)
    -   Also served on `[slug].bmp.tn` by `middleware/miniSiteMiddleware.js`

-   **GET /site/:slug/share.png**
    -   Public, 1200x630 PNG used as `og:image` for social sharing

-   **GET /site/:slug/avatar.svg**
    -   Public, initials avatar used as favicon

## Environment Variables (.env)

-   `PORT`: Server port (default 5000)
-   `MONGO_URI`: MongoDB connection string
-   `JWT_SECRET`: Secret for signing JWT tokens
-   `ADMIN_CREATION_SECRET`: Secret key for creating admin accounts
-   `MINI_SITE_BASE_DOMAIN`: **Required in production.** Root domain serving the
    artisan mini sites, e.g. `bmp.tn`. Each artisan is then reachable at
    `[slug].bmp.tn`.

    -   **Set:** only single-label subdomains of that exact domain resolve to a
        mini site (`hamza.bmp.tn` yes, `hamza.other.tn` and `a.hamza.bmp.tn` no),
        and public URLs are built as `https://[slug].bmp.tn`.
    -   **Unset (local dev):** falls back to a generic
        `subdomain.domain.tld` heuristic and builds URLs as
        `http://[slug].localhost:PORT`. `*.localhost` keeps working either way —
        browsers resolve it without touching the `hosts` file.

    Leaving it unset in production is a real risk: an unexpected `Host` header
    could be interpreted as a mini site request. Reserved slugs (`www`, `api`,
    `app`, `staging`, ...) already guard the common cases, but the variable is
    what makes the match exact.

    Deployment also needs a wildcard DNS record `*.bmp.tn`, a wildcard TLS
    certificate, and Nginx forwarding the original host
    (`proxy_set_header Host $host;`) — the whole subdomain routing depends on it.
