import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { appUrl } from "./env";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== appUrl())
    throw new HttpError(403, "Invalid request origin");
}
export async function readBytes(request: Request, max = 65536) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, "Request too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function readBody(request: Request, max = 65536) {
  return (await readBytes(request, max)).toString("utf8");
}
export async function body(request: Request) {
  try {
    return JSON.parse(await readBody(request));
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "Invalid JSON");
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      400,
    );
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    return json(
      { error: "This value already exists. Refresh and try again." },
      409,
    );
  const id = crypto.randomUUID();
  console.error(
    "Request failed",
    id,
    error instanceof Error ? `${error.name}: ${error.message}` : "Unknown",
  );
  return json({ error: "Something went wrong. Please try again." }, 500);
}
