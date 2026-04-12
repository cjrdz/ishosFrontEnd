<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@iconify/svelte";
  import { Chart } from "svelte-echarts";
  import { init, use } from "echarts/core";
  import { BarChart, LineChart, PieChart } from "echarts/charts";
  import {
    DataZoomComponent,
    GridComponent,
    LegendComponent,
    ToolboxComponent,
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
    DataZoomComponent,
    ToolboxComponent,
    DatasetComponent,
    TooltipComponent,
  ]);

  let loading = $state(true);
  let error = $state("");
  let period = $state<"week" | "month" | "year">("month");
  let groupBy = $state<"day" | "week" | "month">("day");
  let startDate = $state("");
  let endDate = $state("");
  let useCustomRange = $state(false);
  let quickRange = $state<"7d" | "30d" | "90d" | "1y">("30d");
  let chartTextColor = $state("#d1d5db");
  let chartMutedTextColor = $state("#9ca3af");
  let chartGridColor = $state("rgba(148, 163, 184, 0.25)");
  let chartTooltipBackground = $state("#111827");
  let chartTooltipBorder = $state("rgba(148, 163, 184, 0.35)");
  let chartTooltipTextColor = $state("#f8fafc");

  let overview = $state<AnalyticsOverview | null>(null);
  let ordersOverTime = $state<AnalyticsTimelinePoint[]>([]);
  let topProducts = $state<AnalyticsTopProduct[]>([]);

  const CHART_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

  const quickRangeConfig: Record<"7d" | "30d" | "90d" | "1y", { days: number; period: "week" | "month" | "year"; label: string }> = {
    "7d":  { days: 7,   period: "week",  label: "7 días" },
    "30d": { days: 30,  period: "month", label: "30 días" },
    "90d": { days: 90,  period: "month", label: "90 días" },
    "1y":  { days: 365, period: "year",  label: "1 año" },
  };

  function formatTimelineLabel(raw: string): string {
    if (!raw) return "-";
    if (/^\d{4}-W\d{2}$/.test(raw)) {
      const [year, week] = raw.split("-W");
      return `Sem ${week} ${year}`;
    }
    if (/^\d{4}-\d{2}$/.test(raw)) {
      const [year, month] = raw.split("-");
      return `${month}/${year}`;
    }

    const date = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  }

  function formatDateDisplay(dateStr: string): string {
    if (!dateStr) return "";
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }

  function applyRangePreset(days: 7 | 30 | 90 | 365) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    startDate = toISODate(start);
    endDate = toISODate(end);
  }

  function toISODate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  function setQuickRange(nextRange: "7d" | "30d" | "90d" | "1y") {
    quickRange = nextRange;
    useCustomRange = false;
    period = quickRangeConfig[nextRange].period;
    applyRangePreset(quickRangeConfig[nextRange].days as 7 | 30 | 90 | 365);
    void fetchAnalytics();
  }

  function toggleCustomRange(enabled: boolean) {
    useCustomRange = enabled;
    if (!enabled) {
      period = quickRangeConfig[quickRange].period;
      applyRangePreset(quickRangeConfig[quickRange].days as 7 | 30 | 90 | 365);
      void fetchAnalytics();
    }
  }

  function getActivePeriodDescription(): string {
    if (useCustomRange && startDate && endDate) {
      return `${formatDateDisplay(startDate)} – ${formatDateDisplay(endDate)}`;
    }
    return quickRangeConfig[quickRange].label;
  }

  function resolveOverviewPeriod(start: string, end: string): "week" | "month" | "year" {
    const days = Math.max(1, Math.round(
      (new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000
    ));
    if (days <= 14) return "week";
    if (days <= 180) return "month";
    return "year";
  }

  function syncChartThemeColors() {
    if (typeof window === "undefined") return;
    const isDark = (document.documentElement.getAttribute("data-theme") || "night") === "night";
    if (isDark) {
      chartTextColor = "#e5e7eb";
      chartMutedTextColor = "#cbd5e1";
      chartGridColor = "rgba(148, 163, 184, 0.28)";
      chartTooltipBackground = "rgba(15, 23, 42, 0.96)";
      chartTooltipBorder = "rgba(148, 163, 184, 0.45)";
      chartTooltipTextColor = "#f8fafc";
    } else {
      chartTextColor = "#111827";
      chartMutedTextColor = "#374151";
      chartGridColor = "rgba(156, 163, 175, 0.32)";
      chartTooltipBackground = "rgba(17, 24, 39, 0.96)";
      chartTooltipBorder = "rgba(31, 41, 55, 0.55)";
      chartTooltipTextColor = "#f9fafb";
    }
  }

  // Shared donut style
  function donutSeries(data: { name: string; value: number }[], colors: string[]): EChartsOption["series"] {
    return [{
      type: "pie",
      radius: ["42%", "68%"],
      center: ["50%", "46%"],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: "transparent", borderWidth: 2 },
      label: { show: true, color: chartTextColor, textBorderWidth: 0, fontSize: 12, fontWeight: 600, formatter: "{b}: {c}" },
      labelLine: { lineStyle: { color: chartMutedTextColor, width: 1.2 } },
      emphasis: { scale: true, scaleSize: 7, itemStyle: { shadowBlur: 14, shadowColor: "rgba(0,0,0,0.25)" } },
      data: data.map((d, i) => ({ ...d, itemStyle: { color: colors[i % colors.length] } })),
    }];
  }

  const statusPieOptions = $derived<EChartsOption>({
    tooltip: {
      trigger: "item",
      backgroundColor: chartTooltipBackground,
      borderColor: chartTooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartTooltipTextColor, fontWeight: 600 },
    },
    legend: { bottom: 0, textStyle: { color: chartMutedTextColor } },
    series: donutSeries(
      Object.entries(overview?.status_breakdown || {}).map(([name, value]) => ({ name, value })),
      ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]
    ),
  });

  const ordersChartOptions = $derived<EChartsOption>({
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line" },
      backgroundColor: chartTooltipBackground,
      borderColor: chartTooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartTooltipTextColor, fontWeight: 600 },
      formatter: (params: any) => {
        const first = Array.isArray(params) ? params[0] : params;
        const label = formatTimelineLabel(first?.axisValueLabel ?? first?.axisValue ?? "");
        return `${label}<br/><strong>${first?.data ?? 0}</strong> órdenes`;
      },
    },
    grid: { left: 20, right: 20, top: 20, bottom: 80, containLabel: true },
    toolbox: {
      right: 8,
      iconStyle: { borderColor: chartMutedTextColor },
      feature: {
        saveAsImage: { title: "Guardar" },
        dataZoom: { title: { zoom: "Zoom", back: "Reset" } },
      },
    },
    dataZoom: [
      { type: "inside", xAxisIndex: 0 },
      { type: "slider", xAxisIndex: 0, height: 22, bottom: 28, borderColor: chartGridColor, fillerColor: "rgba(59,130,246,0.12)", handleStyle: { color: "#3b82f6" }, textStyle: { color: chartMutedTextColor } },
    ],
    xAxis: {
      type: "category",
      data: ordersOverTime.map((p) => p.date),
      boundaryGap: false,
      axisLabel: { color: chartMutedTextColor, fontSize: 11, formatter: formatTimelineLabel },
      axisLine: { lineStyle: { color: chartGridColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: chartMutedTextColor, fontSize: 11 },
      splitLine: { lineStyle: { color: chartGridColor, type: "dashed" } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      name: "Órdenes",
      type: "line",
      smooth: 0.4,
      showSymbol: false,
      lineStyle: { width: 2.5, color: "#3b82f6" },
      itemStyle: { color: "#3b82f6" },
      areaStyle: { opacity: 1, color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(59,130,246,0.22)" }, { offset: 1, color: "rgba(59,130,246,0.02)" }] } },
      emphasis: { focus: "series" },
      markLine: {
        silent: true,
        symbol: "none",
        label: { color: chartMutedTextColor, formatter: "Prom: {c}", fontSize: 11 },
        lineStyle: { type: "dashed", color: "#f59e0b", width: 1.5 },
        data: [{ type: "average", name: "Promedio" }],
      },
      data: ordersOverTime.map((p) => p.count),
    }],
  });

  const revenueChartOptions = $derived<EChartsOption>({
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: chartTooltipBackground,
      borderColor: chartTooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartTooltipTextColor, fontWeight: 600 },
      formatter: (params: any) => {
        const first = Array.isArray(params) ? params[0] : params;
        const label = formatTimelineLabel(first?.axisValueLabel ?? first?.axisValue ?? "");
        return `${label}<br/><strong>${formatCurrency(Number(first?.data ?? 0))}</strong>`;
      },
    },
    grid: { left: 20, right: 20, top: 20, bottom: 50, containLabel: true },
    xAxis: {
      type: "category",
      data: ordersOverTime.map((p) => p.date),
      axisLabel: { color: chartMutedTextColor, fontSize: 11, formatter: formatTimelineLabel },
      axisLine: { lineStyle: { color: chartGridColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: chartMutedTextColor, fontSize: 11, formatter: (v: number) => formatCurrency(v) },
      splitLine: { lineStyle: { color: chartGridColor, type: "dashed" } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      name: "Ingresos",
      type: "bar",
      barMaxWidth: 38,
      itemStyle: { borderRadius: [5, 5, 0, 0], color: "#22c55e" },
      emphasis: { focus: "series" },
      data: ordersOverTime.map((p) => p.revenue),
    }],
  });

  const topProductsOptions = $derived<EChartsOption>({
    tooltip: {
      trigger: "item",
      backgroundColor: chartTooltipBackground,
      borderColor: chartTooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartTooltipTextColor, fontWeight: 600 },
      formatter: (params: any) => `${params?.name ?? ""}<br/><strong>${params?.value ?? 0}</strong> uds. (${params?.percent ?? 0}%)`,
    },
    legend: { bottom: 0, textStyle: { color: chartMutedTextColor } },
    series: donutSeries(
      topProducts.map((p) => ({ name: p.name, value: p.total_sold })),
      CHART_COLORS
    ),
  });

  async function fetchAnalytics() {
    loading = true;
    error = "";

    try {
      const start = startDate || getPeriodStart(period);
      const end = endDate || todayISO();

      if (new Date(`${end}T00:00:00`) < new Date(`${start}T00:00:00`)) {
        error = "La fecha fin debe ser mayor o igual a la fecha inicio";
        loading = false;
        return;
      }

      const overviewPeriod = useCustomRange ? resolveOverviewPeriod(start, end) : period;

      const [overviewResult, timelineResult, topProductsResult] = await Promise.all([
        getAnalyticsOverview(overviewPeriod),
        getAnalyticsOrdersOverTime(start, end, groupBy),
        getAnalyticsTopProducts(10, start, end),
      ]);

      overview = overviewResult;
      ordersOverTime = timelineResult;
      topProducts = topProductsResult;
    } catch (err) {
      error = err instanceof Error ? err.message : "No se pudo cargar la analítica";
    } finally {
      loading = false;
    }
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function getPeriodStart(p: "week" | "month" | "year") {
    const d = new Date();
    if (p === "week") d.setDate(d.getDate() - 7);
    else if (p === "month") d.setMonth(d.getMonth() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }

  onMount(() => {
    syncChartThemeColors();
    applyRangePreset(quickRangeConfig[quickRange].days as 7 | 30 | 90 | 365);
    period = quickRangeConfig[quickRange].period;
    window.addEventListener("themechange", syncChartThemeColors);
    void fetchAnalytics();
    return () => window.removeEventListener("themechange", syncChartThemeColors);
  });
</script>

<section class="space-y-4">
  <!-- Header -->
  <div class="card bg-base-100 shadow border border-base-300/60">
    <div class="card-body py-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon icon="lucide:bar-chart-2" class="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 class="card-title text-base leading-tight">Analítica de órdenes</h2>
            <p class="text-xs text-base-content/55">Tendencia y rendimiento operacional</p>
          </div>
        </div>
        <!-- Quick range: segmented join for compactness -->
        <div class="join self-start sm:self-auto">
          {#each Object.entries(quickRangeConfig) as [key, cfg]}
            <button
              class="btn btn-sm join-item"
              class:btn-primary={quickRange === key && !useCustomRange}
              class:btn-ghost={quickRange !== key || useCustomRange}
              onclick={() => setQuickRange(key as "7d" | "30d" | "90d" | "1y")}
            >{cfg.label}</button>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- Body -->
  <div class="card bg-base-100 shadow border border-base-300/60">
    <div class="card-body space-y-5">

      {#if error}
        <div class="alert alert-error">
          <span>{error}</span>
          <button type="button" class="btn btn-ghost btn-xs ml-auto" onclick={() => error = ""}>&#x2715;</button>
        </div>
      {/if}

      <!-- Controls row -->
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start">
        <!-- Group by: compact button group instead of full-width select -->
        <div class="flex flex-col gap-1">
          <span class="text-xs font-medium text-base-content/60 ml-0.5">Agrupar por</span>
          <div class="join">
            {#each [["day", "Día"], ["week", "Semana"], ["month", "Mes"]] as [val, lbl]}
              <button
                class="btn btn-sm join-item"
                class:btn-neutral={groupBy === val}
                class:btn-ghost={groupBy !== val}
                onclick={() => { groupBy = val as "day" | "week" | "month"; }}
              >{lbl}</button>
            {/each}
          </div>
        </div>

        <!-- Custom range toggle -->
        <label class="flex cursor-pointer items-center gap-2 w-fit lg:mt-6">
          <input
            type="checkbox"
            class="toggle toggle-primary toggle-sm"
            checked={useCustomRange}
            onchange={(e) => toggleCustomRange((e.currentTarget as HTMLInputElement).checked)}
          />
          <span class="text-sm">Rango personalizado</span>
        </label>

        <button
          class="btn btn-primary btn-sm gap-2 lg:ml-auto lg:mt-6"
          onclick={fetchAnalytics}
          disabled={loading}
        >
          {#if loading}
            <span class="loading loading-spinner loading-xs"></span>
          {:else}
            <Icon icon="lucide:refresh-cw" class="h-4 w-4" />
          {/if}
          Actualizar
        </button>
      </div>

      <!-- Custom date inputs -->
      {#if useCustomRange}
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 animate-fadeIn">
          <label class="flex items-center gap-3">
            <span class="w-24 shrink-0 text-sm font-medium text-base-content/60">Fecha inicio</span>
            <input id="analytics-start-date" type="date" class="input input-bordered h-11 w-full" bind:value={startDate} />
          </label>
          <label class="flex items-center gap-3">
            <span class="w-24 shrink-0 text-sm font-medium text-base-content/60">Fecha fin</span>
            <input id="analytics-end-date" type="date" class="input input-bordered h-11 w-full" bind:value={endDate} />
          </label>
        </div>
      {/if}

      <!-- KPI cards -->
      {#if loading}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          {#each Array(3) as _}
            <div class="stat bg-base-200/50 border border-base-300/50 rounded-box animate-pulse">
              <div class="h-4 bg-base-300 rounded w-20 mb-3"></div>
              <div class="h-8 bg-base-300 rounded w-28"></div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="stat bg-base-200/40 border border-base-300/50 rounded-box">
            <div class="stat-title">Órdenes</div>
            <div class="stat-value text-primary">{overview?.total_orders ?? 0}</div>
            <div class="stat-desc">{getActivePeriodDescription()}</div>
          </div>
          <div class="stat bg-base-200/40 border border-base-300/50 rounded-box">
            <div class="stat-title">Ingresos</div>
            <div class="stat-value text-success text-2xl">{formatCurrency(overview?.total_revenue ?? 0)}</div>
            <div class="stat-desc">Sin órdenes canceladas</div>
          </div>
          <div class="stat bg-base-200/40 border border-base-300/50 rounded-box">
            <div class="stat-title">Ticket promedio</div>
            <div class="stat-value text-info text-2xl">{formatCurrency(overview?.avg_order_value ?? 0)}</div>
            <div class="stat-desc">Por orden completada</div>
          </div>
        </div>
      {/if}

      <!-- Charts -->
      {#if loading}
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {#each Array(4) as _}
            <div class="card bg-base-100 border border-base-300/50">
              <div class="card-body">
                <div class="h-4 bg-base-200 rounded w-36 mb-4"></div>
                <div class="h-72 bg-base-200/60 rounded-xl animate-pulse flex items-center justify-center">
                  <span class="loading loading-spinner loading-md text-base-content/20"></span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else if ordersOverTime.length === 0 && topProducts.length === 0}
        <!-- Empty state -->
        <div class="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div class="w-16 h-16 rounded-full bg-base-300/50 flex items-center justify-center">
            <Icon icon="lucide:bar-chart-2" class="h-8 w-8 text-base-content/30" />
          </div>
          <p class="font-medium text-base-content/60">Sin datos para el periodo seleccionado</p>
          <p class="text-sm text-base-content/40 max-w-xs">Cambia el rango de fechas o espera a que se registren nuevas órdenes.</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div class="card bg-base-100 border border-base-300/50">
            <div class="card-body">
              <h4 class="text-sm font-semibold flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span>
                Órdenes en el tiempo
              </h4>
              <div class="h-72 w-full md:h-80">
                <Chart {init} options={ordersChartOptions} />
              </div>
            </div>
          </div>

          <div class="card bg-base-100 border border-base-300/50">
            <div class="card-body">
              <h4 class="text-sm font-semibold flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-success inline-block"></span>
                Ingresos en el tiempo
              </h4>
              <div class="h-72 w-full md:h-80">
                <Chart {init} options={revenueChartOptions} />
              </div>
            </div>
          </div>

          <div class="card bg-base-100 border border-base-300/50">
            <div class="card-body">
              <h4 class="text-sm font-semibold flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-warning inline-block"></span>
                Productos más vendidos
                {#if topProducts.length > 0}
                  <span class="badge badge-ghost badge-xs ml-auto">Top {topProducts.length}</span>
                {/if}
              </h4>
              {#if topProducts.length === 0}
                <div class="h-72 flex items-center justify-center text-sm text-base-content/40">Sin datos de productos</div>
              {:else}
                <div class="h-72 w-full md:h-80">
                  <Chart {init} options={topProductsOptions} />
                </div>
              {/if}
            </div>
          </div>

          <div class="card bg-base-100 border border-base-300/50">
            <div class="card-body">
              <h4 class="text-sm font-semibold flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-info inline-block"></span>
                Órdenes por estado
              </h4>
              {#if !overview?.status_breakdown || Object.keys(overview.status_breakdown).length === 0}
                <div class="h-72 flex items-center justify-center text-sm text-base-content/40">Sin datos de estados</div>
              {:else}
                <div class="h-72 w-full md:h-80">
                  <Chart {init} options={statusPieOptions} />
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}

    </div>
  </div>
</section>

<style>
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .animate-fadeIn { animation: fadeIn 0.18s ease-out; }
</style>
