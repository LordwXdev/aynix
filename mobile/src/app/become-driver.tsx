import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Button, ChoiceChips, ErrorText, Field, Header, Notice, Screen, T } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DEPARTMENTS } from "@/lib/format";
import { colors, space } from "@/theme";

type Vehicle = "MOTO" | "CAR" | "BICYCLE" | "FOOT";

export default function BecomeDriver() {
  const { user, reloadUser } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>("MOTO");
  const [plate, setPlate] = useState("");
  const [city, setCity] = useState(user?.city ?? "");
  const [department, setDepartment] = useState<string | null>(user?.department ?? null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!vehicle) return setError("Pick how you will deliver");
    if (!city.trim() || !department) return setError("Add the city and department where you will work");
    try {
      await api.post("/api/drivers", {
        vehicleType: vehicle,
        plateNumber: plate.trim() || undefined,
        city: city.trim(),
        department,
      });
      await reloadUser();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen footer={<Button title="Send my application" icon="send" onPress={submit} />}>
        <Header title="" />
        <T v="display">Drive with Aynix Move</T>
        <T v="body" style={{ color: colors.text2, marginTop: space.xs, marginBottom: space.xl }}>
          Pick up orders from local stores and bring them to customers near you. Go online when you want to work.
        </T>
        <View style={{ gap: space.lg }}>
          <ChoiceChips<Vehicle>
            label="How will you deliver?"
            options={[
              { key: "MOTO", label: "Moto", icon: "bicycle" },
              { key: "CAR", label: "Car", icon: "car" },
              { key: "BICYCLE", label: "Bicycle", icon: "bicycle-outline" },
              { key: "FOOT", label: "On foot", icon: "walk" },
            ]}
            value={vehicle}
            onChange={setVehicle}
          />
          {(vehicle === "MOTO" || vehicle === "CAR") && (
            <Field label="Plate number" value={plate} onChangeText={setPlate} autoCapitalize="characters" placeholder="AA-12345" />
          )}
          <Field label="City where you work" value={city} onChangeText={setCity} placeholder="Port-au-Prince" />
          <ChoiceChips
            label="Department"
            options={DEPARTMENTS.map((d) => ({ key: d, label: d }))}
            value={department}
            onChange={setDepartment}
          />
          <Notice tone="info" icon="shield-checkmark" title="Aynix checks every driver">
            After you apply, our team reviews your account. We’ll text you when you can start.
          </Notice>
          <ErrorText error={error} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
