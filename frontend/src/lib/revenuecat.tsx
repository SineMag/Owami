import React, { createContext, useContext, useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import type {
  CustomerInfo,
  PurchasesPackage,
  PurchasesOfferings,
} from "react-native-purchases";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/src/hooks/useAuth";

/**
 * RevenueCat API keys
 *
 * For the current Shipaton/Test Store setup, Expo Go and web development
 * use the RevenueCat Test Store API key.
 */
const REVENUECAT_TEST_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;

const REVENUECAT_IOS_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;

const REVENUECAT_ANDROID_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

/**
 * Expo Go detection
 */
const isExpoGo = Constants.executionEnvironment === "storeClient";

/**
 * RevenueCat identifiers
 *
 * These MUST match the RevenueCat dashboard.
 *
 * Entitlement:
 * owami_pro
 *
 * Offering:
 * default
 */
export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "owami_pro";
export const REVENUECAT_OFFERING_IDENTIFIER = "default";

/**
 * RevenueCat is enabled for:
 *
 * - Native iOS
 * - Native Android
 * - Expo Go / development web
 *
 * Production web does not have a native store, so RevenueCat is disabled there.
 */
export const rcEnabled = Platform.OS !== "web" || __DEV__;

/**
 * Get the correct RevenueCat API key for the current environment.
 */
function getRevenueCatApiKey() {
  const apiKey =
    Platform.OS === "web" || isExpoGo
      ? REVENUECAT_TEST_API_KEY
      : Platform.OS === "ios"
        ? REVENUECAT_IOS_API_KEY
        : REVENUECAT_ANDROID_API_KEY;

  if (!apiKey) {
    throw new Error(
      "RevenueCat API key not found. Check the app environment configuration."
    );
  }

  return apiKey;
}

/**
 * Prevent RevenueCat from being configured more than once.
 */
let _initialized = false;

/**
 * Initialize RevenueCat.
 */
export function initializeRevenueCat() {
  if (!rcEnabled || _initialized) {
    return;
  }

  Purchases.setLogLevel(
    __DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN
  );

  Purchases.configure({
    apiKey: getRevenueCatApiKey(),
  });

  _initialized = true;
}

/**
 * Check whether RevenueCat has already been initialized.
 */
function canUseRevenueCat() {
  return rcEnabled && _initialized;
}

/**
 * Subscription context logic.
 */
function useSubscriptionContext() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  /**
   * Get the current RevenueCat customer information.
   */
  const customerInfoQuery = useQuery<CustomerInfo | null>({
    queryKey: ["revenuecat", "customer-info"],

    queryFn: async () => {
      if (!canUseRevenueCat()) {
        return null;
      }

      return await Purchases.getCustomerInfo();
    },

    enabled: canUseRevenueCat(),

    staleTime: 60 * 1000,
  });

  /**
   * Get RevenueCat offerings.
   *
   * This retrieves the "default" offering configured
   * in the RevenueCat dashboard.
   */
  const offeringsQuery = useQuery<PurchasesOfferings | null>({
    queryKey: ["revenuecat", "offerings"],

    queryFn: async () => {
      if (!canUseRevenueCat()) {
        return null;
      }

      return await Purchases.getOfferings();
    },

    enabled: canUseRevenueCat(),

    staleTime: 300 * 1000,
  });

  /**
   * Listen for RevenueCat customer changes.
   *
   * This allows the UI to react immediately when:
   *
   * - A purchase succeeds
   * - A restore succeeds
   * - An entitlement changes
   */
  useEffect(() => {
    if (!canUseRevenueCat()) {
      return;
    }

    const listener = (info: CustomerInfo) => {
      queryClient.setQueryData(
        ["revenuecat", "customer-info"],
        info
      );
    };

    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [queryClient]);

  /**
   * Purchase a RevenueCat package.
   */
  const purchaseMutation = useMutation({
    mutationFn: async (
      packageToPurchase: PurchasesPackage
    ) => {
      /**
       * Native builds:
       *
       * Prevent purchases before the authenticated
       * RevenueCat identity has been established.
       */
      if (Platform.OS !== "web") {
        const customerInfo =
          await Purchases.getCustomerInfo();

        const id = customerInfo.originalAppUserId;

        if (id.startsWith("$RCAnonymousID:")) {
          throw new Error("identity_not_ready");
        }
      }

      /**
       * Purchase the selected package.
       */
      const { customerInfo } =
        await Purchases.purchasePackage(
          packageToPurchase
        );

      /**
       * Immediately update React Query.
       *
       * This allows isSubscribed to update without
       * waiting for another network request.
       */
      queryClient.setQueryData(
        ["revenuecat", "customer-info"],
        customerInfo
      );

      return customerInfo;
    },
  });

  /**
   * Restore previous purchases.
   */
  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!canUseRevenueCat()) {
        return null;
      }

      const customerInfo =
        await Purchases.restorePurchases();

      /**
       * Update the customer information cache immediately.
       */
      queryClient.setQueryData(
        ["revenuecat", "customer-info"],
        customerInfo
      );

      return customerInfo;
    },
  });

  /**
   * Determine whether the user currently has
   * the "owami_pro" entitlement.
   */
  const isSubscribed =
    !!customerInfoQuery.data?.entitlements.active?.[
      REVENUECAT_ENTITLEMENT_IDENTIFIER
    ];

  /**
   * RevenueCat's current App User ID.
   */
  const originalAppUserId =
    customerInfoQuery.data?.originalAppUserId;

  /**
   * Native SDK identity check.
   *
   * RevenueCat initially creates an anonymous ID such as:
   *
   * $RCAnonymousID:xxxxxxxx
   *
   * We don't want to allow native purchases until
   * the authenticated Owami user has been logged in
   * to RevenueCat.
   */
  const sdkIdentityReady =
    !!originalAppUserId &&
    !originalAppUserId.startsWith("$RCAnonymousID:");

  /**
   * Web Test Store:
   *
   * purchases-js can retain an anonymous RevenueCat ID
   * even after the application user has been authenticated.
   *
   * For Test Store development, we therefore use the
   * Owami authenticated user as the identity-ready signal.
   */
  const identityReady =
    Platform.OS === "web"
      ? !!user?.id
      : sdkIdentityReady;

  /**
   * Get the current RevenueCat offering.
   */
  const current =
    offeringsQuery.data?.current ?? null;

  /**
   * Prefer the configured "default" offering.
   *
   * If RevenueCat has it as the current offering,
   * use that.
   *
   * Otherwise try to find it in the "all" offerings map.
   */
  const offeringByKey =
    current &&
    current.identifier ===
      REVENUECAT_OFFERING_IDENTIFIER
      ? current
      : offeringsQuery.data?.all?.[
          REVENUECAT_OFFERING_IDENTIFIER
        ] ?? current;

  /**
   * Expose everything the Owami subscription UI needs.
   */
  return {
    customerInfo:
      customerInfoQuery.data ?? null,

    offerings:
      offeringsQuery.data ?? null,

    currentOffering:
      offeringByKey,

    /**
     * true when the RevenueCat entitlement
     * "owami_pro" is active.
     */
    isSubscribed,

    /**
     * true when RevenueCat is associated
     * with the authenticated Owami user.
     */
    identityReady,

    /**
     * Loading state for customer information
     * and offerings.
     */
    isLoading:
      customerInfoQuery.isLoading ||
      offeringsQuery.isLoading,

    /**
     * Purchase a package.
     */
    purchase:
      purchaseMutation.mutateAsync,

    /**
     * Restore purchases.
     */
    restore:
      restoreMutation.mutateAsync,

    /**
     * Purchase loading state.
     */
    isPurchasing:
      purchaseMutation.isPending,

    /**
     * Restore loading state.
     */
    isRestoring:
      restoreMutation.isPending,

    /**
     * RevenueCat query error.
     */
    error:
      (offeringsQuery.error ||
        customerInfoQuery.error) as Error | null,
  };
}

/**
 * Subscription context type.
 */
type SubscriptionContextValue =
  ReturnType<typeof useSubscriptionContext>;

/**
 * React context.
 */
const Context =
  createContext<SubscriptionContextValue | null>(
    null
  );

/**
 * Subscription Provider.
 */
export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useSubscriptionContext();

  return (
    <Context.Provider value={value}>
      {children}
    </Context.Provider>
  );
}

/**
 * Access the RevenueCat subscription state
 * anywhere inside SubscriptionProvider.
 */
export function useSubscription() {
  const ctx = useContext(Context);

  if (!ctx) {
    throw new Error(
      "useSubscription must be used within a SubscriptionProvider"
    );
  }

  return ctx;
}

/**
 * RevenueCat identity currently bound to the
 * authenticated Owami user.
 */
let _boundId: string | null = null;

/**
 * Bind RevenueCat to the authenticated Owami user.
 *
 * When the user logs in:
 *
 * Owami user ID
 *      ↓
 * RevenueCat logIn()
 *      ↓
 * RevenueCat App User ID
 */
export async function bindRevenueCatIdentity(
  userId: string | null,
  queryClient?: QueryClient
): Promise<void> {
  if (!canUseRevenueCat()) {
    return;
  }

  /**
   * User signed in.
   */
  if (userId && _boundId !== userId) {
    const { customerInfo } =
      await Purchases.logIn(userId);

    _boundId = userId;

    /**
     * Immediately update the customer cache.
     */
    queryClient?.setQueryData(
      ["revenuecat", "customer-info"],
      customerInfo
    );

    return;
  }

  /**
   * User signed out.
   */
  if (!userId && _boundId) {
    await Purchases.logOut();

    _boundId = null;

    queryClient?.invalidateQueries({
      queryKey: ["revenuecat", "customer-info"],
    });
  }
}

