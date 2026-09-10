import React, { createContext, useContext, useEffect } from "react";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import type { CustomerInfo, PurchasesPackage, PurchasesOfferings } from "react-native-purchases";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAuth } from "@/src/hooks/useAuth";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "pro"; // from /setup: entitlement_lookup_key
export const REVENUECAT_OFFERING_IDENTIFIER = "default"; // from /setup: offering_lookup_key

// Native builds AND __DEV__ (Expo Go / web preview) both run RevenueCat.
// Production web has no store, so we skip there.
export const rcEnabled = Platform.OS !== "web" || __DEV__;

function getRevenueCatApiKey() {
  if (!REVENUECAT_TEST_API_KEY || !REVENUECAT_IOS_API_KEY || !REVENUECAT_ANDROID_API_KEY) {
    throw new Error("RevenueCat public API keys not found — run the Setup section first");
  }
  if (Platform.OS === "web" || __DEV__) return REVENUECAT_TEST_API_KEY;
  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_TEST_API_KEY;
}

let _initialized = false;
export function initializeRevenueCat() {
  if (!rcEnabled || _initialized) return;
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
  Purchases.configure({ apiKey: getRevenueCatApiKey() });
  _initialized = true;
}

function useSubscriptionContext() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const customerInfoQuery = useQuery<CustomerInfo | null>({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: async () => (rcEnabled ? await Purchases.getCustomerInfo() : null),
    enabled: rcEnabled,
    staleTime: 60 * 1000,
  });

  const offeringsQuery = useQuery<PurchasesOfferings | null>({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => (rcEnabled ? await Purchases.getOfferings() : null),
    enabled: rcEnabled,
    staleTime: 300 * 1000,
  });

  useEffect(() => {
    if (!rcEnabled) return;
    const listener = (info: CustomerInfo) =>
      queryClient.setQueryData(["revenuecat", "customer-info"], info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => { Purchases.removeCustomerInfoUpdateListener(listener); };
  }, [queryClient]);

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: PurchasesPackage) => {
      // Native SDK: block anonymous purchases. Web Test Store: purchases-js
      // ignores logIn(), but the Test Store activates entitlements client-side
      // so an anon id doesn't cost anyone money — we trust our auth user.
      if (Platform.OS !== "web") {
        const id = (await Purchases.getCustomerInfo()).originalAppUserId;
        if (id.startsWith("$RCAnonymousID:")) throw new Error("identity_not_ready");
      }
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => (rcEnabled ? await Purchases.restorePurchases() : null),
  });

  const isSubscribed = !!customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
  const originalAppUserId = customerInfoQuery.data?.originalAppUserId;
  // purchases-js (web Browser Mode) v1.54 ignores post-configure logIn(), so
  // originalAppUserId can stay `$RCAnonymousID:…` even after we successfully
  // bind identity. On the Test Store the entitlement grants client-side and
  // there's no real backend charge, so we treat "signed-in app user" as
  // identity-ready. Native SDK still uses the strict SDK check.
  const sdkIdentityReady = !!originalAppUserId && !originalAppUserId.startsWith("$RCAnonymousID:");
  const identityReady = Platform.OS === "web" ? !!user?.id : sdkIdentityReady;

  const current = offeringsQuery.data?.current ?? null;
  const offeringByKey = current && current.identifier === REVENUECAT_OFFERING_IDENTIFIER
    ? current
    : offeringsQuery.data?.all?.[REVENUECAT_OFFERING_IDENTIFIER] ?? current;

  return {
    customerInfo: customerInfoQuery.data ?? null,
    offerings: offeringsQuery.data ?? null,
    currentOffering: offeringByKey,
    isSubscribed,
    identityReady,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    error: (offeringsQuery.error || customerInfoQuery.error) as Error | null,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return ctx;
}

// Bind SDK identity to the app's user id. Call from a hook that has access to auth state.
let _boundId: string | null = null;
export async function bindRevenueCatIdentity(userId: string | null, queryClient?: QueryClient): Promise<void> {
  if (!rcEnabled || !_initialized) return;
  if (userId && _boundId !== userId) {
    const { customerInfo } = await Purchases.logIn(userId);
    _boundId = userId;
    // Immediately refresh the react-query cache so `identityReady` (which reads
    // originalAppUserId from CustomerInfo) flips without waiting for the SDK's
    // background listener.
    queryClient?.setQueryData(["revenuecat", "customer-info"], customerInfo);
  } else if (!userId && _boundId) {
    await Purchases.logOut();
    _boundId = null;
    queryClient?.invalidateQueries({ queryKey: ["revenuecat", "customer-info"] });
  }
}
