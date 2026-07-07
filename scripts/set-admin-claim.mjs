import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Uso: npm run set-admin");
  process.exit(1);
}

const app =
  getApps()[0] ??
  initializeApp({
    credential: applicationDefault(),
  });
const auth = getAuth(app);

try {
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims ?? {}),
    admin: true,
  });

  console.log("Admin asignado correctamente.");
} catch (error) {
  if (process.env.NODE_ENV === "development") {
    console.error(error);
  } else {
    console.error(
      "No se pudo asignar admin. Revisa el correo y las credenciales locales."
    );
  }

  process.exit(1);
}
