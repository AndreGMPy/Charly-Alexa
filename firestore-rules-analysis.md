# Firestore Rules Analysis

- Firestore database: `(default)`, `STANDARD`, native mode, location `nam5`.
- Public reads used by the storefront:
  - `products` filtered by `isActive == true`.
  - `products` detail filtered by `slug` and `isActive == true`.
  - `subcategories` filtered by `parentCategory` and `isActive == true`.
  - `homepage/main` and `siteSettings/main` direct reads.
- Admin reads/writes used by the panel:
  - `products`, `categories`, `subcategories`, `homepage`, `siteSettings`.
  - `orders` sorted by `createdAt`.
  - `sales` and `storeSales` sorted by `createdAt`.
  - `stockMovements` written during admin inventory transactions.
- Public checkout now writes through `app/api/orders` with Firebase Admin SDK.
  Firestore still allows validated public `orders` creates and controlled
  `web_order` stock movement creates for compatibility, but product writes are
  admin-only.
