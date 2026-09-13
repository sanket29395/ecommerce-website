"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Field, message } from "./ui";
import { useToast } from "./toast";
export function AuthForm({
  mode,
}: {
  mode: "login" | "register" | "forgot" | "reset";
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const title = {
    login: "Welcome back.",
    register: "Make yourself at home.",
    forgot: "Forgot your password?",
    reset: "Choose a new password.",
  }[mode];
  return (
    <div className="auth-shell">
      <p className="eyebrow">Your account</p>
      <h1>{title}</h1>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const values = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const result = await api<{ message?: string }>(
              `auth/${mode}`,
              "POST",
              {
                ...values,
                ...(mode === "reset"
                  ? {
                      token: new URLSearchParams(window.location.search).get(
                        "token",
                      ),
                    }
                  : {}),
              },
            );
            if (mode === "forgot")
              toast(result.message || "Check your inbox.", "info");
            else if (mode === "reset") router.push("/login");
            else {
              router.push("/account");
              router.refresh();
            }
          } catch (e) {
            toast(message(e), "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        {mode === "register" && (
          <Field label="Full name" name="name" required autoComplete="name" />
        )}
        {mode !== "reset" && (
          <Field
            label="Email address"
            type="email"
            name="email"
            required
            autoComplete="email"
          />
        )}
        {mode !== "forgot" && (
          <Field
            label={
              mode === "register" || mode === "reset"
                ? "Password (at least 12 characters)"
                : "Password"
            }
            type="password"
            name="password"
            required
            minLength={mode === "login" ? 1 : 12}
            maxLength={128}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? "Please wait…"
            : {
                login: "Sign in",
                register: "Create account",
                forgot: "Send reset link",
                reset: "Save password",
              }[mode]}
        </button>
      </form>
      <div className="flex flex-wrap gap-5 mt-6">
        <Link
          className="text-button"
          href={mode === "login" ? "/register" : "/login"}
        >
          {mode === "login" ? "Create an account" : "Sign in"}
        </Link>
        {mode === "login" && (
          <Link className="text-button" href="/forgot-password">
            Forgot password?
          </Link>
        )}
      </div>
    </div>
  );
}
