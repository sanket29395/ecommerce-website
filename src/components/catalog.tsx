"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Empty, Loading, Notice, ProductCard, useData } from "./ui";
import type { Category, Product } from "@/lib/types";

type CatalogData = {
  products: Product[];
  categories: Category[];
  total: number;
  page: number;
};

export function Catalog({ home = false }: { home?: boolean }) {
  const searchParams = useSearchParams();
  const params = home ? "" : searchParams.toString();
  const query = home ? "" : searchParams.get("q") || "";
  const category = home ? "" : searchParams.get("category") || "";
  const availabilityParam = searchParams.get("availability");
  const availability =
    !home && ["in-stock", "out-of-stock"].includes(availabilityParam || "")
      ? availabilityParam!
      : "all";
  const featured = !home && searchParams.get("featured") === "true";
  const sortParam = searchParams.get("sort");
  const sort =
    !home &&
    ["price-asc", "price-desc", "name-asc", "name-desc"].includes(
      sortParam || "",
    )
      ? sortParam!
      : "newest";
  const page = home
    ? 1
    : Math.min(10000, Math.max(1, Number(searchParams.get("page")) || 1));
  const minParam = home ? "" : searchParams.get("min") || "";
  const maxParam = home ? "" : searchParams.get("max") || "";
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftMin, setDraftMin] = useState(minParam);
  const [draftMax, setDraftMax] = useState(maxParam);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data, error, loading } = useData<CatalogData>(
    home ? "products?page=1&sort=newest" : `products?${params}`,
  );
  const activeFilterCount = [
    query,
    category,
    minParam,
    maxParam,
    availability !== "all" ? availability : "",
    featured ? "featured" : "",
  ].filter(Boolean).length;

  useEffect(() => {
    if (home) return;
    setDraftQuery(query);
    setDraftMin(minParam);
    setDraftMax(maxParam);
  }, [home, maxParam, minParam, query]);

  useEffect(() => {
    if (!filtersOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setFiltersOpen(false);
    }

    function closeAtDesktopWidth() {
      if (window.innerWidth > 900) setFiltersOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeAtDesktopWidth);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeAtDesktopWidth);
    };
  }, [filtersOpen]);

  function updateParams(
    changes: Record<string, string | null>,
    resetPage = true,
  ) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (resetPage) next.delete("page");
    const nextQuery = next.toString();
    window.history.pushState(
      null,
      "",
      nextQuery ? `/shop?${nextQuery}` : "/shop",
    );
  }

  if (home) {
    const products = data?.products || [];
    const heroProduct =
      products.find((product) => product.featured && product.images[0]) ||
      products.find((product) => product.images[0]);
    const storyProduct = products.find(
      (product) => product.id !== heroProduct?.id && product.images[0],
    );
    const collectionCards = [
      ...(data?.categories || []).slice(0, 2).map((item) => ({
        id: item.id,
        name: item.name,
        href: `/shop?category=${encodeURIComponent(item.slug)}`,
        image: products.find(
          (product) =>
            product.categoryId === item.id ||
            product.category?.parentId === item.id,
        )?.images[0],
      })),
      {
        id: "all-products",
        name: "The full edit",
        href: "/shop",
        image: products[2]?.images[0],
      },
    ].slice(0, 3);

    return (
      <div className="home-page">
        <section className="home-hero">
          <div className="home-hero-copy">
            <div className="home-kicker">
              <span aria-hidden="true" />
              The everyday edit
            </div>
            <h1>
              Better choices for your <em>everyday.</em>
            </h1>
            <p className="home-hero-intro">
              A thoughtful collection of good things, chosen to make the
              everyday feel a little more considered.
            </p>
            <div className="home-hero-actions">
              <Link className="button" href="/shop">
                Shop the collection <span aria-hidden="true">&rarr;</span>
              </Link>
              <a className="home-link" href="#collections">
                Explore categories
              </a>
            </div>
            <div className="home-hero-note">
              <span className="home-avatar-stack" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <p>
                <strong>Small edit, big difference.</strong>
                <br />
                Useful finds without the endless scroll.
              </p>
            </div>
          </div>
          <div className="home-hero-visual">
            <span className="hero-shape hero-shape-one" aria-hidden="true" />
            <span className="hero-shape hero-shape-two" aria-hidden="true" />
            <div className="home-hero-image">
              {heroProduct?.images[0] ? (
                <img src={heroProduct.images[0]} alt={heroProduct.name} />
              ) : (
                <span className="home-image-fallback">F&amp;F</span>
              )}
            </div>
            <div className="home-floating-card">
              <span className="home-floating-label">Freshly selected</span>
              <strong>{heroProduct?.name || "The everyday edit"}</strong>
              <Link
                href={heroProduct ? `/products/${heroProduct.slug}` : "/shop"}
              >
                Discover <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
            <span className="home-hero-mark" aria-hidden="true">
              Good things
              <br />
              live here
            </span>
          </div>
        </section>

        <section className="home-value-strip" aria-label="Why shop with us">
          <article>
            <span>01</span>
            <div>
              <strong>Thoughtfully selected</strong>
              <p>An intentional edit, never an overwhelming aisle.</p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <strong>Made for real life</strong>
              <p>Useful favourites for everyday moments and rituals.</p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <strong>Simple to explore</strong>
              <p>Clear details, easy discovery and secure checkout.</p>
            </div>
          </article>
        </section>

        <section className="home-section" id="collections">
          <div className="home-section-heading">
            <div>
              <p className="eyebrow">Find your favourite</p>
              <h2>Shop by collection</h2>
            </div>
            <p>
              From familiar staples to something new, start with what fits your
              day.
            </p>
          </div>
          <div className="home-collection-grid">
            {collectionCards.map((collection, index) => (
              <Link
                className={`home-collection-card collection-tone-${index + 1}`}
                href={collection.href}
                key={collection.id}
              >
                <div className="home-collection-art">
                  {collection.image ? (
                    <img src={collection.image} alt="" loading="lazy" />
                  ) : (
                    <span aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  )}
                </div>
                <div className="home-collection-copy">
                  <p>Collection {String(index + 1).padStart(2, "0")}</p>
                  <h3>{collection.name}</h3>
                  <span>
                    Explore now <i aria-hidden="true">&rarr;</i>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-section home-product-section">
          <div className="home-section-heading home-product-heading">
            <div>
              <p className="eyebrow">Just landed</p>
              <h2>New in the edit</h2>
            </div>
            <Link className="home-link" href="/shop">
              View everything <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          <Notice text={error} tone="error" />
          {loading ? (
            <Loading />
          ) : products.length ? (
            <div className="product-grid home-product-grid">
              {products.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <Empty>No products found. Check back soon.</Empty>
          )}
        </section>

        <section className="home-story">
          <div className="home-story-visual">
            <div className="home-story-image home-story-image-main">
              {storyProduct?.images[0] ? (
                <img
                  src={storyProduct.images[0]}
                  alt={storyProduct.name}
                  loading="lazy"
                />
              ) : (
                <span className="home-image-fallback">Everyday</span>
              )}
            </div>
            <div className="home-story-stamp" aria-hidden="true">
              <span>F&amp;F</span>
              Considered daily
            </div>
          </div>
          <div className="home-story-copy">
            <p className="eyebrow">Our point of view</p>
            <h2>The everyday deserves a little attention.</h2>
            <p className="home-story-intro">
              We believe the best products are the ones that quietly earn a
              place in your routine. Useful, enjoyable and chosen with intent.
            </p>
            <ol className="home-story-list">
              <li>
                <span>01</span>
                <div>
                  <strong>A considered edit</strong>
                  <p>Fewer distractions, more genuinely useful finds.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Details that matter</strong>
                  <p>Clear information so you can choose with confidence.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Always evolving</strong>
                  <p>A dynamic collection that grows with your everyday.</p>
                </div>
              </li>
            </ol>
            <Link className="button button-light" href="/shop?featured=true">
              Explore selected favourites
            </Link>
          </div>
        </section>

        <section className="home-closing-cta">
          <span className="home-cta-orbit" aria-hidden="true">
            &bull;
          </span>
          <p className="eyebrow">Ready when you are</p>
          <h2>Find something worth reaching for every day.</h2>
          <Link className="button" href="/shop">
            Start exploring <span aria-hidden="true">&rarr;</span>
          </Link>
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="section-heading shop-heading">
        <div>
          <p className="eyebrow">Made for your everyday</p>
          <h1 className="!text-4xl">Shop all products</h1>
        </div>
        <span className="muted">
          {data?.total || 0} {data?.total === 1 ? "product" : "products"}
        </span>
      </div>
      <div className="mobile-filter-bar">
        <button
          type="button"
          className="secondary filter-toggle"
          aria-expanded={filtersOpen}
          aria-controls="shop-filters"
          onClick={() => setFiltersOpen(true)}
        >
          Filters
          {activeFilterCount > 0 && (
            <span
              className="filter-count"
              aria-label={`${activeFilterCount} active filters`}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
      {filtersOpen && (
        <button
          type="button"
          className="filter-backdrop"
          aria-label="Close filters"
          tabIndex={-1}
          onClick={() => setFiltersOpen(false)}
        />
      )}
      <div className="shop-layout">
        <aside
          id="shop-filters"
          className={`shop-filters ${filtersOpen ? "filters-open" : ""}`}
          aria-label="Product filters"
        >
          <div className="filter-panel-header">
            <h2>Filters</h2>
            <div className="filter-panel-actions">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    window.history.pushState(null, "", "/shop");
                    setFiltersOpen(false);
                  }}
                >
                  Clear all
                </button>
              )}
              <button
                type="button"
                className="filter-close"
                aria-label="Close filters"
                onClick={() => setFiltersOpen(false)}
              >
                &times;
              </button>
            </div>
          </div>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              updateParams({
                q: draftQuery.trim() || null,
                min: draftMin || null,
                max: draftMax || null,
              });
              setFiltersOpen(false);
            }}
          >
            <label className="field">
              <span>Search</span>
              <input
                type="search"
                placeholder="Name, description, SKU..."
                value={draftQuery}
                maxLength={100}
                onChange={(event) => setDraftQuery(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Category</span>
              <select
                value={category}
                onChange={(event) =>
                  updateParams({ category: event.target.value || null })
                }
              >
                <option value="">All categories</option>
                {data?.categories.map((parent) => [
                  <option value={parent.slug} key={parent.id}>
                    {parent.name}
                  </option>,
                  ...(parent.children || []).map((child) => (
                    <option value={child.slug} key={child.id}>
                      -- {parent.name} / {child.name}
                    </option>
                  )),
                ])}
              </select>
            </label>
            <div className="price-filter">
              <label className="field">
                <span>Min price (INR)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={draftMax || undefined}
                  placeholder="0"
                  value={draftMin}
                  onChange={(event) => setDraftMin(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Max price (INR)</span>
                <input
                  type="number"
                  min={draftMin || "0"}
                  step="0.01"
                  placeholder="Any"
                  value={draftMax}
                  onChange={(event) => setDraftMax(event.target.value)}
                />
              </label>
            </div>
            <label className="field">
              <span>Availability</span>
              <select
                value={availability}
                onChange={(event) =>
                  updateParams({
                    availability:
                      event.target.value === "all" ? null : event.target.value,
                  })
                }
              >
                <option value="all">All products</option>
                <option value="in-stock">In stock</option>
                <option value="out-of-stock">Out of stock</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={featured}
                onChange={(event) =>
                  updateParams({
                    featured: event.target.checked ? "true" : null,
                  })
                }
              />
              Featured products only
            </label>
            <button className="primary">Apply filters</button>
          </form>
        </aside>
        <section className="shop-results" aria-live="polite">
          <div className="results-toolbar">
            <p className="muted">
              {query ? `Results for "${query}"` : "Browse the collection"}
            </p>
            <label className="sort-control">
              <span>Sort by</span>
              <select
                value={sort}
                onChange={(event) =>
                  updateParams({
                    sort:
                      event.target.value === "newest"
                        ? null
                        : event.target.value,
                  })
                }
              >
                <option value="newest">Newest</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name-asc">Name: A to Z</option>
                <option value="name-desc">Name: Z to A</option>
              </select>
            </label>
          </div>
          <Notice text={error} tone="error" />
          {loading ? (
            <Loading />
          ) : data?.products.length ? (
            <div className="product-grid shop-product-grid">
              {data.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <Empty>
              No products match these filters. Try widening your search.
            </Empty>
          )}
          <div className="pagination">
            <button
              className="secondary"
              disabled={page <= 1 || loading}
              onClick={() => updateParams({ page: String(page - 1) }, false)}
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              className="secondary"
              disabled={page * 24 >= (data?.total || 0) || loading}
              onClick={() => updateParams({ page: String(page + 1) }, false)}
            >
              Next
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
