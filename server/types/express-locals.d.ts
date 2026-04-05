declare global {
  namespace Express {
    interface Locals {
      /** Per-request CSP nonce for `index.html` script tags (paired with `Content-Security-Policy`). */
      cspNonce: string;
    }
  }
}

export {};
