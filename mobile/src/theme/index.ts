// the Aynix look in one place: change a color here and the whole app follows

export const colors = {
  // brand
  primary: "#1846C7", // deep Haiti blue: main buttons, links, active tabs
  primaryDark: "#0F2F8C",
  primarySoft: "#E8EEFC",
  accent: "#F0533E", // warm coral: prices on sale, highlights, the cart badge
  accentSoft: "#FDECE9",

  // surfaces
  bg: "#F5F6FA",
  surface: "#FFFFFF",
  surfaceAlt: "#F0F2F7",
  border: "#E4E7EF",

  // text
  text: "#0E1525",
  text2: "#5B6474",
  text3: "#8A93A3",
  onPrimary: "#FFFFFF",

  // status (always shown with a word, never color alone)
  good: "#15803D",
  goodSoft: "#E3F5E9",
  warning: "#B45309",
  warningSoft: "#FEF3DC",
  info: "#1D4ED8",
  infoSoft: "#E6EEFD",
  danger: "#C62828",
  dangerSoft: "#FDE8E8",
  neutralSoft: "#EEF0F4",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

export const type = {
  display: { fontSize: 30, fontWeight: "800" as const, letterSpacing: -0.6, color: colors.text },
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3, color: colors.text },
  heading: { fontSize: 17, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 15, fontWeight: "400" as const, color: colors.text, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const, color: colors.text },
  small: { fontSize: 13, fontWeight: "400" as const, color: colors.text2, lineHeight: 18 },
  tiny: { fontSize: 11, fontWeight: "600" as const, color: colors.text3, letterSpacing: 0.4 },
};

// soft shadow that looks the same on iOS, Android and web
export const shadow = {
  shadowColor: "#0E1525",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};
