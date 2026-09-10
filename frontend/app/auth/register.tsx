import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, spacing } from "@/src/theme";
import { useAuth } from "@/src/hooks/useAuth";

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      setErr("Please fill everything in. Password must be 6+ characters.");
      return;
    }
    setBusy(true); setErr(null);
    try { await signUp(email, password, name.trim()); router.replace("/onboarding"); }
    catch (e: any) { setErr(e?.message === "Email already registered" ? "That email already has a cookbook." : "We couldn't create your account. Try again."); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={16}><Text style={styles.back}>← Back</Text></Pressable>
        <Text style={styles.title}>Let's build your cookbook.</Text>
        <Text style={styles.sub}>Warmth, spice and everything nice.</Text>

        <Text style={styles.label}>Your name</Text>
        <TextInput testID="register-name-input" style={styles.input} value={name} onChangeText={setName} placeholder="Ada" placeholderTextColor={colors.muted} />

        <Text style={styles.label}>Email</Text>
        <TextInput testID="register-email-input" style={styles.input} value={email} onChangeText={setEmail}
          autoCapitalize="none" keyboardType="email-address" placeholder="you@kitchen.com" placeholderTextColor={colors.muted} />

        <Text style={styles.label}>Password</Text>
        <TextInput testID="register-password-input" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="6+ characters" placeholderTextColor={colors.muted} />

        {err && <Text style={styles.err}>{err}</Text>}

        <Pressable testID="register-submit-button" style={[styles.cta, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaText}>Create my cookbook</Text>}
        </Pressable>
        <Text style={styles.foot}>By continuing you agree to Owami's Terms and Privacy Policy.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, flexGrow: 1 },
  back: { color: colors.muted, marginBottom: spacing.xl },
  title: { fontSize: 30, color: colors.onSurface, fontWeight: "700", marginBottom: spacing.xs },
  sub: { color: colors.muted, marginBottom: spacing.lg },
  label: { color: colors.onSurface, fontWeight: "500", marginTop: spacing.md, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, padding: 16, fontSize: 16, color: colors.onSurface, borderWidth: 1, borderColor: colors.border },
  err: { color: colors.error, marginTop: spacing.md },
  cta: { backgroundColor: colors.brandPrimary, marginTop: spacing.xl, padding: 18, borderRadius: radii.lg, alignItems: "center" },
  ctaText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "600" },
  foot: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: spacing.lg },
});
