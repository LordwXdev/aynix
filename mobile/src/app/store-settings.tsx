import { router } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { StoreFields, StoreValues, storeBody } from "@/components/storeForm";
import { Button, ErrorText, Header, Loading, Screen } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import type { Vendor } from "@/lib/types";
import { space } from "@/theme";

export default function StoreSettings() {
  const [values, setValues] = useState<StoreValues | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ vendor: Vendor }>("/api/vendors/me")
      .then(({ vendor: v }) =>
        setValues({
          storeName: v.storeName,
          description: v.description ?? "",
          whatsapp: v.whatsapp ?? "",
          address: v.address ?? "",
          city: v.city ?? "",
          department: v.department,
          latitude: v.latitude,
          longitude: v.longitude,
        })
      )
      .catch((err) => setError(errorText(err)));
  }, []);

  const save = async () => {
    if (!values) return;
    setError(null);
    if (!values.storeName.trim()) return setError("Your store needs a name");
    try {
      await api.patch("/api/vendors/me", storeBody(values));
      router.back();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen footer={values && <Button title="Save" icon="checkmark" onPress={save} />}>
        <Header title="Store settings" />
        {!values && !error && <Loading />}
        <View style={{ gap: space.lg }}>
          {values && <StoreFields values={values} onChange={setValues} />}
          <ErrorText error={error} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
