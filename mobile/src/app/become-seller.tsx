import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { StoreFields, StoreValues, storeBody } from "@/components/storeForm";
import { Button, ErrorText, Header, Screen, T } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, space } from "@/theme";

export default function BecomeSeller() {
  const { user, reloadUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<StoreValues>({
    storeName: "",
    description: "",
    whatsapp: user?.phone ?? "",
    address: "",
    city: user?.city ?? "",
    department: user?.department ?? null,
    latitude: null,
    longitude: null,
  });

  const submit = async () => {
    setError(null);
    if (!values.storeName.trim()) return setError("Give your store a name");
    if (!values.city.trim() || !values.department) return setError("Add your city and department so drivers can find you");
    try {
      await api.post("/api/vendors", storeBody(values));
      // the account is now a seller: switching to the seller side of the app
      await reloadUser();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen footer={<Button title="Open my store" icon="storefront" onPress={submit} />}>
        <Header title="" />
        <T v="display">Sell on Aynix</T>
        <T v="body" style={{ color: colors.text2, marginTop: space.xs, marginBottom: space.xl }}>
          Open your store for free. Aynix checks it, then customers all over Haiti can buy from you. Drivers pick up
          and deliver, and customers pay in cash.
        </T>
        <View style={{ gap: space.lg }}>
          <StoreFields values={values} onChange={setValues} />
          <ErrorText error={error} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
