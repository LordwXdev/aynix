import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Button, ErrorText, Field, Header, Screen, T } from "@/components/ui";
import { errorText } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, space } from "@/theme";

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim() || !phone.trim()) return setError("Enter your name and phone number");
    if (password.length < 8) return setError("Your password needs at least 8 characters");
    try {
      await register({ name: name.trim(), phone: phone.trim(), password });
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Header title="" />
        <T v="display">Create your account</T>
        <T v="body" style={{ marginTop: space.xs, marginBottom: space.xxl, color: colors.text2 }}>
          Start shopping in a minute. You can open a store or drive for Aynix later.
        </T>
        <View style={{ gap: space.lg }}>
          <Field label="Full name" value={name} onChangeText={setName} placeholder="Marie Joseph" autoComplete="name" />
          <Field
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="+509 3XXX XXXX"
            keyboardType="phone-pad"
            autoComplete="tel"
            hint="Stores and drivers use it to reach you about your orders."
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            hint="At least 8 characters."
            onSubmitEditing={submit}
          />
          <ErrorText error={error} />
          <Button title="Create account" onPress={submit} />
          <Button title="I already have an account" kind="ghost" onPress={() => router.replace("/login")} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
