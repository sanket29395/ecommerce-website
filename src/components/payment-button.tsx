"use client";
import { api } from "./ui";
type PaymentOrder = {
  id: string;
  key: string;
  razorpayOrderId: string;
  total: number;
};
type CheckoutOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  handler: () => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
};
declare global {
  interface Window {
    Razorpay: new (options: CheckoutOptions) => { open: () => void };
  }
}
let scriptPromise: Promise<void> | undefined;
async function load() {
  if (window.Razorpay) return;
  if (!scriptPromise)
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = undefined;
        script.remove();
        reject(new Error("Unable to load secure checkout"));
      };
      document.body.appendChild(script);
    });
  await scriptPromise;
}
export async function pay(order: PaymentOrder, onComplete: () => void) {
  await load();
  new window.Razorpay({
    key: order.key,
    order_id: order.razorpayOrderId,
    amount: order.total,
    currency: "INR",
    name: "Form & Field",
    theme: { color: "#14281e" },
    handler: () => {
      void api(`orders/${order.id}/sync`, "POST")
        .catch(() => null)
        .finally(onComplete);
    },
    modal: { ondismiss: onComplete },
  }).open();
}
export type { PaymentOrder };
