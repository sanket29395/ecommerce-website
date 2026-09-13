import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { HttpError, readBytes } from "./http";
import { detectImageType } from "./image-signature";

export const MAX_PRODUCT_IMAGES = 8;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_BYTES = MAX_PRODUCT_IMAGES * MAX_IMAGE_BYTES + 1024 * 1024;
const mediaFilePattern = /^[a-f0-9]{64}\.(?:gif|jpg|png|webp)$/;

function storageDirectory() {
  return path.resolve(
    /* turbopackIgnore: true */
    process.env.MEDIA_STORAGE_PATH || path.join("data", "uploads"),
  );
}

function validateFileName(fileName: string) {
  if (!mediaFilePattern.test(fileName))
    throw new HttpError(404, "Image not found");
  return fileName;
}

export function managedImageUrl(fileName: string) {
  return `/api/media/${validateFileName(fileName)}`;
}

function imageTypeFromFileName(fileName: string) {
  const extension = validateFileName(fileName).split(".").pop();
  return extension === "jpg" ? "image/jpeg" : `image/${extension}`;
}

export async function uploadProductImages(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
    throw new HttpError(415, "Expected a multipart image upload");

  const raw = await readBytes(request, MAX_UPLOAD_BYTES);
  let form: FormData;
  try {
    form = await new Response(raw, {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    throw new HttpError(400, "Invalid image upload");
  }

  const entries = form.getAll("images");
  if (!entries.length) throw new HttpError(400, "Select at least one image");
  if (entries.length > MAX_PRODUCT_IMAGES)
    throw new HttpError(400, `Upload up to ${MAX_PRODUCT_IMAGES} images`);

  const images = await Promise.all(
    entries.map(async (entry) => {
      if (typeof entry === "string")
        throw new HttpError(400, "Every upload must be an image file");
      if (!entry.size) throw new HttpError(400, "Images cannot be empty");
      if (entry.size > MAX_IMAGE_BYTES)
        throw new HttpError(413, "Each image must be 5 MB or smaller");
      const bytes = new Uint8Array(await entry.arrayBuffer());
      const type = detectImageType(bytes);
      if (!type)
        throw new HttpError(
          400,
          "Only JPEG, PNG, WebP, and GIF images are supported",
        );
      if (entry.type && entry.type !== type.mime)
        throw new HttpError(400, "An image's contents do not match its type");
      const hash = createHash("sha256").update(bytes).digest("hex");
      return { bytes, fileName: `${hash}.${type.extension}` };
    }),
  );

  await mkdir(storageDirectory(), { recursive: true });
  await Promise.all(
    images.map(async ({ bytes, fileName }) => {
      try {
        await writeFile(
          /* turbopackIgnore: true */ path.join(storageDirectory(), fileName),
          bytes,
          { flag: "wx" },
        );
      } catch (error) {
        if (
          !error ||
          typeof error !== "object" ||
          !("code" in error) ||
          error.code !== "EEXIST"
        )
          throw error;
      }
    }),
  );
  return images.map(({ fileName }) => managedImageUrl(fileName));
}

export async function mediaResponse(request: Request, fileName: string) {
  validateFileName(fileName);
  let bytes: Buffer;
  try {
    bytes = await readFile(
      /* turbopackIgnore: true */ path.join(storageDirectory(), fileName),
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      throw new HttpError(404, "Image not found");
    throw error;
  }
  const etag = `"${fileName.split(".")[0]}"`;
  const headers = {
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Type": imageTypeFromFileName(fileName),
    "Content-Length": String(bytes.length),
    "Cross-Origin-Resource-Policy": "same-origin",
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers });
  const body = new ArrayBuffer(bytes.length);
  new Uint8Array(body).set(bytes);
  return new Response(body, { headers });
}
