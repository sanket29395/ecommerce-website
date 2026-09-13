import { notFound } from "next/navigation";
const policies: Record<string, { title: string; paragraphs: string[] }> = {
  shipping: {
    title: "Shipping & returns",
    paragraphs: [
      "We currently accept delivery addresses in India. Available shipping charges are displayed before payment. Delivery times depend on the destination and fulfilment arrangements.",
      "For a cancellation, return, damaged item, or refund request, contact the store with your order reference. Unpaid pending orders can be cancelled in My account. Refunds are returned through the original payment provider after review.",
      "Store owner: replace this draft with your actual dispatch times, serviceable locations, return window, exclusions, and support contact before opening the store.",
    ],
  },
  privacy: {
    title: "Privacy policy",
    paragraphs: [
      "The store uses account details, delivery addresses, order history, and payment references to provide shopping and fulfilment services. Card details are collected by the payment provider and are not stored by this application.",
      "An essential session cookie keeps you signed in. Product images may be served by external image providers. Requests to access or delete personal information should be sent to the store operator.",
      "Store owner: complete this draft with your legal business name, contact details, data retention periods, processors, and applicable privacy rights before launch.",
    ],
  },
  terms: {
    title: "Terms of sale",
    paragraphs: [
      "Products and prices are subject to availability. The server validates availability, discounts, and the final amount before creating a payment order. A payment window closing successfully is not confirmation that an order is paid; captured payment must be verified.",
      "Contact support regarding fulfilment issues, refund requests, or payment discrepancies and include your order reference.",
      "Store owner: replace this draft with the terms applicable to your business, tax and invoice details, cancellation conditions, and dispute process before launch.",
    ],
  },
};
export default async function Page({
  params,
}: {
  params: Promise<{ policy: string }>;
}) {
  const { policy } = await params;
  const p = policies[policy];
  if (!p) notFound();
  return (
    <article className="prose">
      <h1>{p.title}</h1>
      {p.paragraphs.map((t) => (
        <p key={t}>{t}</p>
      ))}
    </article>
  );
}
