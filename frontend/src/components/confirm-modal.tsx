import React from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { colors, radii, spacing } from "@/src/theme";

type Props = {
  visible: boolean;
  icon?: string;
  tone?: "default" | "danger";
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
};

export function ConfirmModal({
  visible, icon = "help-circle-outline", tone = "default",
  title, message, confirmText = "Confirm", cancelText = "Cancel",
  loading, onConfirm, onCancel, testID = "confirm-modal",
}: Props) {
  const danger = tone === "danger";
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} testID={`${testID}-backdrop`} />
        <View style={styles.card} testID={testID}>
          <View style={[styles.iconWrap, danger && styles.iconWrapDanger]}>
            <MDIcon name={icon as any} size={28} color={danger ? colors.onError : colors.brandPrimary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.row}>
            <Pressable testID={`${testID}-cancel`} onPress={onCancel} disabled={loading}
              style={[styles.btn, styles.btnGhost, loading && { opacity: 0.6 }]}>
              <Text style={styles.btnGhostT}>{cancelText}</Text>
            </Pressable>
            <Pressable testID={`${testID}-confirm`} onPress={onConfirm} disabled={loading}
              style={[styles.btn, danger ? styles.btnDanger : styles.btnPrimary, loading && { opacity: 0.6 }]}>
              {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
                <Text style={[styles.btnPrimaryT, danger && { color: colors.onError }]}>{confirmText}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(45,30,25,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: { width: "100%", maxWidth: 340, backgroundColor: colors.surface, padding: spacing.xl, borderRadius: radii.lg, alignItems: "center" },
  iconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(192,74,44,0.12)", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  iconWrapDanger: { backgroundColor: "rgba(164,59,42,0.12)" },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "700", textAlign: "center" },
  message: { color: colors.muted, textAlign: "center", marginTop: 6, lineHeight: 20 },
  row: { flexDirection: "row", gap: 10, marginTop: spacing.lg, alignSelf: "stretch" },
  btn: { flex: 1, padding: 14, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  btnGhostT: { color: colors.onSurface, fontWeight: "600" },
  btnPrimary: { backgroundColor: colors.brandPrimary },
  btnDanger: { backgroundColor: colors.error },
  btnPrimaryT: { color: colors.onBrandPrimary, fontWeight: "700" },
});
