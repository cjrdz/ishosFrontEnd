<script lang="ts">
  import Icon from "@iconify/svelte";
  import {
    exportOrders,
    purgeOrdersByStatuses,
    type OrderStatus,
  } from "../../../../lib/bff/admin";

  let startDate = $state("");
  let endDate = $state("");
  let exporting = $state(false);
  let deleting = $state(false);
  let error = $state("");
  let notice = $state("");
  let isCollapsed = $state(false);
  let lastExportedStartDate = $state("");
  let lastExportedEndDate = $state("");
  let lastExportFormat = $state<"csv" | "json" | null>(null);
  let selectedPurgeStatuses = $state<OrderStatus[]>(["entregada", "cancelada"]);
  let purgeConfirmDialog: HTMLDialogElement | null = null;

  const purgeStatusOptions: Array<{ value: OrderStatus; label: string; icon: string }> = [
    { value: "pendiente_revision", label: "Pendiente revisión", icon: "lucide:clock"         },
    { value: "recibida",           label: "Recibida",           icon: "lucide:circle-check"  },
    { value: "en_proceso",         label: "En proceso",         icon: "lucide:refresh-cw"    },
    { value: "lista",              label: "Lista",              icon: "lucide:bell"           },
    { value: "entregada",          label: "Entregada",          icon: "lucide:package"        },
    { value: "cancelada",          label: "Cancelada",          icon: "lucide:x-circle"       },
  ];

  function toISODate(d: Date) { return d.toISOString().slice(0, 10); }

  function formatDateDisplay(s: string) {
    if (!s) return "";
    return new Date(`${s}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  }

  function getDaysDiff() {
    if (!startDate || !endDate) return 0;
    return Math.ceil((new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86400000) + 1;
  }

  function applyPreset(days: 7 | 30 | 90) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    startDate = toISODate(start);
    endDate = toISODate(end);
    error = "";
    notice = "";
  }

  function ensureDates(): boolean {
    if (!startDate || !endDate) {
      error = "Selecciona fecha inicio y fecha fin";
      return false;
    }
    if (new Date(endDate) < new Date(startDate)) {
      error = "La fecha fin debe ser mayor o igual a la fecha inicio";
      return false;
    }
    error = "";
    return true;
  }

  function hasExportForCurrentRange() {
    return Boolean(startDate) && Boolean(endDate) &&
      startDate === lastExportedStartDate &&
      endDate === lastExportedEndDate;
  }

  function download(content: string, mime: string, filename: string) {
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([content], { type: mime })),
      download: filename,
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  async function handleExport(format: "csv" | "json") {
    if (!ensureDates()) return;
    exporting = true;
    notice = "";
    try {
      const blob = await exportOrders(startDate, endDate, format);
      const mime = format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8";
      download(await blob.text(), mime, `ordenes_${startDate}_a_${endDate}_${new Date().toISOString().slice(0,10)}.${format}`);
      lastExportedStartDate = startDate;
      lastExportedEndDate = endDate;
      lastExportFormat = format;
      notice = `Exportación ${format.toUpperCase()} completada. Ya puedes eliminar las órdenes si lo necesitas.`;
    } catch (err) {
      error = err instanceof Error ? err.message : "No se pudo exportar";
    } finally {
      exporting = false;
    }
  }

  function openPurgeModal() {
    if (!ensureDates()) return;
    if (selectedPurgeStatuses.length === 0) { error = "Selecciona al menos un estado"; return; }
    if (!hasExportForCurrentRange()) { error = "Primero exporta CSV o JSON para este rango de fechas"; return; }
    purgeConfirmDialog?.showModal();
  }

  async function confirmPurge() {
    purgeConfirmDialog?.close();
    if (!ensureDates()) return;
    deleting = true;
    notice = "";
    try {
      const result = await purgeOrdersByStatuses(startDate, endDate, selectedPurgeStatuses);
      const count = result.deleted_count ?? result.archived_count ?? 0;
      notice = `${count} órdenes eliminadas correctamente (${selectedPurgeStatuses.join(", ")})`;
      lastExportedStartDate = "";
      lastExportedEndDate = "";
    } catch (err) {
      error = err instanceof Error ? err.message : "No se pudieron eliminar órdenes";
    } finally {
      deleting = false;
    }
  }

  function toggleStatus(status: OrderStatus, checked: boolean) {
    selectedPurgeStatuses = checked
      ? [...new Set([...selectedPurgeStatuses, status])]
      : selectedPurgeStatuses.filter((s) => s !== status);
  }
</script>

<section class="space-y-4">
  <!-- Header — collapsible -->
  <div class="card bg-base-100 shadow border border-base-300/60">
    <div class="card-body py-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          class="flex items-center gap-3 text-left hover:opacity-75 transition-opacity"
          onclick={() => isCollapsed = !isCollapsed}
          aria-expanded={!isCollapsed}
        >
          <div class="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <Icon icon="lucide:upload" class="h-5 w-5 text-warning" />
          </div>
          <div>
            <h2 class="card-title text-base leading-tight">Exportación y mantenimiento</h2>
            <p class="text-xs text-base-content/55">Exporta datos y libera espacio en la BD</p>
          </div>
          <span class="h-4 w-4 text-base-content/40 transition-transform duration-200 ml-1 flex items-center" class:rotate-180={!isCollapsed}>
            <Icon icon="lucide:chevron-down" />
          </span>
        </button>

        <div class="join">
          {#each [[7,"7d"],[30,"30d"],[90,"90d"]] as [days, lbl]}
            <button
              type="button"
              class="btn btn-sm join-item"
              class:btn-neutral={startDate && endDate && getDaysDiff() === days}
              class:btn-ghost={!startDate || !endDate || getDaysDiff() !== days}
              onclick={() => applyPreset(days as 7|30|90)}
            >{lbl}</button>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- Collapsible body -->
  {#if !isCollapsed}
    <div class="card bg-base-100 shadow border border-base-300/60 animate-fadeIn">
      <div class="card-body space-y-5">

        {#if error}
          <div class="alert alert-error">
            <span>{error}</span>
            <button type="button" class="btn btn-ghost btn-xs ml-auto" onclick={() => error = ""}>✕</button>
          </div>
        {/if}

        {#if notice}
          <div class="alert alert-success"><span>{notice}</span></div>
        {/if}

        <!-- Step indicator -->
        <ul class="steps steps-horizontal w-full text-xs">
          <li class="step" class:step-primary={Boolean(startDate && endDate)}>Seleccionar fechas</li>
          <li class="step" class:step-primary={hasExportForCurrentRange()}>Exportar</li>
          <li class="step">Eliminar (opcional)</li>
        </ul>

        <!-- Date pickers -->
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <label class="flex items-center gap-3">
            <span class="w-24 shrink-0 text-sm font-medium text-base-content/60">Fecha inicio</span>
            <input id="export-start-date" type="date" class="input input-bordered h-11 w-full" bind:value={startDate} />
          </label>
          <label class="flex items-center gap-3">
            <span class="w-24 shrink-0 text-sm font-medium text-base-content/60">Fecha fin</span>
            <input id="export-end-date" type="date" class="input input-bordered h-11 w-full" bind:value={endDate} />
          </label>
        </div>

        <!-- Range summary chip -->
        {#if startDate && endDate}
          <div class="flex items-center gap-2 text-sm text-base-content/60">
            <Icon icon="lucide:calendar" class="h-4 w-4 shrink-0" />
            <span>{formatDateDisplay(startDate)} – {formatDateDisplay(endDate)}</span>
            <span class="badge badge-ghost badge-sm">{getDaysDiff()} días</span>
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:flex-wrap">
          <button
            class="btn btn-primary gap-2 w-full sm:w-auto"
            disabled={exporting || deleting || !startDate || !endDate}
            onclick={() => handleExport("csv")}
          >
            {#if exporting}<span class="loading loading-spinner loading-sm"></span>{:else}
              <Icon icon="lucide:file-down" class="h-4 w-4" />
            {/if}
            Exportar CSV
          </button>

          <button
            class="btn btn-outline gap-2 w-full sm:w-auto"
            disabled={exporting || deleting || !startDate || !endDate}
            onclick={() => handleExport("json")}
          >
            {#if exporting}<span class="loading loading-spinner loading-sm"></span>{:else}
              <Icon icon="lucide:file-code" class="h-4 w-4" />
            {/if}
            Exportar JSON
          </button>

          <div class="divider divider-horizontal hidden sm:flex my-0 h-9"></div>

          <div class="flex flex-col items-end gap-1 w-full sm:w-auto">
            <button
              class="btn btn-error btn-outline gap-2 w-full sm:w-auto"
              disabled={deleting || exporting || !hasExportForCurrentRange()}
              onclick={openPurgeModal}
            >
              {#if deleting}<span class="loading loading-spinner loading-sm"></span>{:else}
                <Icon icon="lucide:trash-2" class="h-4 w-4" />
              {/if}
              Eliminar exportadas
            </button>
            {#if !hasExportForCurrentRange() && startDate && endDate}
              <span class="text-xs text-base-content/40">Exporta primero este rango</span>
            {/if}
          </div>
        </div>

      </div>
    </div>
  {/if}
</section>

<!-- Purge modal -->
<dialog class="modal modal-bottom sm:modal-middle" bind:this={purgeConfirmDialog}>
  <div class="modal-box max-w-lg">
    <div class="flex items-center gap-3 mb-5">
      <div class="w-11 h-11 rounded-full bg-error/10 flex items-center justify-center shrink-0">
        <Icon icon="lucide:triangle-alert" class="h-6 w-6 text-error" />
      </div>
      <div>
        <h3 class="font-bold text-base">Confirmar eliminación</h3>
        <p class="text-xs text-base-content/55">{formatDateDisplay(startDate)} – {formatDateDisplay(endDate)} · Esta acción no se puede deshacer</p>
      </div>
    </div>

    <p class="text-sm font-medium mb-3">Estados a eliminar:</p>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 mb-5">
      {#each purgeStatusOptions as opt}
        <label
          class={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${selectedPurgeStatuses.includes(opt.value) ? "border-error bg-error/5" : "border-base-300"}`}
        >
          <input
            type="checkbox"
            class="checkbox checkbox-sm checkbox-error"
            checked={selectedPurgeStatuses.includes(opt.value)}
            onchange={(e) => toggleStatus(opt.value, (e.currentTarget as HTMLInputElement).checked)}
          />
            <Icon icon={opt.icon} class="h-4 w-4 text-base-content/40 shrink-0" />
          <span class="text-sm">{opt.label}</span>
        </label>
      {/each}
    </div>

    {#if lastExportFormat}
      <div class="alert bg-success/10 border-success/25 mb-4 py-2.5">
        <Icon icon="lucide:circle-check" class="text-success h-4 w-4 shrink-0" />
        <span class="text-sm">Tienes respaldo {lastExportFormat.toUpperCase()} de este rango.</span>
      </div>
    {/if}

    <div class="modal-action">
      <button class="btn btn-ghost btn-sm" type="button" onclick={() => purgeConfirmDialog?.close()}>Cancelar</button>
      <button
        class="btn btn-error btn-sm gap-2"
        type="button"
        disabled={deleting || selectedPurgeStatuses.length === 0}
        onclick={confirmPurge}
      >
        {#if deleting}<span class="loading loading-spinner loading-xs"></span>{/if}
        Eliminar órdenes
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button type="submit">close</button></form>
</dialog>

<style>
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .animate-fadeIn { animation: fadeIn 0.18s ease-out; }
</style>
