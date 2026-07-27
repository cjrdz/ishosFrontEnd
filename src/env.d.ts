/// <reference types="astro/client" />

import type { Session } from "./types/auth";

declare global {
  namespace App {
    interface Locals {
      session?: Session;
    }
  }
}

export {};
