<script lang="ts">
  import { onMount } from "svelte";
  import ThemeToggle from "@shared/components/ThemeToggle.svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import LocationSwitcher from "@features/admin-management/components/LocationSwitcher.svelte";
  import {
    canSeeTab,
    TAB_ICONS,
    TAB_LABELS,
    type TabKey,
  } from "@features/admin-management/lib/tabs";

  interface Props {
    userName: string;
    role: string;
    /** The staff member's own location (null for admins). */
    locationName: string | null;
    activeTab: TabKey;
    isAdmin: boolean;
    tabOrder: TabKey[];
    onLogout: () => void;
    onTabChange: (tab: TabKey) => void;
    onOpenSettings: () => void;
    counterMode: boolean;
    /** Absent for admins: counter mode is a staff-only setting. */
    onToggleCounterMode?: () => void;
  }

  let {
    userName,
    role,
    locationName,
    activeTab,
    isAdmin,
    tabOrder,
    onLogout,
    onTabChange,
    onOpenSettings,
    counterMode,
    onToggleCounterMode,
  }: Props = $props();
  let currentHour = $state(new Date().getHours());

  const visibleTabs = $derived(tabOrder.filter((tab) => canSeeTab(role, tab)));

  const greetingMeta = $derived.by(() => {
    if (currentHour < 12) {
      return {
        text: "Buenos días",
        icon: "lucide:sun",
        iconClass: "text-yellow-500",
      };
    }
    if (currentHour < 19) {
      return {
        text: "Buenas tardes",
        icon: "lucide:sun",
        iconClass: "text-orange-500",
      };
    }
    return {
      text: "Buenas noches",
      icon: "lucide:moon",
      iconClass: "text-sky-500",
    };
  });

  onMount(() => {
    const id = setInterval(() => {
      currentHour = new Date().getHours();
    }, 60000);
    return () => clearInterval(id);
  });
</script>

<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h1
      class="font-display font-bold text-4xl sm:text-5xl leading-none text-base-content"
    >
      Panel administrativo
    </h1>
    <div
      class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-base-content/70"
    >
      <p class="flex items-center gap-2">
        <span>{greetingMeta.text}, <strong>{userName || "equipo"}</strong></span
        >
        <Icon
          icon={greetingMeta.icon}
          class={`h-4 w-4 ${greetingMeta.iconClass}`}
        />
      </p>
      <p class="flex items-center gap-2">
        <span class="inline-grid *:[grid-area:1/1]" aria-hidden="true">
          <span class="status status-success animate-ping"></span>
          <span class="status status-success"></span>
        </span>
        <span
          >Sesión activa{counterMode
            ? " · modo mostrador (sin cierre por inactividad)"
            : ""}</span
        >
      </p>
    </div>
  </div>
  <div
    class="flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto"
  >
    <LocationSwitcher {role} {locationName} />
    <ThemeToggle />
    {#if onToggleCounterMode}
      <button
        class={`btn btn-circle ${counterMode ? "btn-primary" : "btn-ghost"}`}
        type="button"
        aria-pressed={counterMode}
        aria-label="Modo mostrador: no cerrar sesión por inactividad en este dispositivo"
        title={counterMode
          ? "Modo mostrador activo en este dispositivo"
          : "Activar modo mostrador (tablet de órdenes)"}
        onclick={onToggleCounterMode}
      >
        <Icon icon="lucide:monitor-check" class="h-6 w-6" />
      </button>
    {/if}
    {#if isAdmin || role === "manager"}
      <button
        class="btn btn-ghost btn-circle"
        type="button"
        aria-label="Abrir configuración"
        title="Configuración del panel"
        onclick={onOpenSettings}
      >
        <Icon icon="lucide:settings-2" class="h-6 w-6" />
      </button>
    {/if}
    <button
      class="btn btn-outline max-sm:btn-circle"
      title="Cerrar sesión"
      aria-label="Cerrar sesión"
      onclick={onLogout}
    >
      <Icon icon="lucide:log-out" class="h-5 w-5" />
      <span class="hidden sm:inline">Cerrar sesión</span>
    </button>
  </div>
</div>

<div
  class="admin-top-tabs overflow-x-auto pb-1"
  class:admin-top-tabs--with-bottom-nav={visibleTabs.length > 1}
>
  <div
    role="tablist"
    class="tabs tabs-box bg-base-100 border border-base-200 shadow-sm p-1 w-max min-w-full sm:w-fit sm:min-w-0"
  >
    {#each visibleTabs as tab}
      <input
        type="radio"
        name="admin_tabs"
        class="tab tab-sm sm:tab-md whitespace-nowrap transition-colors"
        aria-label={TAB_LABELS[tab]}
        checked={activeTab === tab}
        onchange={() => onTabChange(tab)}
      />
    {/each}
  </div>
</div>

{#if visibleTabs.length > 1}
  <!-- Phones: tabs within thumb reach. Tablets and up keep the top tabs. -->
  <nav class="admin-bottom-nav" aria-label="Secciones del panel">
    {#each visibleTabs as tab (tab)}
      <button
        type="button"
        class="admin-bottom-nav__item"
        aria-current={activeTab === tab ? "page" : undefined}
        onclick={() => onTabChange(tab)}
      >
        <Icon icon={TAB_ICONS[tab]} class="size-5" aria-hidden="true" />
        <span>{TAB_LABELS[tab]}</span>
      </button>
    {/each}
  </nav>
{/if}

<style>
  .admin-bottom-nav {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 40;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    padding: 0.35rem 0.25rem calc(0.35rem + env(safe-area-inset-bottom));
    border-top: 1px solid var(--color-base-300);
    background: color-mix(in oklab, var(--color-base-100) 94%, transparent);
    backdrop-filter: blur(10px);
    box-shadow: 0 -6px 20px rgb(0 0 0 / 0.08);
  }

  .admin-bottom-nav__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    min-height: 3rem;
    padding: 0.25rem 0;
    border-radius: 0.75rem;
    color: color-mix(in oklab, var(--color-base-content) 65%, transparent);
    font-size: 0.68rem;
    font-weight: 600;
    transition:
      color var(--dur-fast) var(--ease-out),
      background-color var(--dur-fast) var(--ease-out);
  }

  .admin-bottom-nav__item span {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .admin-bottom-nav__item[aria-current="page"] {
    color: var(--color-primary);
    background: color-mix(in oklab, var(--color-primary) 12%, transparent);
  }

  .admin-bottom-nav__item:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  /* Phones use the bottom bar; scoped CSS here, since sm:hidden would lose to it. */
  @media (max-width: 639px) {
    .admin-top-tabs--with-bottom-nav {
      display: none;
    }
  }

  @media (min-width: 640px) {
    .admin-bottom-nav {
      display: none;
    }
  }
</style>
