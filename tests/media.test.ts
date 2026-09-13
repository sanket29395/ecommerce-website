import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mediaResponse, uploadProductImages } from "../src/lib/media";

test("uploaded product images are persisted and served", async (t) => {
  const prefix = path.join(tmpdir(), "commerce-media-");
  const directory = await mkdtemp(prefix);
  assert.equal(directory.startsWith(prefix), true);
  process.env.MEDIA_STORAGE_PATH = directory;
  t.after(async () => rm(directory, { recursive: true, force: true }));

  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const form = new FormData();
  form.append("images", new File([png], "product.png", { type: "image/png" }));
  const uploadRequest = new Request(
    "https://shop.example.com/api/admin/media",
    {
      method: "POST",
      body: form,
    },
  );

  const [url] = await uploadProductImages(uploadRequest);
  assert.match(url, /^\/api\/media\/[a-f0-9]{64}\.png$/);

  const response = await mediaResponse(
    new Request(`https://shop.example.com${url}`),
    url.split("/").pop()!,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), png);
});
