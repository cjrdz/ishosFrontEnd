<script lang="ts">
  import { onMount } from "svelte";
  import { setCachedSession } from "../lib/session";
  import ThemeToggle from "@shared/components/ThemeToggle.svelte";
  import {
    COLOR_THEME,
    DARK_THEME,
    type ThemeMode,
  } from "@shared/theme/constants";

  let email = $state("");
  let password = $state("");
  let isLoading = $state(false);
  let errorMessage = $state("");
  let theme = $state<ThemeMode>(COLOR_THEME);

  function syncTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    theme = (current === DARK_THEME ? DARK_THEME : COLOR_THEME) as ThemeMode;
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
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const result = (await response.json()) as {
        token: string;
        employee: {
          id: string;
          email: string;
          name: string;
          phone: string;
          role: "admin" | "manager" | "staff";
          active: boolean;
        };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "No se pudo iniciar sesion");
      }

      setCachedSession(result.employee);
      window.location.href = "/admin";
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "No se pudo iniciar sesión";
    } finally {
      isLoading = false;
    }
  }
</script>

<div
  class="w-full max-w-md mx-auto bg-base-100/60 backdrop-blur-xl border border-base-200 shadow-2xl rounded-[2.5rem] overflow-hidden relative"
>
  <!-- Subtle decorative gradients in background -->
  <div
    class="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none"
  ></div>
  <div
    class="absolute -bottom-24 -right-24 w-48 h-48 bg-secondary/10 rounded-full blur-3xl pointer-events-none"
  ></div>

  <div class="p-8 sm:p-10 relative z-10 w-full flex flex-col items-center">
    <!-- Header Controls -->
    <div class="w-full flex justify-end mb-2 absolute right-6 top-6">
      <div
        class="bg-base-200/50 rounded-full p-1 shadow-sm border border-base-200/30"
      >
        <ThemeToggle />
      </div>
    </div>

    <!-- Logo -->
    <div class="flex justify-center mb-6 mt-4">
      <div
        class="p-4 bg-base-100 rounded-3xl shadow-sm border border-base-200/50"
      >
        {#if theme === DARK_THEME}
          <img
            src="/images/whiteicon.png"
            alt="Isho's"
            width="64"
            height="64"
            class="object-contain"
          />
        {:else}
          <img
            src="/images/blackicon.png"
            alt="Isho's"
            width="64"
            height="64"
            class="object-contain"
          />
        {/if}
      </div>
    </div>

    <!-- Typography -->
    <div class="text-center w-full mb-8 space-y-2">
      <h1 class="text-3xl font-extrabold tracking-tight">
        Panel <span
          class="bg-clip-text text-transparent bg-linear-to-r from-primary to-secondary"
          >IshosFactory</span
        >
      </h1>
      <p class="text-base-content/70 font-medium text-sm">
        Ingresa con tus credenciales administrativas
      </p>
    </div>

    <form class="space-y-5 w-full mt-2" onsubmit={handleSubmit}>
      <label class="form-control w-full">
        <span
          id="admin-login-email-label"
          class="label-text font-bold text-base-content/70 ml-1 mb-1"
          >Correo</span
        >
        <input
          id="admin-login-email"
          class="input input-bordered h-12 bg-base-100 focus:bg-base-200 w-full rounded-2xl transition-all"
          type="email"
          bind:value={email}
          placeholder="Email o usuario"
          required
          aria-labelledby="admin-login-email-label"
        />
      </label>

      <label class="form-control w-full">
        <span
          id="admin-login-password-label"
          class="label-text font-bold text-base-content/70 ml-1 mb-1"
          >Contraseña</span
        >
        <input
          id="admin-login-password"
          class="input input-bordered h-12 bg-base-100 focus:bg-base-200 w-full rounded-2xl transition-all"
          type="password"
          bind:value={password}
          placeholder="••••••••"
          required
          aria-labelledby="admin-login-password-label"
        />
      </label>

      {#if errorMessage}
        <div
          class="alert alert-error shadow-sm rounded-2xl border-error/20 text-sm font-medium p-3"
        >
          <span class="text-lg leading-none">⚠️</span>
          <span>{errorMessage}</span>
        </div>
      {/if}

      <div class="pt-2">
        <button
          class="btn btn-primary btn-lg w-full rounded-2xl shadow-lg hover:shadow-xl transition-all font-extrabold text-lg border-2"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? "Validando credenciales..." : "Iniciar sesión"}
        </button>
      </div>
    </form>
  </div>
</div>
