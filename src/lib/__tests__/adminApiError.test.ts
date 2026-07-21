import { describe, it, expect } from "vitest";

import {
  mapHttpStatusToErrorCode,
  buildAdminApiError,
  buildValidationError,
  buildForbiddenError,
  buildNotFoundError,
  buildInternalError,
} from "@/lib/adminApiError";
import type { AdminApiError } from "@/lib/adminApiError";

// ---------------------------------------------------------------------------
// mapHttpStatusToErrorCode
// ---------------------------------------------------------------------------

describe("mapHttpStatusToErrorCode", () => {
  it("maps 400 to validation_failure", () => {
    expect(mapHttpStatusToErrorCode(400)).toBe("validation_failure");
  });

  it("maps 401 to unauthenticated", () => {
    expect(mapHttpStatusToErrorCode(401)).toBe("unauthenticated");
  });

  it("maps 403 to forbidden", () => {
    expect(mapHttpStatusToErrorCode(403)).toBe("forbidden");
  });

  it("maps 404 to not_found", () => {
    expect(mapHttpStatusToErrorCode(404)).toBe("not_found");
  });

  it("maps 409 to conflict", () => {
    expect(mapHttpStatusToErrorCode(409)).toBe("conflict");
  });

  it("maps 500 to internal_error", () => {
    expect(mapHttpStatusToErrorCode(500)).toBe("internal_error");
  });

  it("maps unrecognized status codes to internal_error", () => {
    expect(mapHttpStatusToErrorCode(418)).toBe("internal_error");
    expect(mapHttpStatusToErrorCode(502)).toBe("internal_error");
    expect(mapHttpStatusToErrorCode(0)).toBe("internal_error");
  });
});

// ---------------------------------------------------------------------------
// buildAdminApiError
// ---------------------------------------------------------------------------

describe("buildAdminApiError", () => {
  it("builds a minimal error with code and message", () => {
    const err = buildAdminApiError(404, "Resource not found.");
    expect(err.code).toBe("not_found");
    expect(err.message).toBe("Resource not found.");
    expect(err.fieldErrors).toBeUndefined();
    expect(err.requestId).toBeUndefined();
  });

  it("includes fieldErrors when provided and non-empty", () => {
    const err = buildAdminApiError(400, "Validation failed.", {
      fieldErrors: { name: ["Name is required."], email: ["Invalid email format."] },
    });
    expect(err.fieldErrors).toEqual({
      name: ["Name is required."],
      email: ["Invalid email format."],
    });
  });

  it("omits fieldErrors when the map is empty", () => {
    const err = buildAdminApiError(400, "Validation failed.", { fieldErrors: {} });
    expect(err.fieldErrors).toBeUndefined();
  });

  it("includes requestId when provided", () => {
    const err = buildAdminApiError(500, "Error.", { requestId: "req-abc-123" });
    expect(err.requestId).toBe("req-abc-123");
  });

  it("omits requestId when not provided", () => {
    const err = buildAdminApiError(403, "Forbidden.");
    expect(err.requestId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildValidationError
// ---------------------------------------------------------------------------

describe("buildValidationError", () => {
  it("sets code to validation_failure and includes fieldErrors", () => {
    const err = buildValidationError({ name: ["Required."] });
    expect(err.code).toBe("validation_failure");
    expect(err.fieldErrors).toEqual({ name: ["Required."] });
  });

  it("includes a human-readable default message", () => {
    const err = buildValidationError({ field: ["Error."] });
    expect(err.message).toBeTruthy();
    expect(typeof err.message).toBe("string");
  });

  it("propagates requestId when provided", () => {
    const err = buildValidationError({ field: ["Error."] }, "trace-xyz");
    expect(err.requestId).toBe("trace-xyz");
  });

  it("satisfies the AdminApiError contract shape", () => {
    const err: AdminApiError = buildValidationError({ field: ["err"] });
    expect(err.code).toBeDefined();
    expect(err.message).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// buildForbiddenError
// ---------------------------------------------------------------------------

describe("buildForbiddenError", () => {
  it("returns code forbidden", () => {
    expect(buildForbiddenError().code).toBe("forbidden");
  });

  it("includes a non-empty message", () => {
    expect(buildForbiddenError().message.length).toBeGreaterThan(0);
  });

  it("includes requestId when provided", () => {
    expect(buildForbiddenError("req-001").requestId).toBe("req-001");
  });

  it("omits requestId when not provided", () => {
    expect(buildForbiddenError().requestId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildNotFoundError
// ---------------------------------------------------------------------------

describe("buildNotFoundError", () => {
  it("returns code not_found", () => {
    expect(buildNotFoundError("Customer").code).toBe("not_found");
  });

  it("includes the resource name in the message", () => {
    const err = buildNotFoundError("Organization");
    expect(err.message).toContain("Organization");
  });

  it("includes requestId when provided", () => {
    expect(buildNotFoundError("Job", "trace-002").requestId).toBe("trace-002");
  });
});

// ---------------------------------------------------------------------------
// buildInternalError
// ---------------------------------------------------------------------------

describe("buildInternalError", () => {
  it("returns code internal_error", () => {
    expect(buildInternalError().code).toBe("internal_error");
  });

  it("includes a non-empty message", () => {
    expect(buildInternalError().message.length).toBeGreaterThan(0);
  });

  it("includes requestId when provided", () => {
    expect(buildInternalError("req-003").requestId).toBe("req-003");
  });
});

// ---------------------------------------------------------------------------
// Contract shape — complete AdminApiError
// ---------------------------------------------------------------------------

describe("AdminApiError contract", () => {
  it("a fully populated error satisfies the interface", () => {
    const err: AdminApiError = {
      code: "validation_failure",
      message: "One or more fields failed validation.",
      fieldErrors: { name: ["Required."] },
      requestId: "req-abc",
    };
    expect(err.code).toBe("validation_failure");
    expect(err.fieldErrors?.name).toEqual(["Required."]);
    expect(err.requestId).toBe("req-abc");
  });
});
