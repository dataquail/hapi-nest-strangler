class ValidationError extends Error {
  public type: string;
  public data: unknown;

  constructor(message: string, type: string, data?: unknown) {
    super(message);
    this.name = "ValidationError";
    this.type = type;
    this.data = data;
  }
}

export = ValidationError;
