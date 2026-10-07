import { Redirect, Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { CustomTabBar } from "@/src/components/custom-tab-bar";
import { usesNativeTabs } from "@/src/navigation";

export default function TabsLayout() {
  const { user, ready } = useAuth();
  const { t } = useI18n();

  if (!ready) return null;
  if (!user) return <Redirect href="/login" />;

  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="ranks">
          <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" />
          <NativeTabs.Trigger.Label hidden>{t("tabs.ranks")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="create">
          <NativeTabs.Trigger.Icon sf="plus.circle.fill" />
          <NativeTabs.Trigger.Label hidden>{t("tabs.create")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="safari.fill" />
          <NativeTabs.Trigger.Label>{t("tabs.explore")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="chat">
          <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right.fill" />
          <NativeTabs.Trigger.Label hidden>{t("tabs.chat")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" />
          <NativeTabs.Trigger.Label hidden>{t("tabs.profile")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="ranks" options={{ title: t("tabs.ranks") }} />
      <Tabs.Screen name="create" options={{ title: t("tabs.create") }} />
      <Tabs.Screen name="index" options={{ title: t("tabs.explore") }} />
      <Tabs.Screen name="chat" options={{ title: t("tabs.chat") }} />
      <Tabs.Screen name="profile" options={{ title: t("tabs.profile") }} />
    </Tabs>
  );
}
