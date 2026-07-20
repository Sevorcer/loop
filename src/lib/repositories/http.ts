import type { RepositoryError } from "./contracts";

export function getRepositoryErrorStatus(code: string): number {
  switch (code) {
    case "INVALID_INPUT":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "UNAVAILABLE":
      return 503;
    default:
      return 500;
  }
}

export function createRepositoryErrorBody(error: RepositoryError<string>) {
  const status = getRepositoryErrorStatus(error.code);

  return {
    status,
    body: {
      error: error.code,
      message: error.message,
      code: status,
      statusCode: status,
    },
  };
}
