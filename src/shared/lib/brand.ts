/**
 * Isho's public brand details shared by the store layout, About page and
 * footer: social accounts and the store-wide contact number (each location
 * can override its WhatsApp in Configuración → Sucursales).
 */

export const BRAND_NAME = "Isho's";

/** Store-wide WhatsApp and phone (digits with country code). */
export const BRAND_PHONE_DIGITS = "50376454347";
export const BRAND_PHONE_DISPLAY = "7645-4347";
export const BRAND_PHONE_TEL = `tel:+${BRAND_PHONE_DIGITS}`;
export const BRAND_WHATSAPP_URL = `https://wa.me/${BRAND_PHONE_DIGITS}`;

export interface BrandSocial {
  icon: string;
  label: string;
  handle: string;
  href: string;
}

export const BRAND_SOCIALS: readonly BrandSocial[] = [
  {
    icon: "lucide:instagram",
    label: "Instagram",
    handle: "@ishos_factory",
    href: "https://www.instagram.com/ishos_factory/",
  },
  {
    icon: "lucide:facebook",
    label: "Facebook",
    handle: "ishosfactory",
    href: "https://www.facebook.com/ishosfactory/",
  },
  {
    icon: "proicons:tiktok",
    label: "TikTok",
    handle: "@ishosfactory",
    href: "https://www.tiktok.com/@ishosfactory",
  },
];

/** Mission line from the Manual de Marca. */
export const BRAND_MISSION =
  "Creemos en la magia de los sabores que llevan consigo historias. Gelatos y sorbetes naturales y frescos que honran nuestras raíces salvadoreñas, con la receta de la familia.";
