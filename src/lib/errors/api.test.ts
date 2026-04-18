import { describe, it, expect } from "vitest";
import { ApiError, ValidationError } from "./api";

describe("ApiError", () => {
  it("stores status and code", () => {
    const err = new ApiError("Not found", 404, "NOT_FOUND");
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Not found");
    expect(err.name).toBe("ApiError");
  });

  it("defaults code to API_ERROR when omitted", () => {
    const err = new ApiError("oops", 500);
    expect(err.code).toBe("API_ERROR");
  });

  it("isCode returns true for matching code", () => {
    const err = new ApiError("x", 400, "VALIDATION");
    expect(err.isCode("VALIDATION")).toBe(true);
    expect(err.isCode("OTHER")).toBe(false);
  });

  it("isClientError returns true for 4xx", () => {
    expect(new ApiError("x", 400, "E").isClientError()).toBe(true);
    expect(new ApiError("x", 500, "E").isClientError()).toBe(false);
  });

  it("isServerError returns true for 5xx", () => {
    expect(new ApiError("x", 500, "E").isServerError()).toBe(true);
    expect(new ApiError("x", 404, "E").isServerError()).toBe(false);
  });

  it("isNetworkError returns true for status 0 or NETWORK_ERROR code", () => {
    expect(new ApiError("x", 0, "E").isNetworkError()).toBe(true);
    expect(new ApiError("x", 200, "NETWORK_ERROR").isNetworkError()).toBe(true);
    expect(new ApiError("x", 400, "E").isNetworkError()).toBe(false);
  });
});

describe("ValidationError", () => {
  it("stores field errors", () => {
    const err = new ValidationError("invalid", {
      email: ["Required", "Invalid"],
    });
    expect(err.fields.email).toEqual(["Required", "Invalid"]);
  });

  it("getFieldError returns first message for field", () => {
    const err = new ValidationError("invalid", { name: ["Too short"] });
    expect(err.getFieldError("name")).toBe("Too short");
    expect(err.getFieldError("missing")).toBeUndefined();
  });

  it("getAllErrors returns comma-joined flat list", () => {
    const err = new ValidationError("invalid", { a: ["E1"], b: ["E2"] });
    expect(err.getAllErrors()).toContain("E1");
    expect(err.getAllErrors()).toContain("E2");
  });
});
