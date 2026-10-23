import type { RequestHandler, Response } from "express";
import type { Sessions } from "../auth/session.js";
import type { StoredUser, UserRepository } from "../repositories/users.js";

/** The signed-in user, if any, for this request. */
export const currentUser = (res: Response) => res.locals.user as StoredUser | undefined;

/** Load the session's user onto res.locals; never fails the request. */
export function loadUser(sessions: Sessions, users: UserRepository): RequestHandler {
  return async (req, res, next) => {
    try {
      const id = await sessions.verify(req.cookies?.[sessions.cookieName]);
      if (id) res.locals.user = (await users.byId(id)) ?? undefined;
      next();
    } catch (e) {
      next(e);
    }
  };
}
export const requireAuth: RequestHandler = (_req, res, next) => {
  if (!currentUser(res)) return void res.status(401).json({ error: "Please sign in first." });
  next();
};
