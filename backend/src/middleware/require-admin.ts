import type { NextFunction, Request, Response } from "express";
import type { ApiError } from "@netflix/shared-types";

export function requireAdmin(_request: Request, response: Response, next: NextFunction): void {
  if (response.locals.role === "ADMIN") { next(); return; }
  const body: ApiError = { error: { code: "ADMIN_REQUIRED", message: "Administrator access is required", requestId: response.locals.requestId } };
  response.status(403).json(body);
}
