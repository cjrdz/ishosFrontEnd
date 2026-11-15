<script lang="ts">
  /**
   * Weekly opening hours of one location. Customers see "Abierto · cierra
   * 9:00 pm" from this schedule, and online orders are refused outside it.
   * Leaving every day empty means "no schedule": only the orders switch
   * applies.
   */
  import Icon from "@shared/components/AppIcon.svelte";
  import { showToast } from "@shared/toast/toast";
  import {
    updateLocation,
    type AdminLocation,
    type WeekDay,
    type WeeklyHours,
  } from "@features/admin-management/lib/bff";
  import {
    MAX_RANGES_PER_DAY,
    WEEK_DAYS,
    copyDayToAll,
    emptyWeek,
    validateWeek,
  } from "../lib/store-hours-form";

  interface Props {
    locationId: string;
    initialHours: Partial<WeeklyHours>;
    /** Other locations whose schedule can be copied in one step. */
    copySources?: { name: string; hours: Partial<WeeklyHours> }[];
    onSaved?: (location: AdminLocation) => void;
  }

  let { locationId, initialHours, copySources = [], onSaved }: Props = $props();

  function copyFrom(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const source = copySources[Number(select.value)];
    select.value = "";
    if (!source) return;
    week = toWeek(source.hours);
    showToast(`Horario de ${source.name} copiado. Revisa y guarda.`, {
      tone: "info",
    });
  }

  function toWeek(hours: Partial<WeeklyHours> | undefined): WeeklyHours {
    const next = emptyWeek();
    for (const { key } of WEEK_DAYS) next[key] = hours?.[key] ?? [];
    return next;
  }

  // The editor owns its draft; the initial value only seeds it.
  // svelte-ignore state_referenced_locally
  let week = $state<WeeklyHours>(toWeek(initialHours));
  // svelte-ignore state_referenced_locally
  let saved = $state(JSON.stringify(toWeek(initialHours)));
  let saving = $state(false);
  let showErrors = $state(false);

  const errors = $derived(validateWeek(week));
  const hasErrors = $derived(Object.keys(errors).length > 0);
  const dirty = $derived(JSON.stringify(week) !== saved);
  const configured = $derived(
    WEEK_DAYS.some(({ key }) => week[key].length > 0),
  );

  function setOpen(day: WeekDay, open: boolean) {
    week[day] = open ? [{ open: "14:00", close: "21:00" }] : [];
  }

  function addRange(day: WeekDay) {
    const last = week[day].at(-1);
    week[day] = [
      ...week[day],
      { open: last?.close ?? "14:00", close: "21:00" },
    ];
  }

  function removeRange(day: WeekDay, index: number) {
    week[day] = week[day].filter((_, i) => i !== index);
  }

  async function save() {
    showErrors = true;
    if (hasErrors) return;
    saving = true;
    try {
      const updated = await updateLocation(locationId, { hours: week });
      const next = toWeek(updated.hours);
      week = next;
      saved = JSON.stringify(next);
      onSaved?.(updated);
      showErrors = false;
      showToast("Horario guardado", { tone: "success" });
    } catch {
      showToast(
        "No se pudo guardar el horario. Revisa las horas e intenta de nuevo.",
        {
          tone: "error",
          durationMs: 6000,
        },
      );
    } finally {
      saving = false;
    }
  }
</script>

<div class="space-y-3 rounded-lg border border-base-300 p-4">
  <div class="flex flex-wrap items-start justify-between gap-2">
    <div>
      <p class="font-medium">Horario de atención</p>
      <p class="text-sm text-ink-muted">
        {configured
          ? "Fuera de este horario la tienda muestra «Cerrado» y no acepta pedidos en línea."
          : "Sin horario: la tienda acepta pedidos mientras el interruptor de pedidos esté activo."}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      {#if copySources.length > 0}
        <select
          class="select select-sm select-bordered w-auto"
          aria-label="Copiar horario de otra sucursal"
          onchange={copyFrom}
        >
          <option value="">Copiar horario de…</option>
          {#each copySources as source, index (source.name)}
            <option value={String(index)}>{source.name}</option>
          {/each}
        </select>
      {/if}
      {#if week.mon.length > 0}
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          onclick={() => (week = copyDayToAll(week, "mon"))}
        >
          <Icon icon="lucide:copy" class="size-4" aria-hidden="true" />
          Copiar lunes a todos
        </button>
      {/if}
    </div>
  </div>

  <ul class="divide-y divide-base-300">
    {#each WEEK_DAYS as day (day.key)}
      {@const ranges = week[day.key]}
      {@const error = showErrors ? errors[day.key] : undefined}
      <li
        class="grid gap-2 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start"
      >
        <label class="flex min-h-10 items-center gap-3">
          <input
            type="checkbox"
            class="toggle toggle-primary toggle-sm"
            checked={ranges.length > 0}
            onchange={(event) =>
              setOpen(
                day.key,
                (event.currentTarget as HTMLInputElement).checked,
              )}
          />
          <span class="font-medium">{day.label}</span>
        </label>

        <div class="space-y-2">
          {#if ranges.length === 0}
            <p class="flex min-h-10 items-center text-sm text-ink-muted">
              Cerrado
            </p>
          {/if}
          {#each ranges as range, index (index)}
            <div
              class="grid max-w-sm grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2"
            >
              <input
                type="time"
                step="900"
                class="input input-sm w-full min-w-0"
                class:input-error={!!error}
                aria-label={`${day.label}: abre`}
                bind:value={range.open}
              />
              <span class="text-sm text-ink-muted">a</span>
              <input
                type="time"
                step="900"
                class="input input-sm w-full min-w-0"
                class:input-error={!!error}
                aria-label={`${day.label}: cierra`}
                bind:value={range.close}
              />
              <button
                type="button"
                class="btn btn-ghost btn-sm btn-square"
                aria-label={`Quitar horario ${index + 1} del ${day.label.toLowerCase()}`}
                onclick={() => removeRange(day.key, index)}
              >
                <Icon icon="lucide:x" class="size-4" aria-hidden="true" />
              </button>
            </div>
          {/each}
          {#if ranges.length > 0 && ranges.length < MAX_RANGES_PER_DAY}
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onclick={() => addRange(day.key)}
            >
              <Icon icon="lucide:plus" class="size-3.5" aria-hidden="true" />
              Agregar horario (p. ej. turno partido)
            </button>
          {/if}
          {#if error}
            <p class="text-sm text-error" role="alert">{error}</p>
          {/if}
        </div>
      </li>
    {/each}
  </ul>

  <div class="flex flex-wrap items-center justify-end gap-2">
    {#if dirty}
      <span class="text-sm text-ink-muted">Cambios sin guardar</span>
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        onclick={() => void load()}
        disabled={saving}
      >
        Descartar
      </button>
    {/if}
    <button
      type="button"
      class="btn btn-primary btn-sm"
      onclick={() => void save()}
      disabled={saving || !dirty}
    >
      {saving ? "Guardando…" : "Guardar horario"}
    </button>
  </div>
</div>
