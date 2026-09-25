export class RequestTimeoutError extends Error {
  constructor() { super('La consulta tardó demasiado.'); this.name = 'RequestTimeoutError'; }
}

// Limits the UI wait; the caller must ignore late callbacks from its provider.
export async function withDeadline<T>(task: Promise<T>, milliseconds = 45000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new RequestTimeoutError()), milliseconds); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
