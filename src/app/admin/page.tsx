"use client";
import { useData, Notice, InlineNotice, Loading } from "@/components/ui";
import { money } from "@/lib/money";
export default function Page() {
  const { data, error } = useData<{
    orders: number;
    products: number;
    customers: number;
    revenue: number;
    review: number;
    lowStock: {
      id: string;
      name: string;
      stock: number;
      product: { name: string };
    }[];
  }>("admin/dashboard");
  return (
    <>
      <p className="eyebrow">Your store at a glance</p>
      <h1 className="!text-4xl">Overview</h1>
      <Notice text={error} tone="error" />
      {data ? (
        <>
          <div className="metrics">
            {[
              ["Gross paid sales", money(data.revenue)],
              ["Orders", data.orders],
              ["Products", data.products],
              ["Customers", data.customers],
            ].map(([label, value]) => (
              <div className="metric" key={label}>
                <span className="muted text-sm">{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          {data.review > 0 && (
            <InlineNotice
              text={`${data.review} payment(s) need manual review. Open Orders to investigate.`}
            />
          )}
          <h2 className="my-6">Low stock</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Option</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                {data.lowStock.map((v) => (
                  <tr key={v.id}>
                    <td>{v.product.name}</td>
                    <td>{v.name}</td>
                    <td>{v.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.lowStock.length && (
              <p className="muted p-5">No low-stock variants.</p>
            )}
          </div>
          <p className="muted text-sm mt-6">
            Gross paid sales includes shipping and tax; it is not a profit or
            accounting report.
          </p>
        </>
      ) : (
        !error && <Loading />
      )}
    </>
  );
}
