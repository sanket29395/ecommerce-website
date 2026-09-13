"use client";
import { useState } from "react";
import { api, Field, message } from "./ui";
import type { Address } from "@/lib/types";
import { useToast } from "./toast";
export function AddressForm({
  onSaved,
  existing,
}: {
  onSaved: () => void;
  existing?: Address;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        try {
          await api(
            existing ? `addresses/${existing.id}` : "addresses",
            existing ? "PATCH" : "POST",
            Object.fromEntries(new FormData(form)),
          );
          form.reset();
          toast("Address saved.", "success");
          onSaved();
        } catch (e) {
          toast(message(e), "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        {[
          ["name", "Recipient name"],
          ["phone", "Mobile number"],
          ["line1", "Address line 1"],
          ["line2", "Address line 2 (optional)"],
          ["city", "City"],
          ["state", "State"],
          ["pincode", "PIN code"],
        ].map(([name, label]) => (
          <Field
            key={name}
            name={name}
            label={label}
            required={name !== "line2"}
            defaultValue={existing?.[name as keyof Address] || ""}
            pattern={
              name === "phone"
                ? "[6-9][0-9]{9}"
                : name === "pincode"
                  ? "[1-9][0-9]{5}"
                  : undefined
            }
            maxLength={200}
          />
        ))}
      </div>
      <button className="primary" disabled={busy}>
        Save address
      </button>
    </form>
  );
}
