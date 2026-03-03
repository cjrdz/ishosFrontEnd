<script lang="ts">
  import ThemeToggle from "../shared/ThemeToggle.svelte";

  export type TabKey = "ordenes" | "categorias" | "productos" | "empleados" | "herramientas";

  interface Props {
    role: "admin" | "employee";
    activeTab: TabKey;
    isAdmin: boolean;
    onLogout: () => void;
    onTabChange: (tab: TabKey) => void;
  }

  let { role, activeTab, isAdmin, onLogout, onTabChange }: Props = $props();
</script>

<div class="flex items-center justify-between">
  <div>
    <h1 class="text-3xl font-bold">Panel administrativo</h1>
    <p class="text-base-content/70">Sesion activa con rol: <strong>{role}</strong></p>
  </div>
  <div class="flex items-center gap-2">
    <ThemeToggle />
    <button class="btn btn-outline" onclick={onLogout}>Cerrar sesion</button>
  </div>
</div>

<div role="tablist" class="tabs tabs-box bg-base-100 w-fit">
  <input
    type="radio"
    name="admin_tabs"
    class="tab tab-lg"
    aria-label="Ordenes"
    checked={activeTab === "ordenes"}
    onchange={() => onTabChange("ordenes")}
  />
  {#if isAdmin}
    <input
      type="radio"
      name="admin_tabs"
      class="tab tab-lg"
      aria-label="Categorias"
      checked={activeTab === "categorias"}
      onchange={() => onTabChange("categorias")}
    />
    <input
      type="radio"
      name="admin_tabs"
      class="tab tab-lg"
      aria-label="Productos"
      checked={activeTab === "productos"}
      onchange={() => onTabChange("productos")}
    />
    <input
      type="radio"
      name="admin_tabs"
      class="tab tab-lg"
      aria-label="Empleados"
      checked={activeTab === "empleados"}
      onchange={() => onTabChange("empleados")}
    />
    <input
      type="radio"
      name="admin_tabs"
      class="tab tab-lg"
      aria-label="Herramientas"
      checked={activeTab === "herramientas"}
      onchange={() => onTabChange("herramientas")}
    />
  {/if}
</div>
