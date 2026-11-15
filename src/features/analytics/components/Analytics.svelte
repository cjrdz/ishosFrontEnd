<script lang="ts">
  import { currentChartTheme } from "@shared/theme/chart-colors";
  import { statusLabels } from "@features/orders/lib/order-status";
  import { onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
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
    MarkLineComponent,
  } from "echarts/components";
  import { CanvasRenderer } from "echarts/renderers";
  import type { EChartsOption } from "echarts";
  import {
    getAnalyticsDashboard,
    type AnalyticsOverview,
    type AnalyticsPaymentMethodSummary,
    type AnalyticsTimelinePoint,
    type AnalyticsTopProduct,
  } from "@features/admin-management";
  import { formatCurrency } from "@shared/utils/formatters";
  import {
    delta,
    lastDays,
    previousRange,
    storeTodayISO,
    type Delta,
  } from "../lib/compare";

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
    MarkLineComponent,
  ]);

  let loading = $state(true);
  let error = $state("");
  let period = $state<"week" | "month" | "year">("month");
  let groupBy = $state<"day" | "week" | "month">("day");
  let startDate = $state("");
  let endDate = $state("");
  let useCustomRange = $state(false);
  let quickRange = $state<"7d" | "30d" | "90d" | "1y">("30d");
  const initialChart = currentChartTheme();
  let chartTextColor = $state(initialChart.text);
  let chartMutedTextColor = $state(initialChart.muted);
  let chartGridColor = $state(initialChart.grid);
  let chartTooltipBackground = $state(initialChart.tooltipBackground);
  let chartTooltipBorder = $state(initialChart.tooltipBorder);
  let chartTooltipTextColor = $state(initialChart.tooltipText);

  let overview = $state<AnalyticsOverview | null>(null);
  /** Same-length period just before the selected one, for the KPI deltas. */
  let previousOverview = $state<AnalyticsOverview | null>(null);
  const ordersDelta = $derived(
    delta(overview?.total_orders ?? 0, previousOverview?.total_orders),
  );
  const revenueDelta = $derived(
    delta(overview?.total_revenue ?? 0, previousOverview?.total_revenue),
  );
  const ticketDelta = $derived(
    delta(overview?.avg_order_value ?? 0, previousOverview?.avg_order_value),
  );
  let ordersOverTime = $state<AnalyticsTimelinePoint[]>([]);
  let topProducts = $state<AnalyticsTopProduct[]>([]);

  let CHART_COLORS = $state<string[]>(initialChart.categorical);
  let STATUS_COLORS = $state<Record<string, string>>(initialChart.status);
  /** Single-series marks (orders and revenue over time). */
  let chartSeriesColor = $state(initialChart.series);
  /** Card surface behind the charts (slice gaps are drawn in it). */
  let chartSurfaceColor = $state(initialChart.surface);

  function withAlpha(hex: string, alpha: number): string {
    const n = Number.parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  // Each status keeps its colour whichever statuses are present.
  const STATUS_ORDER = [
    "pendiente_revision",
    "recibida",
    "en_proceso",
    "lista",
    "entregada",
    "cancelada",
  ];
  const STATUS_NAMES: Record<string, string> = statusLabels;

  const quickRangeConfig: Record<
    "7d" | "30d" | "90d" | "1y",
    { days: number; period: "week" | "month" | "year"; label: string }
  > = {
    "7d": { days: 7, period: "week", label: "7 días" },
    "30d": { days: 30, period: "month", label: "30 días" },
    "90d": { days: 90, period: "month", label: "90 días" },
    "1y": { days: 365, period: "year", label: "1 año" },
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
    // Inclusive range ending today in store time ("7 días" = today + 6 before).
    ({ start: startDate, end: endDate } = lastDays(days));
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

  function syncChartThemeColors() {
    if (typeof window === "undefined") return;
    const theme = currentChartTheme();
    chartTextColor = theme.text;
    chartMutedTextColor = theme.muted;
    chartGridColor = theme.grid;
    chartTooltipBackground = theme.tooltipBackground;
    chartTooltipBorder = theme.tooltipBorder;
    chartTooltipTextColor = theme.tooltipText;
    CHART_COLORS = theme.categorical;
    STATUS_COLORS = theme.status;
    chartSeriesColor = theme.series;
    chartSurfaceColor = theme.surface;
  }

  // Shared donut style
  function donutSeries(
    data: { name: string; value: number; itemStyle?: { color: string } }[],
    colors: string[],
    labelFormatter?: (name: string, value: number) => string,
  ): EChartsOption["series"] {
    return [
      {
        type: "pie",
        radius: ["42%", "68%"],
        center: ["50%", "46%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: chartSurfaceColor,
          borderWidth: 2,
        },
        label: {
          show: true,
          color: chartTextColor,
          textBorderWidth: 0,
          fontSize: 12,
          fontWeight: 600,
          formatter: labelFormatter
            ? (params: any) =>
                labelFormatter(params?.name ?? "", Number(params?.value ?? 0))
            : "{b}: {c}",
        },
        labelLine: { lineStyle: { color: chartMutedTextColor, width: 1.2 } },
        emphasis: {
          scale: true,
          scaleSize: 7,
          itemStyle: { shadowBlur: 14, shadowColor: "rgba(0,0,0,0.25)" },
        },
        data: data.map((d, i) => ({
          ...d,
          itemStyle: { color: colors[i % colors.length] },
        })),
      },
    ];
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
      STATUS_ORDER.filter(
        (key) => (overview?.status_breakdown ?? {})[key] != null,
      ).map((key) => ({
        name: STATUS_NAMES[key],
        value: Number(overview?.status_breakdown?.[key] ?? 0),
        itemStyle: { color: STATUS_COLORS[key] },
      })),
      STATUS_ORDER.filter(
        (key) => (overview?.status_breakdown ?? {})[key] != null,
      ).map((key) => STATUS_COLORS[key]),
    ),
  });

  const paymentMethodPieOptions = $derived<EChartsOption>({
    tooltip: {
      trigger: "item",
      backgroundColor: chartTooltipBackground,
      borderColor: chartTooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartTooltipTextColor, fontWeight: 600 },
      formatter: (params: any) => {
        const revenue = formatCurrency(params?.value ?? 0);
        const count = params?.data?.count ?? 0;
        return `${params?.name ?? ""}<br/><strong>${revenue}</strong> (${count} órdenes)`;
      },
    },
    legend: { bottom: 0, textStyle: { color: chartMutedTextColor } },
    series: donutSeries(
      Object.entries(overview?.payment_method_breakdown || {}).map(
        ([name, summary]: [
          string,
          AnalyticsPaymentMethodSummary | undefined,
        ]) => ({
          name,
          value: Math.round(Number(summary?.revenue ?? 0) * 100) / 100,
          count: summary?.count ?? 0,
        }),
      ),
      CHART_COLORS,
      (name, value) => `${name}: ${formatCurrency(value)}`,
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
        const label = formatTimelineLabel(
          first?.axisValueLabel ?? first?.axisValue ?? "",
        );
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
      {
        type: "slider",
        xAxisIndex: 0,
        height: 22,
        bottom: 28,
        borderColor: chartGridColor,
        fillerColor: withAlpha(chartSeriesColor, 0.12),
        handleStyle: { color: chartSeriesColor },
        textStyle: { color: chartMutedTextColor },
      },
    ],
    xAxis: {
      type: "category",
      data: ordersOverTime.map((p) => p.date),
      boundaryGap: false,
      axisLabel: {
        color: chartMutedTextColor,
        fontSize: 11,
        formatter: formatTimelineLabel,
      },
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
    series: [
      {
        name: "Órdenes",
        type: "line",
        smooth: 0.4,
        showSymbol: false,
        lineStyle: { width: 2, color: chartSeriesColor },
        itemStyle: { color: chartSeriesColor },
        areaStyle: {
          opacity: 1,
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: withAlpha(chartSeriesColor, 0.22) },
              { offset: 1, color: withAlpha(chartSeriesColor, 0.02) },
            ],
          },
        },
        emphasis: { focus: "series" },
        markLine: {
          silent: true,
          symbol: "none",
          label: {
            color: chartMutedTextColor,
            formatter: "Promedio: {c}",
            fontSize: 11,
            // Inside the plot: at the line's end it was clipped by the card edge.
            position: "insideEndTop",
          },
          lineStyle: { type: "dashed", color: chartMutedTextColor, width: 1 },
          data: [{ type: "average", name: "Promedio" }],
        },
        data: ordersOverTime.map((p) => p.count),
      },
    ],
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
        const label = formatTimelineLabel(
          first?.axisValueLabel ?? first?.axisValue ?? "",
        );
        return `${label}<br/><strong>${formatCurrency(Number(first?.data ?? 0))}</strong>`;
      },
    },
    grid: { left: 20, right: 20, top: 20, bottom: 50, containLabel: true },
    xAxis: {
      type: "category",
      data: ordersOverTime.map((p) => p.date),
      axisLabel: {
        color: chartMutedTextColor,
        fontSize: 11,
        formatter: formatTimelineLabel,
      },
      axisLine: { lineStyle: { color: chartGridColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: chartMutedTextColor,
        fontSize: 11,
        formatter: (v: number) => formatCurrency(v),
      },
      splitLine: { lineStyle: { color: chartGridColor, type: "dashed" } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: "Ingresos",
        type: "bar",
        barMaxWidth: 38,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: chartSeriesColor },
        emphasis: { focus: "series" },
        data: ordersOverTime.map((p) => p.revenue),
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
      formatter: (params: any) =>
        `${params?.name ?? ""}<br/><strong>${params?.value ?? 0}</strong> uds. (${params?.percent ?? 0}%)`,
    },
    legend: { bottom: 0, textStyle: { color: chartMutedTextColor } },
    series: donutSeries(
      topProducts.map((p) => ({ name: p.name, value: p.total_sold })),
      CHART_COLORS,
    ),
  });

  const topProductsByRevenueOptions = $derived<EChartsOption>({
    tooltip: {
      trigger: "item",
      backgroundColor: chartTooltipBackground,
      borderColor: chartTooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartTooltipTextColor, fontWeight: 600 },
      formatter: (params: any) =>
        `${params?.name ?? ""}<br/><strong>${formatCurrency(Number(params?.value ?? 0))}</strong> (${params?.percent ?? 0}%)`,
    },
    legend: { bottom: 0, textStyle: { color: chartMutedTextColor } },
    series: donutSeries(
      topProducts.map((p) => ({ name: p.name, value: p.total_value })),
      CHART_COLORS,
      (name, value) => `${name}: ${formatCurrency(value)}`,
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

      const previous = previousRange(start, end);
      // The comparison is a nice-to-have: never let it fail the page.
      const previousRequest = getAnalyticsDashboard(
        previous.start,
        previous.end,
        groupBy,
        1,
      ).catch(() => null);
      const dashboard = await getAnalyticsDashboard(start, end, groupBy, 10);

      overview = dashboard.overview;
      previousOverview = null;
      void previousRequest.then((result) => {
        previousOverview = result?.overview ?? null;
      });
      ordersOverTime = dashboard.orders_over_time;
      topProducts = dashboard.top_products;
    } catch (err) {
      error =
        err instanceof Error ? err.message : "No se pudo cargar la analítica";
    } finally {
      loading = false;
    }
  }

  function todayISO() {
    return storeTodayISO();
  }

  function getPeriodStart(p: "week" | "month" | "year") {
    return lastDays(p === "week" ? 7 : p === "month" ? 30 : 365).start;
  }

  onMount(() => {
    syncChartThemeColors();
    applyRangePreset(quickRangeConfig[quickRange].days as 7 | 30 | 90 | 365);
    period = quickRangeConfig[quickRange].period;
    window.addEventListener("themechange", syncChartThemeColors);
    void fetchAnalytics();
    return () =>
      window.removeEventListener("themechange", syncChartThemeColors);
  });
</script>

<section class="space-y-4 md:space-y-6">
  <!-- Header -->
  <div class="card bg-base-100 shadow">
    <div class="card-body gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="card-title shrink-0 mr-1">Analítica de órdenes</h2>

        <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>

        <!-- Quick range: segmented join for compactness -->
        <div class="join">
          {#each Object.entries(quickRangeConfig) as [key, cfg]}
            <button
              class="btn btn-sm join-item"
              class:btn-primary={quickRange === key && !useCustomRange}
              class:btn-ghost={quickRange !== key || useCustomRange}
              onclick={() => setQuickRange(key as "7d" | "30d" | "90d" | "1y")}
              >{cfg.label}</button
            >
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- Body -->
  <div class="card bg-base-100 shadow">
    <div class="card-body gap-4">
      {#if error}
        <div class="alert alert-warning"><span>{error}</span></div>
      {/if}

      <!-- Controls row -->
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="card-title shrink-0 mr-1">Tendencias</h2>

        <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>

        <!-- Group by -->
        <div class="join">
          {#each [["day", "Día"], ["week", "Semana"], ["month", "Mes"]] as [val, lbl]}
            <button
              class="btn btn-sm join-item"
              class:btn-primary={groupBy === val}
              class:btn-ghost={groupBy !== val}
              onclick={() => {
                groupBy = val as "day" | "week" | "month";
              }}>{lbl}</button
            >
          {/each}
        </div>

        <!-- Custom range toggle -->
        <label class="flex cursor-pointer items-center gap-2 w-fit">
          <input
            type="checkbox"
            class="toggle toggle-primary toggle-sm"
            checked={useCustomRange}
            onchange={(e) =>
              toggleCustomRange((e.currentTarget as HTMLInputElement).checked)}
          />
          <span class="text-sm">Rango personalizado</span>
        </label>

        <button
          class="btn btn-sm btn-primary gap-2 shrink-0 sm:ml-auto"
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
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label class="flex items-center gap-3">
            <span class="w-24 shrink-0 text-sm font-medium text-ink-muted"
              >Fecha inicio</span
            >
            <input
              id="analytics-start-date"
              type="date"
              class="input input-sm input-bordered w-full"
              bind:value={startDate}
            />
          </label>
          <label class="flex items-center gap-3">
            <span class="w-24 shrink-0 text-sm font-medium text-ink-muted"
              >Fecha fin</span
            >
            <input
              id="analytics-end-date"
              type="date"
              class="input input-sm input-bordered w-full"
              bind:value={endDate}
            />
          </label>
        </div>
      {/if}

      <!-- KPI cards -->
      {#if loading}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          {#each Array(3) as _}
            <div class="stat bg-base-200/30 rounded-box py-3 animate-pulse">
              <div class="h-3 bg-base-300 rounded w-20 mb-3"></div>
              <div class="h-7 bg-base-300 rounded w-28"></div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="stat rounded-box border-0 bg-base-200 py-3">
            <div class="stat-title text-xs">Órdenes</div>
            <div class="stat-value text-2xl tabular-nums">
              {overview?.total_orders ?? 0}
            </div>
            <div class="stat-desc text-xs">{getActivePeriodDescription()}</div>
            {@render deltaLine(ordersDelta)}
          </div>
          <div class="stat rounded-box border-0 bg-base-200 py-3">
            <div class="stat-title text-xs">Ingresos</div>
            <div class="stat-value text-2xl tabular-nums">
              {formatCurrency(overview?.total_revenue ?? 0)}
            </div>
            <div class="stat-desc text-xs">Sin órdenes canceladas</div>
            {@render deltaLine(revenueDelta)}
          </div>
          <div class="stat rounded-box border-0 bg-base-200 py-3">
            <div class="stat-title text-xs">Ticket promedio</div>
            <div class="stat-value text-2xl tabular-nums">
              {formatCurrency(overview?.avg_order_value ?? 0)}
            </div>
            <div class="stat-desc text-xs">Por orden completada</div>
            {@render deltaLine(ticketDelta)}
          </div>
        </div>
      {/if}

      <!-- Charts -->
      {#if loading}
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {#each Array(5) as _}
            <div class="card bg-base-100 shadow">
              <div class="card-body">
                <div class="h-4 bg-base-200 rounded w-36 mb-4"></div>
                <div
                  class="h-72 bg-base-200/60 rounded-xl animate-pulse flex items-center justify-center"
                >
                  <span
                    class="loading loading-spinner loading-md text-base-content/20"
                  ></span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else if ordersOverTime.length === 0 && topProducts.length === 0}
        <!-- Empty state -->
        <div
          class="flex flex-col items-center justify-center py-16 text-center gap-3"
        >
          <div
            class="w-16 h-16 rounded-full bg-base-300/50 flex items-center justify-center"
          >
            <Icon icon="lucide:bar-chart-2" class="h-8 w-8 text-ink-muted" />
          </div>
          <p class="font-medium text-ink-muted">
            Sin datos para el periodo seleccionado
          </p>
          <p class="text-sm text-ink-muted max-w-xs">
            Cambia el rango de fechas o espera a que se registren nuevas
            órdenes.
          </p>
        </div>
      {:else}
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div class="card bg-base-100 shadow">
            <div class="card-body">
              <h4 class="text-sm font-semibold flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-primary inline-block"
                ></span>
                Órdenes en el tiempo
              </h4>
              <div class="h-72 w-full md:h-80">
                <Chart {init} options={ordersChartOptions} />
              </div>
            </div>
          </div>

          <div class="card bg-base-100 shadow">
            <div class="card-body">
              <h4 class="text-sm font-semibold flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-success inline-block"
                ></span>
                Ingresos en el tiempo
              </h4>
              <div class="h-72 w-full md:h-80">
                <Chart {init} options={revenueChartOptions} />
              </div>
            </div>
          </div>

          <div class="card bg-base-100 shadow">
            <div class="card-body">
              <h4 class="text-sm font-semibold flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-warning inline-block"
                ></span>
                Productos más vendidos
                {#if topProducts.length > 0}
                  <span class="badge badge-ghost badge-xs ml-auto"
                    >Top {topProducts.length}</span
                  >
                {/if}
              </h4>
              {#if topProducts.length === 0}
                <div
                  class="h-72 flex items-center justify-center text-sm text-ink-muted"
                >
                  Sin datos de productos
                </div>
              {:else}
                <div class="h-72 w-full md:h-80">
                  <Chart {init} options={topProductsOptions} />
                </div>
              {/if}
            </div>
          </div>

          <div class="card bg-base-100 shadow">
            <div class="card-body">
              <h4 class="text-sm font-semibold flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-info inline-block"
                ></span>
                Órdenes por estado
              </h4>
              {#if !overview?.status_breakdown || Object.keys(overview.status_breakdown).length === 0}
                <div
                  class="h-72 flex items-center justify-center text-sm text-ink-muted"
                >
                  Sin datos de estados
                </div>
              {:else}
                <div class="h-72 w-full md:h-80">
                  <Chart {init} options={statusPieOptions} />
                </div>
              {/if}
            </div>
          </div>

          <div class="card bg-base-100 shadow">
            <div class="card-body">
              <h4 class="text-sm font-semibold flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-secondary inline-block"
                ></span>
                Ingresos por método de pago
              </h4>
              {#if !overview?.payment_method_breakdown || Object.keys(overview.payment_method_breakdown).length === 0}
                <div
                  class="h-72 flex items-center justify-center text-sm text-ink-muted"
                >
                  Sin datos de métodos de pago
                </div>
              {:else}
                <div class="h-72 w-full md:h-80">
                  <Chart {init} options={paymentMethodPieOptions} />
                </div>
              {/if}
            </div>
          </div>

          <div class="card bg-base-100 shadow">
            <div class="card-body">
              <h4 class="text-sm font-semibold flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-accent inline-block"
                ></span>
                Productos por ingresos
                {#if topProducts.length > 0}
                  <span class="badge badge-ghost badge-xs ml-auto"
                    >Top {topProducts.length}</span
                  >
                {/if}
              </h4>
              {#if topProducts.length === 0}
                <div
                  class="h-72 flex items-center justify-center text-sm text-ink-muted"
                >
                  Sin datos de productos
                </div>
              {:else}
                <div class="h-72 w-full md:h-80">
                  <Chart {init} options={topProductsByRevenueOptions} />
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</section>

{#snippet deltaLine(change: Delta | null)}
  {#if change}
    <div
      class={`stat-desc mt-1 flex items-center gap-1 text-xs font-medium ${change.direction === "up" ? "text-success" : change.direction === "down" ? "text-error" : "text-ink-muted"}`}
    >
      <Icon
        icon={change.direction === "up"
          ? "lucide:trending-up"
          : change.direction === "down"
            ? "lucide:trending-down"
            : "lucide:minus"}
        class="size-3.5"
        aria-hidden="true"
      />
      {change.label}
    </div>
  {/if}
{/snippet}
