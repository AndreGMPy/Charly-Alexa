# Integracion Stripe y Notificaciones

Esta guia no contiene secretos reales. Usa claves de prueba primero y cambia a produccion solo cuando el flujo completo este validado.

## Stripe

1. Entra a la cuenta Stripe de la clienta.
2. Activa modo test para pruebas.
3. Ve a Developers > API keys.
4. Copia la publishable key en `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
5. Copia la secret key en `STRIPE_SECRET_KEY`.
6. En Developers > Webhooks crea un endpoint:
   - Preview/local con Stripe CLI: la URL que entregue `stripe listen`.
   - Produccion: `https://TU-DOMINIO.com/api/stripe/webhook`.
7. Selecciona estos eventos:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
8. Copia el signing secret del webhook en `STRIPE_WEBHOOK_SECRET`.
9. Verifica una compra test con tarjetas de prueba de Stripe.
10. Confirma que el pedido cambie a `paid`, `paymentStatus: paid` y `paymentProvider: stripe` en Firestore.
11. Para produccion, cambia las claves test por live, actualiza el webhook live y haz redeploy.

El pago solo se confirma desde el webhook firmado. La pagina `/pedido/exito` solo consulta el pedido y muestra “Estamos confirmando tu pago...” si Stripe aun no ha notificado.

## Resend

1. Crea una cuenta en Resend.
2. Agrega el dominio `charlyalexa.com`.
3. Copia los registros DNS que Resend indique, normalmente SPF/DKIM y verificacion de dominio.
4. Espera a que Resend marque el dominio como verificado.
5. Crea una API key y colocala en `RESEND_API_KEY`.
6. Define `RESEND_FROM_EMAIL=pedidos@charlyalexa.com`.
7. Define `ORDER_NOTIFICATION_EMAIL=ventas@charlyalexa.com` o el correo real que recibira nuevos pedidos.

Si el dominio aun no esta verificado, usa temporalmente un remitente permitido por Resend. Los fallos de correo quedan registrados en `orders/{id}.notifications.*Error` y no revierten pagos.

## Firebase Cloud Messaging

1. En Firebase Console abre Project settings > Cloud Messaging.
2. Genera o copia la Web Push certificate key pair.
3. Coloca la clave publica en `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
4. El service worker publico es `/firebase-messaging-sw.js`; carga su configuracion desde `/api/firebase/messaging-sw-runtime`.
5. Entra al panel desde el telefono de la clienta.
6. Ve a `/admin/configuracion`.
7. Presiona “Activar notificaciones de pedidos”.
8. Acepta el permiso del navegador.
9. Usa “Enviar notificacion de prueba” para comprobar el dispositivo actual.

Compatibilidad: Chrome/Edge/Android funcionan bien. iOS requiere Safari compatible con Web Push y que el sitio este agregado a la pantalla de inicio. Si el permiso fue rechazado, hay que cambiarlo desde ajustes del navegador o del sistema.

Los tokens se guardan en `adminNotificationTokens`, ligados al UID administrador. Si Firebase reporta un token invalido, se marca `active: false`.

## Vercel

Agrega estas variables en Preview y Production, usando valores test en Preview y live en Production:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ORDER_NOTIFICATION_EMAIL`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

`FIREBASE_ADMIN_PRIVATE_KEY` debe conservar los saltos de linea. En Vercel puede pegarse con `\n` y la app los normaliza.

Haz redeploy cada vez que cambies claves `NEXT_PUBLIC_*`, Stripe, Resend o Firebase Admin.

## Prueba recomendada

1. Crear compra test pagada.
2. Confirmar que el webhook marque el pedido como pagado.
3. Confirmar que el inventario baje una sola vez.
4. Reenviar el mismo evento desde Stripe y confirmar que no duplique correos, push ni inventario.
5. Probar pago rechazado y cancelacion.
6. Activar notificaciones desde telefono y enviar prueba.
7. Revisar que pedidos historicos de `mercadopago` sigan visibles en el panel.
