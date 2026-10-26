<script lang="ts">
  import ExportTool from "./ExportTool.svelte";
  // Loaded on demand so ECharts lives in its own chunk, shared only with the
  // other chart views, instead of the main admin bundle.
  const loadAnalytics = () => import("./Analytics.svelte");
</script>

<section class="space-y-4 md:space-y-6">
  <ExportTool />
  {#await loadAnalytics()}
    <div class="skeleton h-80 w-full rounded-2xl" aria-busy="true"></div>
  {:then { default: Analytics }}
    <Analytics />
  {:catch}
    <div class="alert alert-error rounded-2xl" role="alert">
      <span>No se pudieron cargar las gráficas. Recarga la página.</span>
    </div>
  {/await}
</section>
