declare global {
  namespace Express {
    interface Request {
      userId?: string;
      /** Signed in as a guest, without an account */
      isGuest?: boolean;
    }
  }
}

export {};
