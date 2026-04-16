<script lang="ts">
  import { onMount } from "svelte";
  import { formatCurrency } from "../../../lib/utils/formatters";
  import { listPublicProducts, type PublicProduct } from "../../../lib/api/store";

  let loading = $state(true);
  let error = $state("");
  let featured = $state<PublicProduct[]>([]);
  const featuredSkeletonCards = Array.from({ length: 4 }, (_, index) => index);

  onMount(() => {
    void loadFeatured();
  });

  async function loadFeatured() {
    loading = true;
    error = "";

    try {
      const products = await listPublicProducts();
      featured = products
        .filter((product) => product.is_available)
        .slice(0, 4);
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "No se pudo cargar el menú.";
    } finally {
      loading = false;
    }
  }
</script>

<div class="container mx-auto px-4 py-6 md:py-10 space-y-12 md:space-y-16">
  <!-- Hero Section -->
  <section class="max-w-5xl mx-auto px-2">
    <div class="card bg-base-100/50 backdrop-blur-sm shadow-xl border border-base-200/50 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:border-primary/20">
      <div class="card-body py-10 md:py-16 px-6 md:px-12 text-center items-center">
        <div class="max-w-2xl">
          <h1 class="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight leading-tight">
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              IshosFactory
            </span>
            <br class="hidden md:block"/> <span class="md:hidden">—</span> Gelatos & Sorbetes
          </h1>
          <p class="py-2 mb-4 text-base md:text-lg text-base-content/80 font-medium leading-relaxed">
            Helados artesanales hechos con amor en El Salvador.
          </p>
          <div class="mt-4">
            <a href="/menu" class="btn btn-primary btn-lg rounded-full px-8 shadow-sm hover:shadow-md transition-all">Ver todo el menú</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Featured Products Section -->
  <section class="max-w-7xl mx-auto px-2 pb-12">
    <div class="text-center mb-10 md:mb-14">
      <h2 class="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-base-content to-base-content/70 inline-block mb-3">
        Productos Destacados
      </h2>
      <p class="text-base-content/60 font-medium text-lg">Nuestros sabores más queridos.</p>
    </div>

    {#if loading}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
        {#each featuredSkeletonCards as cardIndex (cardIndex)}
          <article class="card bg-base-100 w-full shadow-md border border-base-200/50 overflow-hidden h-full rounded-2xl" aria-hidden="true">
            <div class="skeleton w-full aspect-[4/3]"></div>
            <div class="card-body p-6 space-y-4">
              <div class="skeleton h-6 w-3/4"></div>
              <div class="space-y-2">
                <div class="skeleton h-4 w-full"></div>
                <div class="skeleton h-4 w-5/6"></div>
              </div>
              <div class="card-actions justify-between items-center mt-auto pt-4">
                <div class="skeleton h-8 w-20"></div>
                <div class="skeleton h-6 w-24 rounded-full"></div>
              </div>
            </div>
          </article>
        {/each}
      </div>
    {:else if error}
      <div class="alert alert-error max-w-xl mx-auto rounded-xl shadow-sm">{error}</div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
        {#each featured as product (product.id)}
          <div class="h-full group">
            <article class="card bg-base-100 w-full border border-base-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden h-full rounded-2xl">
              {#if product.image_url}
                <figure class="bg-base-200/50 w-full aspect-[4/3] overflow-hidden relative">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div class="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                </figure>
              {/if}
              <div class="card-body p-5 md:p-6 flex flex-col">
                <h3 class="card-title text-xl font-bold leading-tight mb-1">{product.name}</h3>
                <p class="text-sm text-base-content/70 line-clamp-2 leading-relaxed mb-4">{product.description}</p>
                
                {#if product.flavors && product.flavors.length > 0}
                  <div class="flex flex-wrap gap-2 mb-4 mt-auto">
                    {#each product.flavors.slice(0, 2) as flavor (flavor.id)}
                      <div class="flex items-center gap-1">
                        <span class="badge badge-sm badge-outline text-base-content/70">{flavor.name}</span>
                        {#if flavor.is_seasonal}
                          <span class="badge badge-sm badge-warning badge-outline">Temporada</span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="mt-auto"></div>
                {/if}
                
                <div class="card-actions justify-between items-center pt-4 border-t border-base-200/50 mt-1">
                  <span class="text-2xl font-bold text-primary">{formatCurrency(product.price)}</span>
                  <span class="badge badge-success badge-outline font-medium px-3 py-3">Disponible</span>
                </div>
              </div>
            </article>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>
