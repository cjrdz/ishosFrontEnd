<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import ThemeToggle from "@shared/components/ThemeToggle.svelte";
  import {
    getAdminPanelConfig,
    getAdminStoreSettings,
    getAdminTabsSettings,
    updateAdminPanelConfig,
    updateAdminStoreSettings,
    updateAdminTabsSettings,
    type PanelConfigValues,
    DEFAULT_TAB_ORDER,
    normalizeTabOrder,
    type TabKey,
  } from "@features/admin-management";
  import SettingsTab from "../../admin-management/components/SettingsTab.svelte";
  import type { StoreOfferItem } from "@features/catalog";
  import { ApiError } from "@core/errors";

  type Session = {
    id: string;
    email: string;
    name: string;
    phone: string;
    role: "admin" | "employee";
    active?: boolean;
  };

  function trackAction(action: string, metadata?: Record<string, unknown>) {
    if (import.meta.env.DEV) {
      console.debug("[analytics]", action, metadata ?? {});
    }
  }

  function trackError(
    error: unknown,
    context: string,
    metadata?: Record<string, unknown>,
  ) {
    if (import.meta.env.DEV) {
      const normalized =
        error instanceof Error
          ? { message: error.message }
          : { message: String(error) };
      console.error("[analytics]", context, {
        ...normalized,
        ...(metadata ?? {}),
      });
    }
  }

  // IMPORTANT: Keep this in sync with backend defaults (see TokenTTLConfig in Go backend)
  const DEFAULT_PANEL_CONFIG: PanelConfigValues = {
    auth_cookie_ttl_hours: 24,
    auth_token_ttl_hours: 168,
    tracking_token_ttl_hours: 720,
    inactivity_logout_seconds: 900,
  };

  const SEARCH_ITEMS = [
    {
      id: "navegacion-panel",
      title: "Navegacion del panel",
      description: "Orden global de pestanas del equipo",
      icon: "lucide:panel-top",
      keywords: ["pestanas", "tabs", "orden", "navegacion", "global"],
    },
    {
      id: "seguridad-panel",
      title: "Seguridad y sesiones",
      description: "Cookies, tokens y timeout de inactividad",
      icon: "lucide:shield-check",
      keywords: [
        "sesion",
        "cookie",
        "token",
        "inactividad",
        "seguridad",
        "logout",
        "expiracion",
      ],
    },
    {
      id: "proximas-personalizaciones",
      title: "Proximas personalizaciones",
      description: "Branding, widgets y atajos futuros",
      icon: "lucide:sparkles",
      keywords: ["branding", "widgets", "atajos", "personalizar", "proximo"],
    },
    {
      id: "operacion-tienda",
      title: "Operacion de tienda",
      description: "Pausar o reactivar pedidos publicos",
      icon: "lucide:store",
      keywords: [
        "ofertas",
        "tienda",
        "pedidos",
        "pausar",
        "activar",
        "kill switch",
      ],
    },
  ] as const;

  let loading = $state(true);
  let busy = $state(false);
  let sessionError = $state("");
  let moduleError = $state("");
  let notice = $state("");
  let session = $state<Session | null>(null);
  let tabOrder = $state<TabKey[]>([...DEFAULT_TAB_ORDER]);
  let panelConfig = $state<PanelConfigValues>({ ...DEFAULT_PANEL_CONFIG });
  let storeOrdersEnabled = $state(true);
  let storeOffers = $state<StoreOfferItem[]>([]);

  // Search palette
  let searchQuery = $state("");
  let selectedIndex = $state(0);
  let searchDialog = $state<HTMLDialogElement | null>(null);
  let searchInput = $state<HTMLInputElement | null>(null);

  const filteredItems = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [...SEARCH_ITEMS];
    return SEARCH_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.includes(q)),
    );
  });

  $effect(() => {
    if (searchQuery) selectedIndex = 0;
  });

  onMount(() => {
    void loadPage();

    function handleGlobalKeydown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        openSearch();
      }
    }

    document.addEventListener("keydown", handleGlobalKeydown);
    return () => document.removeEventListener("keydown", handleGlobalKeydown);
  });

  function openSearch() {
    searchQuery = "";
    selectedIndex = 0;
    searchDialog?.showModal();
    requestAnimationFrame(() => searchInput?.focus());
  }

  function closeSearch() {
    searchDialog?.close();
  }

  function navigateTo(id: string) {
    closeSearch();
    requestAnimationFrame(() => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filteredItems.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filteredItems[selectedIndex];
      if (item) navigateTo(item.id);
    }
  }

  function setNotice(message: string) {
    notice = message;
    setTimeout(() => {
      if (notice === message) {
        notice = "";
      }
    }, 3000);
  }

  // Note: This client-side session validation is for UX only.
  // Real security is enforced by server-side middleware.
  async function loadPage() {
    loading = true;
    sessionError = "";
    moduleError = "";

    try {
      const response = await fetch("/api/admin/session", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Sesion invalida");
      }

      const currentSession = payload as Session;
      if (currentSession.role !== "admin") {
        throw new Error(
          "Solo administradores pueden acceder a esta configuracion",
        );
      }

      session = currentSession;
      trackAction("admin_settings_session_loaded", {
        role: currentSession.role,
      });
      await loadSettings();
    } catch (requestError) {
      trackError(requestError, "AdminSettingsPage.loadPage");
      sessionError =
        requestError instanceof Error
          ? requestError.message
          : "Sesion invalida";
    } finally {
      loading = false;
    }
  }

  async function loadSettings() {
    busy = true;
    moduleError = "";

    const [tabsResult, panelConfigResult, storeSettingsResult] =
      await Promise.allSettled([
        getAdminTabsSettings(),
        getAdminPanelConfig(),
        getAdminStoreSettings(),
      ]);

    let tabsError = "";
    let panelConfigError = "";
    let storeSettingsError = "";

    if (tabsResult.status === "fulfilled") {
      tabOrder = normalizeTabOrder(tabsResult.value.tab_order);
    } else {
      trackError(tabsResult.reason, "AdminSettingsPage.loadSettings.tabs");
      tabsError =
        tabsResult.reason instanceof Error
          ? tabsResult.reason.message
          : "No se pudo cargar la configuracion de pestanas";
      tabOrder = [...DEFAULT_TAB_ORDER];
    }

    if (panelConfigResult.status === "fulfilled") {
      panelConfig = {
        auth_cookie_ttl_hours: panelConfigResult.value.auth_cookie_ttl_hours,
        auth_token_ttl_hours: panelConfigResult.value.auth_token_ttl_hours,
        tracking_token_ttl_hours:
          panelConfigResult.value.tracking_token_ttl_hours,
        inactivity_logout_seconds:
          panelConfigResult.value.inactivity_logout_seconds ?? 900,
      };
    } else {
      trackError(
        panelConfigResult.reason,
        "AdminSettingsPage.loadSettings.panelConfig",
      );
      panelConfigError =
        panelConfigResult.reason instanceof Error
          ? panelConfigResult.reason.message
          : "No se pudo cargar la configuracion de seguridad";
      panelConfig = { ...DEFAULT_PANEL_CONFIG };
    }

    if (storeSettingsResult.status === "fulfilled") {
      storeOrdersEnabled = storeSettingsResult.value.orders_enabled;
      storeOffers = storeSettingsResult.value.offers ?? [];
    } else {
      trackError(
        storeSettingsResult.reason,
        "AdminSettingsPage.loadSettings.storeSettings",
      );
      storeSettingsError =
        storeSettingsResult.reason instanceof ApiError &&
        storeSettingsResult.reason.status === 404
          ? "No se pudo conectar con la configuracion de tienda. Verifica que el backend este actualizado."
          : storeSettingsResult.reason instanceof Error
            ? storeSettingsResult.reason.message
            : "No se pudo cargar la operacion de tienda";
      storeOrdersEnabled = true;
      storeOffers = [];
    }

    // Combine errors for display
    moduleError = [tabsError, panelConfigError, storeSettingsError]
      .filter(Boolean)
      .join(" | ");
    busy = false;
  }

  async function handleSaveTabOrder(nextTabOrder: string[]) {
    busy = true;
    moduleError = "";
    try {
      const response = await updateAdminTabsSettings(nextTabOrder as TabKey[]);
      tabOrder = normalizeTabOrder(response.tab_order);
      setNotice("Orden del panel actualizada");
      trackAction("admin_settings_tab_order_saved", {
        tabCount: nextTabOrder.length,
      });
    } catch (requestError) {
      trackError(requestError, "AdminSettingsPage.handleSaveTabOrder", {
        tabCount: nextTabOrder.length,
      });
      moduleError =
        requestError instanceof Error
          ? requestError.message
          : "No se pudo guardar el orden global";
    } finally {
      busy = false;
    }
  }

  async function handleSavePanelConfig(nextPanelConfig: PanelConfigValues) {
    busy = true;
    moduleError = "";
    try {
      const response = await updateAdminPanelConfig(nextPanelConfig);
      panelConfig = {
        auth_cookie_ttl_hours: response.auth_cookie_ttl_hours,
        auth_token_ttl_hours: response.auth_token_ttl_hours,
        tracking_token_ttl_hours: response.tracking_token_ttl_hours,
        inactivity_logout_seconds: response.inactivity_logout_seconds ?? 900,
      };
      setNotice("Configuracion de seguridad actualizada");
      trackAction(
        "admin_settings_panel_config_saved",
        nextPanelConfig as unknown as Record<string, unknown>,
      );
    } catch (requestError) {
      trackError(
        requestError,
        "AdminSettingsPage.handleSavePanelConfig",
        nextPanelConfig as unknown as Record<string, unknown>,
      );
      moduleError =
        requestError instanceof Error
          ? requestError.message
          : "No se pudo guardar la configuracion de seguridad";
    } finally {
      busy = false;
    }
  }

  async function handleToggleStoreOrders(enabled: boolean) {
    busy = true;
    moduleError = "";

    try {
      const response = await updateAdminStoreSettings({
        orders_enabled: enabled,
        offers: storeOffers,
      });
      storeOrdersEnabled = response.orders_enabled;
      storeOffers = response.offers ?? [];
      setNotice(
        enabled ? "Pedidos publicos activados" : "Pedidos publicos pausados",
      );
      trackAction("admin_settings_store_orders_toggled", { enabled });
    } catch (requestError) {
      trackError(requestError, "AdminSettingsPage.handleToggleStoreOrders", {
        enabled,
      });
      moduleError =
        requestError instanceof Error
          ? requestError.message
          : "No se pudo actualizar la operacion de tienda";
    } finally {
      busy = false;
    }
  }

  async function handleLogout() {
    let logoutFailed = false;
    try {
      const res = await fetch("/api/admin/logout", { method: "POST" });
      if (!res.ok) logoutFailed = true;
    } catch {
      logoutFailed = true;
    }
    if (logoutFailed) {
      setNotice("No se pudo cerrar sesión correctamente. Intenta de nuevo.");
      return;
    }
    window.location.href = "/admin/login";
  }
</script>

{#if loading}
  <div class="flex min-h-[45vh] w-full items-center justify-center">
    <div
      class="flex items-center gap-3 rounded-2xl border border-base-300 bg-base-100 px-6 py-5 shadow-sm"
    >
      <span class="loading loading-spinner loading-md"></span>
      <span>Cargando configuraciones...</span>
    </div>
  </div>
{:else if sessionError}
  <div class="space-y-4">
    <div class="alert alert-warning shadow-sm">
      <Icon icon="lucide:shield-alert" class="h-5 w-5" />
      <div>
        <p class="font-semibold">No fue posible abrir configuraciones</p>
        <p class="text-sm">{sessionError}</p>
      </div>
    </div>
    <div class="flex flex-wrap gap-3">
      <a href="/admin" class="btn btn-primary">Volver al panel</a>
      <a href="/admin/login" class="btn btn-outline">Ir al login</a>
    </div>
  </div>
{:else if session}
  <div class="space-y-6">
    <!-- Header — same layout as AdminHeader -->
    <div
      class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h1 class="text-3xl font-bold">Configuraciones</h1>
        <div
          class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-base-content/70"
        >
          <p class="flex items-center gap-2">
            <span>Administrador, <strong>{session.name}</strong></span>
            <Icon icon="lucide:settings-2" class="h-4 w-4" />
          </p>
          <a
            href="/admin"
            class="flex items-center gap-1.5 transition hover:text-base-content"
          >
            <Icon icon="lucide:arrow-left" class="h-3.5 w-3.5" />
            <span>Panel administrativo</span>
          </a>
        </div>
      </div>
      <div class="flex items-center gap-2 self-end sm:self-auto">
        <ThemeToggle />
        <button
          type="button"
          class="btn btn-ghost gap-2"
          onclick={openSearch}
          title="Buscar ajuste (Ctrl+K)"
        >
          <Icon icon="lucide:search" class="h-4 w-4" />
          <span class="hidden text-sm text-base-content/50 sm:inline"
            >Buscar ajuste...</span
          >
          <kbd class="kbd kbd-sm hidden sm:inline">Ctrl K</kbd>
        </button>
        <button class="btn btn-outline" type="button" onclick={handleLogout}
          >Cerrar sesion</button
        >
      </div>
    </div>

    {#if notice}
      <div role="alert" class="alert alert-success shadow-sm">
        <span>{notice}</span>
      </div>
    {/if}

    <!-- Settings forms -->
    <div class="space-y-6">
      <SettingsTab
        {tabOrder}
        {panelConfig}
        {storeOrdersEnabled}
        {busy}
        {moduleError}
        onSave={handleSaveTabOrder}
        onSavePanelConfig={handleSavePanelConfig}
        onToggleStoreOrders={handleToggleStoreOrders}
      />

      <section id="proximas-personalizaciones" class="card bg-base-100 shadow">
        <div class="card-body space-y-4">
          <div>
            <h2 class="card-title">Proximas personalizaciones</h2>
            <p class="text-sm text-base-content/70">
              Esta pagina queda preparada para crecer nuevas opciones sin tocar
              la operacion diaria.
            </p>
          </div>
          <div class="grid gap-4 md:grid-cols-3">
            <article class="rounded-2xl border border-base-300 bg-base-50 p-5">
              <div class="flex items-center gap-3">
                <span class="rounded-xl bg-info/10 p-2 text-info">
                  <Icon icon="lucide:palette" class="h-5 w-5" />
                </span>
                <h3 class="font-semibold">Branding del panel</h3>
              </div>
              <p class="mt-3 text-sm text-base-content/70">
                Logo, colores y nombre visible para el equipo.
              </p>
            </article>
            <article class="rounded-2xl border border-base-300 bg-base-50 p-5">
              <div class="flex items-center gap-3">
                <span class="rounded-xl bg-success/10 p-2 text-success">
                  <Icon icon="lucide:layout-dashboard" class="h-5 w-5" />
                </span>
                <h3 class="font-semibold">Widgets de inicio</h3>
              </div>
              <p class="mt-3 text-sm text-base-content/70">
                Define que resumenes aparecen primero al entrar al panel.
              </p>
            </article>
            <article class="rounded-2xl border border-base-300 bg-base-50 p-5">
              <div class="flex items-center gap-3">
                <span class="rounded-xl bg-warning/10 p-2 text-warning">
                  <Icon icon="lucide:rocket" class="h-5 w-5" />
                </span>
                <h3 class="font-semibold">Atajos de operacion</h3>
              </div>
              <p class="mt-3 text-sm text-base-content/70">
                Accesos rapidos para procesos frecuentes del equipo.
              </p>
            </article>
          </div>
        </div>
      </section>
    </div>
  </div>

  <!-- Ctrl+K search palette -->
  <dialog
    bind:this={searchDialog}
    class="modal"
    onclose={() => {
      searchQuery = "";
    }}
  >
    <div class="modal-box max-w-lg overflow-hidden rounded-2xl p-0">
      <!-- Input row -->
      <div class="flex items-center gap-3 border-b border-base-300 px-4 py-3">
        <Icon
          icon="lucide:search"
          class="h-5 w-5 shrink-0 text-base-content/40"
        />
        <input
          bind:this={searchInput}
          bind:value={searchQuery}
          onkeydown={handleSearchKeydown}
          type="text"
          placeholder="Buscar ajuste..."
          class="min-w-0 flex-1 bg-transparent text-base focus:outline-none"
          autocomplete="off"
          spellcheck="false"
        />
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          onclick={closeSearch}
        >
          <kbd class="kbd kbd-sm">Esc</kbd>
        </button>
      </div>

      <!-- Results -->
      <div class="max-h-64 overflow-y-auto">
        {#if filteredItems.length === 0}
          <p class="px-4 py-8 text-center text-sm text-base-content/50">
            Sin resultados para "{searchQuery}"
          </p>
        {:else}
          {#each filteredItems as item, i}
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-base-200 {i ===
              selectedIndex
                ? 'bg-base-200'
                : ''}"
              onclick={() => navigateTo(item.id)}
              onmouseenter={() => {
                selectedIndex = i;
              }}
            >
              <span class="rounded-xl bg-base-200 p-2">
                <Icon icon={item.icon} class="h-4 w-4 text-base-content/70" />
              </span>
              <span>
                <span class="block font-medium">{item.title}</span>
                <span class="block text-sm text-base-content/60"
                  >{item.description}</span
                >
              </span>
            </button>
          {/each}
        {/if}
      </div>

      <!-- Keyboard hints -->
      <div
        class="flex items-center gap-4 border-t border-base-300 px-4 py-2.5 text-xs text-base-content/40"
      >
        <span class="flex items-center gap-1">
          <kbd class="kbd kbd-xs">↑</kbd><kbd class="kbd kbd-xs">↓</kbd>
          <span class="ml-1">navegar</span>
        </span>
        <span class="flex items-center gap-1">
          <kbd class="kbd kbd-xs">↵</kbd>
          <span class="ml-1">ir a seccion</span>
        </span>
        <span class="flex items-center gap-1">
          <kbd class="kbd kbd-xs">Esc</kbd>
          <span class="ml-1">cerrar</span>
        </span>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
{/if}
