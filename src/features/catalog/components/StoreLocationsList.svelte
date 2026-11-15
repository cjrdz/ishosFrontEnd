<script lang="ts">
  /**
   * The locations (sucursales) from the backend: a compact list (cart),
   * cards with directions and WhatsApp (home), or cards with the embedded
   * map (About).
   * Each location shows its own WhatsApp and live open/closed status.
   */
  import { onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import {
    fetchStoreLocations,
    type PublicLocation,
  } from "@features/catalog/lib/api";
  import {
    DEFAULT_WHATSAPP,
    displayPhone,
    whatsappLink,
  } from "@features/catalog/lib/locations";

  interface Props {
    variant?: "list" | "cards" | "maps";
  }
  let { variant = "list" }: Props = $props();

  let locations = $state<PublicLocation[]>([]);
  let loaded = $state(false);
  let failed = $state(false);

  onMount(() => {
    fetchStoreLocations()
      .then((value) => (locations = value))
      .catch(() => (failed = true))
      .finally(() => (loaded = true));
  });

  function openNow(l: PublicLocation): boolean {
    return !l.hours?.configured || l.hours.is_open;
  }

  /** Only Google Maps embeds are framed (the URL is typed in by staff, and
   *  the CSP frame-src allows www.google.com only). */
  function safeEmbed(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" &&
        parsed.hostname === "www.google.com" &&
        parsed.pathname.startsWith("/maps/embed")
        ? parsed.toString()
        : null;
    } catch {
      return null;
    }
  }

  function directions(l: PublicLocation): string {
    if (l.maps_url) return l.maps_url;
    return `https://maps.google.com/?q=${encodeURIComponent(`${l.name}, ${l.address}`)}`;
  }
</script>

{#if !loaded}
  <div
    class={variant === "list" ? "space-y-2" : "grid gap-4 md:grid-cols-3"}
    aria-hidden="true"
  >
    {#each Array.from({ length: 3 }) as _, i (i)}
      <div
        class={`skeleton w-full ${variant === "maps" ? "h-64" : variant === "cards" ? "h-44" : "h-14"}`}
      ></div>
    {/each}
  </div>
{:else if failed || locations.length === 0}
  <p class="text-base-content/75">
    No pudimos cargar las sucursales. Escríbenos por
    <a
      class="link text-primary"
      href={whatsappLink(DEFAULT_WHATSAPP)}
      target="_blank"
      rel="noopener noreferrer">WhatsApp</a
    > y te decimos cómo llegar.
  </p>
{:else if variant === "list"}
  <ul class="divide-y divide-base-300 rounded-field border border-base-300">
    {#each locations as location (location.id)}
      <li class="flex items-center justify-between gap-3 px-3 py-2.5">
        <span class="min-w-0">
          <span class="block font-semibold">{location.name}</span>
          <span class="block text-sm text-ink-muted"
            >{location.address || "Ahuachapán, El Salvador"}</span
          >
        </span>
        <a
          href={directions(location)}
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-outline shrink-0 rounded-full min-h-11"
          aria-label={`Cómo llegar a ${location.name}`}
        >
          <Icon icon="lucide:navigation" class="size-4" aria-hidden="true" />
          Cómo llegar
        </a>
      </li>
    {/each}
  </ul>
{:else if variant === "cards"}
  <div class="grid gap-4 md:grid-cols-3">
    {#each locations as location (location.id)}
      <article
        class="flex flex-col gap-3 rounded-[1.375rem] border border-base-300 bg-base-100 p-5"
      >
        <div class="flex items-start justify-between gap-3">
          <h3 class="text-xl font-bold text-head">{location.name}</h3>
          <span
            class={`status-chip status-chip--sm ${openNow(location) ? "status-chip--ready" : "status-chip--done"}`}
            >{openNow(location) ? "Abierto" : "Cerrado"}</span
          >
        </div>
        <p class="text-ink-muted">
          {location.address || "Ahuachapán, El Salvador"}
        </p>
        <div class="mt-auto flex flex-wrap gap-2 pt-1">
          <a
            href={directions(location)}
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-primary min-h-11 rounded-full"
            aria-label={`Cómo llegar a ${location.name}`}
          >
            <Icon icon="lucide:navigation" class="size-4" aria-hidden="true" />
            Cómo llegar
          </a>
          <a
            href={whatsappLink(location.whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-outline min-h-11 rounded-full border-base-300"
            aria-label={`WhatsApp de ${location.name}`}
          >
            <Icon icon="mdi:whatsapp" class="size-4" aria-hidden="true" />
            {displayPhone(location.whatsapp || DEFAULT_WHATSAPP)}
          </a>
        </div>
      </article>
    {/each}
  </div>
{:else}
  <div class="grid gap-4 md:grid-cols-2">
    {#each locations as location (location.id)}
      <article
        class="overflow-hidden rounded-box border border-base-300 bg-base-100"
      >
        <div class="relative aspect-[16/10] bg-base-200">
          <Icon
            icon="lucide:map-pin"
            class="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          {#if safeEmbed(location.maps_embed_url)}
            <iframe
              src={safeEmbed(location.maps_embed_url)}
              class="relative h-full w-full border-0"
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
              allowfullscreen
              title={`Mapa de ${location.name}`}
            ></iframe>
          {/if}
        </div>
        <div class="space-y-3 p-4">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 class="font-bold">{location.name}</h3>
              <p class="text-sm text-ink-muted">
                {location.address || "Ahuachapán, El Salvador"}
              </p>
            </div>
            <span
              class={`status-chip status-chip--sm ${openNow(location) ? "status-chip--ready" : "status-chip--done"}`}
              >{openNow(location) ? "Abierto" : "Cerrado"}</span
            >
          </div>
          <div class="flex flex-wrap gap-2">
            <a
              href={directions(location)}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-primary min-h-11 rounded-full"
            >
              <Icon
                icon="lucide:navigation"
                class="size-4"
                aria-hidden="true"
              />
              Cómo llegar
            </a>
            <a
              href={whatsappLink(location.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-outline min-h-11 rounded-full border-base-300"
              aria-label={`WhatsApp de ${location.name}`}
            >
              <Icon icon="mdi:whatsapp" class="size-4" aria-hidden="true" />
              {displayPhone(location.whatsapp || DEFAULT_WHATSAPP)}
            </a>
          </div>
        </div>
      </article>
    {/each}
  </div>
{/if}
