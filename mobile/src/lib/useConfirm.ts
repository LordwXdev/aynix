import { Alert, Platform } from "react-native";

// "are you sure?" that works on phones and in a web browser
export const confirmAction = (title: string, message: string, yes = "Yes") =>
  new Promise<boolean>((resolve) => {
    if (Platform.OS === "web") return resolve(window.confirm(`${title}\n\n${message}`));
    Alert.alert(title, message, [
      { text: "Back", style: "cancel", onPress: () => resolve(false) },
      { text: yes, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
