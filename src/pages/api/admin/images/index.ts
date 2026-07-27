/**
 * GET /api/admin/images
 * POST /api/admin/images - Upload image
 * DELETE /api/admin/images - Delete image
 *
 * Backend forwarding endpoints for image/upload operations.
 * Uploads are validated for size and folder before proxying.
 */

import type { APIRoute } from "astro";
import {
  allowedUploadFolders,
  deleteImageSchema,
  parseJsonBody,
} from "@core/bff/validation";
import { proxyToBackend } from "@core/bff/proxy";
import { getAdminImageUploadMaxMB } from "@core/config";

export const prerender = false;

const ADMIN_IMAGE_UPLOAD_MAX_BYTES = getAdminImageUploadMaxMB() * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function logSecurityEvent(
  context: Parameters<APIRoute>[0],
  event: string,
  details: Record<string, unknown>,
): void {
  console.warn(
    JSON.stringify({
      event: `security.${event}`,
      requestId: crypto.randomUUID(),
      path: context.url.pathname,
      method: context.request.method,
      ...details,
    }),
  );
}

function requireAdmin(context: Parameters<APIRoute>[0]): Response | null {
  const session = context.locals.session;
  if (!session || session.role !== "admin") {
    return jsonResponse(
      { error: "Forbidden", code: "INSUFFICIENT_PRIVILEGES" },
      403,
    );
  }
  return null;
}

export const GET: APIRoute = async (context) => {
  return proxyToBackend(context, "/upload/images");
};

export const POST: APIRoute = async (context) => {
  const adminError = requireAdmin(context);
  if (adminError) return adminError;

  let formData: FormData;
  try {
    formData = await context.request.formData();
  } catch {
    return jsonResponse(
      { error: "Invalid form data", code: "INVALID_FORM_DATA" },
      400,
    );
  }

  const folder = formData.get("folder");
  if (folder !== null && folder !== "") {
    if (
      !allowedUploadFolders.includes(
        folder as (typeof allowedUploadFolders)[number],
      )
    ) {
      logSecurityEvent(context, "upload_invalid_folder", {
        folder: String(folder),
      });
      return jsonResponse(
        { error: "Invalid upload folder", code: "INVALID_UPLOAD_FOLDER" },
        400,
      );
    }
  }

  const image = formData.get("image");
  if (!(image instanceof File)) {
    return jsonResponse(
      { error: "Image file is required", code: "IMAGE_REQUIRED" },
      400,
    );
  }

  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    logSecurityEvent(context, "upload_invalid_content_type", {
      type: image.type,
    });
    return jsonResponse(
      {
        error: "Only JPEG, PNG, and WebP images are allowed",
        code: "INVALID_IMAGE_TYPE",
      },
      400,
    );
  }

  if (image.size > ADMIN_IMAGE_UPLOAD_MAX_BYTES) {
    logSecurityEvent(context, "upload_size_exceeded", {
      size: image.size,
      limit: ADMIN_IMAGE_UPLOAD_MAX_BYTES,
    });
    return jsonResponse(
      {
        error: `Image exceeds maximum size of ${getAdminImageUploadMaxMB()} MB`,
        code: "IMAGE_TOO_LARGE",
        limit: ADMIN_IMAGE_UPLOAD_MAX_BYTES,
      },
      413,
    );
  }

  return proxyToBackend(context, "/upload/image", {
    method: "POST",
    body: formData,
    isFormData: true,
  });
};

export const DELETE: APIRoute = async (context) => {
  const adminError = requireAdmin(context);
  if (adminError) return adminError;

  const parsed = await parseJsonBody(context, deleteImageSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  return proxyToBackend(context, "/upload/image", {
    method: "DELETE",
    body: parsed.data,
  });
};
