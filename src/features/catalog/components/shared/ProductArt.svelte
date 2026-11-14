<script lang="ts">
  /**
   * Brand illustration used when a product has no photo (or it fails to
   * load), so cards never show a broken-image icon. The shape follows the
   * product's category; scoop colours vary per product so a grid of
   * illustrations doesn't look repetitive.
   */
  interface Props {
    name: string;
    category?: string;
    scoops?: number;
    seed?: string;
  }
  let { name, category = "", scoops = 1, seed = name }: Props = $props();

  // Gelato tones: leche, fresa, pistacho, chocolate, mango, café, maracuyá, jocote.
  const TONES = [
    "#f6efe0",
    "#f4a6be",
    "#b9d98f",
    "#7a4a2e",
    "#f7c548",
    "#a0714f",
    "#f2d06b",
    "#e07a4f",
  ];

  function hash(value: string): number {
    let h = 0;
    for (let i = 0; i < value.length; i++)
      h = (h * 31 + value.charCodeAt(i)) >>> 0;
    return h;
  }

  type Kind = "cone" | "cup" | "bowl" | "drink" | "banana" | "tub";
  const kind = $derived.by((): Kind => {
    const text = `${category} ${name}`.toLowerCase();
    if (/chocobanan/.test(text)) return "banana";
    if (/bebida|malteada|frappe|agua|batido/.test(text)) return "drink";
    if (/cono|barquillo/.test(text)) return "cone";
    if (/bowl/.test(text)) return "bowl";
    if (/llevar|pinta|litro|compartir|cajita/.test(text)) return "tub";
    return "cup";
  });

  const h = $derived(hash(seed));
  const count = $derived(Math.max(1, Math.min(scoops || 1, 3)));
  const tone = (i: number) => TONES[(h + i * 3) % TONES.length];
</script>

<svg viewBox="0 0 120 90" class="product-art" role="img" aria-label={name}>
  <rect width="120" height="90" class="art-bg" />
  <circle cx="98" cy="18" r="26" class="art-blob art-blob--pink" />
  <circle cx="16" cy="78" r="20" class="art-blob art-blob--teal" />
  {#if kind === "drink"}
    <path d="M44 18h32l-5 58H49z" fill="#d9eef3" />
    <path d="M46 36h28l-3 38H49z" fill={tone(0)} />
    <rect
      x="62"
      y="8"
      width="4"
      height="22"
      rx="2"
      fill="var(--color-secondary)"
      transform="rotate(14 64 19)"
    />
  {:else if kind === "banana"}
    <rect x="22" y="40" width="70" height="20" rx="10" fill="#f5d76e" />
    <rect x="22" y="40" width="42" height="20" rx="10" fill="#5a3320" />
    <rect x="90" y="46" width="18" height="7" rx="3.5" fill="#c8a27a" />
  {:else}
    {#each Array.from({ length: count }) as _, i}
      <circle
        cx={60 + (i - (count - 1) / 2) * 20}
        cy={kind === "cone" ? 34 - (i % 2) * 6 : 40 - (i % 2) * 6}
        r="17"
        fill={tone(i)}
      />
    {/each}
    {#if kind === "cone"}
      <path d="M43 42h34L60 86z" fill="#d9a35b" />
      <path
        d="M50 50l18 10M47 58l22 12M55 72l10 6"
        stroke="#b7833f"
        stroke-width="2"
      />
    {:else if kind === "bowl"}
      <path
        d="M28 46h64c0 18-14 30-32 30S28 64 28 46z"
        fill="var(--color-primary)"
        opacity="0.85"
      />
    {:else if kind === "tub"}
      <path
        d="M32 46h56l-5 32H37z"
        fill="#ffffff"
        stroke="var(--color-base-300)"
      />
      <rect
        x="44"
        y="56"
        width="32"
        height="10"
        rx="5"
        fill="var(--color-secondary)"
        opacity="0.85"
      />
    {:else}
      <path d="M34 46h52l-7 30H41z" fill="var(--color-accent)" />
    {/if}
  {/if}
</svg>

<style>
  .product-art {
    width: 100%;
    height: 100%;
    display: block;
  }
  /* Brand pink + teal accents; quieter on dark so they don't turn muddy. */
  .art-bg {
    fill: var(--color-base-200);
  }
  .art-blob--pink {
    fill: #f9b4da;
    opacity: 0.4;
  }
  .art-blob--teal {
    fill: var(--color-primary);
    opacity: 0.14;
  }
  :global([data-theme="night"]) .art-bg {
    fill: color-mix(in oklab, var(--color-base-100) 70%, var(--color-base-300));
  }
  :global([data-theme="night"]) .art-blob--pink {
    opacity: 0.16;
  }
  :global([data-theme="night"]) .art-blob--teal {
    opacity: 0.18;
  }
</style>
