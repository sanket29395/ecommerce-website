"use client";
import { useMemo, useState } from "react";
import { api, Field, Loading, Notice, message, useData } from "./ui";
import type { Category } from "@/lib/types";
import { useToast } from "./toast";

type AdminCategory = Category & {
  _count: { children: number; products: number };
};

export function AdminCategories() {
  const categories = useData<AdminCategory[]>("admin/categories");
  const [editing, setEditing] = useState<AdminCategory | "new" | null>(null);
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const row = editing && editing !== "new" ? editing : null;
  const roots = useMemo(
    () => categories.data?.filter((category) => !category.parentId) || [],
    [categories.data],
  );
  const ordered = useMemo(
    () =>
      roots.flatMap((root) => [
        root,
        ...(categories.data?.filter(
          (category) => category.parentId === root.id,
        ) || []),
      ]),
    [categories.data, roots],
  );

  function create(parentId: string | null = null) {
    setNewParentId(parentId);
    setEditing("new");
  }

  return (
    <>
      <div className="section-heading !mt-0">
        <div>
          <p className="eyebrow">Catalogue structure</p>
          <h1 className="!text-4xl">Categories</h1>
        </div>
        <button className="primary" onClick={() => create()}>
          Add category
        </button>
      </div>
      <Notice text={categories.error} tone="error" />
      {editing && (
        <form
          className="admin-form stack"
          key={row?.id || `new-${newParentId || "root"}`}
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            const form = new FormData(event.currentTarget);
            try {
              await api(
                `admin/categories${row ? `/${row.id}` : ""}`,
                row ? "PATCH" : "POST",
                {
                  name: form.get("name"),
                  slug: form.get("slug"),
                  parentId: String(form.get("parentId") || "") || null,
                },
              );
              setEditing(null);
              setNewParentId(null);
              await categories.reload();
              toast("Category saved.", "success");
            } catch (error) {
              toast(message(error), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>{row ? "Edit category" : "Create category"}</h2>
          <div className="form-grid">
            <Field label="Name" name="name" required defaultValue={row?.name} />
            <Field
              label="Slug"
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              defaultValue={row?.slug}
            />
            <label className="field">
              <span>Parent category</span>
              <select
                name="parentId"
                defaultValue={row?.parentId || newParentId || ""}
                disabled={Boolean(row?._count.children)}
              >
                <option value="">None (top-level category)</option>
                {roots
                  .filter((category) => category.id !== row?.id)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {Boolean(row?._count.children) && (
            <p className="muted text-sm">
              This remains a top-level category because it already contains
              subcategories.
            </p>
          )}
          <p className="muted text-sm">
            Choose a parent to create a subcategory. The catalogue supports one
            subcategory level to keep navigation clear.
          </p>
          <div className="flex gap-3">
            <button className="primary" disabled={busy}>
              Save category
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setEditing(null)}
            >
              Close
            </button>
          </div>
        </form>
      )}
      {categories.loading ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Type</th>
                <th>Products</th>
                <th>Subcategories</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((category) => (
                <tr key={category.id}>
                  <td>
                    <strong
                      className={category.parentId ? "category-child" : ""}
                    >
                      {category.parentId ? "-- " : ""}
                      {category.name}
                    </strong>
                    <p className="muted">/{category.slug}</p>
                  </td>
                  <td>{category.parentId ? "Subcategory" : "Top level"}</td>
                  <td>{category._count.products}</td>
                  <td>{category._count.children}</td>
                  <td>
                    <div className="flex gap-3 flex-wrap">
                      <button
                        className="text-button"
                        onClick={() => {
                          setEditing(category);
                          setNewParentId(null);
                        }}
                      >
                        Edit
                      </button>
                      {!category.parentId && (
                        <button
                          className="text-button"
                          onClick={() => create(category.id)}
                        >
                          + Add subcategory
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
