import type { Order } from "@features/admin-management";

/** Save user form data */
export interface SaveUserFormData {
  name: string;
  user_type: "user" | "company";
  phone: string;
  email: string;
  status: "active" | "inactive";
}

/** Validates save user form */
export function validateSaveUserForm(form: SaveUserFormData): {
  valid: boolean;
  error: string;
} {
  if (!form.name.trim()) {
    return { valid: false, error: "El nombre es requerido" };
  }
  if (!form.phone.trim()) {
    return { valid: false, error: "El teléfono es requerido" };
  }
  return { valid: true, error: "" };
}

/** Pre-fills save user form from order data */
export function prefillSaveUserFormFromOrder(order: Order): SaveUserFormData {
  return {
    name: order.customer_name.trim(),
    user_type: "user",
    phone: order.customer_phone.trim(),
    email: (order.customer_email ?? "").trim(),
    status: "active",
  };
}

/** Pre-fills save user form from order form fields */
export function prefillSaveUserFormFromOrderForm(
  customerName: string,
  customerPhone: string,
  customerEmail: string,
): SaveUserFormData {
  return {
    name: customerName.trim(),
    user_type: "user",
    phone: customerPhone.trim(),
    email: customerEmail.trim(),
    status: "active",
  };
}

/** Prepares save user payload */
export function buildSaveUserPayload(form: SaveUserFormData) {
  return {
    name: form.name.trim(),
    user_type: form.user_type,
    phone: form.phone.trim(),
    email: form.email.trim() || undefined,
    status: form.status,
  };
}
