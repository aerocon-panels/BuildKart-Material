# BuildKart Material

A responsive React and Vite storefront concept for building materials. Product and store settings are saved in the current browser; the project does not include a shared database, authentication, inventory integration, or a live payment gateway.

## Requirements

- Node.js 18 or newer
- npm

## Install and run

From the repository root:

```bash
cd buildkart-material
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).
If you opened this project folder directly, run only `npm install` and `npm run dev`.

## Production build

```bash
cd buildkart-material
npm run build
npm run preview
```

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

Catalog rates and contact/payment details are sample defaults based on the public reference page and should be confirmed before publishing. UPI links only hand off to a compatible payment app; they do not confirm or process payments. Quotation totals are estimates, and delivery charges are not included.
