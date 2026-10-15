import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Button, ErrorText, Field, Header, Screen, T } from "@/components/ui";
import { errorText } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { space } from "@/theme";

export default function Login() {
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!phone.trim() || !password) {
      setError("Enter your phone number and password");
      return;
    }
    try {
      await login(phone.trim(), password);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Header title="" />
        <T v="display">Welcome back</T>
        <T v="body" style={{ marginTop: space.xs, marginBottom: space.xxl, color: "#5B6474" }}>
          Log in with the phone number you signed up with.
        </T>
        <View style={{ gap: space.lg }}>
          <Field
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="+509 3XXX XXXX"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            onSubmitEditing={submit}
          />
          <ErrorText error={error} />
          <Button title="Log in" onPress={submit} />
          <Button title="New to Aynix? Create an account" kind="ghost" onPress={() => router.replace("/register")} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
