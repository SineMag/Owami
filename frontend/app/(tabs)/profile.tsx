import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { colors, radii, spacing } from "@/src/theme";
import { useAuth } from "@/src/hooks/useAuth";
import { api } from "@/src/api/client";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut, refresh } = useAuth();
  const mine = useQuery({ queryKey: ["mine"], queryFn: () => api.myRecipes() });
  const saved = useQuery({ queryKey: ["saves"], queryFn: () => api.mySaves() });
  const history = useQuery({ queryKey: ["history"], queryFn: () => api.history() });

  const onDelete = () => {
    Alert.alert("Delete account?", "This will erase your cookbook, likes, saves, and history.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.deleteMe(); await signOut(); router.replace("/auth/welcome"); } },
    ]);
  };
  const onCancel = async () => { await api.cancelSub(); await refresh(); };
  const onRestore = async () => { await api.restore(); await refresh(); };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl, paddingBottom: 120 }}>
      <View style={styles.headRow}>
        <View style={styles.avatar}><Text style={{ color: colors.onBrandSecondary, fontSize: 26, fontWeight: "700" }}>{user?.display_name?.[0]?.toUpperCase() || "O"}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.display_name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.is_premium ? (
            <View style={styles.plusBadgeBig}><MDIcon name="star-four-points" size={12} color={colors.onBrandPrimary} /><Text style={styles.plusBadgeBigText}>Owami+ member</Text></View>
          ) : (
            <Pressable testID="profile-upgrade" onPress={() => router.push("/paywall")} style={styles.upgradeBtn}>
              <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Upgrade to Owami+</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.stats}>
        <Stat label="Recipes" value={mine.data?.length ?? 0} />
        <Stat label="Saved" value={saved.data?.length ?? 0} />
        <Stat label="Cooked" value={history.data?.length ?? 0} />
      </View>

      <Text style={styles.section}>Settings</Text>
      <Row testID="row-notifications" icon="bell-outline" title="Notifications" sub="Timer complete, meal reminders" />
      <Row testID="row-voice" icon="microphone-outline" title="Voice settings" sub="Speech speed and language" />
      <Row testID="row-diet" icon="leaf-circle-outline" title="Dietary preferences" sub="Vegetarian, halal, allergies" />
      <Row testID="row-privacy" icon="shield-outline" title="Privacy policy" onPress={() => router.push("/policy")} />
      <Row testID="row-terms" icon="file-document-outline" title="Terms of service" onPress={() => router.push("/policy?type=terms")} />

      <Text style={styles.section}>Subscription</Text>
      {user?.is_premium ? (
        <Row testID="row-cancel" icon="cancel" title="Cancel subscription" onPress={onCancel} />
      ) : null}
      <Row testID="row-restore" icon="restore" title="Restore purchases" onPress={onRestore} />

      <Text style={styles.section}>Account</Text>
      <Row testID="row-signout" icon="logout" title="Sign out" onPress={async () => { await signOut(); router.replace("/auth/welcome"); }} />
      <Row testID="row-delete" icon="trash-can-outline" title="Delete account" danger onPress={onDelete} />

      <Text style={styles.foot}>Owami · Save recipes, create meals, and cook hands-free.</Text>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLab}>{label}</Text>
    </View>
  );
}
function Row({ icon, title, sub, onPress, danger, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.row}>
      <MDIcon name={icon} size={22} color={danger ? colors.error : colors.brandPrimary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowT, danger && { color: colors.error }]}>{title}</Text>
        {sub && <Text style={styles.rowS}>{sub}</Text>}
      </View>
      {onPress && <MDIcon name="chevron-right" size={20} color={colors.muted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", marginBottom: spacing.xl },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 22, color: colors.onSurface, fontWeight: "700" },
  email: { color: colors.muted, marginTop: 2 },
  plusBadgeBig: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: colors.brandPrimary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, marginTop: 6 },
  plusBadgeBigText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "700" },
  upgradeBtn: { alignSelf: "flex-start", marginTop: 6, borderWidth: 1.5, borderColor: colors.brandPrimary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill },
  stats: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.xl },
  stat: { flex: 1, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radii.md, alignItems: "center" },
  statVal: { fontSize: 22, color: colors.onSurface, fontWeight: "700" },
  statLab: { color: colors.muted, fontSize: 12, marginTop: 2 },
  section: { color: colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: spacing.xl, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowT: { color: colors.onSurface, fontSize: 15, fontWeight: "500" },
  rowS: { color: colors.muted, fontSize: 12, marginTop: 2 },
  foot: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: spacing.xxl },
});
