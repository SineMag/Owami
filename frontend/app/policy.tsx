import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/src/theme";

const PRIVACY = `Owami collects only the information required to give you a personal cookbook: your email, display name, the recipes you create, the ones you save and like, and your cooking history. We use this data to personalize your experience.

We never sell your data. Your recipes are yours, and you can delete your account and all associated data at any time from Settings.

Third-party services we use include: our backend hosting, our AI provider for recipe generation, and Emergent Object Storage for recipe images.`;

const TERMS = `Welcome to Owami. By using this app you agree to use it lawfully, respect other users' recipes, and not attempt to abuse or scrape our services.

Subscriptions renew until cancelled. Manage or cancel from Settings › Subscription. Prices are shown in your local currency at checkout. Digital purchases are non-refundable except where required by law.

Owami is provided "as is" without warranties. We do our best to give you tasty results.`;

export default function Policy() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isTerms = type === "terms";
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl, paddingBottom: 60 }}>
        <Pressable onPress={() => router.back()} hitSlop={16}><Text style={{ color: colors.muted, marginBottom: spacing.md }}>← Back</Text></Pressable>
        <Text style={styles.h}>{isTerms ? "Terms of Service" : "Privacy Policy"}</Text>
        <Text style={styles.updated}>Last updated November 2025</Text>
        <Text style={styles.body}>{isTerms ? TERMS : PRIVACY}</Text>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  h: { fontSize: 28, fontWeight: "700", color: colors.onSurface },
  updated: { color: colors.muted, marginTop: 4, marginBottom: spacing.lg },
  body: { color: colors.onSurface, fontSize: 15, lineHeight: 24 },
});
