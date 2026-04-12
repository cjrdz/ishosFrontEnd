<script lang="ts">
  import ThemeToggle from "../shared/ThemeToggle.svelte";
  import Icon from "@iconify/svelte";

  export type TabKey = "ordenes" | "categorias" | "productos" | "empleados" | "usuarios" | "herramientas";

  const TAB_LABELS: Record<TabKey, string> = {
    ordenes: "Ordenes",
    categorias: "Categorias",
    productos: "Productos",
    empleados: "Empleados",
    usuarios: "Usuarios",
    herramientas: "Herramientas",
  };

  const ADMIN_ONLY_TABS = new Set<TabKey>(["categorias", "productos", "empleados", "usuarios", "herramientas"]);

  interface Props {
    role: "admin" | "employee";
    activeTab: TabKey;
    isAdmin: boolean;
    tabOrder: TabKey[];
    onLogout: () => void;
    onTabChange: (tab: TabKey) => void;
    onOpenSettings: () => void;
  }

  let { role, activeTab, isAdmin, tabOrder, onLogout, onTabChange, onOpenSettings }: Props = $props();

  const visibleTabs = $derived(
    tabOrder.filter((tab) => isAdmin || !ADMIN_ONLY_TABS.has(tab)),
  );
</script>

<div class="flex items-center justify-between">
  <div>
    <h1 class="text-3xl font-bold">Panel administrativo</h1>
    <p class="text-base-content/70">Sesion activa con rol: <strong>{role}</strong></p>
  </div>
  <div class="flex items-center gap-2">
    <ThemeToggle />
    {#if isAdmin}
      <button class="btn btn-ghost btn-circle" type="button" aria-label="Abrir configuracion" title="Configuracion del panel" onclick={onOpenSettings}>
        <Icon icon="lucide:settings-2" class="h-6 w-6" />
      </button>
    {/if}
    <button class="btn btn-outline" onclick={onLogout}>Cerrar sesion</button>
  </div>
</div>

<div role="tablist" class="tabs tabs-box bg-base-100 w-fit">
  {#each visibleTabs as tab}
    <input
      type="radio"
      name="admin_tabs"
      class="tab tab-lg"
      aria-label={TAB_LABELS[tab]}
      checked={activeTab === tab}
      onchange={() => onTabChange(tab)}
    />
  {/each}
</div>
