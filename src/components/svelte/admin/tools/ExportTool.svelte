<script lang="ts">
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
  let purgeConfirmDialog: HTMLDialogElement | null = null;
  let lastExportedStartDate = $state("");
  let lastExportedEndDate = $state("");
  let selectedPurgeStatuses = $state<OrderStatus[]>(["entregada", "cancelada"]);

  const purgeStatusOptions: Array<{ value: OrderStatus; label: string }> = [
    { value: "pendiente_revision", label: "Pendiente revision" },
    { value: "recibida", label: "Recibida" },
    { value: "en_proceso", label: "En proceso" },
    { value: "lista", label: "Lista" },
    { value: "entregada", label: "Entregada" },
    { value: "cancelada", label: "Cancelada" },
  ];

  function toISODate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  function applyRangePreset(days: 7 | 30 | 90) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    startDate = toISODate(start);
    endDate = toISODate(end);
    error = "";
  }

  function download(content: string, mimeType: string, filename: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function buildFilename(prefix: string, extension: string): string {
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10);
    return `${prefix}_${stamp}.${extension}`;
  }

  function ensureDates(): boolean {
    if (!startDate || !endDate) {
      error = "Debes seleccionar fecha inicio y fecha fin";
      notice = "";
      return false;
    }

    if (new Date(endDate) < new Date(startDate)) {
      error = "La fecha fin debe ser mayor o igual a la fecha inicio";
      notice = "";
      return false;
    }

    error = "";
    return true;
  }

  function hasExportForCurrentRange(): boolean {
    return (
      Boolean(startDate) &&
      Boolean(endDate) &&
      startDate === lastExportedStartDate &&
      endDate === lastExportedEndDate
    );
  }

  async function handleExport(format: "csv" | "json") {
    if (!ensureDates()) return;

    exporting = true;
    notice = "";

    try {
      const blob = await exportOrders(startDate, endDate, format);
      const content = await blob.text();
      const mimeType = format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8";
      download(content, mimeType, buildFilename(`ordenes_${startDate}_a_${endDate}`, format));
      lastExportedStartDate = startDate;
      lastExportedEndDate = endDate;
      notice = `Exportacion ${format.toUpperCase()} completada`;
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "No se pudo exportar ordenes";
    } finally {
      exporting = false;
    }
  }

  function openPurgeModal() {
    if (!ensureDates()) return;

    if (selectedPurgeStatuses.length === 0) {
      error = "Selecciona al menos un estado para eliminar";
      notice = "";
      return;
    }

    if (!hasExportForCurrentRange()) {
      error = "Primero debes exportar CSV o JSON para este mismo rango de fechas";
      notice = "";
      return;
    }

    purgeConfirmDialog?.showModal();
  }

  function closePurgeModal() {
    purgeConfirmDialog?.close();
  }

  async function confirmPurgeExportedOrders() {
    purgeConfirmDialog?.close();

    if (!ensureDates()) return;

    deleting = true;
    notice = "";
    try {
      const result = await purgeOrdersByStatuses(startDate, endDate, selectedPurgeStatuses);
      const deletedCount = result.deleted_count ?? result.archived_count ?? 0;
      notice = `${deletedCount} ordenes eliminadas correctamente (${selectedPurgeStatuses.join(", ")})`;
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "No se pudieron eliminar ordenes";
    } finally {
      deleting = false;
    }
  }

  function togglePurgeStatus(status: OrderStatus, checked: boolean) {
    if (checked) {
      if (!selectedPurgeStatuses.includes(status)) {
        selectedPurgeStatuses = [...selectedPurgeStatuses, status];
      }
      return;
    }

    selectedPurgeStatuses = selectedPurgeStatuses.filter((current) => current !== status);
  }
</script>

<section class="space-y-4">
  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="card-title">Exportacion y mantenimiento</h2>
          <p class="text-sm text-base-content/70">
            Exporta por rango de fechas y elimina por estados para mantener la base de datos ligera.
          </p>
        </div>
        <div class="join">
          <button class="btn btn-sm btn-outline join-item" type="button" onclick={() => applyRangePreset(7)}>7 dias</button>
          <button class="btn btn-sm btn-outline join-item" type="button" onclick={() => applyRangePreset(30)}>30 dias</button>
          <button class="btn btn-sm btn-outline join-item" type="button" onclick={() => applyRangePreset(90)}>90 dias</button>
        </div>
      </div>
    </div>
  </div>

  <div class="card bg-base-100 shadow">
    <div class="card-body space-y-5">
    {#if error}
      <div class="alert alert-error"><span>{error}</span></div>
    {/if}
    {#if notice}
      <div class="alert alert-success"><span>{notice}</span></div>
    {/if}

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label class="form-control gap-2 xl:col-span-2">
        <span id="export-start-date-label" class="label-text">Fecha inicio</span>
        <input
          id="export-start-date"
          type="date"
          class="input input-bordered h-11 w-full"
          bind:value={startDate}
          aria-labelledby="export-start-date-label"
        />
      </label>

      <label class="form-control gap-2 xl:col-span-2">
        <span id="export-end-date-label" class="label-text">Fecha fin</span>
        <input
          id="export-end-date"
          type="date"
          class="input input-bordered h-11 w-full"
          bind:value={endDate}
          aria-labelledby="export-end-date-label"
        />
      </label>
    </div>

    <div class="rounded-box border border-base-300/70 bg-base-200/35 p-3 md:p-4">
      <div class="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-end">
      <button
        class="btn btn-primary w-full md:w-auto"
        class:loading={exporting}
        disabled={exporting || deleting}
        onclick={() => handleExport("csv")}
      >
        Exportar CSV
      </button>

      <button
        class="btn btn-outline w-full md:w-auto"
        class:loading={exporting}
        disabled={exporting || deleting}
        onclick={() => handleExport("json")}
      >
        Exportar JSON
      </button>

      <button
        class="btn btn-soft btn-error w-full md:w-auto"
        class:loading={deleting}
        disabled={deleting || exporting || !hasExportForCurrentRange()}
        onclick={openPurgeModal}
      >
        Eliminar exportadas
      </button>
      </div>
    </div>

    <div class="alert alert-info py-3">
      <span>Por defecto se eliminan entregadas y canceladas. Puedes elegir otros estados en el modal antes de proceder.</span>
    </div>

    <p class="text-xs text-base-content/70">
      Al hacer click en "Eliminar exportadas", se abrira una confirmacion explicando el impacto. Solo estara disponible si ya exportaste CSV o JSON del rango seleccionado.
    </p>
  </div>
  </div>
</section>

<dialog class="modal" bind:this={purgeConfirmDialog}>
  <div class="modal-box max-w-lg">
    <h3 class="font-bold text-lg">Confirmar eliminacion de ordenes</h3>
    <p class="py-3 text-sm text-base-content/80">
      Se eliminaran permanentemente las ordenes entregadas entre <strong>{startDate}</strong> y <strong>{endDate}</strong>.
      Esta accion libera espacio real en base de datos para ayudarte con los limites de Neon.
    </p>
    <div class="mt-4 rounded-box border border-base-300/70 bg-base-200/35 p-3">
      <p class="text-sm font-medium">Estados a eliminar</p>
      <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {#each purgeStatusOptions as option}
          <label class="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300/70 px-3 py-2">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              checked={selectedPurgeStatuses.includes(option.value)}
              onchange={(event) => togglePurgeStatus(option.value, (event.currentTarget as HTMLInputElement).checked)}
            />
            <span class="label-text">{option.label}</span>
          </label>
        {/each}
      </div>
    </div>

    <p class="mt-3 text-sm text-base-content/80">
      Ya realizaste una exportacion para este rango, por lo que conservas respaldo en CSV o JSON antes de proceder.
    </p>

    <div class="modal-action">
      <button class="btn btn-outline" type="button" onclick={closePurgeModal}>Cancelar</button>
      <button
        class="btn btn-error"
        type="button"
        class:loading={deleting}
        disabled={deleting || exporting || selectedPurgeStatuses.length === 0}
        onclick={confirmPurgeExportedOrders}
      >
        Proceder y eliminar
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="submit">close</button>
  </form>
</dialog>
