import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { ProductArt } from "@/components/product";
import { Button, ChoiceChips, ErrorText, Field, Header, Loading, Row, Screen, T } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { useCategories } from "@/lib/catalog";
import type { Product } from "@/lib/types";
import { colors, space } from "@/theme";

type Status = "ACTIVE" | "DRAFT" | "INACTIVE";

export default function ProductForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { categories } = useCategories();
  const [loading, setLoading] = useState(!!id);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [comparePrice, setComparePrice] = useState("");
  const [stock, setStock] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [status, setStatus] = useState<Status>("ACTIVE");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<{ products: Product[] }>("/api/products/mine")
      .then(({ products }) => {
        const p = products.find((x) => x.id === id);
        if (!p) return setError("Product not found");
        setName(p.name);
        setPrice(String(Number(p.price)));
        setComparePrice(p.comparePrice ? String(Number(p.comparePrice)) : "");
        setStock(String(p.stockQty));
        setCategoryId(p.categoryId);
        setDescription(p.description ?? "");
        setImage(p.images?.[0] ?? "");
        setStatus(p.status === "OUT_OF_STOCK" ? "ACTIVE" : (p.status as Status));
      })
      .catch((err) => setError(errorText(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    setError(null);
    const priceNum = Number(price.replace(",", "."));
    const stockNum = Number(stock || 0);
    if (!name.trim()) return setError("Give your product a name");
    if (!Number.isFinite(priceNum) || priceNum <= 0) return setError("Enter a price above 0");
    if (!Number.isInteger(stockNum) || stockNum < 0) return setError("Stock must be a whole number");
    if (!categoryId) return setError("Pick a category");

    const body = {
      name: name.trim(),
      price: priceNum,
      comparePrice: comparePrice ? Number(comparePrice.replace(",", ".")) : undefined,
      stockQty: stockNum,
      categoryId,
      description: description.trim() || undefined,
      images: image.trim() ? [image.trim()] : undefined,
      status,
    };
    try {
      if (id) await api.patch(`/api/products/${id}`, body);
      else await api.post("/api/products", body);
      router.back();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen footer={!loading && <Button title={id ? "Save changes" : "Add product"} icon="checkmark" onPress={save} />}>
        <Header title={id ? "Edit product" : "New product"} />
        {loading ? (
          <Loading />
        ) : (
          <View style={{ gap: space.lg }}>
            {categoryId && (
              <View style={{ alignItems: "center" }}>
                <ProductArt image={image.trim() || null} categoryId={categoryId} size={120} />
              </View>
            )}
            <Field label="Product name" value={name} onChangeText={setName} placeholder="Diri lokal 5 kg" />
            <Row gap={space.md} style={{ alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Field label="Price (HTG)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="750" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="In stock" value={stock} onChangeText={setStock} keyboardType="number-pad" placeholder="20" />
              </View>
            </Row>
            <Field
              label="Old price (optional)"
              value={comparePrice}
              onChangeText={setComparePrice}
              keyboardType="decimal-pad"
              hint="If it is on sale, put the old price here. Customers see it crossed out."
            />
            <ChoiceChips
              label="Category"
              options={categories.map((c) => ({ key: c.id, label: c.name }))}
              value={categoryId}
              onChange={setCategoryId}
            />
            <Field
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Size, color, what's included…"
            />
            <Field
              label="Photo link (optional)"
              value={image}
              onChangeText={setImage}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://…"
              hint="Photo upload from your phone is coming soon."
            />
            <ChoiceChips<Status>
              label="Who can see it"
              options={[
                { key: "ACTIVE", label: "Visible to customers", icon: "eye" },
                { key: "DRAFT", label: "Draft", icon: "create" },
                { key: "INACTIVE", label: "Hidden", icon: "eye-off" },
              ]}
              value={status}
              onChange={setStatus}
            />
            <ErrorText error={error} />
            <T v="small" style={{ color: colors.text3, textAlign: "center" }}>
              Aynix keeps a small fee on each sale. You see your exact earnings on every order.
            </T>
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
