<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import ThemeToggle from "@shared/components/ThemeToggle.svelte";
  import ExportTool from "./ExportTool.svelte";
  // Loaded on demand so ECharts lives in its own chunk, shared only with the
  // other chart views, instead of the main admin bundle.
  const loadAnalytics = () => import("./Analytics.svelte");
</script>

<section class="space-y-4 md:space-y-6">
  <!-- Same header pattern as Configuraciones: back to the panel, brand title. -->
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <a
        href="/admin"
        class="btn btn-ghost btn-sm gap-2"
        title="Volver al panel administrativo"
      >
        <Icon icon="lucide:arrow-left" class="h-4 w-4" aria-hidden="true" />
        <span>Panel administrativo</span>
      </a>
      <ThemeToggle />
    </div>
    <div>
      <h1
        class="font-display text-4xl font-bold leading-none text-base-content sm:text-5xl"
      >
        Analítica
      </h1>
      <p class="mt-1 text-sm text-base-content/70">
        Órdenes, ingresos y productos más vendidos, comparados con el periodo
        anterior.
      </p>
    </div>
  </div>

  {#await loadAnalytics()}
    <div class="skeleton h-80 w-full rounded-2xl" aria-busy="true"></div>
  {:then { default: Analytics }}
    <Analytics />
  {:catch}
    <div class="alert alert-error rounded-2xl" role="alert">
      <span>No se pudieron cargar las gráficas. Recarga la página.</span>
    </div>
  {/await}

  <!-- Maintenance lives below the numbers: it's an occasional task. -->
  <ExportTool />
</section>
