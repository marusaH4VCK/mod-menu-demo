import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ModMenuButton } from "@/components/ModMenu";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
          paddingBottom: Platform.OS === "web" ? 84 : insets.bottom + 80,
        },
      ]}
    >
      <View style={styles.center}>
        <Text style={styles.title}>Mod Menu Demo</Text>
        <Text style={styles.subtitle}>กดปุ่ม ☰ มุมซ้ายบนเพื่อเปิด Mod Menu</Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>DEV_MODE = true</Text>
          <Text style={styles.infoText}>
            ตอนนี้ bypass ป้องกันทั้งหมด{"\n"}
            เปลี่ยนเป็น false ตอน build release
          </Text>
        </View>
      </View>

      {/* FLOATING MOD MENU */}
      <ModMenuButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FB",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  subtitle: {
    fontSize: 15,
    color: "#8E92A4",
    textAlign: "center",
  },
  infoBox: {
    marginTop: 16,
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 16,
    width: "100%",
    gap: 6,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#22c55e",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  infoText: {
    fontSize: 13,
    color: "#aaa",
    lineHeight: 20,
  },
});
