# BuildKart Material

A responsive React and Vite storefront concept for building materials. Product and store settings are saved in the current browser; the project does not include a shared database, authentication, inventory integration, or a live payment gateway.

## Requirements

- Node.js 18 or newer and npm (frontend)
- .NET 10 SDK (backend)
- SQL Server is only needed when you choose to configure and use the API. It is not required to build or start the backend.

## Run the frontend

From the project root:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Create a production frontend build with `npm run build`.

## Run the backend

In a separate terminal, from the project root:

```bash
dotnet run --project backend\BuildKart.API
```

The development launch profile listens at `http://localhost:5000`, loads .NET User Secrets, and allows the Vite origin `http://localhost:5173` by default.
The storefront reads products and categories from `http://localhost:5000/api` by default. To use another API URL, set `VITE_API_BASE_URL` in a root `.env` file before starting Vite (see [.env.example](./.env.example)). It shows a loading state while requesting the API and reports API errors; if the API is unavailable, the storefront uses products saved in this browser without replacing them. When API data is available, catalogue management is read-only in the storefront; product/category changes require an authenticated admin workflow.

The backend does not connect to a database on startup and no SQL Server installation is assumed. Until a connection string is configured, API data routes return `503 Service Unavailable`. To enable them, configure a SQL Server connection string in .NET user-secrets or an environment variable; do not put credentials in this React project:

```bash
dotnet user-secrets init --project backend\BuildKart.API
dotnet user-secrets set "ConnectionStrings:BuildKart" "<your SQL Server connection string>" --project backend\BuildKart.API
dotnet user-secrets set "Authentication:Jwt:SigningKey" "<a unique random secret of at least 32 characters>" --project backend\BuildKart.API
```

For deployments, use a managed secret store or environment variables such as `ConnectionStrings__BuildKart` and `Authentication__Jwt__SigningKey`. Configure `Authentication:Jwt:Issuer` and `Authentication:Jwt:Audience` to match the trusted token issuer. Without a configured signing key the API uses a temporary process-local key, so tokens will not survive a restart. No login or token-issuance endpoint or default administrator account is included.

To allow a different frontend origin, set `Cors:AllowedOrigins` (for example, `Cors__AllowedOrigins__0` in the environment). Keep this list limited to trusted origins.

## Database setup (optional)

The SQL scripts are templates for an existing SQL Server database; they do not create a database or connect to a server. Select or create a database using your SQL Server tooling, then run `database\schema.sql` followed by `database\seed-data.sql`. The seed script inserts the storefront's sample product categories and products. These prices are examples and should be confirmed before use.

The backend uses EF Core SQL Server and does not apply migrations or seed data automatically. The schema script is the initial schema; if you change the EF models, update the SQL schema accordingly.
The current database has not been seeded, so the storefront will show an empty catalogue until you choose to run the optional seed script.

## Included features

- Product catalogue for Aerocon Panels, Bison Boards, Roofing Sheets, and Elevation Planks
- Search, category filters, and price sorting
- Add, edit, and remove products, persisted in browser local storage
- Area estimator with a selectable wastage margin
- Cart quantity controls, wholesale discounts, and estimated GST
- Customer, project, site, contact, and PIN details
- WhatsApp quotation sharing and PDF quotation download
- UPI advance estimates at 10% or 50%
- Editable store contact and UPI settings
- Responsive desktop and mobile layouts

## Important

The existing storefront remains a standalone browser-storage app; it is not wired to the new API. Catalog rates and contact/payment details are sample defaults and should be confirmed before publishing. UPI links only hand off to a compatible payment app; they do not confirm or process payments. Quotation totals are estimates, and delivery charges are not included. The API uses an example 18% tax rate that can be changed through `Sales:TaxRate`.
