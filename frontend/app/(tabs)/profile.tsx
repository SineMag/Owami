import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { colors, radii, spacing } from "@/src/theme";
import { useAuth } from "@/src/hooks/useAuth";
import { useSubscription } from "@/src/lib/revenuecat";
import { api, fileUrl } from "@/src/api/client";
import { ConfirmModal } from "@/src/components/confirm-modal";

let RevenueCatUI: any = null;
try { RevenueCatUI = require("react-native-purchases-ui").default ?? require("react-native-purchases-ui"); } catch {}

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut, refresh } = useAuth();
  const { isSubscribed, restore } = useSubscription();
  const mine = useQuery({ queryKey: ["mine"], queryFn: () => api.myRecipes() });
  const saved = useQuery({ queryKey: ["saves"], queryFn: () => api.mySaves() });
  const history = useQuery({ queryKey: ["history"], queryFn: () => api.history() });

  const [confirm, setConfirm] = useState<null | "signout" | "delete">(null);
  const [busy, setBusy] = useState(false);

  const doSignOut = async () => {
    setBusy(true);
    try { await signOut(); router.replace("/auth/welcome"); }
    finally { setBusy(false); setConfirm(null); }
  };
  const doDelete = async () => {
    setBusy(true);
    try { await api.deleteMe(); await signOut(); router.replace("/auth/welcome"); }
    finally { setBusy(false); setConfirm(null); }
  };
  const onRestore = async () => {
    try { await restore(); await refresh(); } catch {}
  };
  const openCustomerCenter = async () => {
    try {
      if (Platform.OS !== "web" && RevenueCatUI?.presentCustomerCenter) {
        await RevenueCatUI.presentCustomerCenter();
      } else {
        router.push("/paywall");
      }
    } catch { router.push("/paywall"); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl, paddingBottom: 120 }}>
      <View style={styles.headRow}>
        <Pressable testID="profile-edit-avatar" onPress={() => router.push("/profile/edit")}>
          {user?.avatar_url ? (
            <Image source={{ uri: fileUrl(user.avatar_url) }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={styles.avatar}>
              <Text style={{ color: colors.onBrandSecondary, fontSize: 26, fontWeight: "700" }}>{user?.display_name?.[0]?.toUpperCase() || "O"}</Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <MDIcon name="pencil" size={12} color={colors.onBrandPrimary} />
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.display_name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {isSubscribed ? (
            <View style={styles.plusBadgeBig}><MDIcon name="star-four-points" size={12} color={colors.onBrandPrimary} /><Text style={styles.plusBadgeBigText}>Owami+ member</Text></View>
          ) : (
            <Pressable testID="profile-upgrade" onPress={() => router.push("/paywall")} style={styles.upgradeBtn}>
              <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Upgrade to Owami+</Text>
            </Pressable>
          )}
        </View>
        <Pressable testID="profile-edit-button" onPress={() => router.push("/profile/edit")} hitSlop={10} style={styles.editIconBtn}>
          <MDIcon name="cog-outline" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={styles.stats}>
        <Stat label="Recipes" value={mine.data?.length ?? 0} />
        <Stat label="Saved" value={saved.data?.length ?? 0} />
        <Stat label="Cooked" value={history.data?.length ?? 0} />
      </View>

      <Text style={styles.section}>Settings</Text>
      <Row testID="row-preferences" icon="tune-variant" title="Cooking preferences" sub="Diet, cuisines, favourites" onPress={() => router.push("/onboarding?from=settings")} />
      <Row testID="row-privacy" icon="shield-outline" title="Privacy policy" onPress={() => router.push("/policy")} />
      <Row testID="row-terms" icon="file-document-outline" title="Terms of service" onPress={() => router.push("/policy?type=terms")} />

      <Text style={styles.section}>Subscription</Text>
      {isSubscribed ? (
        <Row testID="row-manage-sub" icon="account-cog-outline" title="Manage subscription" sub="Renewal, cancel, billing" onPress={openCustomerCenter} />
      ) : (
        <Row testID="row-upgrade" icon="star-four-points" title="Upgrade to Owami+" sub="Unlock all premium features" onPress={() => router.push("/paywall")} />
      )}
      <Row testID="row-restore" icon="restore" title="Restore purchases" onPress={onRestore} />

      <Text style={styles.section}>Account</Text>
      <Row testID="row-edit" icon="account-edit-outline" title="Edit profile" onPress={() => router.push("/profile/edit")} />
      <Row testID="row-signout" icon="logout" title="Sign out" onPress={() => setConfirm("signout")} />
      <Row testID="row-delete" icon="trash-can-outline" title="Delete account" danger onPress={() => setConfirm("delete")} />

      <Text style={styles.foot}>Owami · Save recipes, create meals, and cook hands-free.</Text>

      <ConfirmModal
        testID="signout-modal"
        visible={confirm === "signout"}
        icon="logout"
        title="Sign out of Owami?"
        message="Your cookbook is safe. You can sign back in any time."
        confirmText="Sign out"
        loading={busy && confirm === "signout"}
        onCancel={() => setConfirm(null)}
        onConfirm={doSignOut}
      />
      <ConfirmModal
        testID="delete-modal"
        visible={confirm === "delete"}
        icon="trash-can-outline"
        tone="danger"
        title="Delete your account?"
        message="This erases your cookbook, likes, saves, cooking history, and preferences. This can't be undone."
        confirmText="Delete forever"
        loading={busy && confirm === "delete"}
        onCancel={() => setConfirm(null)}
        onConfirm={doDelete}
      />
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
  avatarEditBadge: { position: "absolute", right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  editIconBtn: { padding: 6 },
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
