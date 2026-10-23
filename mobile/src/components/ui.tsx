// the building blocks every screen uses, so the whole app feels like one thing

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, shadow, space, type } from "@/theme";

export type IconName = keyof typeof Ionicons.glyphMap;

// ---------- text ----------

type TextVariant = keyof typeof type;

export const T = ({
  v = "body",
  style,
  children,
  numberOfLines,
}: {
  v?: TextVariant;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) => (
  <Text style={[type[v], style]} numberOfLines={numberOfLines}>
    {children}
  </Text>
);

// ---------- screen ----------

// a full screen with safe areas, an optional pull-to-refresh, and room at the bottom
export const Screen = ({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  footer,
  padded = true,
  edges = ["top"],
}: {
  children: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  footer?: ReactNode;
  padded?: boolean;
  edges?: ("top" | "bottom")[];
}) => {
  const content = padded ? { padding: space.lg, paddingBottom: space.xxxl } : undefined;
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, content]}>{children}</View>
      )}
      {footer && <View style={styles.footer}>{footer}</View>}
    </SafeAreaView>
  );
};

// title row at the top of a pushed screen, with a back button
export const Header = ({ title, right }: { title: string; right?: ReactNode }) => (
  <View style={styles.header}>
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      style={styles.iconButton}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
    >
      <Ionicons name="chevron-back" size={22} color={colors.text} />
    </Pressable>
    <T v="heading" style={{ flex: 1, textAlign: "center" }} numberOfLines={1}>
      {title}
    </T>
    <View style={{ width: 40, alignItems: "flex-end" }}>{right}</View>
  </View>
);

// ---------- buttons ----------

type ButtonKind = "primary" | "secondary" | "ghost" | "danger" | "success";

export const Button = ({
  title,
  onPress,
  kind = "primary",
  icon,
  loading,
  disabled,
  small,
  style,
}: {
  title: string;
  onPress?: () => void | Promise<unknown>;
  kind?: ButtonKind;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) => {
  const [busy, setBusy] = useState(false);
  const isBusy = loading || busy;
  const k = buttonKinds[kind];

  const press = async () => {
    if (!onPress || isBusy) return;
    const result = onPress();
    if (result instanceof Promise) {
      setBusy(true);
      try {
        await result;
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <Pressable
      onPress={press}
      disabled={disabled || isBusy}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: k.bg, borderColor: k.border },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        (disabled || isBusy) && { opacity: 0.5 },
        style,
      ]}
    >
      {isBusy ? (
        <ActivityIndicator color={k.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 19} color={k.fg} />}
          <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: k.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
};

const buttonKinds: Record<ButtonKind, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
  ghost: { bg: "transparent", fg: colors.primary, border: "transparent" },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  success: { bg: colors.good, fg: colors.onPrimary, border: colors.good },
};

export const IconButton = ({
  icon,
  onPress,
  label,
  badge,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  badge?: number;
}) => (
  <Pressable onPress={onPress} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}>
    <Ionicons name={icon} size={22} color={colors.text} />
    {!!badge && (
      <View style={styles.dotBadge}>
        <Text style={styles.dotBadgeText}>{badge > 9 ? "9+" : badge}</Text>
      </View>
    )}
  </Pressable>
);

// ---------- inputs ----------

export const Field = ({
  label,
  error,
  hint,
  ...props
}: TextInputProps & { label: string; error?: string | null; hint?: string }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T v="small" style={{ fontWeight: "600", color: colors.text }}>
        {label}
      </T>
      <TextInput
        placeholderTextColor={colors.text3}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          styles.input,
          props.multiline && { minHeight: 90, textAlignVertical: "top", paddingTop: 12 },
          focused && { borderColor: colors.primary, backgroundColor: colors.surface },
          !!error && { borderColor: colors.danger },
        ]}
      />
      {error ? (
        <T v="small" style={{ color: colors.danger }}>
          {error}
        </T>
      ) : hint ? (
        <T v="small">{hint}</T>
      ) : null}
    </View>
  );
};

// a row of choices like "Moto | Car | Bicycle"
export const ChoiceChips = <K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: K; label: string; icon?: IconName }[];
  value: K | null;
  onChange: (key: K) => void;
  label?: string;
}) => (
  <View style={{ gap: 6 }}>
    {label && (
      <T v="small" style={{ fontWeight: "600", color: colors.text }}>
        {label}
      </T>
    )}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
      {options.map((o) => (
        <Chip key={o.key} label={o.label} icon={o.icon} active={value === o.key} onPress={() => onChange(o.key)} />
      ))}
    </View>
  </View>
);

export const Chip = ({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: !!active }}
    style={[styles.chip, active && styles.chipActive]}
  >
    {icon && <Ionicons name={icon} size={15} color={active ? colors.onPrimary : colors.text2} />}
    <Text style={[styles.chipText, active && { color: colors.onPrimary }]}>{label}</Text>
  </Pressable>
);

// ---------- containers ----------

export const Card = ({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) =>
  onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }, style]}>
      {children}
    </Pressable>
  ) : (
    <View style={[styles.card, style]}>{children}</View>
  );

export const Row = ({
  children,
  style,
  gap = space.sm,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) => <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>{children}</View>;

export const Section = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
}) => (
  <View style={{ marginTop: space.xl, gap: space.md }}>
    <Row style={{ justifyContent: "space-between" }}>
      <T v="heading">{title}</T>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <T v="small" style={{ color: colors.primary, fontWeight: "600" }}>
            {action.label}
          </T>
        </Pressable>
      )}
    </Row>
    {children}
  </View>
);

export const Divider = () => <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.md }} />;

// ---------- status ----------

type Tone = "good" | "warning" | "info" | "danger" | "neutral";

const STATUS: Record<string, { tone: Tone; label: string }> = {
  PENDING: { tone: "warning", label: "Waiting for store" },
  CONFIRMED: { tone: "info", label: "Confirmed" },
  SHIPPED: { tone: "info", label: "On the way" },
  DELIVERED: { tone: "good", label: "Delivered" },
  CANCELLED: { tone: "danger", label: "Cancelled" },
  WAITING_FOR_DRIVER: { tone: "warning", label: "Finding a driver" },
  ASSIGNED: { tone: "info", label: "Driver assigned" },
  PICKED_UP: { tone: "info", label: "Picked up" },
  FAILED: { tone: "danger", label: "Problem" },
  ACTIVE: { tone: "good", label: "Active" },
  DRAFT: { tone: "neutral", label: "Draft" },
  INACTIVE: { tone: "neutral", label: "Hidden" },
  OUT_OF_STOCK: { tone: "warning", label: "Out of stock" },
  SUSPENDED: { tone: "danger", label: "Suspended" },
  REJECTED: { tone: "danger", label: "Rejected" },
};

const toneColors: Record<Tone, { bg: string; fg: string }> = {
  good: { bg: colors.goodSoft, fg: colors.good },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  info: { bg: colors.infoSoft, fg: colors.info },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  neutral: { bg: colors.neutralSoft, fg: colors.text2 },
};

export const Badge = ({ status, label }: { status: string; label?: string }) => {
  const s = STATUS[status] ?? { tone: "neutral" as Tone, label: status };
  const c = toneColors[s.tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: c.fg }]} />
      <Text style={[styles.badgeText, { color: c.fg }]}>{label ?? s.label}</Text>
    </View>
  );
};

// a colored box with an icon, for important messages
export const Notice = ({
  tone = "info",
  icon = "information-circle",
  title,
  children,
}: {
  tone?: Tone;
  icon?: IconName;
  title: string;
  children?: ReactNode;
}) => {
  const c = toneColors[tone];
  return (
    <View style={[styles.notice, { backgroundColor: c.bg }]}>
      <Ionicons name={icon} size={22} color={c.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bodyStrong" style={{ color: c.fg }}>
          {title}
        </T>
        {children && <T v="small" style={{ color: colors.text }}>{children}</T>}
      </View>
    </View>
  );
};

export const Empty = ({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName;
  title: string;
  text?: string;
  action?: ReactNode;
}) => (
  <View style={styles.empty}>
    <View style={styles.emptyIcon}>
      <Ionicons name={icon} size={30} color={colors.primary} />
    </View>
    <T v="heading" style={{ textAlign: "center" }}>
      {title}
    </T>
    {text && (
      <T v="small" style={{ textAlign: "center", maxWidth: 280 }}>
        {text}
      </T>
    )}
    {action}
  </View>
);

export const Loading = () => (
  <View style={{ padding: space.xxxl, alignItems: "center" }}>
    <ActivityIndicator color={colors.primary} size="large" />
  </View>
);

export const ErrorText = ({ error }: { error: string | null }) =>
  error ? <Notice tone="danger" icon="alert-circle" title={error} /> : null;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  footer: {
    padding: space.lg,
    paddingBottom: space.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: space.lg,
    gap: space.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  dotBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  dotBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: space.sm,
    borderWidth: 1,
  },
  buttonSmall: { minHeight: 38, paddingHorizontal: space.md, borderRadius: radius.sm },
  buttonText: { fontSize: 16, fontWeight: "700" },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: space.md,
    fontSize: 16,
    color: colors.text,
    // the web adds its own focus ring; our blue border already shows focus
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: "600", color: colors.text2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    ...shadow,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  notice: {
    flexDirection: "row",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    alignItems: "flex-start",
  },
  empty: { alignItems: "center", gap: space.md, paddingVertical: space.xxxl, paddingHorizontal: space.lg },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
