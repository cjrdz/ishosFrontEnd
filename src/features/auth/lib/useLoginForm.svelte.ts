import { z } from "zod";

const schema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export function useLoginForm() {
  let email = $state("");
  let password = $state("");
  let isLoading = $state(false);
  let errorMessage = $state("");
  let lockoutSeconds = $state(0);

  let _timer: ReturnType<typeof setInterval> | null = null;

  function startLockout(seconds: number) {
    if (_timer) clearInterval(_timer);
    lockoutSeconds = seconds;
    _timer = setInterval(() => {
      lockoutSeconds--;
      if (lockoutSeconds <= 0) {
        clearInterval(_timer!);
        _timer = null;
      }
    }, 1000);
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    errorMessage = "";

    const parsed = schema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      errorMessage = parsed.error.issues[0].message;
      return;
    }

    isLoading = true;
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
        body: JSON.stringify(parsed.data),
      });

      if (res.status === 429) {
        const raw = Number(res.headers.get("Retry-After") ?? 30);
        startLockout(Number.isFinite(raw) && raw > 0 ? raw : 30);
        errorMessage = "Demasiados intentos. Intenta de nuevo en un momento.";
        return;
      }

      if (!res.ok) {
        errorMessage = "Credenciales incorrectas";
        return;
      }

      window.location.href = "/admin";
    } catch (err) {
      errorMessage =
        err instanceof DOMException && err.name === "TimeoutError"
          ? "La solicitud tardó demasiado. Intenta nuevamente."
          : "No se pudo conectar. Verifica tu conexión.";
    } finally {
      isLoading = false;
    }
  }

  return {
    get email() {
      return email;
    },
    set email(v: string) {
      email = v;
    },
    get password() {
      return password;
    },
    set password(v: string) {
      password = v;
    },
    get isLoading() {
      return isLoading;
    },
    get errorMessage() {
      return errorMessage;
    },
    get lockoutSeconds() {
      return lockoutSeconds;
    },
    get isLocked() {
      return lockoutSeconds > 0;
    },
    handleSubmit,
  };
}
