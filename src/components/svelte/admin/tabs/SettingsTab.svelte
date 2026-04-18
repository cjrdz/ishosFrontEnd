<script lang="ts">
  import Icon from "../../shared/AppIcon.svelte";

  export interface PanelConfigValues {
    auth_cookie_ttl_hours: number;
    auth_token_ttl_hours: number;
    tracking_token_ttl_hours: number;
    inactivity_logout_seconds: number;
  }

  interface Props {
    tabOrder: string[];
    panelConfig: PanelConfigValues;
    storeOrdersEnabled: boolean;
    busy: boolean;
    moduleError: string;
    onSave: (tabOrder: string[]) => void;
    onSavePanelConfig: (config: PanelConfigValues) => void;
    onToggleStoreOrders: (enabled: boolean) => void | Promise<void>;
  }

  const TAB_LABELS: Record<string, string> = {
    ordenes: "Ordenes",
    categorias: "Categorias",
    productos: "Productos",
    personas: "Personas",
    ofertas: "Ofertas",
    herramientas: "Herramientas",
  };

  let {
    tabOrder,
    panelConfig,
    storeOrdersEnabled,
    busy,
    moduleError,
    onSave,
    onSavePanelConfig,
    onToggleStoreOrders,
  }: Props = $props();
  let localOrder = $state<string[]>([]);
  let localPanelConfig = $state<PanelConfigValues>({
    auth_cookie_ttl_hours: 24,
    auth_token_ttl_hours: 168,
    tracking_token_ttl_hours: 720,
    inactivity_logout_seconds: 900,
  });
  let confirmPauseDialog = $state<HTMLDialogElement | null>(null);

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
</script>

<section class="space-y-4">
  {#if moduleError}
    <div class="alert alert-warning"><span>{moduleError}</span></div>
  {/if}

  <div id="navegacion-panel" class="card bg-base-100 shadow">
    <div class="card-body space-y-4">
      <div>
        <h2 class="card-title">Navegacion del panel</h2>
        <p class="text-sm text-base-content/70">
          Reordena las pestanas globales del panel administrativo para que el
          equipo vea primero lo importante.
        </p>
      </div>

      <div class="rounded-2xl border border-base-300 bg-base-50/70 p-3 sm:p-4">
        <div class="flex flex-wrap gap-2">
          {#each localOrder as tab, index}
            <div
              class="flex items-center gap-2 rounded-full border border-base-300 bg-base-100 px-2 py-2 shadow-xs"
            >
              <span
                class="rounded-full bg-base-200 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-base-content/60"
                >{index + 1}</span
              >
              <span class="text-sm font-medium">{TAB_LABELS[tab] ?? tab}</span>
              <div
                class="flex items-center gap-1 border-l border-base-300 pl-2"
              >
                <button
                  class="btn btn-ghost btn-xs btn-circle"
                  type="button"
                  onclick={() => handleMoveTab(tab, "up")}
                  disabled={busy || index === 0}
                  aria-label={`Subir ${TAB_LABELS[tab] ?? tab}`}
                >
                  <Icon icon="lucide:chevron-left" class="h-3.5 w-3.5" />
                </button>
                <button
                  class="btn btn-ghost btn-xs btn-circle"
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
        <p class="mt-3 text-xs text-base-content/60">
          Usa las flechas para mover cada pestana sin ocupar una fila completa
          por elemento.
        </p>
      </div>

      <div class="flex justify-end">
        <button
          class="btn btn-primary"
          type="button"
          onclick={handleSave}
          disabled={busy}>Guardar orden global</button
        >
      </div>
    </div>
  </div>

  <div id="operacion-tienda" class="card bg-base-100 shadow">
    <div class="card-body space-y-4">
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div class="min-w-0 flex-1">
          <h2 class="card-title">Operacion de tienda</h2>
          <p class="text-sm text-base-content/70">
            El kill switch vive aqui para evitar pausas accidentales desde la
            operacion diaria.
          </p>
        </div>
        <span
          class="badge gap-1 px-3 py-3 shrink-0 self-start {storeOrdersEnabled
            ? 'badge-success'
            : 'badge-error'}"
        >
          <Icon
            icon={storeOrdersEnabled
              ? "lucide:circle-check"
              : "lucide:circle-x"}
            class="h-4 w-4"
          />
          {storeOrdersEnabled ? "Pedidos activos" : "Pedidos pausados"}
        </span>
      </div>

      <div class="rounded-2xl border border-base-300 bg-base-50/70 p-3 sm:p-5">
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="space-y-1 text-sm text-base-content/70 min-w-0">
            <p class="font-semibold text-base-content">
              Cuando esta pausado, el catalogo sigue visible pero no permite
              nuevos pedidos publicos.
            </p>
            <p>El staff puede seguir operando desde el panel administrativo.</p>
          </div>
          <div class="shrink-0">
            {#if storeOrdersEnabled}
              <button
                class="btn btn-error btn-outline btn-sm sm:btn-md w-full sm:w-auto"
                type="button"
                onclick={openPauseDialog}
                disabled={busy}>Pausar pedidos</button
              >
            {:else}
              <button
                class="btn btn-success btn-sm sm:btn-md w-full sm:w-auto"
                type="button"
                onclick={() => onToggleStoreOrders(true)}
                disabled={busy}>Activar pedidos</button
              >
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="seguridad-panel" class="card bg-base-100 shadow">
    <div class="card-body space-y-4">
      <div>
        <h2 class="card-title">Seguridad y sesiones</h2>
        <p class="text-sm text-base-content/70">
          Configura sesiones, expiraciones y reglas de seguridad del panel
          administrativo.
        </p>
      </div>

      <div class="rounded-2xl border border-base-300 bg-base-50/60 p-4 sm:p-5">
        <div
          class="mb-4 flex flex-wrap items-center gap-2 text-xs text-base-content/70"
        >
          <span class="badge badge-outline badge-sm">Recomendado</span>
          <span class="rounded-lg bg-base-200 px-2.5 py-1">Cookie: 24h</span>
          <span class="rounded-lg bg-base-200 px-2.5 py-1"
            >Token login: 168h</span
          >
          <span class="rounded-lg bg-base-200 px-2.5 py-1"
            >Inactividad: 300-900s</span
          >
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <label class="rounded-xl border border-base-300 bg-base-100 p-4">
            <span
              class="mb-2 inline-flex items-center gap-2 text-sm font-semibold"
            >
              <Icon icon="lucide:cookie" class="h-4 w-4 text-warning" />
              Cookie de sesion (horas)
            </span>
            <input
              class="input input-bordered input-sm w-full"
              type="number"
              min="1"
              step="1"
              bind:value={localPanelConfig.auth_cookie_ttl_hours}
              disabled={busy}
            />
            <span class="mt-2 block text-xs text-base-content/60"
              >Usado por el backend para cookie HttpOnly.</span
            >
          </label>

          <label class="rounded-xl border border-base-300 bg-base-100 p-4">
            <span
              class="mb-2 inline-flex items-center gap-2 text-sm font-semibold"
            >
              <Icon icon="lucide:key-round" class="h-4 w-4 text-info" />
              Token de login (horas)
            </span>
            <input
              class="input input-bordered input-sm w-full"
              type="number"
              min="1"
              step="1"
              bind:value={localPanelConfig.auth_token_ttl_hours}
              disabled={busy}
            />
            <span class="mt-2 block text-xs text-base-content/60"
              >JWT de empleados para iniciar sesion.</span
            >
          </label>

          <label class="rounded-xl border border-base-300 bg-base-100 p-4">
            <span
              class="mb-2 inline-flex items-center gap-2 text-sm font-semibold"
            >
              <Icon icon="lucide:scan-eye" class="h-4 w-4 text-success" />
              Token de seguimiento (horas)
            </span>
            <input
              class="input input-bordered input-sm w-full"
              type="number"
              min="1"
              step="1"
              bind:value={localPanelConfig.tracking_token_ttl_hours}
              disabled={busy}
            />
            <span class="mt-2 block text-xs text-base-content/60"
              >Token publico para rastreo de ordenes.</span
            >
          </label>

          <label class="rounded-xl border border-base-300 bg-base-100 p-4">
            <span
              class="mb-2 inline-flex items-center gap-2 text-sm font-semibold"
            >
              <Icon icon="lucide:timer-reset" class="h-4 w-4 text-error" />
              Logout por inactividad (segundos)
            </span>
            <input
              class="input input-bordered input-sm w-full"
              type="number"
              min="1"
              step="1"
              bind:value={localPanelConfig.inactivity_logout_seconds}
              disabled={busy}
            />
            <span class="mt-2 block text-xs text-base-content/60"
              >Cierra sesion automaticamente sin actividad.</span
            >
          </label>
        </div>
      </div>

      <div class="flex justify-end">
        <button
          class="btn btn-primary"
          type="button"
          onclick={handleSavePanelConfig}
          disabled={busy}>Guardar expiraciones</button
        >
      </div>
    </div>
  </div>
</section>

<dialog bind:this={confirmPauseDialog} class="modal">
  <div class="modal-box">
    <h3 class="text-lg font-bold">Pausar pedidos publicos</h3>
    <p class="py-4">
      Los clientes podran seguir viendo el catalogo, pero no podran crear
      pedidos nuevos hasta reactivar la tienda.
    </p>
    <div class="modal-action">
      <form method="dialog">
        <button class="btn">Cancelar</button>
      </form>
      <button
        class="btn btn-error"
        type="button"
        onclick={confirmPauseOrders}
        disabled={busy}>Pausar pedidos</button
      >
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
