export class TokenVerificationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = TokenVerificationError.name;
  }
}
