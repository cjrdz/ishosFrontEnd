<script lang="ts">
  /**
   * Sucursales: per-location switches, contact details and opening hours.
   *
   * Admins see and edit every location and can add new ones. A manager only
   * sees their own location and may change its hours and orders switch (the
   * backend enforces the same rule).
   */
  import { onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import { showToast } from "@shared/toast/toast";
  import {
    createLocation,
    listLocations,
    updateLocation,
    type AdminLocation,
    type LocationPatch,
  } from "@features/admin-management/lib/bff";
  import StoreHoursEditor from "./StoreHoursEditor.svelte";
  import PublicTrackingSetting from "./PublicTrackingSetting.svelte";

  interface Props {
    isAdmin: boolean;
  }

  let { isAdmin }: Props = $props();

  let locations = $state<AdminLocation[]>([]);
  let loading = $state(true);
  let loadError = $state("");
  let savingId = $state<string | null>(null);
  /** Contact-details drafts by location id (admin). */
  let drafts = $state<Record<string, ContactDraft>>({});
  let fieldErrors = $state<Record<string, Record<string, string>>>({});
  let newLocation = $state({ name: "", slug: "" });
  let creating = $state(false);
  /** Location shown in the editor (admins switch with the tabs). */
  let selectedId = $state<string | null>(null);
  const selected = $derived(
    locations.find((l) => l.id === selectedId) ?? locations[0] ?? null,
  );

  type ContactDraft = {
    name: string;
    address: string;
    whatsapp: string;
    phone: string;
    maps_url: string;
    maps_embed_url: string;
  };

  function toDraft(l: AdminLocation): ContactDraft {
    return {
      name: l.name,
      address: l.address,
      whatsapp: l.whatsapp,
      phone: l.phone,
      maps_url: l.maps_url,
      maps_embed_url: l.maps_embed_url,
    };
  }

  onMount(() => {
    void load();
  });

  async function load() {
    loading = true;
    loadError = "";
    try {
      const { data } = await listLocations();
      locations = data ?? [];
      drafts = Object.fromEntries(locations.map((l) => [l.id, toDraft(l)]));
      selectedId ??= locations[0]?.id ?? null;
    } catch {
      loadError = "No se pudieron cargar las sucursales.";
    } finally {
      loading = false;
    }
  }

  function replace(updated: AdminLocation) {
    locations = locations.map((l) => (l.id === updated.id ? updated : l));
  }

  function errorFields(error: unknown): Record<string, string> {
    const details = (error as { details?: Record<string, string[]> })?.details;
    if (!details) return {};
    return Object.fromEntries(
      Object.entries(details).map(([field, messages]) => [field, messages[0]]),
    );
  }

  async function save(
    location: AdminLocation,
    patch: LocationPatch,
    okMessage: string,
  ) {
    savingId = location.id;
    try {
      const updated = await updateLocation(location.id, patch);
      replace(updated);
      fieldErrors = { ...fieldErrors, [location.id]: {} };
      showToast(okMessage, { tone: "success" });
      return updated;
    } catch (error) {
      fieldErrors = { ...fieldErrors, [location.id]: errorFields(error) };
      showToast(
        error instanceof Error && error.message
          ? error.message
          : "No se pudo guardar la sucursal.",
        { tone: "error", durationMs: 6000 },
      );
      return null;
    } finally {
      savingId = null;
    }
  }

  function toggle(
    location: AdminLocation,
    field: "orders_enabled" | "online_orders_enabled" | "is_active",
    value: boolean,
  ) {
    const messages = {
      orders_enabled: value ? "Órdenes activadas" : "Órdenes pausadas",
      online_orders_enabled: value
        ? "Pedidos en línea activados"
        : "Pedidos en línea desactivados",
      is_active: value ? "Sucursal activada" : "Sucursal desactivada",
    };
    void save(
      location,
      { [field]: value },
      `${location.name}: ${messages[field]}`,
    );
  }

  function saveContact(location: AdminLocation) {
    const draft = drafts[location.id];
    if (!draft) return;
    void save(
      location,
      { ...draft },
      `${draft.name || location.name} guardada`,
    );
  }

  function slugify(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function addLocation(event: SubmitEvent) {
    event.preventDefault();
    const name = newLocation.name.trim();
    const slug = newLocation.slug.trim() || slugify(name);
    if (!name || !slug) return;
    creating = true;
    try {
      const created = await createLocation({
        name,
        slug,
        sort_order: locations.length + 1,
      });
      locations = [...locations, created];
      drafts = { ...drafts, [created.id]: toDraft(created) };
      selectedId = created.id;
      newLocation = { name: "", slug: "" };
      showToast(`${created.name} agregada. Completa sus datos y horario.`, {
        tone: "success",
      });
    } catch (error) {
      showToast(
        error instanceof Error && error.message
          ? error.message
          : "No se pudo agregar la sucursal.",
        { tone: "error", durationMs: 6000 },
      );
    } finally {
      creating = false;
    }
  }

  function statusTone(l: AdminLocation): string {
    if (!l.is_active || !l.orders_enabled) return "bg-base-content/30";
    if (l.status?.configured && !l.status.is_open) return "bg-warning";
    return "bg-success";
  }

  function statusText(l: AdminLocation): string {
    if (!l.is_active) return "Inactiva";
    if (!l.orders_enabled) return "Órdenes pausadas";
    if (l.status?.configured && !l.status.is_open) return "Cerrada ahora";
    return "Abierta";
  }
</script>

<div id="operacion-tienda" class="card scroll-mt-4 bg-base-100 shadow">
  <div class="card-body gap-4">
    <div>
      <h2 class="card-title">
        {isAdmin ? "Sucursales" : "Mi sucursal"}
      </h2>
      <p class="text-sm text-base-content/70">
        {isAdmin
          ? "Cada sucursal tiene su horario, sus órdenes, su inventario y sus agotados. El menú y los precios son los mismos en todas."
          : "Horario y órdenes de tu sucursal."}
      </p>
    </div>

    {#if isAdmin}
      <PublicTrackingSetting />
    {/if}

    {#if loading}
      <div class="skeleton h-40 w-full"></div>
    {:else if loadError}
      <div class="alert alert-warning">
        <span>{loadError}</span>
        <button type="button" class="btn btn-sm" onclick={() => void load()}
          >Reintentar</button
        >
      </div>
    {:else}
      {#if locations.length > 1}
        <div
          role="tablist"
          aria-label="Sucursales"
          class="flex gap-2 overflow-x-auto pb-1"
        >
          {#each locations as location (location.id)}
            {@const active = selected?.id === location.id}
            <button
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`loc-panel-${location.id}`}
              class={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${active ? "border-primary bg-primary/10 font-semibold text-primary" : "border-base-300 hover:bg-base-200"}`}
              onclick={() => (selectedId = location.id)}
            >
              <span
                class={`size-2 rounded-full ${statusTone(location)}`}
                aria-hidden="true"
              ></span>
              {location.name}
              <span class="sr-only">· {statusText(location)}</span>
            </button>
          {/each}
        </div>
      {/if}

      {#each selected ? [selected] : [] as location (location.id)}
        {@const draft = drafts[location.id]}
        {@const errors = fieldErrors[location.id] ?? {}}
        {@const busy = savingId === location.id}
        <section
          id={`loc-panel-${location.id}`}
          role={locations.length > 1 ? "tabpanel" : undefined}
          class="space-y-4 rounded-box border border-base-300 p-4"
          aria-labelledby={`loc-${location.id}`}
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 id={`loc-${location.id}`} class="text-lg font-semibold">
              {location.name}
            </h3>
            <span
              class={`badge ${location.is_active && location.orders_enabled ? "badge-success" : "badge-ghost"} badge-soft`}
              >{statusText(location)}</span
            >
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <label
              class="flex items-start justify-between gap-3 rounded-lg border border-base-300 p-3"
            >
              <span>
                <span class="block font-medium">Recibe órdenes</span>
                <span class="block text-sm text-ink-muted"
                  >Apágalo para pausar todas las órdenes de esta sucursal.</span
                >
              </span>
              <input
                type="checkbox"
                class="toggle toggle-success"
                checked={location.orders_enabled}
                disabled={busy}
                onchange={(e) =>
                  toggle(
                    location,
                    "orders_enabled",
                    (e.currentTarget as HTMLInputElement).checked,
                  )}
              />
            </label>

            {#if isAdmin}
              <label
                class="flex items-start justify-between gap-3 rounded-lg border border-base-300 p-3"
              >
                <span>
                  <span class="block font-medium">Pedidos en línea</span>
                  <span class="block text-sm text-ink-muted"
                    >Los clientes pueden pedir desde la página web.</span
                  >
                </span>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  checked={location.online_orders_enabled}
                  disabled={busy}
                  onchange={(e) =>
                    toggle(
                      location,
                      "online_orders_enabled",
                      (e.currentTarget as HTMLInputElement).checked,
                    )}
                />
              </label>
            {/if}
          </div>

          {#if isAdmin && draft}
            <details class="collapse collapse-arrow border border-base-300">
              <summary class="collapse-title font-medium"
                >Datos de contacto y mapa</summary
              >
              <div class="collapse-content">
                <form
                  class="grid gap-3 sm:grid-cols-2"
                  onsubmit={(e) => {
                    e.preventDefault();
                    saveContact(location);
                  }}
                >
                  <label class="form-control">
                    <span class="label-text text-sm">Nombre</span>
                    <input
                      class="input input-bordered input-sm w-full"
                      bind:value={draft.name}
                      required
                      maxlength="120"
                      aria-invalid={!!errors.name}
                    />
                    {#if errors.name}<span class="text-xs text-error"
                        >{errors.name}</span
                      >{/if}
                  </label>
                  <label class="form-control">
                    <span class="label-text text-sm">Dirección</span>
                    <input
                      class="input input-bordered input-sm w-full"
                      bind:value={draft.address}
                      maxlength="255"
                    />
                  </label>
                  <label class="form-control">
                    <span class="label-text text-sm">WhatsApp</span>
                    <input
                      class="input input-bordered input-sm w-full"
                      bind:value={draft.whatsapp}
                      inputmode="tel"
                      placeholder="7645-4347"
                      aria-invalid={!!errors.whatsapp}
                    />
                    {#if errors.whatsapp}<span class="text-xs text-error"
                        >{errors.whatsapp}</span
                      >{/if}
                  </label>
                  <label class="form-control">
                    <span class="label-text text-sm">Teléfono</span>
                    <input
                      class="input input-bordered input-sm w-full"
                      bind:value={draft.phone}
                      inputmode="tel"
                      maxlength="30"
                    />
                  </label>
                  <label class="form-control sm:col-span-2">
                    <span class="label-text text-sm">Enlace de Google Maps</span
                    >
                    <input
                      class="input input-bordered input-sm w-full"
                      bind:value={draft.maps_url}
                      type="url"
                      placeholder="https://maps.app.goo.gl/…"
                      aria-invalid={!!errors.maps_url}
                    />
                    {#if errors.maps_url}<span class="text-xs text-error"
                        >{errors.maps_url}</span
                      >{/if}
                  </label>
                  <label class="form-control sm:col-span-2">
                    <span class="label-text text-sm"
                      >Mapa insertado (Google Maps → Compartir → Insertar un
                      mapa → copiar el enlace src)</span
                    >
                    <input
                      class="input input-bordered input-sm w-full"
                      bind:value={draft.maps_embed_url}
                      type="url"
                      placeholder="https://www.google.com/maps/embed?pb=…"
                      aria-invalid={!!errors.maps_embed_url}
                    />
                    {#if errors.maps_embed_url}<span class="text-xs text-error"
                        >{errors.maps_embed_url}</span
                      >{/if}
                  </label>
                  <div
                    class="flex flex-wrap items-center justify-between gap-2 sm:col-span-2"
                  >
                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        class="toggle toggle-sm"
                        checked={location.is_active}
                        disabled={busy}
                        onchange={(e) =>
                          toggle(
                            location,
                            "is_active",
                            (e.currentTarget as HTMLInputElement).checked,
                          )}
                      />
                      Sucursal activa (visible en la tienda)
                    </label>
                    <button
                      type="submit"
                      class="btn btn-primary btn-sm"
                      disabled={busy}
                    >
                      {busy ? "Guardando…" : "Guardar datos"}
                    </button>
                  </div>
                </form>
              </div>
            </details>
          {/if}

          {#key location.id}
            <StoreHoursEditor
              locationId={location.id}
              initialHours={location.hours}
              copySources={locations
                .filter((l) => l.id !== location.id)
                .map((l) => ({ name: l.name, hours: l.hours }))}
              onSaved={replace}
            />
          {/key}
        </section>
      {:else}
        <p class="text-sm text-ink-muted">No hay sucursales.</p>
      {/each}

      {#if isAdmin}
        <form
          class="flex flex-col gap-2 rounded-box border border-dashed border-base-300 p-4 sm:flex-row sm:items-end"
          onsubmit={addLocation}
        >
          <label class="form-control flex-1">
            <span class="label-text text-sm">Nueva sucursal</span>
            <input
              class="input input-bordered input-sm w-full"
              placeholder="Isho's Sucursal 4"
              bind:value={newLocation.name}
              maxlength="120"
              required
            />
          </label>
          <button
            type="submit"
            class="btn btn-outline btn-sm"
            disabled={creating || !newLocation.name.trim()}
          >
            <Icon icon="lucide:plus" class="h-4 w-4" />
            Agregar sucursal
          </button>
        </form>
      {/if}
    {/if}
  </div>
</div>
