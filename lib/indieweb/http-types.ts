export interface IndieWebJsonError {
  error: string;
  error_description?: string;
}

export interface JsonResponseInit {
  status?: number;
  headers?: HeadersInit;
}
