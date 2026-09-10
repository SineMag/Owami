import { Tabs } from "expo-router";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { Platform } from "react-native";
import { colors } from "@/src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, size }) => <MDIcon name="home-variant" size={size} color={color} /> }} />
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarIcon: ({ color, size }) => <MDIcon name="compass-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="create" options={{ title: "Create", tabBarIcon: ({ color, size }) => <MDIcon name="plus-circle" size={size + 4} color={color} /> }} />
      <Tabs.Screen name="cookbook" options={{ title: "Cookbook", tabBarIcon: ({ color, size }) => <MDIcon name="book-open-variant" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <MDIcon name="account-circle-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
