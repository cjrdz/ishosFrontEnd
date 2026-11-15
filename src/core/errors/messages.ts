/**
 * Every error message the app shows is in Spanish. The backend answers in
 * Spanish, but a proxy, a timeout or an older endpoint can still produce an
 * English text; those are replaced by a Spanish message for the status.
 */

const DEFAULT_BY_STATUS: Record<number, string> = {
  0: "No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.",
  400: "Revisa los datos e intenta de nuevo.",
  401: "Tu sesión expiró. Inicia sesión de nuevo.",
  403: "No tienes permiso para hacer esto.",
  404: "No se encontró lo que buscabas.",
  409: "No se pudo completar porque los datos cambiaron. Actualiza e intenta de nuevo.",
  413: "La solicitud es demasiado grande.",
  429: "Demasiados intentos. Espera un momento e intenta de nuevo.",
  503: "El servicio no está disponible por ahora. Intenta de nuevo en unos minutos.",
  504: "El servidor tardó demasiado en responder. Intenta de nuevo.",
};

const GENERIC = "Ocurrió un error inesperado. Intenta de nuevo.";

/** Spanish fallback for an HTTP status. */
export function defaultErrorMessage(status: number): string {
  return DEFAULT_BY_STATUS[status] ?? GENERIC;
}

// Words that only appear in English error texts ("Request failed",
// "conflict: x needs 1 but only 0 available", "invalid format"...).
const ENGLISH =
  /\b(the|is|are|not|failed|failure|invalid|required|must|cannot|unable|unexpected|request|conflict|timed out|found|forbidden|unauthorized|denied|too many|try later|only|available|needs|already|internal|server)\b/i;
const SPANISH_MARKS = /[áéíóúñ¿¡ÁÉÍÓÚÑ]/;

/** True when the text reads as English (and so must not be shown as is). */
export function looksEnglish(message: string): boolean {
  if (SPANISH_MARKS.test(message)) return false;
  return ENGLISH.test(message);
}

/** The message to show people: the given one when it is Spanish. */
export function toSpanishMessage(message: string, status: number): string {
  const text = (message ?? "").trim();
  if (!text || looksEnglish(text)) return defaultErrorMessage(status);
  return text;
}
