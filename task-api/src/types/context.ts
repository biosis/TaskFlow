export interface AuthedUser {
  id: string;
  email: string;
}

export interface RequestContext {
  requestId: string;
  user?: AuthedUser;
}
