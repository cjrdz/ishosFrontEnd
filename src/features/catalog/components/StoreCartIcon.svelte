<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import { fetchStoreSettings } from "@features/catalog/lib/api";

  let itemCount = $state(0);
  let ordersEnabled = $state(true);
  let badgePop = $state(false);
  let previousCount = 0;
  let popTimer: ReturnType<typeof setTimeout> | undefined;

  function updateCount(event: Event) {
    const custom = event as CustomEvent<number>;
    const nextCount = Number(custom.detail || 0);
    if (nextCount > previousCount) {
      badgePop = true;
      if (popTimer) clearTimeout(popTimer);
      popTimer = setTimeout(() => {
        badgePop = false;
      }, 340);
    }
    itemCount = nextCount;
    previousCount = nextCount;
  }

  onMount(() => {
    const persisted = localStorage.getItem("ishos_storefront_cart_count");
    if (persisted) {
      itemCount = Number(persisted) || 0;
      previousCount = itemCount;
    }

    fetchStoreSettings()
      .then((s) => {
        ordersEnabled = s.orders_enabled;
      })
      .catch(() => {
        ordersEnabled = true;
      });

    window.addEventListener(
      "storefront-cart-count",
      updateCount as EventListener,
    );
    return () => {
      if (popTimer) clearTimeout(popTimer);
      window.removeEventListener(
        "storefront-cart-count",
        updateCount as EventListener,
      );
    };
  });
</script>

{#if ordersEnabled}
  <a
    href="/order/cart"
    class="btn btn-ghost btn-circle relative"
    aria-label="Ver carrito"
  >
    <Icon icon="lucide:shopping-cart" class="h-6 w-6" />
    {#if itemCount > 0}
      <span
        class={`badge badge-sm badge-primary absolute -top-1 -right-1 ${badgePop ? "cart-badge-pop" : ""}`}
        >{itemCount}</span
      >
    {/if}
  </a>
{/if}

<style>
  .cart-badge-pop {
    animation: cartBadgePop 340ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes cartBadgePop {
    0% {
      transform: scale(1);
    }
    45% {
      transform: scale(1.17);
    }
    100% {
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cart-badge-pop {
      animation: none;
    }
  }
</style>
