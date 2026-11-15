/**
 * Zod, configured for this app. Import `z` from here, not from "zod".
 *
 * jitless: Zod 4 probes `new Function` to JIT-compile object parsers. The page
 * CSP forbids eval, so the probe is reported as a CSP violation in the browser;
 * the interpreted parser is plenty fast for these small payloads.
 */
import { z } from "zod";

z.config({ jitless: true });

export { z };
