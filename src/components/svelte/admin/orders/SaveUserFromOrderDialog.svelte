<script lang="ts">
  interface SaveUserForm {
    name: string;
    user_type: "user" | "company";
    phone: string;
    email: string;
    status: "active" | "inactive";
  }

  interface Props {
    open: boolean;
    busy: boolean;
    saveUserForm: SaveUserForm;
    saveUserError: string;
    onSubmit: (event: SubmitEvent) => void;
    onClose: () => void;
  }

  let { open, busy, saveUserForm, saveUserError, onSubmit, onClose }: Props = $props();
  let dialogRef = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    if (!dialogRef) return;
    if (open && !dialogRef.open) {
      dialogRef.showModal();
    } else if (!open && dialogRef.open) {
      dialogRef.close();
    }
  });
</script>

<dialog class="modal" bind:this={dialogRef} onclose={onClose}>
  <div class="modal-box max-w-2xl">
    <h3 class="font-bold text-lg">Guardar usuario desde orden</h3>
    <p class="mt-2 text-sm text-base-content/70">Puedes ajustar tipo y estado antes de guardar el registro.</p>

    <form class="mt-4 space-y-4" onsubmit={onSubmit}>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="form-control">
          <span id="save-user-name-label" class="label-text mb-1">Nombre</span>
          <input id="save-user-name" class="input input-bordered" bind:value={saveUserForm.name} required aria-labelledby="save-user-name-label" />
        </div>
        <div class="form-control">
          <span id="save-user-type-label" class="label-text mb-1">Tipo de usuario</span>
          <select id="save-user-type" class="select select-bordered" bind:value={saveUserForm.user_type} aria-labelledby="save-user-type-label">
            <option value="user">usuario</option>
            <option value="company">empresa</option>
          </select>
        </div>
        <div class="form-control">
          <span id="save-user-phone-label" class="label-text mb-1">Telefono</span>
          <input id="save-user-phone" class="input input-bordered" bind:value={saveUserForm.phone} required aria-labelledby="save-user-phone-label" />
        </div>
        <div class="form-control">
          <span id="save-user-email-label" class="label-text mb-1">Correo (opcional)</span>
          <input id="save-user-email" class="input input-bordered" type="email" bind:value={saveUserForm.email} aria-labelledby="save-user-email-label" />
        </div>
      </div>

      <div class="form-control">
        <span class="label-text mb-1">Estado</span>
        <label class="label h-12 w-full cursor-pointer justify-start gap-2 rounded-lg border border-base-300/70 px-3">
          <input
            class="toggle toggle-sm"
            type="checkbox"
            checked={saveUserForm.status === "active"}
            onchange={(event) => (saveUserForm.status = (event.currentTarget as HTMLInputElement).checked ? "active" : "inactive")}
            aria-label="Estado de usuario"
          />
          <span class="label-text">{saveUserForm.status === "active" ? "Activo" : "Inactivo"}</span>
        </label>
      </div>

      {#if saveUserError}
        <div class="text-sm text-error">{saveUserError}</div>
      {/if}

      <div class="modal-action">
        <button class="btn btn-ghost" type="button" onclick={onClose}>Cancelar</button>
        <button class="btn btn-primary" type="submit" disabled={busy}>Guardar usuario</button>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={onClose}>close</button>
  </form>
</dialog>
