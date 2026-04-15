import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  NativeModules,
  Platform,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// DEV MODE
// true  = bypass ป้องกันทั้งหมด (ใช้ตอน test)
// false = เปิดป้องกันจริง (ใช้ตอน build release)
// ─────────────────────────────────────────────────────────────────────────────
const DEV_MODE = true;

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-TAMPER
// ─────────────────────────────────────────────────────────────────────────────
function isEnvironmentSuspicious(): boolean {
  if (DEV_MODE) return false;

  const suspiciousNativeModules = [
    "FridaGadget",
    "CydiaSubstrate",
    "SubstrateLoader",
    "MobileSubstrate",
    "cycript",
    "RootBridge",
  ];
  for (const mod of suspiciousNativeModules) {
    if ((NativeModules as Record<string, unknown>)[mod] !== undefined)
      return true;
  }

  const suspiciousGlobals = [
    "__frida_scripts__",
    "__FRIDA__",
    "__substrate__",
    "cycript",
    "__objc_hooks__",
  ];
  for (const g of suspiciousGlobals) {
    if ((global as Record<string, unknown>)[g] !== undefined) return true;
  }

  return false;
}

function verifyFeatureIntegrity(
  id: string,
  injectedOffset: number | null,
): boolean {
  if (DEV_MODE) return true;
  if (injectedOffset !== null && injectedOffset !== 0) return false;
  if (/^0x[0-9a-fA-F]{4,}$/.test(id)) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type FeatureBase = {
  id: string;
  label: string;
  description?: string;
  warning?: string;
  offset?: number | null;
};
type ToggleFeature = FeatureBase & { type: "toggle" };
type SliderFeature = FeatureBase & {
  type: "slider";
  min: number;
  max: number;
  step: number;
  defaultValue: number;
};
type SegmentFeature = FeatureBase & { type: "segment"; options: string[] };
type Feature = ToggleFeature | SliderFeature | SegmentFeature;

type Tab = {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  features: Feature[];
};

// ─────────────────────────────────────────────────────────────────────────────
// TABS DATA — แก้ตรงนี้เพื่อเพิ่ม/ลด feature
// ─────────────────────────────────────────────────────────────────────────────
const TABS: Tab[] = [
  {
    id: "ui",
    icon: "eye",
    label: "UI",
    features: [
      { id: "showTelevip", type: "toggle", label: "Show TeleVIP UI" },
      { id: "showUnderground", type: "toggle", label: "Show Underground UI" },
      { id: "showAiTelekill", type: "toggle", label: "Show AI Telekill UI" },
      { id: "showNinjaRun", type: "toggle", label: "Show Ninja Run UI" },
      { id: "showFlyAltura", type: "toggle", label: "Show Fly Altura UI" },
    ],
  },
  {
    id: "aimbot",
    icon: "crosshair",
    label: "AIMBOT",
    features: [
      {
        id: "enableAimbot",
        type: "toggle",
        label: "Enable Aimbot",
        description: "Automatically fires when target is in FOV",
      },
      {
        id: "aimsilent",
        type: "toggle",
        label: "Aimsilent",
        description: "Hides Aimbot from killcam & replays",
      },
      {
        id: "ignoreWallCheck",
        type: "toggle",
        label: "Ignore Wall Check",
        description: "Always aim at enemy head, ignore wall/tanghin...",
      },
      {
        id: "aimkillv2",
        type: "toggle",
        label: "Aimkillv2",
        description: "Automatically kills enemies when aiming at the...",
      },
      {
        id: "increaseRof",
        type: "toggle",
        label: "Increase Rate of fire",
        description: "Increases weapon fire rate for faster shooting",
      },
      {
        id: "fovRadius",
        type: "slider",
        label: "FOV Radius",
        min: 0,
        max: 1000,
        step: 10,
        defaultValue: 500,
      },
      {
        id: "triggerWhen",
        type: "segment",
        label: "Trigger When",
        options: ["Always", "Firing", "Scope"],
      },
      {
        id: "flyMoveValue",
        type: "slider",
        label: "Fly Move Value",
        min: 0,
        max: 200,
        step: 1,
        defaultValue: 60,
      },
      {
        id: "teleportRadius",
        type: "slider",
        label: "Go Teleport Radius",
        min: 0,
        max: 20,
        step: 0.1,
        defaultValue: 2.3,
      },
      {
        id: "secondPhaseFire",
        type: "toggle",
        label: "Second Phase Fire",
        description: "Enable get_StartFiring, OnFirstphasefire, OnS...",
      },
      {
        id: "firstPhaseFire",
        type: "toggle",
        label: "First Phase Fire",
        description: "Enable phasefire(rivalTarget)",
      },
    ],
  },
  {
    id: "msl",
    icon: "radio",
    label: "MSL",
    features: [
      {
        id: "speedBypass",
        type: "toggle",
        label: "Speed Bypass",
        description: "Increases movement beyond normal lim...",
      },
      {
        id: "upPlayer",
        type: "toggle",
        label: "Up Player",
        description: "Elevates player position above ground",
      },
      {
        id: "telekill",
        type: "toggle",
        label: "Telekill",
        description: "Teleports to enemies and kills them instantly",
        warning: "Warning: This feature might flag your account",
      },
      { id: "undergroundKill2", type: "toggle", label: "Underground Kill2" },
      { id: "aiKill", type: "toggle", label: "AI Kill" },
      { id: "flyAlt", type: "toggle", label: "FLY ALT" },
    ],
  },
  {
    id: "misc",
    icon: "scissors",
    label: "MISC",
    features: [
      { id: "antiReport", type: "toggle", label: "Anti Report" },
      { id: "noSway", type: "toggle", label: "No Sway" },
      { id: "fastLoot", type: "toggle", label: "Fast Loot" },
      {
        id: "magicBullet",
        type: "toggle",
        label: "Magic Bullet",
        description: "Bullets always hit the target",
      },
    ],
  },
  {
    id: "settings",
    icon: "grid",
    label: "SETTI...",
    features: [
      { id: "brutalSettings", type: "toggle", label: "Brutal S..." },
      { id: "mediumSettings", type: "toggle", label: "Medium Settings" },
      { id: "safeSettings", type: "toggle", label: "Safe Settings" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
interface ModMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function ModMenu({ visible, onClose }: ModMenuProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [sliders, setSliders] = useState<Record<string, number>>({});
  const [segments, setSegments] = useState<Record<string, string>>({});
  const [blocked, setBlocked] = useState(false);
  const [blockTarget, setBlockTarget] = useState<string | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const currentTab = TABS[activeTab];

  useEffect(() => {
    if (!DEV_MODE) {
      const interval = setInterval(() => {
        if (isEnvironmentSuspicious()) {
          setBlocked(true);
          setBlockTarget("environment");
          triggerShake();
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 90,
      friction: 12,
    }).start();
  }, [visible]);

  function triggerShake() {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  const handleToggle = useCallback(
    (feature: Feature) => {
      if (blocked) {
        triggerShake();
        return;
      }
      if (!verifyFeatureIntegrity(feature.id, feature.offset ?? null)) {
        setBlocked(true);
        setBlockTarget(feature.id);
        triggerShake();
        return;
      }
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setToggles((prev) => ({ ...prev, [feature.id]: !prev[feature.id] }));
    },
    [blocked],
  );

  if (!visible) return null;

  const scaleY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });
  const opacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ scaleY }, { translateX: shakeAnim }] },
      ]}
    >
      {/* LEFT SIDEBAR */}
      <View style={styles.sidebar}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => {
              setActiveTab(index);
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[
              styles.sidebarBtn,
              activeTab === index && styles.sidebarBtnActive,
            ]}
            activeOpacity={0.7}
          >
            <Feather
              name={tab.icon}
              size={22}
              color={activeTab === index ? "#000" : "#888"}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* MAIN PANEL */}
      <View style={styles.panel}>
        <Text style={styles.copyright}>© Fluck. All rights reserved.</Text>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Feather name={currentTab.icon} size={16} color="#000" />
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {currentTab.label}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerBtn}>
            <Feather name="download" size={17} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Feather name="sun" size={17} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
            <Feather name="x" size={17} color="#333" />
          </TouchableOpacity>
        </View>

        {/* BLOCKED BANNER */}
        {blocked && (
          <View style={styles.blockedBanner}>
            <Feather name="alert-triangle" size={13} color="#EF4444" />
            <Text style={styles.blockedText}>
              {blockTarget === "environment"
                ? "Inject detected — UI disabled"
                : `Offset on "${blockTarget}" blocked`}
            </Text>
            {DEV_MODE && <Text style={styles.devNote}> [DEV_MODE]</Text>}
          </View>
        )}

        {/* FEATURE LIST */}
        <ScrollView
          style={styles.featureScroll}
          contentContainerStyle={styles.featureScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {currentTab.features.map((feature) => {
            if (feature.type === "toggle") {
              return (
                <ToggleRow
                  key={feature.id}
                  feature={feature}
                  value={!!toggles[feature.id]}
                  onToggle={() => handleToggle(feature)}
                  disabled={blocked && !DEV_MODE}
                />
              );
            }
            if (feature.type === "slider") {
              return (
                <SliderRow
                  key={feature.id}
                  feature={feature}
                  value={sliders[feature.id] ?? feature.defaultValue}
                  onChange={(v) =>
                    setSliders((p) => ({ ...p, [feature.id]: v }))
                  }
                />
              );
            }
            if (feature.type === "segment") {
              return (
                <SegmentRow
                  key={feature.id}
                  feature={feature}
                  value={segments[feature.id] ?? feature.options[0]}
                  onChange={(v) =>
                    setSegments((p) => ({ ...p, [feature.id]: v }))
                  }
                />
              );
            }
            return null;
          })}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE ROW
// ─────────────────────────────────────────────────────────────────────────────
function ToggleRow({
  feature,
  value,
  onToggle,
  disabled,
}: {
  feature: ToggleFeature;
  value: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onToggle}
      disabled={disabled}
      style={styles.toggleWrapper}
    >
      <View style={[styles.toggleRow, value && styles.toggleRowOn]}>
        <Text style={[styles.toggleLabel, value && styles.toggleLabelOn]}>
          {feature.label}
        </Text>
        <View
          style={[
            styles.toggleIndicator,
            value && styles.toggleIndicatorOn,
          ]}
        >
          {value && <Feather name="check" size={13} color="#fff" />}
        </View>
      </View>
      {feature.description && (
        <Text style={styles.featureDesc}>{feature.description}</Text>
      )}
      {feature.warning && (
        <Text style={styles.featureWarning}>{feature.warning}</Text>
      )}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDER ROW
// ─────────────────────────────────────────────────────────────────────────────
function SliderRow({
  feature,
  value,
  onChange,
}: {
  feature: SliderFeature;
  value: number;
  onChange: (v: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const lastX = useRef(0);
  const percent = (value - feature.min) / (feature.max - feature.min);
  const displayValue =
    feature.step < 1 ? value.toFixed(1) : Math.round(value).toString();

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          lastX.current = e.nativeEvent.pageX;
        },
        onPanResponderMove: (e) => {
          if (trackWidth === 0) return;
          const dx = e.nativeEvent.pageX - lastX.current;
          lastX.current = e.nativeEvent.pageX;
          const delta = (dx / trackWidth) * (feature.max - feature.min);
          const next = Math.min(
            feature.max,
            Math.max(feature.min, value + delta),
          );
          const stepped = Math.round(next / feature.step) * feature.step;
          onChange(stepped);
        },
      }),
    [trackWidth, value, feature],
  );

  return (
    <View style={styles.sliderWrapper}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{feature.label}</Text>
        <Text style={styles.sliderValue}>{displayValue}</Text>
      </View>
      <View
        style={styles.sliderTrack}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View style={[styles.sliderFill, { width: `${percent * 100}%` as any }]} />
        <View style={[styles.sliderThumb, { left: `${percent * 100}%` as any }]} />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENT ROW
// ─────────────────────────────────────────────────────────────────────────────
function SegmentRow({
  feature,
  value,
  onChange,
}: {
  feature: SegmentFeature;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.segmentWrapper}>
      <Text style={styles.segmentLabel}>{feature.label}</Text>
      <View style={styles.segmentTrack}>
        {feature.options.map((opt) => (
          <TouchableOpacity
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.segmentOption,
              value === opt && styles.segmentOptionActive,
            ]}
          >
            <Text
              style={[
                styles.segmentOptionText,
                value === opt && styles.segmentOptionTextActive,
              ]}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING BUTTON
// ─────────────────────────────────────────────────────────────────────────────
export function ModMenuButton() {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => {
          if (Platform.OS !== "web")
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setVisible((v) => !v);
        }}
      >
        <View style={styles.fabInner}>
          <Feather name={visible ? "x" : "menu"} size={22} color="#fff" />
        </View>
      </TouchableOpacity>

      {visible && (
        <View style={styles.menuOverlay} pointerEvents="box-none">
          <ModMenu visible={visible} onClose={() => setVisible(false)} />
        </View>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const SIDEBAR_W = 58;
const PANEL_W = 260;
const GRAY_BG = "rgba(210,210,215,0.96)";
const PILL_BG = "rgba(195,195,200,0.9)";
const PILL_BG_ON = "#1a1a1a";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 20,
    overflow: "hidden",
    width: SIDEBAR_W + PANEL_W,
    height: 480,
    backgroundColor: GRAY_BG,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  sidebar: {
    width: SIDEBAR_W,
    backgroundColor: "rgba(190,190,196,0.95)",
    paddingVertical: 12,
    alignItems: "center",
    gap: 6,
    borderRightWidth: 1,
    borderRightColor: "rgba(0,0,0,0.06)",
  },
  sidebarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(220,220,225,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  sidebarBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  panel: {
    flex: 1,
    backgroundColor: GRAY_BG,
  },
  copyright: {
    fontSize: 10,
    color: "#555",
    textAlign: "center",
    paddingTop: 8,
    fontFamily: "System",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  headerTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(230,230,235,0.9)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  headerTitleText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
    flex: 1,
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(230,230,235,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  blockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    marginHorizontal: 10,
    borderRadius: 8,
    padding: 6,
    gap: 5,
    marginBottom: 4,
  },
  blockedText: {
    fontSize: 11,
    color: "#EF4444",
    fontWeight: "600",
    flex: 1,
  },
  devNote: {
    fontSize: 10,
    color: "#22c55e",
  },
  featureScroll: { flex: 1 },
  featureScrollContent: {
    paddingHorizontal: 10,
    paddingBottom: 14,
    gap: 4,
  },
  toggleWrapper: { gap: 2, marginBottom: 2 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: PILL_BG,
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toggleRowOn: { backgroundColor: PILL_BG_ON },
  toggleLabel: { fontSize: 13.5, fontWeight: "600", color: "#111", flex: 1 },
  toggleLabelOn: { color: "#fff" },
  toggleIndicator: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleIndicatorOn: { backgroundColor: "#111" },
  featureDesc: { fontSize: 11, color: "#777", paddingHorizontal: 4 },
  featureWarning: {
    fontSize: 11,
    fontWeight: "500",
    color: "#F59E0B",
    paddingHorizontal: 4,
  },
  sliderWrapper: { marginBottom: 8 },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  sliderLabel: { fontSize: 13.5, fontWeight: "600", color: "#111" },
  sliderValue: { fontSize: 13.5, fontWeight: "600", color: "#111" },
  sliderTrack: {
    height: 36,
    backgroundColor: PILL_BG,
    borderRadius: 18,
    justifyContent: "center",
    overflow: "visible",
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#111",
    borderRadius: 18,
    minWidth: 36,
  },
  sliderThumb: {
    position: "absolute",
    top: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    marginLeft: -14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  segmentWrapper: { marginBottom: 6, gap: 4 },
  segmentLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    paddingHorizontal: 4,
  },
  segmentTrack: {
    flexDirection: "row",
    backgroundColor: PILL_BG,
    borderRadius: 20,
    padding: 4,
    gap: 2,
  },
  segmentOption: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 16,
    alignItems: "center",
  },
  segmentOptionActive: { backgroundColor: "#111" },
  segmentOptionText: { fontSize: 12, fontWeight: "600", color: "#555" },
  segmentOptionTextActive: { color: "#fff" },
  fab: {
    position: "absolute",
    top: Platform.OS === "web" ? 80 : 60,
    left: 16,
    zIndex: 998,
  },
  fabInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  menuOverlay: {
    position: "absolute",
    top: Platform.OS === "web" ? 136 : 116,
    left: 72,
    zIndex: 999,
  },
});
