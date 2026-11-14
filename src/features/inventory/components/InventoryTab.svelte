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
  import { resolveWorkingLocation } from "@features/admin-management/lib/location-selection";
  import {
    listLocations,
    type AdminLocation,
  } from "@features/admin-management/lib/bff";
  import {
    getCurrentAdminId,
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
    /** Admins edit flavours, add-ons and container types; managers only stock. */
    canEditCatalog?: boolean;
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
    canEditCatalog = true,
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

  // Location being managed: the staff member's own, or the admin's header
  // choice. null = admin on "Todas": stock is shown side by side per location.
  let workingLocation = $state<AdminLocation | null>(null);
  let allLocations = $state<AdminLocation[]>([]);
  let locationResolved = $state(false);
  const isAllView = $derived(locationResolved && !workingLocation);
  let showCharts = $state(false);
  let entryPreselect = $state<{ type: "flavor" | "unit"; id: string } | null>(
    null,
  );

  const SEVERITY: Record<string, number> = {
    Agotado: 0,
    "Stock bajo": 1,
    OK: 2,
  };

  /** Most urgent first (agotado, stock bajo), then by name. */
  const visibleItems = $derived(
    [...filteredItems()].sort(
      (a, b) =>
        SEVERITY[getStockStatus(a).label] - SEVERITY[getStockStatus(b).label] ||
        a.name.localeCompare(b.name, "es"),
    ),
  );

  /** "Todas": one row per flavour/product, one column per location. */
  const stockMatrix = $derived.by(() => {
    const rows = new Map<
      string,
      {
        key: string;
        name: string;
        type: "ball_based" | "unit_based";
        byLocation: Record<string, InventoryItem>;
      }
    >();
    // Every flavour gets a row, so untracked locations show as "—".
    for (const flavor of flavors) {
      rows.set(flavor.id, {
        key: flavor.id,
        name: flavor.name,
        type: "ball_based",
        byLocation: {},
      });
    }
    for (const item of [...inventoryFlavors, ...unitItems]) {
      const key = item.flavor_id ?? item.product_id ?? item.id;
      const row = rows.get(key) ?? {
        key,
        name: flavors.find((f) => f.id === item.flavor_id)?.name ?? item.name,
        type: item.type,
        byLocation: {},
      };
      if (item.location_id) row.byLocation[item.location_id] = item;
      rows.set(key, row);
    }
    const term = normalizedSearchQuery;
    return [...rows.values()]
      .filter((r) => !term || r.name.toLowerCase().includes(term))
      .sort((a, b) =>
        a.type === b.type
          ? a.name.localeCompare(b.name, "es")
          : a.type === "ball_based"
            ? -1
            : 1,
      );
  });

  function stockBarPercent(item: InventoryItem): number {
    const target = Math.max((item.low_stock_threshold ?? 0) * 2, 1);
    return Math.min(
      100,
      Math.round(((item.current_stock ?? 0) / target) * 100),
    );
  }

  /** Rows backed by a real inventory item (untracked flavours only take an entry). */
  function isTracked(item: InventoryItem): boolean {
    return (
      unitItems.includes(item) || inventoryFlavors.some((f) => f.id === item.id)
    );
  }

  function openEntryFor(item: InventoryItem) {
    entryPreselect =
      item.type === "ball_based" && item.flavor_id
        ? { type: "flavor", id: item.flavor_id }
        : { type: "unit", id: item.id };
    openEntry();
  }

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

  function openEntryBlank() {
    entryPreselect = null;
    openEntry();
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
    }

    void loadInventory();
    void resolveWorkingLocation()
      .then((location) => (workingLocation = location))
      .catch(() => (workingLocation = null))
      .finally(() => (locationResolved = true));
    void listLocations()
      .then(
        ({ data }) => (allLocations = (data ?? []).filter((l) => l.is_active)),
      )
      .catch(() => (allLocations = []));
    return () =>
      window.removeEventListener("themechange", syncChartThemeColors);
  });
</script>

<section class="space-y-4">
  {#if moduleError || error}
    <div class="alert alert-warning"><span>{moduleError || error}</span></div>
  {/if}

  <!-- Toolbar: where we are, what to do -->
  <div class="card bg-base-100 shadow">
    <div class="card-body gap-4 p-4 sm:p-6">
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0 flex-1">
          <h2 class="card-title flex-wrap">
            Inventario
            {#if workingLocation}
              <span class="font-normal text-base-content/60"
                >· {workingLocation.name}</span
              >
            {:else if isAllView}
              <span class="font-normal text-base-content/60"
                >· Todas las sucursales</span
              >
            {/if}
          </h2>
          <p class="text-sm text-base-content/70">
            {#if isAllView}
              Existencias de cada sucursal. Elige una sucursal arriba para
              registrar entradas o ajustes.
            {:else}
              Registra lo que llega con «Nueva entrada»; las ventas descuentan
              solas al pasar una orden a Preparando.
            {/if}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            class="btn btn-ghost btn-sm btn-square"
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
          {#if canEditCatalog}
            <div class="dropdown dropdown-end">
              <button
                type="button"
                tabindex="0"
                class="btn btn-sm btn-outline gap-2"
                disabled={loading || busy}
              >
                <Icon icon="lucide:settings-2" class="h-4 w-4" />
                Catálogo
                <Icon icon="lucide:chevron-down" class="h-3.5 w-3.5" />
              </button>
              <ul
                class="dropdown-content menu z-20 mt-1 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
              >
                <li>
                  <button type="button" onclick={openGlobalFlavors}>
                    <Icon icon="lucide:ice-cream-bowl" class="h-4 w-4" />
                    Sabores
                  </button>
                </li>
                <li>
                  <button type="button" onclick={openGlobalAddons}>
                    <Icon icon="lucide:puzzle" class="h-4 w-4" />
                    Complementos
                  </button>
                </li>
                <li>
                  <button type="button" onclick={openContainerTypes}>
                    <Icon icon="lucide:container" class="h-4 w-4" />
                    Contenedores
                  </button>
                </li>
              </ul>
            </div>
          {/if}
          {#if !isAllView}
            <button
              class="btn btn-sm btn-primary gap-2"
              type="button"
              onclick={openEntryBlank}
              disabled={loading || busy || !locationResolved}
            >
              <Icon icon="lucide:plus" class="h-4 w-4" />
              Nueva entrada
            </button>
          {/if}
        </div>
      </div>

      {#if !isAllView}
        <!-- Status counters double as filters -->
        <div class="grid grid-cols-3 gap-2 sm:max-w-xl">
          {#each [{ key: "out-of-stock", label: "Agotados", count: outOfStockCount, tone: "text-error", ring: "ring-error/40" }, { key: "low-stock", label: "Stock bajo", count: lowStockCount, tone: "text-warning", ring: "ring-warning/40" }, { key: "ok", label: "OK", count: okCount, tone: "text-success", ring: "ring-success/40" }] as chip (chip.key)}
            {@const active = tableFilter === chip.key}
            <button
              type="button"
              class={`rounded-box border border-base-300 px-3 py-2 text-left transition hover:bg-base-200 ${active ? `ring-2 ${chip.ring}` : ""}`}
              aria-pressed={active}
              onclick={() =>
                (tableFilter = active
                  ? "all"
                  : (chip.key as InventoryStockFilter))}
            >
              <span class={`block text-2xl font-bold tabular-nums ${chip.tone}`}
                >{chip.count}</span
              >
              <span class="text-xs text-base-content/70">{chip.label}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Stock list -->
  <div class="card bg-base-100 shadow">
    <div class="card-body gap-3 p-4 sm:p-6">
      <div class="flex flex-wrap items-center gap-2">
        <label
          class="input input-sm input-bordered flex w-full min-w-0 items-center gap-2 sm:w-auto sm:max-w-xs sm:flex-1"
        >
          <Icon icon="lucide:search" class="h-4 w-4 opacity-60" />
          <input
            type="search"
            class="grow"
            placeholder="Buscar sabor o producto"
            bind:value={searchQuery}
            aria-label="Buscar en inventario"
          />
        </label>
        {#if !isAllView}
          <div class="join" role="group" aria-label="Tipo">
            {#each [{ key: "all", label: `Todos (${allItems.length})` }, { key: "flavor", label: `Sabores (${flavorItems.length})` }, { key: "unit", label: `Unitarios (${unitItems.length})` }] as option (option.key)}
              <button
                type="button"
                class={`btn btn-sm join-item ${tableTypeFilter === option.key ? "btn-primary" : "btn-ghost border-base-300"}`}
                aria-pressed={tableTypeFilter === option.key}
                onclick={() =>
                  (tableTypeFilter = option.key as InventoryTypeFilter)}
                >{option.label}</button
              >
            {/each}
          </div>
          {#if tableFilter !== "all"}
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              onclick={() => (tableFilter = "all")}
            >
              <Icon icon="lucide:x" class="h-4 w-4" /> Quitar filtro
            </button>
          {/if}
        {/if}
      </div>

      {#if loading && allItems.length === 0}
        <div class="space-y-2" aria-hidden="true">
          {#each Array.from({ length: 6 }) as _, i (i)}
            <div class="skeleton h-12 w-full"></div>
          {/each}
        </div>
      {:else if isAllView}
        <div class="overflow-x-auto rounded-box border border-base-300">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Producto</th>
                {#each allLocations as location (location.id)}
                  <th class="text-right">{location.name}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each stockMatrix as row (row.key)}
                <tr>
                  <td>
                    <span class="font-medium">{row.name}</span>
                    <span class="ml-1 text-xs text-base-content/60"
                      >{row.type === "ball_based" ? "Sabor" : "Unitario"}</span
                    >
                  </td>
                  {#each allLocations as location (location.id)}
                    {@const item = row.byLocation[location.id]}
                    <td class="text-right tabular-nums">
                      {#if item}
                        {@const status = getStockStatus(item)}
                        <span
                          class={status.label === "Agotado"
                            ? "font-semibold text-error"
                            : status.label === "Stock bajo"
                              ? "font-semibold text-warning"
                              : ""}
                          title={status.label}
                          >{item.current_stock}{item.type === "ball_based"
                            ? " bolas"
                            : ""}</span
                        >
                      {:else}
                        <span class="text-base-content/40" title="Sin registro"
                          >—</span
                        >
                      {/if}
                    </td>
                  {/each}
                </tr>
              {:else}
                <tr>
                  <td
                    colspan={allLocations.length + 1}
                    class="py-6 text-center text-base-content/60"
                    >Aún no hay inventario registrado.</td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else if visibleItems.length === 0}
        <p
          class="rounded-box border border-dashed border-base-300 py-8 text-center text-sm text-base-content/60"
        >
          {allItems.length === 0
            ? "Aún no hay inventario. Registra la primera entrada."
            : "Nada coincide con la búsqueda o el filtro."}
        </p>
      {:else}
        <ul class="divide-y divide-base-300 rounded-box border border-base-300">
          {#each visibleItems as item (item.id)}
            {@const status = getStockStatus(item)}
            <li
              class="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 sm:flex-nowrap"
            >
              <div class="min-w-0 flex-1 basis-40">
                <p class="truncate font-medium">{item.name}</p>
                <p class="text-xs text-base-content/60">
                  {item.type === "ball_based" ? "Sabor" : "Unitario"} · mínimo {item.low_stock_threshold}
                </p>
              </div>
              <div class="w-full basis-full sm:w-48 sm:basis-auto">
                <div class="flex items-baseline justify-between gap-2">
                  <span class="text-lg font-bold tabular-nums"
                    >{item.current_stock}<span
                      class="ml-1 text-xs font-normal text-base-content/60"
                      >{item.type === "ball_based" ? "bolas" : "uds."}</span
                    ></span
                  >
                  <span
                    class={`badge badge-sm border-0 ${status.label === "Agotado" ? "bg-error/15 text-error" : status.label === "Stock bajo" ? "bg-warning/25 text-base-content" : "bg-success/15 text-success"}`}
                    >{status.label}</span
                  >
                </div>
                <progress
                  class={`progress h-1.5 w-full ${status.label === "Agotado" ? "progress-error" : status.label === "Stock bajo" ? "progress-warning" : "progress-success"}`}
                  value={stockBarPercent(item)}
                  max="100"
                  aria-label={`Nivel de ${item.name}`}
                ></progress>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  class="btn btn-sm btn-outline gap-1"
                  onclick={() => openEntryFor(item)}
                  title={`Registrar entrada de ${item.name}`}
                >
                  <Icon icon="lucide:plus" class="h-4 w-4" /> Entrada
                </button>
                {#if isTracked(item)}
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm btn-square"
                    onclick={() => openAdjustment(item)}
                    aria-label={`Ajustar ${item.name}`}
                    title="Ajuste (merma, conteo)"
                  >
                    <Icon icon="lucide:sliders-horizontal" class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm btn-square"
                    onclick={() => loadMovements(item)}
                    aria-label={`Movimientos de ${item.name}`}
                    title="Historial de movimientos"
                  >
                    <Icon icon="lucide:history" class="h-4 w-4" />
                  </button>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  {#if !isAllView && allItems.length > 0}
    <!-- Charts are secondary: folded away by default -->
    <details
      class="collapse collapse-arrow bg-base-100 shadow"
      bind:open={showCharts}
    >
      <summary class="collapse-title font-semibold"
        >Gráficas de inventario</summary
      >
      <div class="collapse-content">
        {#if showCharts}
          <div class="grid gap-4 lg:grid-cols-2">
            <div class="h-72">
              <Chart {init} options={stockStatusPieOptions} />
            </div>
            <div class="h-72">
              <Chart {init} options={stockLevelsBarOptions} />
            </div>
          </div>
        {/if}
      </div>
    </details>
  {/if}
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
  onOpenContainerTypes={canEditCatalog ? openContainerTypes : undefined}
  preselect={entryPreselect}
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
