<script lang="ts">
  /**
   * "Receta familiar · Ahuachapán · 19·68" seal from the brand's graphic line.
   * Static SVG; colours follow the theme tokens.
   */
  let { size = 112, class: className = "" }: { size?: number; class?: string } =
    $props();
  const pathId = `stamp-${Math.random().toString(36).slice(2, 8)}`;
</script>

<svg
  class={`brand-stamp ${className}`}
  width={size}
  height={size}
  viewBox="0 0 128 128"
  role="img"
  aria-label="Sello: receta familiar, Ahuachapán, 19 68"
>
  <defs>
    <path id={pathId} d="M64,64 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0"
    ></path>
  </defs>
  <circle cx="64" cy="64" r="60" fill="none" class="ring" stroke-width="2"
  ></circle>
  <circle cx="64" cy="64" r="34" class="core"></circle>
  <text font-size="12.5" font-weight="700" letter-spacing="3" class="ring-text">
    <textPath href={`#${pathId}`}>RECETA FAMILIAR · AHUACHAPÁN ·</textPath>
  </text>
  <text
    x="64"
    y="71"
    text-anchor="middle"
    font-size="26"
    font-weight="700"
    class="core-text">19·68</text
  >
</svg>

<style>
  .brand-stamp {
    flex: none;
  }
  .ring {
    stroke: var(--brand-head);
  }
  .ring-text {
    fill: var(--brand-head);
    font-family: var(--font-sans);
  }
  .core {
    fill: var(--brand-menu-bar);
  }
  .core-text {
    fill: var(--brand-menu-bar-ink);
    font-family: var(--font-display);
  }
</style>
