<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import { Chart } from "svelte-echarts";
  import { init, use } from "echarts/core";
  import { BarChart, PieChart } from "echarts/charts";
  import {
    GridComponent,
    LegendComponent,
    TitleComponent,
    TooltipComponent,
  } from "echarts/components";
  import { CanvasRenderer } from "echarts/renderers";
  import type { EChartsOption } from "echarts";
  import {
    getInventoryDashboard,
    recordInventoryEntry,
    recordUnitInventoryEntry,
    recordInventoryAdjustment,
    getInventoryMovements,
    listContainerTypes,
    createContainerType,
    updateContainerType,
    deleteContainerType,
    type InventoryItem,
    type InventoryStats,
    type StockMovement,
    type ContainerType,
  } from "@features/admin-management/lib/bff";
  import { type Flavor, type Addon } from "@features/admin-management/lib/api";
  import InventoryEntryDialog from "./InventoryEntryDialog.svelte";
  import InventoryAdjustmentDialog from "./InventoryAdjustmentDialog.svelte";
  import ContainerTypesDialog from "./ContainerTypesDialog.svelte";
  import InventoryMovementsDialog from "./InventoryMovementsDialog.svelte";
  import GlobalFlavorsManager from "@features/products/components/admin/GlobalFlavorsManager.svelte";
  import GlobalAddonsManager from "@features/products/components/admin/GlobalAddonsManager.svelte";
  import {
    getAdminLocalSettings,
    getCurrentAdminId,
    getCurrentRowsPerTable,
    saveAdminRowsPerTable,
    getInventoryFilterState,
    saveInventoryFilterState,
    type InventoryStockFilter,
    type InventoryTypeFilter,
  } from "@features/admin-management/lib/local-settings";

  use([
    TitleComponent,
    CanvasRenderer,
    PieChart,
    BarChart,
    GridComponent,
    LegendComponent,
    TooltipComponent,
  ]);

  interface Props {
    busy?: boolean;
    moduleError?: string;
    flavors?: Flavor[];
    addons?: Addon[];
    flavorBusy?: boolean;
    addonBusy?: boolean;
    flavorError?: string;
    addonError?: string;
    onCreateFlavor?: (payload: { name: string; is_seasonal: boolean }) => void;
    onUpdateFlavor?: (
      id: string,
      payload: {
        name: string;
        display_order: number;
        is_seasonal: boolean;
        is_active: boolean;
      },
    ) => void;
    onDeleteFlavor?: (id: string) => void;
    onCreateAddon?: (payload: {
      name: string;
      price: number;
      group_name: string;
    }) => void;
    onUpdateAddon?: (
      id: string,
      payload: {
        name: string;
        price: number;
        group_name: string;
        display_order: number;
        is_active: boolean;
      },
    ) => void;
    onDeleteAddon?: (id: string) => void;
  }

  let {
    busy = false,
    moduleError = "",
    flavors = [],
    addons = [],
    flavorBusy = false,
    addonBusy = false,
    flavorError = "",
    addonError = "",
    onCreateFlavor = () => {},
    onUpdateFlavor = () => {},
    onDeleteFlavor = () => {},
    onCreateAddon = () => {},
    onUpdateAddon = () => {},
    onDeleteAddon = () => {},
  }: Props = $props();

  let inventoryFlavors = $state<InventoryItem[]>([]);
  let unitItems = $state<InventoryItem[]>([]);
  let stats = $state<InventoryStats | null>(null);
  let movements = $state<StockMovement[]>([]);
  let loading = $state(false);
  let error = $state("");
  let selectedItem = $state<InventoryItem | null>(null);
  let showEntryDialog = $state(false);
  let showAdjustment = $state(false);
  let showMovements = $state(false);
  let showContainerTypes = $state(false);
  let showGlobalFlavors = $state(false);
  let showGlobalAddons = $state(false);
  let tableFilter = $state<InventoryStockFilter>("all");
  let tableTypeFilter = $state<InventoryTypeFilter>("all");
  let searchQuery = $state("");

  const normalizedSearchQuery = $derived(searchQuery.trim().toLowerCase());

  $effect(() => {
    const adminId = getCurrentAdminId();
    if (!adminId) return;
    saveInventoryFilterState(adminId, {
      stockFilter: tableFilter,
      typeFilter: tableTypeFilter,
    });
  });

  let containerTypes = $state<ContainerType[]>([]);
  let containerTypesLoading = $state(false);

  const rowLimitOptions = [5, 10, 25, 50, 100] as const;
  let rowLimit = $state<number>(getCurrentRowsPerTable("inventario"));

  const rowLimitLabel = $derived(rowLimit <= 0 ? "Todos" : String(rowLimit));

  function setRowLimit(limit: number) {
    rowLimit = limit;
    const adminId = getCurrentAdminId();
    if (!adminId) return;
    const current = getAdminLocalSettings(adminId);
    saveAdminRowsPerTable(adminId, {
      ...current.rows_per_table,
      inventario: limit,
    });
  }

  const visibleItems = $derived(
    rowLimit <= 0 ? filteredItems() : filteredItems().slice(0, rowLimit),
  );

  // Chart theme colors
  let chartTextColor = $state("#d1d5db");
  let chartMutedTextColor = $state("#9ca3af");
  let chartGridColor = $state("rgba(148, 163, 184, 0.25)");
  let chartTooltipBackground = $state("#111827");
  let chartTooltipBorder = $state("rgba(148, 163, 184, 0.35)");
  let chartTooltipTextColor = $state("#f8fafc");

  function syncChartThemeColors() {
    if (typeof window === "undefined") return;
    const isDark =
      (document.documentElement.getAttribute("data-theme") || "night") ===
      "night";
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

  // Chart data
  const flavorItems = $derived<InventoryItem[]>(
    (() => {
      const byFlavorId = new Map(
        inventoryFlavors.map((item) => [item.flavor_id, item]),
      );
      return flavors.map((flavor) => {
        const existing = byFlavorId.get(flavor.id);
        if (existing) {
          return { ...existing, name: flavor.name };
        }
        return {
          id: flavor.id,
          name: flavor.name,
          type: "ball_based" as const,
          current_stock: 0,
          low_stock_threshold: 0,
          flavor_id: flavor.id,
          created_at: flavor.created_at ?? new Date().toISOString(),
          updated_at: flavor.created_at ?? new Date().toISOString(),
        };
      });
    })(),
  );

  const allItems = $derived([...flavorItems, ...unitItems]);

  const okCount = $derived(
    allItems.filter((item) => getStockStatus(item).label === "OK").length,
  );

  const lowStockCount = $derived(
    allItems.filter((item) => getStockStatus(item).label === "Stock bajo")
      .length,
  );

  const outOfStockCount = $derived(
    allItems.filter((item) => getStockStatus(item).label === "Agotado").length,
  );

  const filteredItems = $derived(() => {
    return allItems.filter((item) => {
      const status = getStockStatus(item);
      const passesSearch =
        !normalizedSearchQuery ||
        item.name.toLowerCase().includes(normalizedSearchQuery);
      const passesStockFilter =
        tableFilter === "all" ||
        (tableFilter === "ok" && status.label === "OK") ||
        (tableFilter === "low-stock" && status.label === "Stock bajo") ||
        (tableFilter === "out-of-stock" && status.label === "Agotado");
      const passesTypeFilter =
        tableTypeFilter === "all" ||
        (tableTypeFilter === "flavor" && item.type === "ball_based") ||
        (tableTypeFilter === "unit" && item.type === "unit_based");
      return passesSearch && passesStockFilter && passesTypeFilter;
    });
  });

  const statusBreakdown = $derived(() => {
    const result = [
      { name: "Agotado", value: 0, color: "#ef4444" },
      { name: "Stock bajo", value: 0, color: "#f59e0b" },
      { name: "OK", value: 0, color: "#22c55e" },
    ];
    for (const item of allItems) {
      const s = getStockStatus(item);
      if (s.label === "Agotado") result[0].value++;
      else if (s.label === "Stock bajo") result[1].value++;
      else result[2].value++;
    }
    return result.filter((d) => d.value > 0);
  });

  const sortedItemsByStock = $derived(
    [...allItems]
      .sort((a, b) => (a.current_stock ?? 0) - (b.current_stock ?? 0))
      .slice(0, 15),
  );

  const stockStatusPieOptions = $derived<EChartsOption>({
    tooltip: {
      trigger: "item",
      backgroundColor: chartTooltipBackground,
      borderColor: chartTooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartTooltipTextColor, fontWeight: 600 },
      formatter: (params: any) =>
        `${params?.name ?? ""}<br/><strong>${params?.value ?? 0}</strong> items (${params?.percent ?? 0}%)`,
    },
    legend: { bottom: 0, textStyle: { color: chartMutedTextColor } },
    series: [
      {
        type: "pie",
        radius: ["42%", "68%"],
        center: ["50%", "46%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: "transparent",
          borderWidth: 2,
        },
        label: {
          show: true,
          color: chartTextColor,
          textBorderWidth: 0,
          fontSize: 12,
          fontWeight: 600,
          formatter: "{b}: {c}",
        },
        labelLine: {
          lineStyle: { color: chartMutedTextColor, width: 1.2 },
        },
        emphasis: {
          scale: true,
          scaleSize: 7,
          itemStyle: { shadowBlur: 14, shadowColor: "rgba(0,0,0,0.25)" },
        },
        data: statusBreakdown().map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.color },
        })),
      },
    ],
  });

  const stockLevelsBarOptions = $derived<EChartsOption>({
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: chartTooltipBackground,
      borderColor: chartTooltipBorder,
      borderWidth: 1,
      textStyle: { color: chartTooltipTextColor, fontWeight: 600 },
    },
    grid: { left: 20, right: 20, top: 20, bottom: 20, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: { color: chartMutedTextColor, fontSize: 11 },
      splitLine: { lineStyle: { color: chartGridColor, type: "dashed" } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      data: sortedItemsByStock.map((i) => i.name),
      axisLabel: { color: chartMutedTextColor, fontSize: 11 },
      axisLine: { lineStyle: { color: chartGridColor } },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 20,
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: (params: any) => {
            const item = sortedItemsByStock[params.dataIndex];
            const status = getStockStatus(item);
            if (status.label === "Agotado") return "#ef4444";
            if (status.label === "Stock bajo") return "#f59e0b";
            return "#22c55e";
          },
        },
        data: sortedItemsByStock.map((i) => i.current_stock ?? 0),
      },
    ],
  });

  async function loadContainerTypes() {
    containerTypesLoading = true;
    try {
      containerTypes = await listContainerTypes();
    } catch (e) {
      error =
        e instanceof Error ? e.message : "Error cargando tipos de recipiente";
    } finally {
      containerTypesLoading = false;
    }
  }

  async function loadInventory() {
    if (loading) return;
    loading = true;
    error = "";
    try {
      const dashboard = await getInventoryDashboard();

      inventoryFlavors = (dashboard?.flavor_items ?? []).map((item: any) => ({
        ...item,
        current_stock: item.current_stock ?? 0,
        low_stock_threshold: item.low_stock_threshold ?? 0,
      }));

      unitItems = (dashboard?.unit_items ?? []).map((item: any) => ({
        ...item,
        current_stock: item.current_stock ?? 0,
        low_stock_threshold: item.low_stock_threshold ?? 0,
      }));

      stats = dashboard?.stats ?? null;
    } catch (e) {
      error = e instanceof Error ? e.message : "Error cargando inventario";
    } finally {
      loading = false;
    }
  }

  async function handleEntry(payload: {
    type: "flavor" | "unit";
    flavor_id?: string;
    container_type_id?: string;
    quantity_containers?: number;
    balls_per_container?: number;
    inventory_item_id?: string;
    quantity?: number;
  }) {
    try {
      if (payload.type === "flavor" && payload.flavor_id) {
        await recordInventoryEntry(payload.flavor_id, {
          container_type_id: payload.container_type_id ?? "",
          quantity_containers: payload.quantity_containers ?? 0,
          balls_per_container: payload.balls_per_container,
        });
      } else if (payload.type === "unit" && payload.inventory_item_id) {
        await recordUnitInventoryEntry(payload.inventory_item_id, {
          quantity: payload.quantity ?? 0,
        });
      }
      showEntryDialog = false;
      await loadInventory();
    } catch (e) {
      error = e instanceof Error ? e.message : "Error registrando entrada";
    }
  }

  async function handleAdjustment(payload: {
    quantity: number;
    reason: string;
  }) {
    if (!selectedItem) return;
    try {
      await recordInventoryAdjustment(selectedItem.id, payload);
      showAdjustment = false;
      await loadInventory();
    } catch (e) {
      error = e instanceof Error ? e.message : "Error registrando ajuste";
    }
  }

  async function loadMovements(item: InventoryItem) {
    selectedItem = item;
    movements = [];
    try {
      const res = await getInventoryMovements(item.id, 50, 0);
      movements = res.movements;
      showMovements = true;
    } catch (e) {
      error = e instanceof Error ? e.message : "Error cargando movimientos";
    }
  }

  function openEntry() {
    if (containerTypes.length === 0) {
      loadContainerTypes();
    }
    showEntryDialog = true;
  }

  function openAdjustment(item: InventoryItem) {
    selectedItem = item;
    showAdjustment = true;
  }

  function openContainerTypes() {
    loadContainerTypes();
    showContainerTypes = true;
  }

  function openGlobalFlavors() {
    showGlobalFlavors = true;
  }

  function closeGlobalFlavors() {
    showGlobalFlavors = false;
  }

  function openGlobalAddons() {
    showGlobalAddons = true;
  }

  function closeGlobalAddons() {
    showGlobalAddons = false;
  }

  function getStockStatus(item: InventoryItem): {
    label: string;
    class: string;
  } {
    const stock = item.current_stock ?? 0;
    const threshold = item.low_stock_threshold ?? 0;
    if (stock <= 0) {
      return { label: "Agotado", class: "badge-error" };
    }
    if (stock <= threshold) {
      return { label: "Stock bajo", class: "badge-warning" };
    }
    return { label: "OK", class: "badge-success" };
  }

  async function handleContainerTypeCreate(payload: {
    name: string;
    balls_per_container: number;
    is_custom: boolean;
  }) {
    try {
      await createContainerType(payload);
      await loadContainerTypes();
    } catch (e) {
      error = e instanceof Error ? e.message : "Error creando tipo";
    }
  }

  async function handleContainerTypeUpdate(
    id: string,
    payload: {
      name?: string;
      balls_per_container?: number;
      is_custom?: boolean;
    },
  ) {
    try {
      await updateContainerType(id, payload);
      await loadContainerTypes();
    } catch (e) {
      error = e instanceof Error ? e.message : "Error actualizando tipo";
    }
  }

  async function handleContainerTypeDelete(id: string) {
    try {
      await deleteContainerType(id);
      await loadContainerTypes();
    } catch (e) {
      error = e instanceof Error ? e.message : "Error eliminando tipo";
    }
  }

  onMount(() => {
    syncChartThemeColors();
    window.addEventListener("themechange", syncChartThemeColors);

    const adminId = getCurrentAdminId();
    if (adminId) {
      const filterState = getInventoryFilterState(adminId);
      tableFilter = filterState.stockFilter;
      tableTypeFilter = filterState.typeFilter;
      rowLimit = getCurrentRowsPerTable("inventario");
    }

    void loadInventory();
    return () =>
      window.removeEventListener("themechange", syncChartThemeColors);
  });
</script>

<section class="space-y-4 md:space-y-6">
  {#if moduleError || error}
    <div class="alert alert-warning"><span>{moduleError || error}</span></div>
  {/if}

  <!-- Card 1: Resumen de Inventario -->
  <div class="card bg-base-100 shadow">
    <div class="card-body gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="card-title shrink-0 mr-1">Resumen de Inventario</h2>

        <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>

        <button
          class="btn btn-sm btn-outline gap-2"
          onclick={openGlobalFlavors}
          disabled={loading || busy}
        >
          <Icon icon="lucide:ice-cream-bowl" class="h-4 w-4" />
          Sabores
        </button>
        <button
          class="btn btn-sm btn-outline gap-2"
          onclick={openGlobalAddons}
          disabled={loading || busy}
        >
          <Icon icon="lucide:puzzle" class="h-4 w-4" />
          Complementos
        </button>
        <button
          class="btn btn-sm btn-ghost btn-square shrink-0 sm:ml-auto"
          type="button"
          onclick={loadInventory}
          disabled={loading}
          aria-label="Actualizar inventario"
          title="Actualizar inventario"
        >
          {#if loading}
            <span class="loading loading-spinner loading-xs"></span>
          {:else}
            <Icon icon="lucide:refresh-cw" class="h-4 w-4" />
          {/if}
        </button>
      </div>

      {#if stats}
        <div class="px-4 pb-4">
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div class="stat bg-base-200/30 rounded-box py-3">
              <div class="stat-figure text-info">
                <Icon icon="lucide:ice-cream-cone" class="h-6 w-6" />
              </div>
              <div class="stat-title text-xs">Sabores</div>
              <div class="stat-value text-info text-2xl">
                {stats.ball_based_items}
              </div>
            </div>
            <div class="stat bg-base-200/30 rounded-box py-3">
              <div class="stat-figure text-secondary">
                <Icon icon="lucide:box" class="h-6 w-6" />
              </div>
              <div class="stat-title text-xs">Unitarios</div>
              <div class="stat-value text-secondary text-2xl">
                {stats.unit_based_items}
              </div>
            </div>
            <div class="stat bg-base-200/30 rounded-box py-3">
              <div class="stat-figure text-error">
                <Icon icon="lucide:alert-triangle" class="h-6 w-6" />
              </div>
              <div class="stat-title text-xs">Agotados</div>
              <div class="stat-value text-error text-2xl">
                {stats.out_of_stock_items}
              </div>
              {#if stats.out_of_stock_items > 0}
                <div class="stat-desc text-error text-xs">
                  Requiere atención
                </div>
              {/if}
            </div>
            <div class="stat bg-base-200/30 rounded-box py-3">
              <div class="stat-figure text-warning">
                <Icon icon="lucide:alert-circle" class="h-6 w-6" />
              </div>
              <div class="stat-title text-xs">Stock Bajo</div>
              <div class="stat-value text-warning text-2xl">
                {stats.low_stock_items}
              </div>
              {#if stats.low_stock_items > 0}
                <div class="stat-desc text-warning text-xs">
                  Requiere atención
                </div>
              {/if}
            </div>
            <div class="stat bg-base-200/30 rounded-box py-3">
              <div class="stat-figure text-success">
                <Icon icon="lucide:check-circle" class="h-6 w-6" />
              </div>
              <div class="stat-title text-xs">OK</div>
              <div class="stat-value text-success text-2xl">
                {stats.healthy_items}
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if !loading && allItems.length > 0}
        <div class="px-4 pb-4">
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="card bg-base-100 shadow">
              <div class="card-body">
                <h4 class="text-sm font-semibold flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-info inline-block"
                  ></span>
                  Distribución de stock
                </h4>
                <div class="h-64 w-full md:h-72">
                  <Chart {init} options={stockStatusPieOptions} />
                </div>
              </div>
            </div>

            <div class="card bg-base-100 shadow">
              <div class="card-body">
                <h4 class="text-sm font-semibold flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-warning inline-block"
                  ></span>
                  Niveles de stock (más bajos)
                </h4>
                <div class="h-64 w-full md:h-72">
                  <Chart {init} options={stockLevelsBarOptions} />
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Card 2: Gestión de Stock -->
    <div class="card bg-base-100 shadow">
      <div class="card-body gap-4">
        <!-- Toolbar -->
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="card-title shrink-0 mr-1">Sabores y Unitarios</h2>

          <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>

          <input
            class="input input-sm input-bordered w-full sm:w-36 md:w-44 lg:w-52"
            type="text"
            placeholder="Buscar item"
            value={searchQuery}
            oninput={(event) =>
              (searchQuery = (event.currentTarget as HTMLInputElement).value)}
          />

          <!-- Stock filter -->
          <div class="join">
            <button
              class="btn btn-sm join-item"
              class:btn-primary={tableFilter === "all"}
              class:btn-ghost={tableFilter !== "all"}
              onclick={() => (tableFilter = "all")}
            >
              Todos
            </button>
            <button
              class="btn btn-sm join-item"
              class:btn-primary={tableFilter === "ok"}
              class:btn-ghost={tableFilter !== "ok"}
              onclick={() => (tableFilter = "ok")}
            >
              OK
              {#if okCount > 0}
                <span class="badge badge-sm badge-success ml-1">{okCount}</span>
              {/if}
            </button>
            <button
              class="btn btn-sm join-item"
              class:btn-primary={tableFilter === "low-stock"}
              class:btn-ghost={tableFilter !== "low-stock"}
              onclick={() => (tableFilter = "low-stock")}
            >
              Stock bajo
              {#if lowStockCount > 0}
                <span class="badge badge-sm badge-warning ml-1"
                  >{lowStockCount}</span
                >
              {/if}
            </button>
            <button
              class="btn btn-sm join-item"
              class:btn-primary={tableFilter === "out-of-stock"}
              class:btn-ghost={tableFilter !== "out-of-stock"}
              onclick={() => (tableFilter = "out-of-stock")}
            >
              Agotado
              {#if outOfStockCount > 0}
                <span class="badge badge-sm badge-error ml-1"
                  >{outOfStockCount}</span
                >
              {/if}
            </button>
          </div>

          <button
            class="btn btn-sm btn-outline shrink-0 gap-2 sm:ml-auto"
            onclick={openContainerTypes}
            disabled={loading || busy}
          >
            <Icon icon="lucide:container" class="h-4 w-4" />
            Contenedores
          </button>
          <button
            class="btn btn-sm btn-primary shrink-0 gap-2"
            onclick={openEntry}
            disabled={loading || busy}
          >
            <Icon icon="lucide:plus" class="h-4 w-4" />
            Nueva entrada
          </button>
        </div>

        <!-- Type subtabs -->
        <div class="flex flex-wrap items-center gap-2">
          <div class="join">
            <button
              class="btn btn-sm join-item"
              class:btn-primary={tableTypeFilter === "all"}
              class:btn-ghost={tableTypeFilter !== "all"}
              onclick={() => (tableTypeFilter = "all")}
            >
              Todos ({allItems.length})
            </button>
            <button
              class="btn btn-sm join-item"
              class:btn-primary={tableTypeFilter === "flavor"}
              class:btn-ghost={tableTypeFilter !== "flavor"}
              onclick={() => (tableTypeFilter = "flavor")}
            >
              Sabores ({flavorItems.length})
            </button>
            <button
              class="btn btn-sm join-item"
              class:btn-primary={tableTypeFilter === "unit"}
              class:btn-ghost={tableTypeFilter !== "unit"}
              onclick={() => (tableTypeFilter = "unit")}
            >
              Unitarios ({unitItems.length})
            </button>
          </div>
        </div>

        <!-- Unified table -->
        <div
          class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
        >
          <table class="table table-sm w-full table-fixed">
            <thead class="bg-base-200/60 text-base-content">
              <tr>
                <th class="font-bold w-[34%] sm:w-[38%] lg:w-[40%]">Nombre</th>
                <th class="font-bold w-[14%] sm:w-[12%] lg:w-[10%]">Tipo</th>
                <th class="text-right font-bold w-[20%] sm:w-[18%] lg:w-[16%]">
                  Stock actual
                </th>
                <th class="text-right font-bold w-[12%] sm:w-[10%]">Mínimo</th>
                <th class="font-bold w-[14%] sm:w-[12%]">Estado</th>
                <th class="text-right font-bold w-[16%] sm:w-[14%] lg:w-[12%]">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {#if filteredItems().length === 0}
                <tr>
                  <td colspan="6" class="text-center py-6 text-base-content/50">
                    {#if loading}
                      <span class="loading loading-spinner loading-sm"></span>
                      Cargando inventario...
                    {:else}
                      No se encontraron items con los filtros seleccionados
                    {/if}
                  </td>
                </tr>
              {:else}
                {#each visibleItems as item (item.id)}
                  {@const status = getStockStatus(item)}
                  {@const isFlavor = item.type === "ball_based"}
                  <tr
                    class="hover:bg-base-300/40 transition-colors {status.label ===
                    'Agotado'
                      ? 'bg-error/5'
                      : ''}"
                  >
                    <td class="truncate">
                      <div class="font-medium truncate">{item.name}</div>
                    </td>
                    <td class="whitespace-nowrap">
                      <span
                        class="badge badge-sm {isFlavor
                          ? 'badge-info'
                          : 'badge-secondary'}"
                      >
                        {isFlavor ? "Sabor" : "Unitario"}
                      </span>
                    </td>
                    <td
                      class="text-right font-mono whitespace-nowrap px-1 sm:px-2"
                    >
                      {(item.current_stock ?? 0).toLocaleString()}
                      <span class="text-xs text-base-content/60"
                        >{isFlavor ? "bolas" : "uds"}</span
                      >
                    </td>
                    <td
                      class="text-right text-xs text-base-content/60 whitespace-nowrap px-1 sm:px-2"
                    >
                      {item.low_stock_threshold ?? 0}
                    </td>
                    <td class="whitespace-nowrap">
                      <span class="badge badge-sm {status.class}"
                        >{status.label}</span
                      >
                    </td>
                    <td class="text-right whitespace-nowrap">
                      <div
                        class="flex flex-wrap md:flex-nowrap items-center justify-end gap-1"
                        role="group"
                        aria-label="Acciones de item"
                      >
                        <button
                          class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-accent"
                          type="button"
                          onclick={() => openAdjustment(item)}
                          disabled={loading || busy}
                          aria-label="Ajustar stock"
                          title="Ajustar"
                        >
                          <Icon
                            icon="lucide:sliders-horizontal"
                            class="h-4 w-4"
                          />
                        </button>
                        <button
                          class="btn btn-ghost btn-xs sm:btn-sm btn-square text-base-content/70 hover:text-info"
                          type="button"
                          onclick={() => loadMovements(item)}
                          disabled={loading || busy}
                          aria-label="Ver movimientos"
                          title="Movimientos"
                        >
                          <Icon icon="lucide:clock" class="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-t border-base-300/50 pt-3"
        >
          <span class="text-sm text-base-content/60">
            Mostrando {visibleItems.length} de {filteredItems().length}
          </span>

          <div class="flex items-center gap-2">
            <span class="text-sm text-base-content/60">Filas</span>
            <div class="dropdown w-full sm:w-auto dropdown-top dropdown-end">
              <div
                tabindex="0"
                role="button"
                class="btn btn-sm btn-outline w-full sm:w-24 justify-between"
              >
                {rowLimitLabel}
                <Icon icon="lucide:chevron-down" class="h-4 w-4 opacity-50" />
              </div>
              <ul
                tabindex="-1"
                class="dropdown-content menu bg-base-100 rounded-box z-100 w-full sm:w-32 p-2 mb-1 shadow-xl border border-base-300"
              >
                {#each rowLimitOptions as option}
                  <li>
                    <button type="button" onclick={() => setRowLimit(option)}
                      >{option}</button
                    >
                  </li>
                {/each}
                <li>
                  <button type="button" onclick={() => setRowLimit(0)}
                    >Todos</button
                  >
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Dialogs -->
<GlobalFlavorsManager
  open={showGlobalFlavors}
  {flavors}
  busy={flavorBusy}
  error={flavorError}
  onClose={closeGlobalFlavors}
  onCreate={onCreateFlavor}
  onUpdate={onUpdateFlavor}
  onDelete={onDeleteFlavor}
/>

<GlobalAddonsManager
  open={showGlobalAddons}
  {addons}
  busy={addonBusy}
  error={addonError}
  onClose={closeGlobalAddons}
  onCreate={onCreateAddon}
  onUpdate={onUpdateAddon}
  onDelete={onDeleteAddon}
/>

<InventoryEntryDialog
  open={showEntryDialog}
  {containerTypes}
  {flavorItems}
  {unitItems}
  onClose={() => (showEntryDialog = false)}
  onSubmit={handleEntry}
  onOpenContainerTypes={openContainerTypes}
/>

<InventoryAdjustmentDialog
  open={showAdjustment}
  item={selectedItem}
  onClose={() => (showAdjustment = false)}
  onSubmit={handleAdjustment}
/>

<ContainerTypesDialog
  open={showContainerTypes}
  {containerTypes}
  loading={containerTypesLoading}
  onClose={() => (showContainerTypes = false)}
  onCreate={handleContainerTypeCreate}
  onUpdate={handleContainerTypeUpdate}
  onDelete={handleContainerTypeDelete}
/>

<InventoryMovementsDialog
  open={showMovements}
  item={selectedItem}
  {movements}
  onClose={() => (showMovements = false)}
/>
