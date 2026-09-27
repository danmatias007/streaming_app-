import type { NextFunction, Request, Response } from "express";
import type { ApiError } from "@netflix/shared-types";
import type { TokenService } from "../auth/token-service.js";

export function createAuthenticate(tokens: TokenService) {
  return async function authenticate(
    request: Request,
    response: Response<unknown, { requestId: string; profileId?: string; userId?: string; role?: "USER" | "ADMIN" }>,
    next: NextFunction
  ): Promise<void> {
    const authorization = request.header("authorization");
    if (!authorization?.startsWith("Bearer ") || authorization.length <= 7) {
      reject(response); return;
    }
    try {
      const claims = await tokens.verifyAccessToken(authorization.slice(7));
      response.locals.profileId = claims.profileId;
      response.locals.userId = claims.userId;
      response.locals.role = claims.role;
      next();
    } catch {
      reject(response);
    }
  };
}

function reject(response: Response<unknown, { requestId: string }>) {
  const body: ApiError = { error: { code: "AUTHENTICATION_REQUIRED", message: "A valid Bearer token is required", requestId: response.locals.requestId } };
  response.status(401).json(body);
}
