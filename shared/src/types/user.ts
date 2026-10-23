/** What the browser may know about a user. Never a hash, never a Google subject id. */
export type PublicUser = { id: string; email: string; name: string; hasPassword: boolean; google: boolean };
