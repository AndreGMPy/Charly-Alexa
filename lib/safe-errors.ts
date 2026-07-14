import { FirebaseError } from "firebase/app";

const invalidCredentialCodes = new Set([
  "auth/invalid-credential",
  "auth/invalid-email",
  "auth/missing-password",
  "auth/user-not-found",
  "auth/wrong-password",
]);

export function logErrorInDevelopment(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") return;

  if (error instanceof FirebaseError) {
    console.error(context, {
      code: error.code,
      message: error.message,
      customData: error.customData,
    });
    return;
  }

  console.error(context, error);
}

export function getSafeLoginErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    if (invalidCredentialCodes.has(error.code)) {
      return "Correo o contraseña incorrectos.";
    }

    if (
      error.code === "auth/api-key-not-valid" ||
      error.code === "auth/invalid-api-key" ||
      error.code === "auth/operation-not-allowed" ||
      error.code === "auth/unauthorized-domain"
    ) {
      return "La conexión de la tienda no está configurada correctamente.";
    }

    if (error.code === "auth/too-many-requests") {
      return "Hay demasiados intentos. Espera unos minutos y vuelve a intentar.";
    }
  }

  return "No se pudo iniciar sesión. Intenta de nuevo.";
}

export function getSafeFirebaseActionMessage(
  error: unknown,
  fallback = "No se pudo cargar la información. Intenta de nuevo."
) {
  if (error instanceof FirebaseError) {
    if (error.code === "permission-denied") {
      return "No tienes permisos para realizar esta acción.";
    }

    if (
      error.code === "auth/api-key-not-valid" ||
      error.code === "auth/invalid-api-key"
    ) {
      return "No se pudo conectar con la tienda. Revisa la configuración.";
    }
  }

  return fallback;
}

export function getSafeUploadMessage(error: unknown) {
  if (error instanceof Error) {
    const safeValidationMessages = [
      "Solo puedes subir archivos de imagen.",
      "No se pudo leer la imagen.",
    ];

    if (
      safeValidationMessages.includes(error.message) ||
      /^La imagen original debe pesar menos de \d+ MB\.$/.test(error.message)
    ) {
      return error.message;
    }
  }

  return getSafeFirebaseActionMessage(
    error,
    "No se pudo subir la imagen. Intenta de nuevo."
  );
}

export function getSafeOrderMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("No hay suficientes piezas")) {
      return "Lo sentimos, ya no hay suficientes piezas de esta talla.";
    }

    if (error.message === "La tienda todavía no está lista. Intenta más tarde.") {
      return error.message;
    }
  }

  return getSafeFirebaseActionMessage(
    error,
    "No se pudo enviar el pedido. Intenta de nuevo."
  );
}

export function getSafePaymentMessage(error: unknown) {
  if (error instanceof Error) {
    const stripeSafeMessages = [
      "No pudimos iniciar el pago. Intenta nuevamente.",
      "El producto ya no esta disponible.",
      "El carrito esta vacio.",
      "Los pagos todavia no estan configurados.",
    ];

    if (stripeSafeMessages.includes(error.message)) {
      return error.message;
    }

    const safeMessages = [
      "Los pagos todavía no están configurados.",
      "Este pedido ya está pagado.",
      "Este pedido se acordará por WhatsApp.",
      "No se pudo preparar el pago. Intenta de nuevo o acuerda por WhatsApp.",
    ];

    if (safeMessages.includes(error.message)) {
      return error.message;
    }
  }

  return "No pudimos iniciar el pago. Intenta nuevamente.";
}

export function getSafeSaleMessage(error: unknown) {
  if (error instanceof Error) {
    const match = error.message.match(
      /No hay suficientes piezas disponibles de (.+) talla (.+)\./
    );

    if (match) {
      return `No hay suficientes piezas de la talla ${match[2]} en ${match[1]}.`;
    }
  }

  return getSafeFirebaseActionMessage(
    error,
    "No se pudo registrar la venta. Intenta de nuevo."
  );
}
