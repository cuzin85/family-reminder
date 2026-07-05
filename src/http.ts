export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers
    }
  });
}

export function apiErrorResponse(error: string, status: number): Response {
  return jsonResponse(
    {
      ok: false,
      error
    },
    { status }
  );
}

export function methodNotAllowedResponse(): Response {
  return apiErrorResponse("method_not_allowed", 405);
}

export function notFoundResponse(): Response {
  return apiErrorResponse("not_found", 404);
}

export async function withApiErrorHandling(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    console.error("api_error", error);

    return apiErrorResponse("internal_error", 500);
  }
}
