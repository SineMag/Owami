import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { api, fileUrl } from "@/src/api/client";
import { useAuth } from "@/src/hooks/useAuth";
import { colors, radii, spacing } from "@/src/theme";

export default function EditProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.display_name || "");
  const [avatar, setAvatar] = useState(user?.avatar_url || "");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || "");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.display_name || "");
    setAvatar(user?.avatar_url || "");
    setAvatarPreview(user?.avatar_url || "");
  }, [user]);

  const pickAvatar = async (fromCamera: boolean) => {
    setErr(null);
    try {
      const perm = fromCamera
        ? await ImagePicker.getCameraPermissionsAsync()
        : await ImagePicker.getMediaLibraryPermissionsAsync();
      let ok = perm.status === "granted";
      if (!ok && perm.canAskAgain) {
        const r = fromCamera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        ok = r.status === "granted";
      }
      if (!ok) { setErr("Please allow photo access from Settings."); return; }
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setAvatarPreview(asset.uri);
      setUploading(true);
      try {
        const up = await api.uploadImage(asset.uri);
        setAvatar(up.url);
      } catch {
        setErr("We couldn't upload that photo. Try again.");
        setAvatarPreview(user?.avatar_url || "");
      } finally { setUploading(false); }
    } catch { setErr("Couldn't open your photos."); }
  };

  const save = async () => {
    const nm = name.trim();
    if (!nm) { setErr("Please add your name."); return; }
    setBusy(true); setErr(null);
    try {
      await api.updateMe({ display_name: nm, avatar_url: avatar });
      await refresh();
      router.back();
    } catch { setErr("We couldn't save that. Try again."); }
    finally { setBusy(false); }
  };

  const initial = (name || user?.display_name || "O")[0]?.toUpperCase();

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + spacing.md, paddingBottom: 140 }]} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
          <Pressable testID="edit-back" onPress={() => router.back()} hitSlop={16}>
            <MDIcon name="arrow-left" size={22} color={colors.onSurface} />
          </Pressable>
          <Pressable testID="edit-save" onPress={save} disabled={busy || uploading} hitSlop={12}>
            <Text style={[styles.saveT, (busy || uploading) && { opacity: 0.5 }]}>Save</Text>
          </Pressable>
        </View>
        <Text style={styles.h1}>Edit profile</Text>

        <View style={styles.avatarWrap}>
          {avatarPreview ? (
            <Image testID="edit-avatar-image" source={{ uri: fileUrl(avatarPreview) }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
          {uploading && (
            <View style={[styles.avatar, styles.avatarOverlay]}>
              <ActivityIndicator color={colors.onBrandPrimary} />
            </View>
          )}
        </View>
        <View style={styles.avatarBtns}>
          <Pressable testID="edit-avatar-library" onPress={() => pickAvatar(false)} style={styles.imgBtn}>
            <MDIcon name="image-multiple-outline" size={18} color={colors.brandPrimary} />
            <Text style={styles.imgBtnT}>Choose photo</Text>
          </Pressable>
          <Pressable testID="edit-avatar-camera" onPress={() => pickAvatar(true)} style={styles.imgBtn}>
            <MDIcon name="camera-outline" size={18} color={colors.brandPrimary} />
            <Text style={styles.imgBtnT}>Take photo</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Display name</Text>
        <TextInput testID="edit-name-input" style={styles.input} value={name} onChangeText={setName}
          placeholder="Your name" placeholderTextColor={colors.muted} maxLength={40} />

        <Text style={styles.label}>Email</Text>
        <View style={[styles.input, styles.readonly]}>
          <Text style={{ color: colors.muted }}>{user?.email}</Text>
          <MDIcon name="lock-outline" size={16} color={colors.muted} />
        </View>
        <Text style={styles.hint}>Email can't be changed yet. Reach out to support if you need to update it.</Text>

        {err && <Text style={{ color: colors.error, marginTop: spacing.md }}>{err}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl },
  h1: { fontSize: 28, color: colors.onSurface, fontWeight: "700", marginBottom: spacing.lg },
  saveT: { color: colors.brandPrimary, fontWeight: "700", fontSize: 15 },
  avatarWrap: { alignSelf: "center", width: 120, height: 120, marginBottom: spacing.md },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.brandSecondary },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.onBrandSecondary, fontSize: 40, fontWeight: "700" },
  avatarOverlay: { position: "absolute", top: 0, left: 0, backgroundColor: "rgba(45,30,25,0.5)", alignItems: "center", justifyContent: "center" },
  avatarBtns: { flexDirection: "row", gap: 8, marginBottom: spacing.lg, justifyContent: "center" },
  imgBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 10 },
  imgBtnT: { color: colors.brandPrimary, fontWeight: "600", fontSize: 13 },
  label: { color: colors.onSurface, fontWeight: "600", marginTop: spacing.md, marginBottom: 6 },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, padding: 14, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
  readonly: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hint: { color: colors.muted, fontSize: 12, marginTop: 6 },
});
