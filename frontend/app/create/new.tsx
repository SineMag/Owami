import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { api, fileUrl } from "@/src/api/client";
import { colors, radii, spacing } from "@/src/theme";

export default function NewRecipe() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [image, setImage] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [prep, setPrep] = useState("10");
  const [cook, setCook] = useState("20");
  const [servings, setServings] = useState("2");
  const [ings, setIngs] = useState<string[]>([""]);
  const [steps, setSteps] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pickImage = async () => {
    try {
      const { status, canAskAgain } = await ImagePicker.getMediaLibraryPermissionsAsync();
      let ok = status === "granted";
      if (!ok && canAskAgain) {
        const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
        ok = r.status === "granted";
      }
      if (!ok) { setErr("Please allow photo access from Settings to upload."); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setImagePreview(asset.uri);
      setUploading(true); setErr(null);
      try {
        const up = await api.uploadImage(asset.uri);
        setImage(up.url);
      } catch (e) {
        setErr("We couldn't upload that image. Try again.");
        setImagePreview("");
      } finally { setUploading(false); }
    } catch (e) { setErr("We couldn't open your photos."); }
  };
  const takePhoto = async () => {
    try {
      const { status, canAskAgain } = await ImagePicker.getCameraPermissionsAsync();
      let ok = status === "granted";
      if (!ok && canAskAgain) {
        const r = await ImagePicker.requestCameraPermissionsAsync();
        ok = r.status === "granted";
      }
      if (!ok) { setErr("Please allow camera access from Settings to snap a photo."); return; }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setImagePreview(asset.uri); setUploading(true); setErr(null);
      try {
        const up = await api.uploadImage(asset.uri);
        setImage(up.url);
      } catch (e) { setErr("Upload failed."); setImagePreview(""); }
      finally { setUploading(false); }
    } catch { setErr("Camera unavailable."); }
  };

  const submit = async () => {
    if (!title.trim()) { setErr("Give your recipe a name."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api.createRecipe({
        title: title.trim(), description: desc, image_url: image,
        prep_time: parseInt(prep) || 0, cook_time: parseInt(cook) || 0, servings: parseInt(servings) || 2,
        difficulty: "Easy", category: "Dinner",
        ingredients: ings.filter(i => i.trim()).map(i => ({ name: i, quantity: "", unit: "" })),
        instructions: steps.filter(s => s.trim()),
        tags: [],
      });
      router.replace(`/recipe/${r.id}`);
    } catch (e: any) { setErr("Couldn't save recipe. Try again."); }
    finally { setBusy(false); }
  };
  const upd = (arr: string[], setter: any) => (i: number, v: string) => { const c = [...arr]; c[i] = v; setter(c); };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + spacing.md, paddingBottom: 140 }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={16}><Text style={styles.back}>← Back</Text></Pressable>
        <Text style={styles.h1}>New recipe</Text>

        <L label="Cover photo" />
        {imagePreview ? (
          <View style={styles.imgWrap}>
            <Image
              source={{ uri: fileUrl(imagePreview) }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              onError={() => setErr("The photo preview could not be displayed. Try selecting it again.")}
            />
            {uploading && (
              <View style={styles.imgOverlay}>
                <ActivityIndicator color={colors.onBrandPrimary} />
                <Text style={{ color: colors.onBrandPrimary, fontWeight: "600", marginTop: 6 }}>Uploading…</Text>
              </View>
            )}
            <Pressable testID="new-image-remove" style={styles.imgRemove} onPress={() => { setImage(""); setImagePreview(""); }}>
              <MDIcon name="close" size={16} color={colors.onSurfaceInverse} />
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable testID="new-image-pick" onPress={pickImage} style={styles.imgBtn}>
              <MDIcon name="image-multiple-outline" size={22} color={colors.brandPrimary} />
              <Text style={styles.imgBtnT}>Choose photo</Text>
            </Pressable>
            <Pressable testID="new-image-camera" onPress={takePhoto} style={styles.imgBtn}>
              <MDIcon name="camera-outline" size={22} color={colors.brandPrimary} />
              <Text style={styles.imgBtnT}>Take photo</Text>
            </Pressable>
          </View>
        )}

        <L label="Recipe name" />
        <TextInput testID="new-title" style={styles.in} value={title} onChangeText={setTitle} placeholder="Grandma's chicken curry" placeholderTextColor={colors.muted} />
        <L label="Short description" />
        <TextInput testID="new-desc" style={[styles.in, { minHeight: 70 }]} value={desc} onChangeText={setDesc} multiline placeholder="Rich, warming, one-pan wonder…" placeholderTextColor={colors.muted} />

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}><L label="Prep (min)" /><TextInput testID="new-prep" style={styles.in} keyboardType="number-pad" value={prep} onChangeText={setPrep} /></View>
          <View style={{ flex: 1 }}><L label="Cook (min)" /><TextInput testID="new-cook" style={styles.in} keyboardType="number-pad" value={cook} onChangeText={setCook} /></View>
          <View style={{ flex: 1 }}><L label="Servings" /><TextInput testID="new-servings" style={styles.in} keyboardType="number-pad" value={servings} onChangeText={setServings} /></View>
        </View>

        <L label="Ingredients" />
        {ings.map((v, i) => (
          <TextInput key={i} testID={`new-ing-${i}`} style={styles.in} value={v} onChangeText={t => upd(ings, setIngs)(i, t)} placeholder={`Ingredient ${i + 1}`} placeholderTextColor={colors.muted} />
        ))}
        <Pressable testID="new-add-ing" onPress={() => setIngs([...ings, ""])} style={styles.addRow}><MDIcon name="plus" size={18} color={colors.brandPrimary} /><Text style={styles.addT}>Add ingredient</Text></Pressable>

        <L label="Steps" />
        {steps.map((v, i) => (
          <TextInput key={i} testID={`new-step-${i}`} style={[styles.in, { minHeight: 60 }]} value={v} onChangeText={t => upd(steps, setSteps)(i, t)} multiline placeholder={`Step ${i + 1}`} placeholderTextColor={colors.muted} />
        ))}
        <Pressable testID="new-add-step" onPress={() => setSteps([...steps, ""])} style={styles.addRow}><MDIcon name="plus" size={18} color={colors.brandPrimary} /><Text style={styles.addT}>Add step</Text></Pressable>

        {err && <Text style={{ color: colors.error, marginTop: 8 }}>{err}</Text>}
        <Pressable testID="new-submit" style={[styles.cta, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy || uploading}>
          {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaT}>Save to my cookbook</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function L({ label }: { label: string }) { return <Text style={styles.label}>{label}</Text>; }
const styles = StyleSheet.create({
  wrap: { padding: spacing.xl },
  back: { color: colors.muted, marginBottom: spacing.md },
  h1: { fontSize: 28, color: colors.onSurface, fontWeight: "700", marginBottom: spacing.md },
  label: { color: colors.onSurface, fontWeight: "600", marginTop: spacing.md, marginBottom: 6 },
  in: { backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, padding: 14, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  imgWrap: { height: 200, borderRadius: radii.lg, overflow: "hidden", marginBottom: 8, backgroundColor: colors.surfaceTertiary },
  imgOverlay: { position: "absolute", inset: 0 as any, backgroundColor: "rgba(45,30,25,0.55)", alignItems: "center", justifyContent: "center" },
  imgRemove: { position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(45,30,25,0.7)", alignItems: "center", justifyContent: "center" },
  imgBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed", borderRadius: radii.md, padding: 18 },
  imgBtnT: { color: colors.brandPrimary, fontWeight: "700" },
  addRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  addT: { color: colors.brandPrimary, fontWeight: "600" },
  cta: { marginTop: spacing.xl, backgroundColor: colors.brandPrimary, padding: 18, borderRadius: radii.lg, alignItems: "center" },
  ctaT: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16 },
});
