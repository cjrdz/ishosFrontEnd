<script lang="ts">
  import { onMount } from "svelte";
  import ThemeToggle from "../shared/ThemeToggle.svelte";
  import Icon from "@iconify/svelte";
  import { ADMIN_ONLY_TABS, TAB_LABELS, type TabKey } from "./config/tabs";

  interface Props {
    userName: string;
    activeTab: TabKey;
    isAdmin: boolean;
    tabOrder: TabKey[];
    onLogout: () => void;
    onTabChange: (tab: TabKey) => void;
    onOpenSettings: () => void;
  }

  let { userName, activeTab, isAdmin, tabOrder, onLogout, onTabChange, onOpenSettings }: Props = $props();
  let currentHour = $state(new Date().getHours());

  const visibleTabs = $derived(
    tabOrder.filter((tab) => isAdmin || !ADMIN_ONLY_TABS.has(tab)),
  );

  const greetingMeta = $derived.by(() => {
    if (currentHour < 12) {
      return { text: "Buenos días", icon: "lucide:sun", iconClass: "text-yellow-500" };
    }
    if (currentHour < 19) {
      return { text: "Buenas tardes", icon: "lucide:sun", iconClass: "text-orange-500" };
    }
    return { text: "Buenas noches", icon: "lucide:moon", iconClass: "text-sky-500" };
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
    <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-base-content/90">Panel administrativo</h1>
    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-base-content/70">
      <p class="flex items-center gap-2">
        <span>{greetingMeta.text}, <strong>{userName || "equipo"}</strong></span>
        <Icon icon={greetingMeta.icon} class={`h-4 w-4 ${greetingMeta.iconClass}`} />
      </p>
      <p class="flex items-center gap-2">
        <span class="loading loading-ring loading-sm text-success"></span>
        <span>Sesion activa</span>
      </p>
    </div>
  </div>
  <div class="flex items-center gap-2 self-end sm:self-auto">
    <ThemeToggle />
    {#if isAdmin}
      <button class="btn btn-ghost btn-circle" type="button" aria-label="Abrir configuracion" title="Configuracion del panel" onclick={onOpenSettings}>
        <Icon icon="lucide:settings-2" class="h-6 w-6" />
      </button>
    {/if}
    <button class="btn btn-outline max-sm:btn-circle" title="Cerrar sesion" aria-label="Cerrar sesion" onclick={onLogout}>
      <Icon icon="lucide:log-out" class="h-5 w-5" />
      <span class="hidden sm:inline">Cerrar sesion</span>
    </button>
  </div>
</div>

<div class="overflow-x-auto pb-1">
  <div role="tablist" class="tabs tabs-box bg-base-100 border border-base-200 shadow-sm p-1 w-max min-w-full sm:w-fit sm:min-w-0">
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
