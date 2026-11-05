/** Errors the manuals routes map to HTTP statuses (kept I/O-free for tests). */

export class ManualValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ManualValidationError";
  }
}

export class DriveNotConfiguredError extends Error {
  status = 503;
  missing: string[];
  constructor(missing: string[]) {
    super(`Google Drive is not connected yet. Missing: ${missing.join(", ")}.`);
    this.name = "DriveNotConfiguredError";
    this.missing = missing;
  }
}

export class DriveSyncError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "DriveSyncError";
    this.status = status;
  }
}
