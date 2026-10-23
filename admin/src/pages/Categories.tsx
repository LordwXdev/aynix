import { FormEvent, useState } from "react";
import { api } from "../api/client";
import type { Category } from "../api/types";
import { Badge } from "../components/Badge";
import { Dialog } from "../components/Overlay";
import { useAction } from "../components/Toast";
import { useAsync } from "../lib/useAsync";

const CategoryForm = ({
  category,
  categories,
  onSaved,
  onClose,
}: {
  category: Category | null;
  categories: Category[];
  onSaved: () => void;
  onClose: () => void;
}) => {
  const run = useAction();
  const [name, setName] = useState(category?.name ?? "");
  const [parentId, setParentId] = useState(category?.parentId ?? "");
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? categories.length));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { name: name.trim(), parentId: parentId || null, sortOrder: Number(sortOrder) || 0 };
    const ok = await run(
      () =>
        category
          ? api.patch(`/api/admin/categories/${category.id}`, body)
          : api.post("/api/admin/categories", { ...body, parentId: parentId || undefined }),
      category ? "Category saved" : "Category added"
    );
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog title={category ? "Edit category" : "New category"} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          Inside another category (optional)
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">No, it is a main category</option>
            {categories
              .filter((c) => c.id !== category?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          Position (smaller shows first)
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </label>
        <div className="btn-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>
            Back
          </button>
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Dialog>
  );
};

export const Categories = () => {
  const run = useAction();
  const [editing, setEditing] = useState<Category | null | "new">(null);
  const { data, error, reload } = useAsync(
    () => api.get<{ categories: Category[] }>("/api/admin/categories").then((r) => r.categories),
    []
  );
  const categories = data ?? [];
  const nameOf = (id: string | null) => categories.find((c) => c.id === id)?.name;

  const toggle = async (c: Category) => {
    if (
      await run(
        () => api.patch(`/api/admin/categories/${c.id}`, { isActive: !c.isActive }),
        c.isActive ? "Category hidden" : "Category shown"
      )
    ) {
      await reload();
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Categories</h1>
        <button className="btn primary" onClick={() => setEditing("new")}>
          Add category
        </button>
      </div>
      <div className="card">
        {error && <div className="error-text">{error}</div>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Name</th>
                <th>Inside</th>
                <th className="num">Products</th>
                <th>Shown</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="num muted">{c.sortOrder}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div className="small muted">{c.slug}</div>
                  </td>
                  <td>{nameOf(c.parentId) ?? <span className="muted">—</span>}</td>
                  <td className="num">{c._count?.products ?? 0}</td>
                  <td>{c.isActive ? <Badge status="ACTIVE" label="Shown" /> : <Badge status="OFFLINE" label="Hidden" />}</td>
                  <td className="num">
                    <div className="btn-row" style={{ justifyContent: "flex-end" }}>
                      <button className="btn sm" onClick={() => setEditing(c)}>
                        Edit
                      </button>
                      <button className="btn sm" onClick={() => void toggle(c)}>
                        {c.isActive ? "Hide" : "Show"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && categories.length === 0 && <div className="empty">No categories yet. Run npm run seed or add one.</div>}
        </div>
      </div>
      {editing && (
        <CategoryForm
          category={editing === "new" ? null : editing}
          categories={categories}
          onSaved={reload}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
};
