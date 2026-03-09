<script lang="ts">
  import { onMount } from "svelte";
  import { ApiError } from "../../../lib/errors";
  import { createPublicOrder } from "../../../lib/api/store";
  import { clearCartItems, getCartItems, removeCartItem, setCartItems, type StoreCartItem } from "../../../lib/store/cart";
  import { saveTracking } from "../../../lib/store/tracking";
  import { formatCurrency } from "../../../lib/utils/formatters";

  type CheckoutForm = {
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    payment_method: "efectivo" | "tarjeta" | "transferencia" | "otro";
    order_type: "en_local" | "para_llevar";
    table_number: string;
    notes: string;
  };

  let items = $state<StoreCartItem[]>([]);
  let submitting = $state(false);
  let message = $state("");
  let error = $state("");

  let form = $state<CheckoutForm>({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    payment_method: "efectivo",
    order_type: "para_llevar",
    table_number: "",
    notes: "",
  });

  const total = $derived(items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0));

  onMount(() => {
    items = getCartItems();
  });

  function updateQty(item: StoreCartItem, nextQty: number) {
    const updated = items
      .map((entry) => (entry === item ? { ...entry, quantity: nextQty } : entry))
      .filter((entry) => entry.quantity > 0);

    items = updated;
    setCartItems(updated);
  }

  function removeItem(item: StoreCartItem) {
    removeCartItem(item.product_id, item.notes);
    items = getCartItems();
  }

  async function submitOrder() {
    if (items.length === 0) {
      error = "Tu carrito está vacío.";
      return;
    }

    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      error = "Nombre y teléfono son obligatorios.";
      return;
    }

    error = "";
    message = "";
    submitting = true;

    try {
      const created = await createPublicOrder({
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        customer_email: form.customer_email.trim() || undefined,
        payment_method: form.payment_method,
        order_type: form.order_type,
        table_number: form.order_type === "en_local" ? Number(form.table_number) : undefined,
        notes: form.notes.trim() || undefined,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          customizations: item.notes ? { notes: item.notes } : undefined,
        })),
      });

      saveTracking(created.order_number, form.customer_phone.trim());
      clearCartItems();
      items = [];
      message = `${created.message} N° ${created.order_number}`;
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError && requestError.status === 429) {
        error = "Has alcanzado el límite de pedidos. Intenta más tarde.";
      } else {
        error = requestError instanceof Error ? requestError.message : "No se pudo crear la orden.";
      }
    } finally {
      submitting = false;
    }
  }
</script>

<div class="space-y-8">
  <section class="mb-6 flex items-center justify-between flex-wrap gap-2">
    <h1 class="text-4xl font-bold">Tu carrito y checkout</h1>
    <a href="/order/tracking" class="btn btn-outline">Ir a seguimiento</a>
  </section>

  <section id="checkout" class="card bg-base-100 shadow-xl border border-base-300 rounded-2xl">
    <div class="card-body p-8">
      {#if items.length === 0}
        <div class="space-y-3">
          <p class="text-base-content/70">Tu carrito está vacío.</p>
          <a href="/menu" class="btn btn-primary w-fit">Ir al menú</a>
        </div>
      {:else}
        <div class="space-y-3">
          {#each items as item (item.product_id + (item.notes || ""))}
            <article class="card bg-base-200">
              <div class="card-body p-3">
                <div class="flex items-center justify-between gap-2">
                  <h4 class="font-medium">{item.name}</h4>
                  <span class="text-sm">{formatCurrency(item.unit_price * item.quantity)}</span>
                </div>
                {#if item.notes}
                  <p class="text-xs text-base-content/70">Nota: {item.notes}</p>
                {/if}
                <div class="join">
                  <button class="btn btn-sm join-item" type="button" onclick={() => updateQty(item, item.quantity - 1)}>-</button>
                  <span class="btn btn-sm join-item no-animation">{item.quantity}</span>
                  <button class="btn btn-sm join-item" type="button" onclick={() => updateQty(item, item.quantity + 1)}>+</button>
                  <button class="btn btn-sm join-item" type="button" onclick={() => removeItem(item)}>x</button>
                </div>
              </div>
            </article>
          {/each}
        </div>

        <div class="divider"></div>
        <div class="font-semibold text-lg mb-3">Total: {formatCurrency(total)}</div>

        <div class="grid gap-4 md:grid-cols-2">
          <label class="form-control">
            <span class="label-text">Nombre *</span>
            <input class="input input-bordered w-full" bind:value={form.customer_name} />
          </label>

          <label class="form-control">
            <span class="label-text">Teléfono *</span>
            <input class="input input-bordered w-full" bind:value={form.customer_phone} />
          </label>

          <label class="form-control">
            <span class="label-text">Email (opcional)</span>
            <input class="input input-bordered w-full" type="email" bind:value={form.customer_email} />
          </label>

          <label class="form-control">
            <span class="label-text">Tipo de pedido</span>
            <select class="select select-bordered w-full" bind:value={form.order_type}>
              <option value="para_llevar">Para llevar</option>
              <option value="en_local">En local</option>
            </select>
          </label>

          {#if form.order_type === "en_local"}
            <label class="form-control">
              <span class="label-text">Número de mesa *</span>
              <input class="input input-bordered w-full" bind:value={form.table_number} />
            </label>
          {/if}

          <label class="form-control">
            <span class="label-text">Pago</span>
            <select class="select select-bordered w-full" bind:value={form.payment_method}>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
              <option value="otro">Otro</option>
            </select>
          </label>
        </div>

        <label class="form-control">
          <span class="label-text">Notas generales (opcional)</span>
          <textarea class="textarea textarea-bordered w-full" rows="2" bind:value={form.notes}></textarea>
        </label>

        {#if error}
          <div class="alert alert-error">{error}</div>
        {/if}
        {#if message}
          <div class="alert alert-success">{message}</div>
        {/if}

        <div class="flex gap-2">
          <button class="btn btn-primary flex-1" type="button" onclick={submitOrder} disabled={submitting}>
            {submitting ? "Enviando..." : "Confirmar pedido"}
          </button>
          <a href="/menu" class="btn btn-ghost">Seguir comprando</a>
        </div>
      {/if}
    </div>
  </section>
</div>
