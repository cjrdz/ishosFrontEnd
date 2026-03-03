<script lang="ts">
  import { onMount } from "svelte";
  import { login } from "../../lib/api/auth";
  import { setToken } from "../../lib/auth/session";
  import ThemeToggle from "./shared/ThemeToggle.svelte";

  let email = $state("");
  let password = $state("");
  let isLoading = $state(false);
  let errorMessage = $state("");
  let theme = $state<"valentine" | "night">("valentine");

  function syncTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    theme = current === "night" ? "night" : "valentine";
  }

  onMount(() => {
    syncTheme();
    window.addEventListener("themechange", syncTheme);
    return () => {
      window.removeEventListener("themechange", syncTheme);
    };
  });

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = "";
    isLoading = true;

    try {
      const result = await login(email.trim(), password);
      setToken(result.token);
      window.location.href = "/admin";
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "No se pudo iniciar sesión";
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="card w-full max-w-md bg-base-100 shadow-xl">
  <div class="card-body">
    <div class="flex justify-end">
      <ThemeToggle />
    </div>
    <div class="flex justify-center -mt-2 mb-2">
      {#if theme === "night"}
        <img src="/images/whiteicon.png" alt="Isho's" width="86" height="86" />
      {:else}
        <img src="/images/blackicon.png" alt="Isho's" width="86" height="86" />
      {/if}
    </div>
    <h1 class="card-title text-2xl">Panel IshosFactory</h1>
    <p class="text-base-content/70">Ingresa con una cuenta de empleado o admin.</p>

    <form class="space-y-4 mt-4" onsubmit={handleSubmit}>
      <div class="form-control w-full">
        <span id="admin-login-email-label" class="label-text mb-2">Correo</span>
        <input
          id="admin-login-email"
          class="input input-bordered w-full"
          type="email"
          bind:value={email}
          placeholder="admin@ishos.com"
          required
          aria-labelledby="admin-login-email-label"
        />
      </div>

      <div class="form-control w-full">
        <span id="admin-login-password-label" class="label-text mb-2">Contraseña</span>
        <input
          id="admin-login-password"
          class="input input-bordered w-full"
          type="password"
          bind:value={password}
          placeholder="••••••••"
          required
          aria-labelledby="admin-login-password-label"
        />
      </div>

      {#if errorMessage}
        <div class="alert alert-error">
          <span>{errorMessage}</span>
        </div>
      {/if}

      <button class="btn btn-primary w-full" type="submit" disabled={isLoading}>
        {isLoading ? "Ingresando..." : "Iniciar sesión"}
      </button>
    </form>
  </div>
</div>
