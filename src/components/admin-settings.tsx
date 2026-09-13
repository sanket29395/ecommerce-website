"use client";
import { useState } from "react";
import { api, useData, Field, Notice, Loading, Pager, message } from "./ui";
import { useToast } from "./toast";
type Row = {
  id: string;
  name?: string;
  slug?: string;
  code?: string;
  percent?: number;
  minSubtotal?: number;
  maxUses?: number;
  used?: number;
  active?: boolean;
  expiresAt?: string;
  email?: string;
  createdAt?: string;
  actorId?: string;
  action?: string;
  targetId?: string;
  _count?: { orders: number };
};
export function AdminSettings({
  resource,
}: {
  resource: "categories" | "coupons" | "customers" | "audit";
}) {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useData<Row[]>(
    `admin/${resource}?page=${page}`,
  );
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const row = editing && editing !== "new" ? editing : null;
  const editable = resource === "categories" || resource === "coupons";
  return (
    <>
      <div className="section-heading !mt-0">
        <h1 className="!text-4xl capitalize">
          {resource === "audit" ? "Audit log" : resource}
        </h1>
        {editable && (
          <button className="primary" onClick={() => setEditing("new")}>
            Add {resource === "categories" ? "category" : "coupon"}
          </button>
        )}
      </div>
      <Notice text={error} tone="error" />
      {editing && editable && (
        <form
          className="admin-form stack"
          key={row?.id || "new"}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            const value =
              resource === "categories"
                ? { name: f.get("name"), slug: f.get("slug") }
                : {
                    code: f.get("code"),
                    percent: Number(f.get("percent")),
                    minSubtotal: Math.round(Number(f.get("minSubtotal")) * 100),
                    maxUses: Number(f.get("maxUses")),
                    active: f.has("active"),
                    expiresAt: new Date(
                      String(f.get("expiresAt")),
                    ).toISOString(),
                  };
            try {
              await api(
                `admin/${resource}${row ? `/${row.id}` : ""}`,
                row ? "PATCH" : "POST",
                value,
              );
              setEditing(null);
              await reload();
              toast("Saved.", "success");
            } catch (e) {
              toast(message(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>{row ? "Edit" : "Create"}</h2>
          <div className="form-grid">
            {resource === "categories" ? (
              <>
                <Field
                  label="Name"
                  name="name"
                  required
                  defaultValue={row?.name}
                />
                <Field
                  label="Slug"
                  name="slug"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  defaultValue={row?.slug}
                />
              </>
            ) : (
              <>
                <Field
                  label="Code"
                  name="code"
                  required
                  defaultValue={row?.code}
                />
                <Field
                  label="Discount percentage (1–90)"
                  name="percent"
                  type="number"
                  min={1}
                  max={90}
                  required
                  defaultValue={row?.percent || 10}
                />
                <Field
                  label="Minimum subtotal in ₹"
                  name="minSubtotal"
                  type="number"
                  min={0}
                  required
                  defaultValue={(row?.minSubtotal || 0) / 100}
                />
                <Field
                  label="Maximum total uses"
                  name="maxUses"
                  type="number"
                  min={1}
                  required
                  defaultValue={row?.maxUses || 100}
                />
                <Field
                  label="Expiry date (UTC)"
                  name="expiresAt"
                  type="date"
                  required
                  defaultValue={row?.expiresAt?.slice(0, 10)}
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={row?.active ?? true}
                  />
                  Active
                </label>
              </>
            )}
          </div>
          <div className="flex gap-3">
            <button className="primary" disabled={busy}>
              Save
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => setEditing(null)}
            >
              Close
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {(resource === "categories"
                  ? ["Name", "Slug", "Manage"]
                  : resource === "coupons"
                    ? [
                        "Code",
                        "Discount",
                        "Uses (including reservations)",
                        "Expires",
                        "Manage",
                      ]
                    : resource === "customers"
                      ? ["Customer", "Email", "Orders", "Joined"]
                      : ["Action", "Actor ID", "Target ID", "Date"]
                ).map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.map((r) => (
                <tr key={r.id}>
                  {resource === "categories" ? (
                    <>
                      <td>{r.name}</td>
                      <td>{r.slug}</td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => setEditing(r)}
                        >
                          Edit
                        </button>
                      </td>
                    </>
                  ) : resource === "coupons" ? (
                    <>
                      <td>
                        {r.code}
                        {!r.active && " (inactive)"}
                      </td>
                      <td>{r.percent}%</td>
                      <td>
                        {r.used} / {r.maxUses}
                      </td>
                      <td>{r.expiresAt?.slice(0, 10)}</td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => setEditing(r)}
                        >
                          Edit
                        </button>
                      </td>
                    </>
                  ) : resource === "customers" ? (
                    <>
                      <td>{r.name}</td>
                      <td>{r.email}</td>
                      <td>{r._count?.orders}</td>
                      <td>{r.createdAt?.slice(0, 10)}</td>
                    </>
                  ) : (
                    <>
                      <td>{r.action}</td>
                      <td className="break-all">{r.actorId}</td>
                      <td className="break-all">{r.targetId}</td>
                      <td>
                        {r.createdAt && new Date(r.createdAt).toLocaleString()}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {resource !== "categories" && (
        <Pager page={page} setPage={setPage} count={data?.length || 0} />
      )}
    </>
  );
}
