<script lang="ts">
  import { animate, stagger } from "motion";
  import { onMount, tick } from "svelte";
  import { useTheme } from "../lib/useTheme.svelte";
  import { useLoginForm } from "../lib/useLoginForm.svelte";
  import ThemeToggle from "@shared/components/ThemeToggle.svelte";
  import "../../../styles/login.css";

  const { theme: _theme } = useTheme(); // keeps theme subscription alive
  const form = useLoginForm();

  let showPassword = $state(false);
  let cardRef = $state<HTMLElement | null>(null);
  let formPanelRef = $state<HTMLElement | null>(null);
  let albertoRef = $state<HTMLElement | null>(null);
  let yuyuRef = $state<HTMLElement | null>(null);
  let noticeRef = $state<HTMLElement | null>(null);
  let btnRef = $state<HTMLElement | null>(null);
  let visualPanelRef = $state<HTMLElement | null>(null);
  let isVisualSwapped = $state(false);
  let albertoBellActive = $state(false);
  let yuyuEngineActive = $state(false);

  let albertoFloatAnim: ReturnType<typeof animate> | null = null;
  let yuyuFloatAnim: ReturnType<typeof animate> | null = null;
  let charsVisible = false;

  let albertoBellTimer: number | undefined;
  let yuyuEngineTimer: number | undefined;

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function startFloats() {
    if (prefersReducedMotion()) return;
    albertoFloatAnim?.cancel();
    yuyuFloatAnim?.cancel();
    if (albertoRef) {
      albertoFloatAnim = animate(
        albertoRef,
        // @ts-ignore — motion shorthand y accepted at runtime
        { y: ["0px", "-8px", "0px"] },
        { duration: 4.8, ease: [0.45, 0, 0.55, 1], repeat: Infinity },
      );
    }
    if (yuyuRef) {
      yuyuFloatAnim = animate(
        yuyuRef,
        // @ts-ignore
        { y: ["0px", "-12px", "0px"] },
        { duration: 3.6, ease: [0.45, 0, 0.55, 1], repeat: Infinity },
      );
    }
  }

  function playEntranceAnimations() {
    if (prefersReducedMotion()) {
      if (albertoRef) albertoRef.style.opacity = "1";
      if (yuyuRef) yuyuRef.style.opacity = "1";
      charsVisible = true;
      startFloats();
      return;
    }
    if (cardRef) {
      void animate(
        cardRef,
        { opacity: [0, 1] },
        { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
      );
      // @ts-ignore
      void animate(
        cardRef,
        { y: [28, 0], scale: [0.96, 1] },
        { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
      );
    }
    if (formPanelRef) {
      const fields = formPanelRef.querySelectorAll(".anim-field");
      // @ts-ignore — NodeList + mixed shorthand accepted at runtime
      void animate(
        fields,
        { opacity: [0, 1], y: [14, 0] },
        {
          duration: 0.4,
          ease: [0.22, 1, 0.36, 1],
          delay: stagger(0.08, { startDelay: 0.22 }),
        },
      );
    }
    // Capture both entrance animations. Wait for both before starting floats so that
    // motion's residual x / rotate / scale values are cleared from the transform,
    // preventing the float-loop from compositing on top of them (the "double" glitch).
    // @ts-ignore
    const yuyuEntrance = yuyuRef
      ? animate(
          yuyuRef,
          { opacity: [0, 1], x: [42, 0], y: [-24, 0], rotate: [6, 0] },
          {
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
            delay: 0.15,
          },
        )
      : null;
    // @ts-ignore
    const albertoEntrance = albertoRef
      ? animate(
          albertoRef,
          { opacity: [0, 1], x: [22, 0], y: [34, 0] },
          {
            duration: 0.75,
            ease: [0.22, 1, 0.36, 1],
            delay: 0.28,
          },
        )
      : null;
    void Promise.all([
      yuyuEntrance?.finished ?? Promise.resolve(),
      albertoEntrance?.finished ?? Promise.resolve(),
    ]).then(() => {
      if (yuyuRef) {
        yuyuRef.style.transform = "";
        yuyuRef.style.opacity = "1";
      }
      if (albertoRef) {
        albertoRef.style.transform = "";
        albertoRef.style.opacity = "1";
      }
      charsVisible = true;
      startFloats();
    });
  }

  async function playThemeTransition() {
    if (prefersReducedMotion() || !charsVisible) return;
    albertoFloatAnim?.cancel();
    yuyuFloatAnim?.cancel();
    const dur = 0.32;
    const ease = [0.4, 0, 1, 1] as const;
    await Promise.all([
      yuyuRef
        ? // @ts-ignore
          animate(
            yuyuRef,
            { opacity: [1, 0], x: [0, 50], y: [0, -34], rotate: [0, 8] },
            { duration: dur, ease },
          ).finished
        : Promise.resolve(),
      albertoRef
        ? // @ts-ignore
          animate(
            albertoRef,
            { opacity: [1, 0], x: [0, 36], y: [0, 44] },
            { duration: dur, ease },
          ).finished
        : Promise.resolve(),
    ]);
    if (visualPanelRef) {
      void animate(
        visualPanelRef,
        { opacity: [1, 0.88, 1] },
        { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
      );
    }
    isVisualSwapped = !isVisualSwapped;
    await tick();
    await new Promise((r) => window.setTimeout(r, 80));
    const inEase = [0.22, 1, 0.36, 1] as const;
    // @ts-ignore
    const yuyuIn = animate(
      yuyuRef!,
      {
        opacity: [0, 1],
        x: [isVisualSwapped ? -40 : 40, 0],
        y: [-24, 0],
        rotate: [isVisualSwapped ? -6 : 6, 0],
      },
      { duration: 0.55, ease: inEase },
    );
    // @ts-ignore
    const albertoIn = animate(
      albertoRef!,
      { opacity: [0, 1], x: [isVisualSwapped ? -22 : 22, 0], y: [36, 0] },
      {
        duration: 0.6,
        ease: inEase,
        delay: 0.05,
      },
    );
    void Promise.all([yuyuIn.finished, albertoIn.finished]).then(() => {
      if (yuyuRef) {
        yuyuRef.style.transform = "";
        yuyuRef.style.opacity = "1";
      }
      if (albertoRef) {
        albertoRef.style.transform = "";
        albertoRef.style.opacity = "1";
      }
      startFloats();
    });
  }

  async function animateNotice() {
    await tick();
    if (!noticeRef || prefersReducedMotion()) {
      if (noticeRef) noticeRef.style.opacity = "1";
      return;
    }
    void animate(
      noticeRef,
      { opacity: [0, 1] },
      { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
    );
    // @ts-ignore
    void animate(
      noticeRef,
      { y: [-8, 0], scale: [0.97, 1] },
      { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
    );
    noticeRef.focus();
  }

  function shakeButton() {
    if (!btnRef || prefersReducedMotion()) return;
    btnRef.animate(
      [
        { transform: "translateX(-5px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(-2px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 450, easing: "ease-in-out" },
    );
  }

  function triggerAlbertoBell() {
    albertoBellActive = false;
    window.clearTimeout(albertoBellTimer);
    window.requestAnimationFrame(() => {
      albertoBellActive = true;
      albertoBellTimer = window.setTimeout(() => {
        albertoBellActive = false;
      }, 700);
    });
  }

  function triggerYuyuEngine() {
    yuyuEngineActive = false;
    window.clearTimeout(yuyuEngineTimer);
    window.requestAnimationFrame(() => {
      yuyuEngineActive = true;
      yuyuEngineTimer = window.setTimeout(() => {
        yuyuEngineActive = false;
      }, 420);
    });
  }

  function handleCharacterKey(event: KeyboardEvent, action: () => void) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    action();
  }

  $effect(() => {
    if (form.errorMessage) {
      void animateNotice();
      shakeButton();
    }
  });

  onMount(() => {
    window.addEventListener("themechange", () => void playThemeTransition());
    playEntranceAnimations();
    return () => {
      albertoFloatAnim?.cancel();
      yuyuFloatAnim?.cancel();
      window.clearTimeout(albertoBellTimer);
      window.clearTimeout(yuyuEngineTimer);
    };
  });
</script>

<div class="login-shell" bind:this={cardRef} style="opacity:0">
  <div
    class="login-card grid md:grid-cols-[1.08fr_1fr] rounded-3xl overflow-hidden relative"
  >
    <!-- ── Form side ─────────────────────────────────── -->
    <div
      class="login-form-side p-8 sm:p-10 relative z-10"
      bind:this={formPanelRef}
    >
      <div class="anim-field flex items-start justify-between gap-3 mb-8">
        <div>
          <span class="login-kicker">Admin Panel</span>
          <h1 class="login-title">Iniciar Sesión</h1>
        </div>
        <div class="login-theme-toggle">
          <ThemeToggle />
        </div>
      </div>

      <form class="space-y-5" onsubmit={form.handleSubmit} novalidate>
        <!-- Email -->
        <div class="anim-field login-field-wrap">
          <label class="login-field-label" for="admin-login-email"
            >Correo electrónico</label
          >
          <div class="login-input-wrap">
            <svg
              class="login-field-icon"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"
              />
              <path
                d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"
              />
            </svg>
            <input
              id="admin-login-email"
              class="login-field-input"
              type="email"
              bind:value={form.email}
              placeholder="Correo o usuario"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              required
            />
          </div>
        </div>

        <!-- Password -->
        <div class="anim-field login-field-wrap">
          <label class="login-field-label" for="admin-login-password"
            >Contraseña</label
          >
          <div class="login-input-wrap">
            <svg
              class="login-field-icon"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clip-rule="evenodd"
              />
            </svg>
            <input
              id="admin-login-password"
              class="login-field-input"
              type={showPassword ? "text" : "password"}
              bind:value={form.password}
              placeholder="********"
              minlength="8"
              autocomplete="current-password"
              required
            />
            <button
              type="button"
              class="login-eye-btn"
              aria-label={showPassword
                ? "Ocultar contraseña"
                : "Mostrar contraseña"}
              onclick={() => (showPassword = !showPassword)}
            >
              {#if showPassword}
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                    clip-rule="evenodd"
                  />
                  <path
                    d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"
                  />
                </svg>
              {:else}
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path
                    fill-rule="evenodd"
                    d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              {/if}
            </button>
          </div>
        </div>

        <!-- Error / lockout notice -->
        {#if form.errorMessage}
          <div
            class="login-notice login-notice--error"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            tabindex="-1"
            bind:this={noticeRef}
            style="opacity:0"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              class="login-notice-icon"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            <span>{form.errorMessage}</span>
            {#if form.isLocked}
              <span class="ml-auto font-mono tabular-nums text-xs"
                >{form.lockoutSeconds}s</span
              >
            {/if}
          </div>
        {/if}

        <!-- Submit -->
        <div class="anim-field">
          <button
            bind:this={btnRef}
            class="login-submit-btn"
            type="submit"
            disabled={form.isLoading || form.isLocked}
          >
            {#if form.isLocked}
              Bloqueado ({form.lockoutSeconds}s)
            {:else if form.isLoading}
              <span class="loading loading-spinner loading-sm"></span>
              Validando…
            {:else}
              Iniciar sesión
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                class="w-4 h-4 btn-arrow"
              >
                <path
                  fill-rule="evenodd"
                  d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            {/if}
          </button>
        </div>
      </form>
    </div>

    <!-- ── Visual side ────────────────────────────────── -->
    <div
      class="login-visual-panel hidden md:flex"
      role="group"
      aria-label="Ilustraciones"
      bind:this={visualPanelRef}
    >
      <div class="login-sunburst"></div>
      <div class="login-vignette"></div>
      <div class="login-separator"></div>

      <div class="login-stage-line" aria-hidden="true">
        <svg viewBox="0 0 460 20" preserveAspectRatio="none" fill="none">
          <path
            d="M0 18 Q230 2 460 18"
            stroke="rgb(255 255 255 / 0.18)"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </div>

      <!-- Yuyu — scooter -->
      <div
        class="login-char login-char--yuyu login-char-clickable"
        class:swapped={isVisualSwapped}
        class:rev-active={yuyuEngineActive}
        bind:this={yuyuRef}
        style="opacity:0"
        role="button"
        tabindex="0"
        aria-label="Ilustración de moto"
        onclick={triggerYuyuEngine}
        onkeydown={(e) => handleCharacterKey(e, triggerYuyuEngine)}
      >
        <img
          src="/images/whiteYuyu.png"
          alt=""
          width="768"
          height="768"
          loading="eager"
          decoding="async"
        />
        <span class="puff puff-1" aria-hidden="true"></span>
        <span class="puff puff-2" aria-hidden="true"></span>
        <span class="puff puff-3" aria-hidden="true"></span>
      </div>

      <!-- Alberto — ice-cream cart -->
      <div
        class="login-char login-char--alberto login-char-clickable"
        class:swapped={isVisualSwapped}
        class:bell-active={albertoBellActive}
        bind:this={albertoRef}
        style="opacity:0"
        role="button"
        tabindex="0"
        aria-label="Ilustración de carrito de helados"
        onclick={triggerAlbertoBell}
        onkeydown={(e) => handleCharacterKey(e, triggerAlbertoBell)}
      >
        <img
          src="/images/blackAlberto.png"
          alt=""
          width="768"
          height="768"
          loading="eager"
          decoding="async"
        />
        <span class="bell-ring bell-ring-1" aria-hidden="true"></span>
        <span class="bell-ring bell-ring-2" aria-hidden="true"></span>
      </div>
    </div>
  </div>
</div>
