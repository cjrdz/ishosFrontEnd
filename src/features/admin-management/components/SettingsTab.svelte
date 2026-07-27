<script lang="ts">
  import Icon from "@shared/components/AppIcon.svelte";
  import AdminModalShell from "./shared/AdminModalShell.svelte";
  import AdminFormActions from "./shared/AdminFormActions.svelte";
  import type { RowsPerTableConfig } from "../lib/local-settings";
  import type { PanelConfigValues } from "../types/settings";
  import type { OrderArchiveConfig } from "../lib/bff";

  interface Props {
    tabOrder: string[];
    panelConfig: PanelConfigValues;
    storeOrdersEnabled: boolean;
    rowsPerTable: RowsPerTableConfig;
    archiveConfig: OrderArchiveConfig;
    busy: boolean;
    moduleError: string;
    onSave: (tabOrder: string[]) => void;
    onSavePanelConfig: (config: PanelConfigValues) => void;
    onToggleStoreOrders: (enabled: boolean) => void | Promise<void>;
    onSaveRowsPerTable: (rows: RowsPerTableConfig) => void;
    onSaveArchiveConfig: (config: OrderArchiveConfig) => void;
    onRunArchive: () => void;
  }

  const TAB_LABELS: Record<string, string> = {
    ordenes: "Ordenes",
    categorias: "Categorias",
    productos: "Productos",
    personas: "Personas",
    analitica: "Analitica",
  };

  let {
    tabOrder,
    panelConfig,
    storeOrdersEnabled,
    rowsPerTable,
    archiveConfig,
    busy,
    moduleError,
    onSave,
    onSavePanelConfig,
    onToggleStoreOrders,
    onSaveRowsPerTable,
    onSaveArchiveConfig,
    onRunArchive,
  }: Props = $props();
  let localOrder = $state<string[]>([]);
  let localPanelConfig = $state<PanelConfigValues>({
    auth_cookie_ttl_hours: 24,
    auth_token_ttl_hours: 168,
    tracking_token_ttl_hours: 720,
    inactivity_logout_seconds: 900,
  });
  let confirmPauseDialog = $state<HTMLDialogElement | null>(null);
  let confirmPauseArchiveDialog = $state<HTMLDialogElement | null>(null);
  const rowsPerTableOptions = [5, 10, 25, 50, 100] as const;
  let localRowsPerTable = $state<RowsPerTableConfig>({
    default: 5,
    ordenes: 5,
    categorias: 5,
    productos: 5,
    usuarios: 5,
    empleados: 5,
    inventario: 5,
  });
  let localArchiveConfig = $state<OrderArchiveConfig>({
    enabled: true,
    age_days: 7,
    interval_minutes: 60,
  });

  $effect(() => {
    localOrder = [...tabOrder];
  });

  $effect(() => {
    localPanelConfig = {
      auth_cookie_ttl_hours: panelConfig.auth_cookie_ttl_hours,
      auth_token_ttl_hours: panelConfig.auth_token_ttl_hours,
      tracking_token_ttl_hours: panelConfig.tracking_token_ttl_hours,
      inactivity_logout_seconds: panelConfig.inactivity_logout_seconds,
    };
  });

  $effect(() => {
    localRowsPerTable = { ...rowsPerTable };
  });

  $effect(() => {
    localArchiveConfig = { ...archiveConfig };
  });

  function moveUp(index: number) {
    if (index <= 0) return;
    const clone = [...localOrder];
    const current = clone[index];
    clone[index] = clone[index - 1];
    clone[index - 1] = current;
    localOrder = clone;
  }

  function moveDown(index: number) {
    if (index >= localOrder.length - 1) return;
    const clone = [...localOrder];
    const current = clone[index];
    clone[index] = clone[index + 1];
    clone[index + 1] = current;
    localOrder = clone;
  }

  function handleSave() {
    onSave(localOrder);
  }

  function handleSavePanelConfig() {
    onSavePanelConfig({
      auth_cookie_ttl_hours: normalizeHours(
        localPanelConfig.auth_cookie_ttl_hours,
        panelConfig.auth_cookie_ttl_hours,
      ),
      auth_token_ttl_hours: normalizeHours(
        localPanelConfig.auth_token_ttl_hours,
        panelConfig.auth_token_ttl_hours,
      ),
      tracking_token_ttl_hours: normalizeHours(
        localPanelConfig.tracking_token_ttl_hours,
        panelConfig.tracking_token_ttl_hours,
      ),
      inactivity_logout_seconds: normalizeSeconds(
        localPanelConfig.inactivity_logout_seconds,
        panelConfig.inactivity_logout_seconds,
      ),
    });
  }

  function normalizeHours(value: number, fallback: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return fallback;
    }

    return Math.round(value);
  }

  function normalizeSeconds(value: number, fallback: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return fallback;
    }

    return Math.round(value);
  }

  function handleMoveTab(tab: string, direction: "up" | "down") {
    const currentIndex = localOrder.indexOf(tab);
    if (currentIndex === -1) return;
    if (direction === "up") {
      moveUp(currentIndex);
      return;
    }
    moveDown(currentIndex);
  }

  function openPauseDialog() {
    confirmPauseDialog?.showModal();
  }

  function confirmPauseOrders() {
    confirmPauseDialog?.close();
    void onToggleStoreOrders(false);
  }

  function handleStoreOrdersToggle(checked: boolean) {
    if (checked) {
      void onToggleStoreOrders(true);
      return;
    }
    openPauseDialog();
  }

  function handleSaveRowsPerTable() {
    onSaveRowsPerTable({ ...localRowsPerTable });
  }

  function openPauseArchiveDialog() {
    confirmPauseArchiveDialog?.showModal();
  }

  function confirmPauseArchive() {
    confirmPauseArchiveDialog?.close();
    localArchiveConfig = { ...localArchiveConfig, enabled: false };
    void onSaveArchiveConfig({ ...localArchiveConfig });
  }

  function handleArchiveToggle(checked: boolean) {
    if (checked) {
      localArchiveConfig = { ...localArchiveConfig, enabled: true };
      void onSaveArchiveConfig({ ...localArchiveConfig });
      return;
    }
    openPauseArchiveDialog();
  }

  function normalizeArchiveDays(value: number, fallback: number): number {
    if (!Number.isFinite(value) || value < 1) return fallback;
    return Math.round(value);
  }

  function normalizeArchiveMinutes(value: number, fallback: number): number {
    if (!Number.isFinite(value) || value < 1) return fallback;
    return Math.round(value);
  }

  function handleSaveArchiveConfig() {
    onSaveArchiveConfig({
      enabled: localArchiveConfig.enabled,
      age_days: normalizeArchiveDays(
        localArchiveConfig.age_days,
        archiveConfig.age_days,
      ),
      interval_minutes: normalizeArchiveMinutes(
        localArchiveConfig.interval_minutes,
        archiveConfig.interval_minutes,
      ),
    });
  }
</script>

<section class="space-y-6">
  {#if moduleError}
    <div class="alert alert-warning"><span>{moduleError}</span></div>
  {/if}

  <!-- Navigation -->
  <div id="navegacion-panel" class="card bg-base-100 shadow">
    <div class="card-body gap-4">
      <div>
        <h2 class="card-title">Navegacion del panel</h2>
        <p class="text-sm text-base-content/70">
          Reordena las pestanas globales del panel administrativo.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        {#each localOrder as tab, index}
          <div
            class="inline-flex items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-3 py-1.5 shadow-sm"
          >
            <span class="text-xs font-medium text-base-content/50"
              >{index + 1}</span
            >
            <span class="text-sm font-medium">{TAB_LABELS[tab] ?? tab}</span>
            <div
              class="flex items-center gap-0.5 border-l border-base-300 pl-2"
            >
              <button
                class="btn btn-ghost btn-xs btn-square"
                type="button"
                onclick={() => handleMoveTab(tab, "up")}
                disabled={busy || index === 0}
                aria-label={`Subir ${TAB_LABELS[tab] ?? tab}`}
              >
                <Icon icon="lucide:chevron-left" class="h-3.5 w-3.5" />
              </button>
              <button
                class="btn btn-ghost btn-xs btn-square"
                type="button"
                onclick={() => handleMoveTab(tab, "down")}
                disabled={busy || index === localOrder.length - 1}
                aria-label={`Bajar ${TAB_LABELS[tab] ?? tab}`}
              >
                <Icon icon="lucide:chevron-right" class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        {/each}
      </div>

      <div class="flex justify-end pt-1">
        <button
          class="btn btn-primary btn-sm"
          type="button"
          onclick={handleSave}
          disabled={busy}>Guardar orden</button
        >
      </div>
    </div>
  </div>

  <!-- Store operation -->
  <div id="operacion-tienda" class="card bg-base-100 shadow">
    <div class="card-body gap-4">
      <div>
        <h2 class="card-title">Operacion de tienda</h2>
        <p class="text-sm text-base-content/70">
          Controla si los clientes pueden crear pedidos publicos.
        </p>
      </div>

      <div
        class="flex flex-col gap-4 rounded-lg border border-base-300 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p class="font-medium text-base-content">
            {storeOrdersEnabled ? "Pedidos activos" : "Pedidos pausados"}
          </p>
          <p class="text-sm text-base-content/60">
            {storeOrdersEnabled
              ? "El catalogo es visible y los clientes pueden ordenar."
              : "El catalogo es visible pero no se aceptan nuevos pedidos publicos."}
          </p>
        </div>
        <input
          class="toggle toggle-md {storeOrdersEnabled
            ? 'toggle-success'
            : 'toggle-error'}"
          type="checkbox"
          checked={storeOrdersEnabled}
          onchange={(event) =>
            handleStoreOrdersToggle(
              (event.currentTarget as HTMLInputElement).checked,
            )}
          disabled={busy}
          aria-label={storeOrdersEnabled
            ? "Pedidos activos"
            : "Pedidos pausados"}
        />
      </div>
    </div>
  </div>

  <!-- Security -->
  <div id="seguridad-panel" class="card bg-base-100 shadow">
    <div class="card-body gap-4">
      <div>
        <h2 class="card-title">Seguridad y sesiones</h2>
        <p class="text-sm text-base-content/70">
          Configura sesiones, expiraciones y reglas de seguridad del panel.
        </p>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <label class="form-control">
          <span class="label-text text-sm font-medium"
            >Cookie de sesion (horas)</span
          >
          <input
            class="input input-bordered input-sm w-full mt-1"
            type="number"
            min="1"
            step="1"
            bind:value={localPanelConfig.auth_cookie_ttl_hours}
            disabled={busy}
          />
          <span class="label-text-alt text-xs text-base-content/60 mt-1"
            >Usado por el backend para cookie HttpOnly.</span
          >
        </label>

        <label class="form-control">
          <span class="label-text text-sm font-medium"
            >Token de login (horas)</span
          >
          <input
            class="input input-bordered input-sm w-full mt-1"
            type="number"
            min="1"
            step="1"
            bind:value={localPanelConfig.auth_token_ttl_hours}
            disabled={busy}
          />
          <span class="label-text-alt text-xs text-base-content/60 mt-1"
            >JWT de empleados para iniciar sesion.</span
          >
        </label>

        <label class="form-control">
          <span class="label-text text-sm font-medium"
            >Token de seguimiento (horas)</span
          >
          <input
            class="input input-bordered input-sm w-full mt-1"
            type="number"
            min="1"
            step="1"
            bind:value={localPanelConfig.tracking_token_ttl_hours}
            disabled={busy}
          />
          <span class="label-text-alt text-xs text-base-content/60 mt-1"
            >Token publico para rastreo de ordenes.</span
          >
        </label>

        <label class="form-control">
          <span class="label-text text-sm font-medium"
            >Logout por inactividad (segundos)</span
          >
          <input
            class="input input-bordered input-sm w-full mt-1"
            type="number"
            min="1"
            step="1"
            bind:value={localPanelConfig.inactivity_logout_seconds}
            disabled={busy}
          />
          <span class="label-text-alt text-xs text-base-content/60 mt-1"
            >Cierra sesion automaticamente sin actividad.</span
          >
        </label>
      </div>

      <div class="flex justify-end pt-1">
        <button
          class="btn btn-primary btn-sm"
          type="button"
          onclick={handleSavePanelConfig}
          disabled={busy}>Guardar expiraciones</button
        >
      </div>
    </div>
  </div>

  <!-- Rows per table -->
  <div id="filas-tablas" class="card bg-base-100 shadow">
    <div class="card-body gap-4">
      <div>
        <h2 class="card-title">Filas por tabla</h2>
        <p class="text-sm text-base-content/70">
          Define el numero de filas visible por defecto en cada tabla.
        </p>
      </div>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label class="form-control">
          <span class="label-text text-sm font-medium">Default</span>
          <select
            class="select select-bordered select-sm w-full mt-1"
            bind:value={localRowsPerTable.default}
            disabled={busy}
          >
            {#each rowsPerTableOptions as option}
              <option value={option}>{option}</option>
            {/each}
          </select>
        </label>

        <label class="form-control">
          <span class="label-text text-sm font-medium">Ordenes</span>
          <select
            class="select select-bordered select-sm w-full mt-1"
            bind:value={localRowsPerTable.ordenes}
            disabled={busy}
          >
            {#each rowsPerTableOptions as option}
              <option value={option}>{option}</option>
            {/each}
          </select>
        </label>

        <label class="form-control">
          <span class="label-text text-sm font-medium">Categorias</span>
          <select
            class="select select-bordered select-sm w-full mt-1"
            bind:value={localRowsPerTable.categorias}
            disabled={busy}
          >
            {#each rowsPerTableOptions as option}
              <option value={option}>{option}</option>
            {/each}
          </select>
        </label>

        <label class="form-control">
          <span class="label-text text-sm font-medium">Productos</span>
          <select
            class="select select-bordered select-sm w-full mt-1"
            bind:value={localRowsPerTable.productos}
            disabled={busy}
          >
            {#each rowsPerTableOptions as option}
              <option value={option}>{option}</option>
            {/each}
          </select>
        </label>

        <label class="form-control">
          <span class="label-text text-sm font-medium">Usuarios</span>
          <select
            class="select select-bordered select-sm w-full mt-1"
            bind:value={localRowsPerTable.usuarios}
            disabled={busy}
          >
            {#each rowsPerTableOptions as option}
              <option value={option}>{option}</option>
            {/each}
          </select>
        </label>

        <label class="form-control">
          <span class="label-text text-sm font-medium">Empleados</span>
          <select
            class="select select-bordered select-sm w-full mt-1"
            bind:value={localRowsPerTable.empleados}
            disabled={busy}
          >
            {#each rowsPerTableOptions as option}
              <option value={option}>{option}</option>
            {/each}
          </select>
        </label>

        <label class="form-control">
          <span class="label-text text-sm font-medium">Inventario</span>
          <select
            class="select select-bordered select-sm w-full mt-1"
            bind:value={localRowsPerTable.inventario}
            disabled={busy}
          >
            {#each rowsPerTableOptions as option}
              <option value={option}>{option}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="flex justify-end pt-1">
        <button
          class="btn btn-primary btn-sm"
          type="button"
          onclick={handleSaveRowsPerTable}
          disabled={busy}>Guardar filas</button
        >
      </div>
    </div>
  </div>

  <!-- Order archive -->
  <div id="archivo-ordenes" class="card bg-base-100 shadow">
    <div class="card-body gap-4">
      <div>
        <h2 class="card-title">Archivo de ordenes</h2>
        <p class="text-sm text-base-content/70">
          Oculta automaticamente ordenes terminadas o canceladas despues de un
          tiempo, y permite archivar manualmente desde el panel.
        </p>
      </div>

      <div
        class="flex flex-col gap-4 rounded-lg border border-base-300 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p class="font-medium text-base-content">
            {localArchiveConfig.enabled
              ? "Archivo automatico activo"
              : "Archivo automatico pausado"}
          </p>
          <p class="text-sm text-base-content/60">
            {localArchiveConfig.enabled
              ? `Las ordenes entregadas o canceladas se archivan despues de ${localArchiveConfig.age_days} dias.`
              : "Las ordenes no se archivan automaticamente."}
          </p>
        </div>
        <input
          class="toggle toggle-md {localArchiveConfig.enabled
            ? 'toggle-success'
            : 'toggle-error'}"
          type="checkbox"
          checked={localArchiveConfig.enabled}
          onchange={(event) =>
            handleArchiveToggle(
              (event.currentTarget as HTMLInputElement).checked,
            )}
          disabled={busy}
          aria-label={localArchiveConfig.enabled
            ? "Archivo automatico activo"
            : "Archivo automatico pausado"}
        />
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <label class="form-control">
          <span class="label-text text-sm font-medium">
            Antiguedad para archivo (dias)
          </span>
          <input
            class="input input-bordered input-sm w-full mt-1"
            type="number"
            min="1"
            step="1"
            bind:value={localArchiveConfig.age_days}
            disabled={busy}
          />
          <span class="label-text-alt text-xs text-base-content/60 mt-1"
            >Dias desde que la orden quedo en estado terminal.</span
          >
        </label>

        <label class="form-control">
          <span class="label-text text-sm font-medium">
            Intervalo de revision (minutos)
          </span>
          <input
            class="input input-bordered input-sm w-full mt-1"
            type="number"
            min="1"
            step="1"
            bind:value={localArchiveConfig.interval_minutes}
            disabled={busy}
          />
          <span class="label-text-alt text-xs text-base-content/60 mt-1"
            >Cada cuanto el servidor busca ordenes candidatas.</span
          >
        </label>
      </div>

      <div class="flex flex-wrap justify-end gap-2 pt-1">
        <button
          class="btn btn-outline btn-sm"
          type="button"
          onclick={onRunArchive}
          disabled={busy}>Ejecutar archivo ahora</button
        >
        <button
          class="btn btn-primary btn-sm"
          type="button"
          onclick={handleSaveArchiveConfig}
          disabled={busy}>Guardar archivo</button
        >
      </div>
    </div>
  </div>
</section>

<AdminModalShell
  bind:dialogRef={confirmPauseDialog}
  title="Pausar pedidos publicos"
  icon="lucide:pause-circle"
  widthClass="max-w-md"
  onClose={() => {}}
>
  <p>
    Los clientes podran seguir viendo el catalogo, pero no podran crear pedidos
    nuevos hasta reactivar la tienda.
  </p>
  <AdminFormActions
    submitLabel="Pausar pedidos"
    submitType="button"
    submitVariant="error"
    onSubmit={confirmPauseOrders}
    onCancel={() => confirmPauseDialog?.close()}
    {busy}
  />
</AdminModalShell>

<AdminModalShell
  bind:dialogRef={confirmPauseArchiveDialog}
  title="Pausar archivo automatico"
  icon="lucide:archive-x"
  widthClass="max-w-md"
  onClose={() => {}}
>
  <p>
    Las ordenes entregadas y canceladas dejaran de archivarse automaticamente.
    Puedes seguir archivando manualmente desde el panel.
  </p>
  <AdminFormActions
    submitLabel="Pausar archivo"
    submitType="button"
    submitVariant="error"
    onSubmit={confirmPauseArchive}
    onCancel={() => confirmPauseArchiveDialog?.close()}
    {busy}
  />
</AdminModalShell>
