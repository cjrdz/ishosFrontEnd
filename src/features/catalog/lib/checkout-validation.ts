/**
 * Client-side checks for the checkout contact fields. They mirror the strictest
 * layer for each field — the BFF schema (CreatePublicOrderSchema) for name
 * length and email, the backend (rules.go isValidPhone) for phone — so the
 * customer gets an immediate, field-level message instead of a failed order.
 */
import { z } from "@core/zod";

export interface CheckoutContact {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
}

export type CheckoutFieldErrors = Partial<
  Record<keyof CheckoutContact, string>
>;

// Matches CreatePublicOrderSchema / orderCreateSchema (.max(120)).
export const MAX_CUSTOMER_NAME_LENGTH = 120;

/** 7–15 digits; only digits, spaces, "+", "-", "(" and ")" allowed. */
export function isValidPhone(phone: string): boolean {
  if (!/^[0-9+\-() ]+$/.test(phone)) return false;
  const digits = phone.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15;
}

// Same rule the BFF validates with, so a client-accepted email is never
// rejected after submit.
const emailSchema = z.email();

export function validateCheckoutContact(
  contact: CheckoutContact,
): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  const name = contact.customer_name.trim();
  const phone = contact.customer_phone.trim();
  const email = contact.customer_email.trim();

  if (!name) {
    errors.customer_name = "Escribe tu nombre.";
  } else if ([...name].length > MAX_CUSTOMER_NAME_LENGTH) {
    errors.customer_name = `Máximo ${MAX_CUSTOMER_NAME_LENGTH} caracteres.`;
  }

  if (!phone) {
    errors.customer_phone = "Escribe tu número de teléfono.";
  } else if (!isValidPhone(phone)) {
    errors.customer_phone =
      "Usa solo números (7 a 15 dígitos), por ejemplo 7123 4567.";
  }

  if (email && !emailSchema.safeParse(email).success) {
    errors.customer_email = "Revisa el correo electrónico.";
  }

  return errors;
}
