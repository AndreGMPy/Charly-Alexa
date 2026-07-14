# Firestore Rules Audit Notes - Stripe Checkout

## Collections Observed

- `products`: public reads only for active products; admin writes.
- `categories`, `subcategories`: public reads only for active documents; admin writes.
- `homepage`, `siteSettings`: public reads for storefront content; admin writes.
- `orders`: contains customer PII, totals, payment state, Stripe IDs, notification state, and inventory flags. Admin only.
- `adminNotificationTokens`: contains FCM tokens and admin user data. Admin only.
- `stripeWebhookEvents`: idempotency records for server webhooks. Admin only.
- `stockMovements`, `sales`, `storeSales`, `customers`: operational/admin data. Admin only.

## Access Changes

- Removed public `orders` create permission because checkout now creates orders through server routes using Firebase Admin.
- Removed public product stock update permission because inventory is updated only after a signed Stripe webhook confirms payment.
- Added admin-only `adminNotificationTokens` and `stripeWebhookEvents` paths.

## Attack Review

- Public users cannot create orders, mark orders paid, set Stripe IDs, write totals, or write notification tokens.
- Public users cannot decrement inventory or create stock movements.
- Admin access still depends on Firebase Auth custom claim `admin == true`.
- Product/catalog reads remain public only for active storefront data.

These rules are a prototype aligned to the new server-side checkout flow and should be reviewed before production launch.
