<script lang="ts">
  import { onMount } from "svelte";
  import { Chart } from "svelte-echarts";
  import { init, use } from "echarts/core";
  import { BarChart, LineChart, PieChart } from "echarts/charts";
  import {
    GridComponent,
    LegendComponent,
    TitleComponent,
    DatasetComponent,
    TooltipComponent,
  } from "echarts/components";
  import { CanvasRenderer } from "echarts/renderers";
  import type { EChartsOption } from "echarts";
  import {
    getAnalyticsOrdersOverTime,
    getAnalyticsOverview,
    getAnalyticsTopProducts,
    type AnalyticsOverview,
    type AnalyticsTimelinePoint,
    type AnalyticsTopProduct,
  } from "../../../../lib/bff/admin";
  import { formatCurrency } from "../../../../lib/utils/formatters";

  use([
    TitleComponent,
    CanvasRenderer,
    LineChart,
    PieChart,
    BarChart,
    GridComponent,
    LegendComponent,
    DatasetComponent,
    TooltipComponent,
  ]);

  let loading = $state(true);
  let error = $state("");
  let period = $state<"week" | "month" | "year">("month");
  let groupBy = $state<"day" | "week" | "month">("day");
  let startDate = $state("");
  let endDate = $state("");
  let chartTextColor = $state("#d1d5db");
  let chartMutedTextColor = $state("#9ca3af");
  let chartGridColor = $state("rgba(148, 163, 184, 0.25)");
  let chartTooltipBackground = $state("#111827");
  let chartTooltipBorder = $state("rgba(148, 163, 184, 0.35)");
  let chartTooltipTextColor = $state("#f8fafc");

  let overview = $state<AnalyticsOverview | null>(null);
  let ordersOverTime = $state<AnalyticsTimelinePoint[]>([]);
  let topProducts = $state<AnalyticsTopProduct[]>([]);

  function syncChartThemeColors() {
    if (typeof window === "undefined") return;

    const currentTheme = document.documentElement.getAttribute("data-theme") || "night";
    const isDarkTheme = currentTheme === "night";

    if (isDarkTheme) {
      chartTextColor = "#e5e7eb";
      chartMutedTextColor = "#cbd5e1";
      chartGridColor = "rgba(148, 163, 184, 0.28)";
      chartTooltipBackground = "rgba(15, 23, 42, 0.96)";
      chartTooltipBorder = "rgba(148, 163, 184, 0.45)";
      chartTooltipTextColor = "#f8fafc";
      return;
    }

    chartTextColor = "#111827";
    chartMutedTextColor = "#374151";
    chartGridColor = "rgba(156, 163, 175, 0.32)";
    chartTooltipBackground = "rgba(17, 24, 39, 0.96)";
    chartTooltipBorder = "rgba(31, 41, 55, 0.55)";
    chartTooltipTextColor = "#f9fafb";
  }

  const statusPieOptions = $derived<EChartsOption>({
    tooltip: {
      trigger: "item",
      backgroundColor: chartTooltipBackground,
      borderColor: chartTooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartTooltipTextColor, fontWeight: 600 },
    },
    legend: {
      top: "bottom",
      textStyle: { color: chartMutedTextColor },
    },
    series: [
      {
        name: "Estados",
        type: "pie",
        radius: "60%",
        label: {
          color: chartTextColor,
          textBorderWidth: 0,
          fontSize: 15,
          fontWeight: 600,
        },
        labelLine: {
          lineStyle: { color: chartMutedTextColor, width: 1.25 },
        },
        emphasis: {
          scale: true,
          scaleSize: 8,
          itemStyle: {
            shadowBlur: 18,
            shadowColor: "rgba(0, 0, 0, 0.3)",
          },
        },
        data: Object.entries(overview?.status_breakdown || {}).map(([name, value]) => ({
          name,
          value,
        })),
      },
    ],
  });

  const ordersChartOptions = $derived<EChartsOption>({
    tooltip: {
      trigger: "axis",
      backgroundColor: chartTooltipBackground,
      borderColor: chartTooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartTooltipTextColor, fontWeight: 600 },
    },
    grid: { left: 28, right: 16, top: 16, bottom: 24, containLabel: true },
    xAxis: {
      type: "category",
      data: ordersOverTime.map((point) => point.date),
      axisLabel: { color: chartMutedTextColor },
      axisLine: { lineStyle: { color: chartGridColor } },
      axisTick: { lineStyle: { color: chartGridColor } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: chartMutedTextColor },
      splitLine: { lineStyle: { color: chartGridColor } },
    },
    series: [
      {
        name: "Ordenes",
        type: "line",
        smooth: true,
        areaStyle: {},
        data: ordersOverTime.map((point) => point.count),
      },
    ],
  });

  const revenueChartOptions = $derived<EChartsOption>({
    tooltip: {
      trigger: "axis",
      backgroundColor: chartTooltipBackground,
      borderColor: chartTooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartTooltipTextColor, fontWeight: 600 },
    },
    grid: { left: 28, right: 16, top: 16, bottom: 24, containLabel: true },
    xAxis: {
      type: "category",
      data: ordersOverTime.map((point) => point.date),
      axisLabel: { color: chartMutedTextColor },
      axisLine: { lineStyle: { color: chartGridColor } },
      axisTick: { lineStyle: { color: chartGridColor } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: chartMutedTextColor },
      splitLine: { lineStyle: { color: chartGridColor } },
    },
    series: [
      {
        name: "Ingresos",
        type: "bar",
        data: ordersOverTime.map((point) => point.revenue),
      },
    ],
  });

  const topProductsOptions = $derived<EChartsOption>({
    tooltip: {
      trigger: "item",
      backgroundColor: chartTooltipBackground,
      borderColor: chartTooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartTooltipTextColor, fontWeight: 600 },
    },
    series: [
      {
        type: "pie",
        radius: "60%",
        label: {
          color: chartTextColor,
          textBorderWidth: 0,
          fontSize: 15,
          fontWeight: 600,
        },
        labelLine: {
          lineStyle: { color: chartMutedTextColor, width: 1.25 },
        },
        emphasis: {
          scale: true,
          scaleSize: 8,
          itemStyle: {
            shadowBlur: 18,
            shadowColor: "rgba(0, 0, 0, 0.3)",
          },
        },
        data: topProducts.map((item) => ({
          name: item.name,
          value: item.total_sold,
        })),
      },
    ],
  });

  async function fetchAnalytics() {
    loading = true;
    error = "";

    try {
      const start = startDate || getPeriodStart(period);
      const end = endDate || todayISO();

      const [overviewResult, timelineResult, topProductsResult] = await Promise.all([
        getAnalyticsOverview(period),
        getAnalyticsOrdersOverTime(start, end, groupBy),
        getAnalyticsTopProducts(10, start, end),
      ]);

      overview = overviewResult;
      ordersOverTime = timelineResult;
      topProducts = topProductsResult;
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "No se pudo cargar la analitica";
    } finally {
      loading = false;
    }
  }

  function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function getPeriodStart(selectedPeriod: "week" | "month" | "year"): string {
    const base = new Date();
    if (selectedPeriod === "week") {
      base.setDate(base.getDate() - 7);
    } else if (selectedPeriod === "month") {
      base.setMonth(base.getMonth() - 1);
    } else {
      base.setFullYear(base.getFullYear() - 1);
    }
    return base.toISOString().slice(0, 10);
  }

  onMount(() => {
    syncChartThemeColors();
    startDate = getPeriodStart(period);
    endDate = todayISO();
    const handleThemeChange = () => syncChartThemeColors();
    window.addEventListener("themechange", handleThemeChange);
    void fetchAnalytics();

    return () => {
      window.removeEventListener("themechange", handleThemeChange);
    };
  });
</script>

<section class="space-y-4">
  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="card-title">Analitica de ordenes</h2>
          <p class="text-sm text-base-content/70">Resumen operacional para monitorear tendencia y rendimiento.</p>
        </div>
        <div class="join">
          <button class={`btn btn-sm join-item ${period === "week" ? "btn-primary" : "btn-outline"}`} onclick={() => (period = "week")}>Semana</button>
          <button class={`btn btn-sm join-item ${period === "month" ? "btn-primary" : "btn-outline"}`} onclick={() => (period = "month")}>Mes</button>
          <button class={`btn btn-sm join-item ${period === "year" ? "btn-primary" : "btn-outline"}`} onclick={() => (period = "year")}>Año</button>
        </div>
      </div>
    </div>
  </div>

  <div class="card bg-base-100 shadow">
    <div class="card-body space-y-5">
      {#if error}
        <div class="alert alert-error"><span>{error}</span></div>
      {/if}

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label class="form-control gap-2 xl:col-span-2">
          <span id="analytics-start-date-label" class="label-text">Fecha inicio</span>
          <input
            id="analytics-start-date"
            type="date"
            class="input input-bordered h-11 w-full"
            bind:value={startDate}
            aria-labelledby="analytics-start-date-label"
          />
        </label>

        <label class="form-control gap-2 xl:col-span-2">
          <span id="analytics-end-date-label" class="label-text">Fecha fin</span>
          <input
            id="analytics-end-date"
            type="date"
            class="input input-bordered h-11 w-full"
            bind:value={endDate}
            aria-labelledby="analytics-end-date-label"
          />
        </label>

        <label class="form-control gap-2 xl:col-span-2">
          <span id="analytics-group-by-label" class="label-text">Agrupar por</span>
          <select
            id="analytics-group-by"
            class="select select-bordered h-11 w-full"
            bind:value={groupBy}
            aria-labelledby="analytics-group-by-label"
          >
            <option value="day">Dia</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
        </label>

        <div class="rounded-box border border-base-300/70 bg-base-200/35 p-3 md:p-4 xl:col-span-2">
          <div class="flex h-full flex-col justify-center gap-2 md:flex-row md:flex-wrap md:items-center md:justify-end">
            <button class="btn btn-outline w-full md:w-auto" onclick={fetchAnalytics} disabled={loading}>Actualizar</button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <article class="stats shadow border border-base-300">
        <div class="stat">
          <div class="stat-title">Ordenes</div>
          <div class="stat-value text-primary">{overview?.total_orders || 0}</div>
          <div class="stat-desc">Periodo seleccionado</div>
        </div>
      </article>

      <article class="stats shadow border border-base-300">
        <div class="stat">
          <div class="stat-title">Ingresos</div>
          <div class="stat-value text-success text-3xl">{formatCurrency(overview?.total_revenue || 0)}</div>
          <div class="stat-desc">No canceladas</div>
        </div>
      </article>

      <article class="stats shadow border border-base-300">
        <div class="stat">
          <div class="stat-title">Ticket promedio</div>
          <div class="stat-value text-info text-3xl">{formatCurrency(overview?.avg_order_value || 0)}</div>
          <div class="stat-desc">Ticket promedio</div>
        </div>
      </article>

      <article class="stats shadow border border-base-300">
        <div class="stat">
          <div class="stat-title">Periodo</div>
          <div class="stat-value text-accent text-3xl uppercase">{overview?.period || period}</div>
          <div class="stat-desc">Filtro activo</div>
        </div>
      </article>
    </div>

      {#if loading}
        <div class="flex items-center gap-2 py-8">
          <span class="loading loading-spinner loading-md"></span>
          <span>Cargando analitica...</span>
        </div>
      {:else}
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div class="card bg-base-100 shadow border border-base-content/5">
            <div class="card-body">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h4 class="card-title text-base">Ordenes en el tiempo</h4>
              </div>
              <div class="h-80 w-full">
                <Chart {init} options={ordersChartOptions} />
              </div>
            </div>
          </div>

          <div class="card bg-base-100 shadow border border-base-content/5">
            <div class="card-body">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h4 class="card-title text-base">Ingresos en el tiempo</h4>
              </div>
              <div class="h-80 w-full">
                <Chart {init} options={revenueChartOptions} />
              </div>
            </div>
          </div>

          <div class="card bg-base-100 shadow border border-base-content/5">
            <div class="card-body">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h4 class="card-title text-base">Productos mas vendidos</h4>
              </div>
              <div class="h-80 w-full">
                <Chart {init} options={topProductsOptions} />
              </div>
            </div>
          </div>

          <div class="card bg-base-100 shadow border border-base-content/5">
            <div class="card-body">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h4 class="card-title text-base">Ordenes por estado</h4>
              </div>
              <div class="h-80 w-full">
                <Chart {init} options={statusPieOptions} />
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</section>
