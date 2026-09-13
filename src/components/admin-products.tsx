"use client";
import { useEffect, useMemo, useState } from "react";
import { useData, api, Notice, Loading, Field, Pager, message } from "./ui";
import { money } from "@/lib/money";
import type { Category, Product, Variant } from "@/lib/types";
import { useToast } from "./toast";

type ProductImageItem =
  | { id: string; kind: "saved"; url: string }
  | { id: string; kind: "upload"; file: File };

const acceptedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

function PendingImage({ file }: { file: File }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setSource(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return source ? <img src={source} alt="" /> : null;
}

export function AdminProducts() {
  const [page, setPage] = useState(1);
  const products = useData<Product[]>(`admin/products?page=${page}`);
  const categories = useData<Category[]>("admin/categories");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [variant, setVariant] = useState<{
    product: Product;
    value?: Variant;
  } | null>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<ProductImageItem[]>([]);
  const p = editing && editing !== "new" ? editing : null;
  const categoryOptions = useMemo(() => {
    const all = categories.data || [];
    return all
      .filter((category) => !category.parentId)
      .flatMap((parent) => [
        parent,
        ...all.filter((category) => category.parentId === parent.id),
      ]);
  }, [categories.data]);
  function openProduct(product: Product | "new") {
    setEditing(product);
    setVariant(null);
    setImages(
      product === "new"
        ? []
        : product.images.map((url, index) => ({
            id: `saved-${index}-${url}`,
            kind: "saved" as const,
            url,
          })),
    );
  }
  function addImages(files: File[]) {
    const invalid = files.find(
      (file) =>
        !acceptedImageTypes.includes(file.type) || file.size > 5 * 1024 * 1024,
    );
    if (invalid) {
      toast(
        `${invalid.name} must be a JPEG, PNG, WebP, or GIF no larger than 5 MB.`,
        "error",
      );
      return;
    }
    const available = 8 - images.length;
    if (files.length > available) {
      toast(
        `A product can have up to 8 images. You can add ${available} more.`,
        "error",
      );
      return;
    }
    const existingUploads = new Set(
      images
        .filter((image) => image.kind === "upload")
        .map(
          (image) =>
            `${image.file.name}:${image.file.size}:${image.file.lastModified}`,
        ),
    );
    const unique = files.filter(
      (file) =>
        !existingUploads.has(`${file.name}:${file.size}:${file.lastModified}`),
    );
    setImages((current) => [
      ...current,
      ...unique.map((file) => ({
        id: crypto.randomUUID(),
        kind: "upload" as const,
        file,
      })),
    ]);
  }
  function moveImage(index: number, offset: -1 | 1) {
    setImages((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function saveProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const pending = images.filter((image) => image.kind === "upload");
      let uploaded: string[] = [];
      if (pending.length) {
        const upload = new FormData();
        pending.forEach(({ file }) => upload.append("images", file));
        const response = await fetch("/api/admin/media", {
          method: "POST",
          body: upload,
        });
        const result = (await response.json().catch(() => null)) as {
          images?: string[];
          error?: string;
        } | null;
        if (!response.ok || !result?.images)
          throw new Error(result?.error || "Image upload failed");
        uploaded = result.images;
      }
      let uploadedIndex = 0;
      const productImages = images
        .map((image) =>
          image.kind === "saved" ? image.url : uploaded[uploadedIndex++],
        )
        .filter(
          (url, index, all): url is string =>
            Boolean(url) && all.indexOf(url) === index,
        );
      await api(`admin/products${p ? `/${p.id}` : ""}`, p ? "PATCH" : "POST", {
        name: f.get("name"),
        slug: f.get("slug"),
        description: f.get("description"),
        categoryId: f.get("categoryId"),
        images: productImages,
        active: f.has("active"),
        featured: f.has("featured"),
      });
      setEditing(null);
      setImages([]);
      toast("Product saved.", "success");
      await products.reload();
    } catch (e) {
      toast(message(e), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading !mt-0">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="!text-4xl">Products</h1>
        </div>
        <button
          className="primary"
          onClick={() => {
            openProduct("new");
          }}
        >
          Add product
        </button>
      </div>
      <Notice text={products.error} tone="error" />
      {editing && (
        <form
          key={p?.id || "new"}
          className="admin-form stack"
          onSubmit={saveProduct}
        >
          <h2>{p ? "Edit product" : "New product"}</h2>
          <div className="form-grid">
            <Field
              label="Product name"
              name="name"
              required
              defaultValue={p?.name}
            />
            <Field
              label="URL slug"
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              defaultValue={p?.slug}
            />
            <label className="field">
              <span>Category</span>
              <select
                name="categoryId"
                required
                defaultValue={p?.categoryId || ""}
              >
                <option value="" disabled>
                  Select category
                </option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentId ? `-- ${c.parent?.name} / ` : ""}
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-5 items-center">
              <label className="flex gap-2">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={p?.active}
                />
                Published
              </label>
              <label className="flex gap-2">
                <input
                  name="featured"
                  type="checkbox"
                  defaultChecked={p?.featured}
                />
                Featured
              </label>
            </div>
          </div>
          <label className="field">
            <span>Description</span>
            <textarea
              name="description"
              minLength={10}
              maxLength={10000}
              required
              defaultValue={p?.description}
            />
          </label>
          <label className="field image-upload-field">
            <span>Product images ({images.length}/8)</span>
            <input
              type="file"
              accept={acceptedImageTypes.join(",")}
              multiple
              disabled={busy || images.length >= 8}
              onChange={(event) => {
                addImages(Array.from(event.currentTarget.files || []));
                event.currentTarget.value = "";
              }}
            />
          </label>
          {images.length > 0 && (
            <div className="admin-image-grid">
              {images.map((image, index) => (
                <div className="admin-image" key={image.id}>
                  <div className="admin-image-preview">
                    {image.kind === "saved" ? (
                      <img src={image.url} alt="" />
                    ) : (
                      <PendingImage file={image.file} />
                    )}
                    {index === 0 && <span className="tag">Primary</span>}
                  </div>
                  <p
                    title={image.kind === "saved" ? image.url : image.file.name}
                  >
                    {image.kind === "saved" ? "Saved image" : image.file.name}
                  </p>
                  <div className="admin-image-actions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={index === 0 || busy}
                      onClick={() => moveImage(index, -1)}
                      aria-label={`Move image ${index + 1} earlier`}
                    >
                      Earlier
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={index === images.length - 1 || busy}
                      onClick={() => moveImage(index, 1)}
                      aria-label={`Move image ${index + 1} later`}
                    >
                      Later
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        setImages((current) =>
                          current.filter((item) => item.id !== image.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="muted text-sm">
            Upload up to eight JPEG, PNG, WebP, or GIF files (5 MB each). The
            first image is the storefront thumbnail. Unpublish products to
            remove them from the storefront while preserving order history.
          </p>
          <div className="flex gap-3">
            <button className="primary" disabled={busy}>
              Save product
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setEditing(null);
                setImages([]);
              }}
            >
              Close
            </button>
          </div>
        </form>
      )}
      {variant && (
        <form
          key={variant.value?.id || variant.product.id}
          className="admin-form stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              await api(
                `admin/variants${variant.value ? `/${variant.value.id}` : ""}`,
                variant.value ? "PATCH" : "POST",
                {
                  expectedStock: variant.value?.stock,
                  productId: variant.product.id,
                  name: f.get("name"),
                  sku: f.get("sku"),
                  price: Math.round(Number(f.get("price")) * 100),
                  stock: Number(f.get("stock")),
                  active: f.has("active"),
                },
              );
              setVariant(null);
              await products.reload();
              toast("Variant saved.", "success");
            } catch (e) {
              toast(message(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>
            {variant.value ? "Edit" : "Add"} option · {variant.product.name}
          </h2>
          <div className="form-grid">
            <Field
              label="Option name (e.g. Gold / Small)"
              name="name"
              required
              defaultValue={variant.value?.name}
            />
            <Field
              label="SKU (unique)"
              name="sku"
              required
              defaultValue={variant.value?.sku}
            />
            <Field
              label="Price in ₹ (tax inclusive)"
              name="price"
              type="number"
              min="1"
              step="0.01"
              required
              defaultValue={
                variant.value ? variant.value.price / 100 : undefined
              }
            />
            <Field
              label="Available stock (excludes reserved stock)"
              name="stock"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={variant.value?.stock || 0}
            />
          </div>
          <label className="flex gap-2">
            <input
              type="checkbox"
              name="active"
              defaultChecked={variant.value?.active ?? true}
            />
            Active option
          </label>
          <p className="muted text-sm">
            Stock is the currently available quantity. Check outstanding
            reservations before correcting inventory.
          </p>
          <div className="flex gap-3">
            <button className="primary" disabled={busy}>
              Save option
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setVariant(null)}
            >
              Close
            </button>
          </div>
        </form>
      )}
      {products.loading ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Options / stock</th>
                <th>Status</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {products.data?.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <p className="muted">/{p.slug}</p>
                  </td>
                  <td>
                    {p.category?.parent
                      ? `${p.category.parent.name} / ${p.category.name}`
                      : p.category?.name}
                  </td>
                  <td>
                    {p.variants.map((v) => (
                      <div key={v.id} className="mb-3">
                        <button
                          className="text-button"
                          onClick={() => {
                            setVariant({ product: p, value: v });
                            setEditing(null);
                          }}
                        >
                          {v.name}
                        </button>
                        <p className="muted">
                          {money(v.price)} · {v.stock} available
                          {!v.active ? " · inactive" : ""}
                        </p>
                      </div>
                    ))}
                    <button
                      className="text-button"
                      onClick={() => {
                        setVariant({ product: p });
                        setEditing(null);
                      }}
                    >
                      + Add option
                    </button>
                  </td>
                  <td>
                    <span className="badge">
                      {p.active ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="secondary"
                      onClick={() => {
                        openProduct(p);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} setPage={setPage} count={products.data?.length || 0} />
    </>
  );
}
