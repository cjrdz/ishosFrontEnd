import type { Order } from "@features/admin-management";

/** Dialog and modal state management helpers */

export interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  action: (() => void) | null;
}

export interface RejectDialogState {
  open: boolean;
  targetId: string | null;
  reason: string;
  error: string;
}

export interface ReactivateDialogState {
  open: boolean;
  targetId: string | null;
  reason: string;
  error: string;
}

export interface PrintPromptDialogState {
  open: boolean;
  printTarget: Order | null;
}

export interface SaveUserDialogState {
  open: boolean;
  form: {
    name: string;
    user_type: "user" | "company";
    phone: string;
    email: string;
    status: "active" | "inactive";
  };
  error: string;
}

/** Opens the confirm dialog */
export function openConfirm(
  title: string,
  message: string,
  action: () => void,
): ConfirmDialogState {
  return {
    open: true,
    title,
    message,
    action,
  };
}

/** Closes the confirm dialog after executing the action */
export function confirmNow(state: ConfirmDialogState): {
  newState: ConfirmDialogState;
  action: (() => void) | null;
} {
  const action = state.action;
  return {
    newState: {
      open: false,
      title: "",
      message: "",
      action: null,
    },
    action,
  };
}

/** Closes the confirm dialog without executing the action */
export function closeConfirm(): ConfirmDialogState {
  return {
    open: false,
    title: "",
    message: "",
    action: null,
  };
}

/** Opens the reject dialog */
export function openReject(orderId: string): RejectDialogState {
  return {
    open: true,
    targetId: orderId,
    reason: "",
    error: "",
  };
}

/** Closes the reject dialog */
export function closeReject(): RejectDialogState {
  return {
    open: false,
    targetId: null,
    reason: "",
    error: "",
  };
}

/** Opens the reactivate dialog */
export function openReactivate(orderId: string): ReactivateDialogState {
  return {
    open: true,
    targetId: orderId,
    reason: "",
    error: "",
  };
}

/** Closes the reactivate dialog */
export function closeReactivate(): ReactivateDialogState {
  return {
    open: false,
    targetId: null,
    reason: "",
    error: "",
  };
}

/** Opens the print prompt dialog */
export function openPrintPrompt(order: Order): PrintPromptDialogState {
  return {
    open: true,
    printTarget: order,
  };
}

/** Closes the print prompt dialog */
export function closePrintPrompt(): PrintPromptDialogState {
  return {
    open: false,
    printTarget: null,
  };
}

/** Creates a default save user form */
export function createDefaultSaveUserForm(): SaveUserDialogState["form"] {
  return {
    name: "",
    user_type: "user",
    phone: "",
    email: "",
    status: "active",
  };
}

/** Opens the save user dialog with prefilled data */
export function openSaveUserDialog(
  name: string = "",
  phone: string = "",
  email: string = "",
): SaveUserDialogState {
  return {
    open: true,
    form: {
      name: name.trim(),
      user_type: "user",
      phone: phone.trim(),
      email: email.trim(),
      status: "active",
    },
    error: "",
  };
}

/** Closes the save user dialog */
export function closeSaveUserDialog(): SaveUserDialogState {
  return {
    open: false,
    form: createDefaultSaveUserForm(),
    error: "",
  };
}
