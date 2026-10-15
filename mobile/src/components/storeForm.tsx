import * as Location from "expo-location";
import { useState } from "react";
import { View } from "react-native";
import { DEPARTMENTS } from "@/lib/format";
import { space } from "@/theme";
import { Button, ChoiceChips, Field, Notice } from "./ui";

export interface StoreValues {
  storeName: string;
  description: string;
  whatsapp: string;
  address: string;
  city: string;
  department: string | null;
  latitude: number | null;
  longitude: number | null;
}

// the same fields when opening a store and when editing it
export const StoreFields = ({
  values,
  onChange,
}: {
  values: StoreValues;
  onChange: (values: StoreValues) => void;
}) => {
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const set = (patch: Partial<StoreValues>) => onChange({ ...values, ...patch });

  const pin = async () => {
    setLocating(true);
    setLocError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error();
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      set({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      setLocError("Could not get your location. Turn on location and try again.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      <Field label="Store name" value={values.storeName} onChangeText={(storeName) => set({ storeName })} placeholder="Ti Jan Shop" />
      <Field
        label="What do you sell? (optional)"
        value={values.description}
        onChangeText={(description) => set({ description })}
        multiline
        placeholder="Fresh local products from Kenscoff…"
      />
      <Field
        label="WhatsApp number (optional)"
        value={values.whatsapp}
        onChangeText={(whatsapp) => set({ whatsapp })}
        keyboardType="phone-pad"
        placeholder="+509 3XXX XXXX"
        hint="Customers can message you from your store page."
      />
      <Field label="Store address" value={values.address} onChangeText={(address) => set({ address })} placeholder="45 Rue Pavée" />
      <Field label="City or area" value={values.city} onChangeText={(city) => set({ city })} placeholder="Port-au-Prince" />
      <ChoiceChips
        label="Department"
        options={DEPARTMENTS.map((d) => ({ key: d, label: d }))}
        value={values.department}
        onChange={(department) => set({ department })}
      />
      {values.latitude !== null ? (
        <Notice tone="good" icon="location" title="Store pinned on the map">
          Drivers will come to this exact spot to pick up orders.
        </Notice>
      ) : (
        <Notice tone="info" icon="navigate" title="Pin your store on the map">
          Stand in your store and tap the button. It helps us send the closest driver.
        </Notice>
      )}
      <Button
        title={values.latitude !== null ? "Update pin to where I am" : "Pin my store here"}
        icon="locate"
        kind="secondary"
        loading={locating}
        onPress={pin}
      />
      {locError && <Notice tone="warning" title={locError} />}
    </View>
  );
};

export const storeBody = (v: StoreValues) => ({
  storeName: v.storeName.trim(),
  description: v.description.trim() || undefined,
  whatsapp: v.whatsapp.trim() || undefined,
  address: v.address.trim() || undefined,
  city: v.city.trim() || undefined,
  department: v.department ?? undefined,
  latitude: v.latitude ?? undefined,
  longitude: v.longitude ?? undefined,
});
