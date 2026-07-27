import type { APIRoute } from "astro";
import { proxyToBackend, proxyToBackendStream } from "@core/bff/proxy";

export const prerender = false;

const MAX_EXPORT_RANGE_DAYS = 90;

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function parseQueryParams(url: URL) {
  return {
    start: url.searchParams.get("start") ?? undefined,
    end: url.searchParams.get("end") ?? undefined,
    format: url.searchParams.get("format") ?? undefined,
    statuses: url.searchParams.get("statuses") ?? undefined,
  };
}

function buildQuery(
  params: ReturnType<typeof parseQueryParams>,
): Record<string, string> {
  const query: Record<string, string> = {};
  if (params.start) query.start = params.start;
  if (params.end) query.end = params.end;
  if (params.format) query.format = params.format;
  if (params.statuses) query.statuses = params.statuses;
  return query;
}

function validateExportParams(
  params: ReturnType<typeof parseQueryParams>,
): { ok: true } | { ok: false; response: Response } {
  if (!params.start || !params.end) {
    return {
      ok: false,
      response: jsonResponse(
        { error: "start and end are required", code: "MISSING_PARAMS" },
        400,
      ),
    };
  }

  if (params.format && !["csv", "json"].includes(params.format)) {
    return {
      ok: false,
      response: jsonResponse(
        { error: "format must be csv or json", code: "INVALID_FORMAT" },
        400,
      ),
    };
  }

  const startDate = new Date(params.start);
  const endDate = new Date(params.end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return {
      ok: false,
      response: jsonResponse(
        { error: "Invalid date range", code: "INVALID_DATE_RANGE" },
        400,
      ),
    };
  }

  if (endDate < startDate) {
    return {
      ok: false,
      response: jsonResponse(
        {
          error: "end date must be after start date",
          code: "INVALID_DATE_RANGE",
        },
        400,
      ),
    };
  }

  const diffDays =
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > MAX_EXPORT_RANGE_DAYS) {
    return {
      ok: false,
      response: jsonResponse(
        {
          error: `Export range cannot exceed ${MAX_EXPORT_RANGE_DAYS} days`,
          code: "RANGE_TOO_LARGE",
          max_days: MAX_EXPORT_RANGE_DAYS,
        },
        400,
      ),
    };
  }

  return { ok: true };
}

export const GET: APIRoute = async (context) => {
  const params = parseQueryParams(context.url);
  const validation = validateExportParams(params);
  if (!validation.ok) {
    return validation.response;
  }

  return proxyToBackendStream(context, "/export/orders", {
    query: buildQuery(params),
    timeoutMs: 110_000,
  });
};

export const DELETE: APIRoute = async (context) => {
  const params = parseQueryParams(context.url);
  const validation = validateExportParams(params);
  if (!validation.ok) {
    return validation.response;
  }

  return proxyToBackend(context, "/export/orders", {
    method: "DELETE",
    query: buildQuery(params),
    timeoutMs: 110_000,
  });
};
