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
    listFlavorInventory,
    listUnitInventory,
    listFlavors,
    getInventoryStats,
    getLowStockItems,
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
    type Flavor,
  } from "@features/admin-management/lib/bff";
  import InventoryEntryDialog from "./InventoryEntryDialog.svelte";
  import InventoryAdjustmentDialog from "./InventoryAdjustmentDialog.svelte";
  import ContainerTypesDialog from "./ContainerTypesDialog.svelte";
  import InventoryMovementsDialog from "./InventoryMovementsDialog.svelte";

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
  }

  let { busy = false, moduleError = "" }: Props = $props();

  let flavorItems = $state<InventoryItem[]>([]);
  let unitItems = $state<InventoryItem[]>([]);
  let globalFlavors = $state<Flavor[]>([]);
  let stats = $state<InventoryStats | null>(null);
  let lowStock = $state<InventoryItem[]>([]);
  let movements = $state<StockMovement[]>([]);
  let loading = $state(false);
  let error = $state("");
  let selectedItem = $state<InventoryItem | null>(null);
  let showEntryDialog = $state(false);
  let showAdjustment = $state(false);
  let showMovements = $state(false);
  let showContainerTypes = $state(false);
  let tableFilter = $state<"all" | "low-stock">("all");

  let containerTypes = $state<ContainerType[]>([]);
  let containerTypesLoading = $state(false);

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
  const allItems = $derived([...flavorItems, ...unitItems]);

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
    loading = true;
    error = "";
    try {
      const [flavorsRes, unitsRes, statsRes, lowRes, globalFlavorsRes] =
        await Promise.allSettled([
          listFlavorInventory(),
          listUnitInventory(),
          getInventoryStats(),
          getLowStockItems(),
          listFlavors(),
        ]);

      let inventoryFlavors: InventoryItem[] = [];
      if (flavorsRes.status === "fulfilled") {
        inventoryFlavors = (flavorsRes.value.items ?? []).map((item: any) => ({
          ...item,
          current_stock: item.current_stock ?? 0,
          low_stock_threshold: item.low_stock_threshold ?? 0,
        }));
      }

      if (unitsRes.status === "fulfilled") {
        unitItems = (unitsRes.value.items ?? []).map((item: any) => ({
          ...item,
          current_stock: item.current_stock ?? 0,
          low_stock_threshold: item.low_stock_threshold ?? 0,
        }));
      }
      if (statsRes.status === "fulfilled") {
        stats = statsRes.value;
      }
      if (lowRes.status === "fulfilled") {
        lowStock = (lowRes.value ?? []).map((item: any) => ({
          ...item,
          current_stock: item.current_stock ?? 0,
          low_stock_threshold: item.low_stock_threshold ?? 0,
        }));
      }
      if (globalFlavorsRes.status === "fulfilled") {
        globalFlavors = globalFlavorsRes.value ?? [];
      }

      // Merge global flavors with inventory records
      const inventoryByFlavorId = new Map(
        inventoryFlavors.map((item) => [item.flavor_id, item]),
      );
      flavorItems = globalFlavors.map((flavor) => {
        const existing = inventoryByFlavorId.get(flavor.id);
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

  $effect(() => {
    loadInventory();
  });

  onMount(() => {
    syncChartThemeColors();
    window.addEventListener("themechange", syncChartThemeColors);
    return () =>
      window.removeEventListener("themechange", syncChartThemeColors);
  });
</script>

<section class="space-y-5 md:space-y-6">
  {#if moduleError || error}
    <div class="alert alert-error">
      <span>{moduleError || error}</span>
    </div>
  {/if}

  <!-- Card 1: Resumen de Inventario -->
  <div class="card bg-base-100 shadow border border-base-300/60">
    <div class="card-body py-4">
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0"
          >
            <Icon
              icon="lucide:package"
              width="20"
              height="20"
              class="text-warning"
            />
          </div>
          <div>
            <h2 class="card-title text-base leading-tight">
              Resumen de Inventario
            </h2>
            <p class="text-xs text-base-content/55">Stock actual y alertas</p>
          </div>
        </div>
        <button
          class="btn btn-sm btn-primary gap-2 self-start sm:self-auto"
          onclick={loadInventory}
          disabled={loading}
        >
          {#if loading}
            <span class="loading loading-spinner loading-xs"></span>
          {:else}
            <Icon icon="lucide:refresh-cw" width="16" height="16" />
          {/if}
          Actualizar
        </button>
      </div>
    </div>

    {#if stats}
      <div class="px-4 pb-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div
            class="stat bg-base-200/40 border border-base-300/50 rounded-box"
          >
            <div class="stat-figure text-info">
              <Icon icon="lucide:ice-cream-cone" width="24" height="24" />
            </div>
            <div class="stat-title">Sabores</div>
            <div class="stat-value text-info text-2xl">
              {stats.ball_based_items}
            </div>
          </div>
          <div
            class="stat bg-base-200/40 border border-base-300/50 rounded-box"
          >
            <div class="stat-figure text-secondary">
              <Icon icon="lucide:box" width="24" height="24" />
            </div>
            <div class="stat-title">Unitarios</div>
            <div class="stat-value text-secondary text-2xl">
              {stats.unit_based_items}
            </div>
          </div>
          <div
            class="stat bg-base-200/40 border border-base-300/50 rounded-box"
          >
            <div class="stat-figure text-error">
              <Icon icon="lucide:alert-triangle" width="24" height="24" />
            </div>
            <div class="stat-title">Agotados</div>
            <div class="stat-value text-error text-2xl">
              {stats.out_of_stock_items}
            </div>
            {#if stats.out_of_stock_items > 0}
              <div class="stat-desc text-error">Requiere atención</div>
            {/if}
          </div>
          <div
            class="stat bg-base-200/40 border border-base-300/50 rounded-box"
          >
            <div class="stat-figure text-warning">
              <Icon icon="lucide:alert-circle" width="24" height="24" />
            </div>
            <div class="stat-title">Stock Bajo</div>
            <div class="stat-value text-warning text-2xl">
              {stats.low_stock_items}
            </div>
            {#if stats.low_stock_items > 0}
              <div class="stat-desc text-warning">Requiere atención</div>
            {/if}
          </div>
          <div
            class="stat bg-base-200/40 border border-base-300/50 rounded-box"
          >
            <div class="stat-figure text-success">
              <Icon icon="lucide:check-circle" width="24" height="24" />
            </div>
            <div class="stat-title">OK</div>
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
          <div class="card bg-base-100 border border-base-300/50">
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

          <div class="card bg-base-100 border border-base-300/50">
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
  <div class="card bg-base-100 shadow border border-base-200">
    <div class="card-body gap-4">
      <!-- Toolbar (Personas pattern) -->
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="card-title shrink-0 mr-1">Sabores y Unitarios</h2>

        <div class="hidden sm:block w-px h-5 bg-base-300 self-center"></div>

        <!-- Segmented filter -->
        <div class="join">
          <button
            class="btn btn-sm join-item"
            class:btn-neutral={tableFilter === "all"}
            class:btn-ghost={tableFilter !== "all"}
            onclick={() => (tableFilter = "all")}
          >
            Todo
          </button>
          <button
            class="btn btn-sm join-item"
            class:btn-neutral={tableFilter === "low-stock"}
            class:btn-ghost={tableFilter !== "low-stock"}
            onclick={() => (tableFilter = "low-stock")}
          >
            Stock Bajo
            {#if lowStock.length > 0}
              <span class="badge badge-sm badge-error ml-1"
                >{lowStock.length}</span
              >
            {/if}
          </button>
        </div>

        <div
          class="flex items-center gap-1.5 text-sm text-base-content/80 font-medium shrink-0"
        >
          <span
            class="badge badge-info badge-sm font-semibold rounded-md text-white!"
            >{allItems.length}</span
          >
          <span>items</span>
        </div>

        <button
          class="btn btn-sm btn-primary shrink-0 ml-auto"
          onclick={openEntry}
          disabled={loading || busy}
        >
          <Icon icon="lucide:plus" width="16" height="16" />
          Nueva entrada
        </button>
      </div>

      <!-- Tables -->
      {#if tableFilter === "all"}
        <div class="animate-fadeIn space-y-4">
          <!-- Sabores -->
          <div>
            <h3 class="text-sm font-semibold flex items-center gap-2 mb-2">
              <span class="badge badge-info badge-sm">Sabores</span>
              <span class="badge badge-ghost badge-sm"
                >{flavorItems.length}</span
              >
            </h3>
            <div
              class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
            >
              <table class="table table-sm">
                <thead class="bg-base-200/60 text-base-content">
                  <tr>
                    <th class="font-bold">Sabor</th>
                    <th class="text-right font-bold">Stock Actual</th>
                    <th class="text-right font-bold">Mínimo</th>
                    <th class="font-bold">Estado</th>
                    <th class="text-right font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {#each flavorItems as item (item.id)}
                    {@const status = getStockStatus(item)}
                    <tr class="hover:bg-base-200/50 transition-colors">
                      <td>
                        <div class="font-medium">{item.name}</div>
                      </td>
                      <td class="text-right font-mono">
                        {(item.current_stock ?? 0).toLocaleString()}
                        <span class="text-xs text-base-content/60">bolas</span>
                      </td>
                      <td class="text-right text-xs text-base-content/60">
                        {item.low_stock_threshold ?? 0}
                      </td>
                      <td>
                        <span class="badge badge-sm {status.class}"
                          >{status.label}</span
                        >
                      </td>
                      <td class="text-right">
                        <div class="flex justify-end gap-1">
                          <button
                            class="btn btn-xs btn-soft btn-accent"
                            title="Ajuste"
                            onclick={() => openAdjustment(item)}
                          >
                            <Icon
                              icon="lucide:sliders-horizontal"
                              width="14"
                              height="14"
                            />
                          </button>
                          <button
                            class="btn btn-xs btn-soft btn-ghost"
                            title="Movimientos"
                            onclick={() => loadMovements(item)}
                          >
                            <Icon icon="lucide:clock" width="14" height="14" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  {:else}
                    <tr>
                      <td
                        colspan="5"
                        class="text-center py-8 text-base-content/50"
                      >
                        {#if loading}
                          <span class="loading loading-spinner loading-sm"
                          ></span>
                          Cargando inventario...
                        {:else}
                          No hay sabores en el inventario
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Unitarios -->
          <div>
            <h3 class="text-sm font-semibold flex items-center gap-2 mb-2">
              <span class="badge badge-secondary badge-sm">Unitarios</span>
              <span class="badge badge-ghost badge-sm">{unitItems.length}</span>
            </h3>
            <div
              class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
            >
              <table class="table table-sm">
                <thead class="bg-base-200/60 text-base-content">
                  <tr>
                    <th class="font-bold">Producto</th>
                    <th class="text-right font-bold">Stock Actual</th>
                    <th class="text-right font-bold">Mínimo</th>
                    <th class="font-bold">Estado</th>
                    <th class="text-right font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {#each unitItems as item (item.id)}
                    {@const status = getStockStatus(item)}
                    <tr class="hover:bg-base-200/50 transition-colors">
                      <td>
                        <div class="font-medium">{item.name}</div>
                      </td>
                      <td class="text-right font-mono">
                        {(item.current_stock ?? 0).toLocaleString()}
                        <span class="text-xs text-base-content/60"
                          >unidades</span
                        >
                      </td>
                      <td class="text-right text-xs text-base-content/60">
                        {item.low_stock_threshold ?? 0}
                      </td>
                      <td>
                        <span class="badge badge-sm {status.class}"
                          >{status.label}</span
                        >
                      </td>
                      <td class="text-right">
                        <div class="flex justify-end gap-1">
                          <button
                            class="btn btn-xs btn-soft btn-accent"
                            title="Ajuste"
                            onclick={() => openAdjustment(item)}
                          >
                            <Icon
                              icon="lucide:sliders-horizontal"
                              width="14"
                              height="14"
                            />
                          </button>
                          <button
                            class="btn btn-xs btn-soft btn-ghost"
                            title="Movimientos"
                            onclick={() => loadMovements(item)}
                          >
                            <Icon icon="lucide:clock" width="14" height="14" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  {:else}
                    <tr>
                      <td
                        colspan="5"
                        class="text-center py-8 text-base-content/50"
                      >
                        {#if loading}
                          <span class="loading loading-spinner loading-sm"
                          ></span>
                          Cargando inventario...
                        {:else}
                          No hay productos unitarios en el inventario
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      {/if}

      {#if tableFilter === "low-stock"}
        <div class="animate-fadeIn">
          {#if lowStock.length > 0}
            <div
              class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
            >
              <table class="table table-sm">
                <thead class="bg-base-200/60 text-base-content">
                  <tr>
                    <th class="font-bold">Item</th>
                    <th class="text-right font-bold">Stock Actual</th>
                    <th class="text-right font-bold">Mínimo</th>
                    <th class="text-right font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {#each lowStock as item (item.id)}
                    <tr class="hover:bg-base-200/50 transition-colors">
                      <td>
                        <div class="font-medium">{item.name}</div>
                        <span
                          class="badge badge-sm {item.type === 'ball_based'
                            ? 'badge-info'
                            : 'badge-secondary'}"
                        >
                          {item.type === "ball_based" ? "Sabor" : "Unitario"}
                        </span>
                      </td>
                      <td class="text-right font-mono text-error font-bold">
                        {(item.current_stock ?? 0).toLocaleString()}
                      </td>
                      <td class="text-right font-mono">
                        {item.low_stock_threshold ?? 0}
                      </td>
                      <td class="text-right">
                        <button
                          class="btn btn-xs btn-soft btn-primary"
                          onclick={() => openAdjustment(item)}
                        >
                          Ajustar
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <div class="text-center py-6 text-base-content/50">
              <Icon
                icon="lucide:check-circle-2"
                width="48"
                height="48"
                class="mx-auto mb-2 text-success"
              />
              <p>Todos los items tienen stock suficiente</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</section>

<!-- Dialogs -->
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

<style>
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fadeIn {
    animation: fadeIn 0.18s ease-out;
  }
</style>
