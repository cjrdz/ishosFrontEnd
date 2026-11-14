<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@shared/components/AppIcon.svelte";
  import { showToast } from "@shared/toast/toast";

  let itemCount = $state(0);
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

  function onCartAdded(event: Event) {
    const detail =
      (event as CustomEvent<{ name?: string; quantity?: number }>).detail ?? {};
    const quantity = Number(detail.quantity || 1);
    const name = detail.name || "Producto";
    showToast(`${quantity > 1 ? `${quantity} × ` : ""}${name} en tu carrito`, {
      actionLabel: "Ver carrito",
      onAction: () => {
        window.location.href = "/order/cart";
      },
      durationMs: 3500,
    });
  }

  onMount(() => {
    window.addEventListener("storefront-cart-added", onCartAdded);
    const persisted = localStorage.getItem("ishos_storefront_cart_count");
    if (persisted) {
      itemCount = Number(persisted) || 0;
      previousCount = itemCount;
    }

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
      window.removeEventListener("storefront-cart-added", onCartAdded);
    };
  });
</script>

<a
  href="/order/cart"
  class="btn btn-ghost btn-circle relative"
  aria-label={itemCount > 0
    ? `Ver carrito (${itemCount} productos)`
    : "Ver carrito"}
  data-cart-target
>
  <Icon icon="lucide:shopping-cart" class="h-6 w-6" />
  {#if itemCount > 0}
    <span
      class={`badge badge-sm badge-primary absolute -top-1 -right-1 ${badgePop ? "cart-badge-pop" : ""}`}
      >{itemCount}</span
    >
  {/if}
</a>

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
