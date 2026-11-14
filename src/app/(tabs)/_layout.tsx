import { Tabs } from 'expo-router/js-tabs';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import { HomeIcon } from '@/ui/icons/home-icon';
import { JournalIcon } from '@/ui/icons/journal-icon';
import type { IconProps } from '@/ui/icons/line-icon';
import { RanksIcon } from '@/ui/icons/ranks-icon';
import { SettingsIcon } from '@/ui/icons/settings-icon';
import { colors, typography } from '@/ui/theme';

function tabIcon(Icon: ComponentType<IconProps>) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return <Icon color={focused ? colors.accent : colors.textSecondary} />;
  };
}

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: typography.tabLabel,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.separator,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.home'), tabBarIcon: tabIcon(HomeIcon) }}
      />
      <Tabs.Screen
        name="journal"
        options={{ title: t('tabs.journal'), tabBarIcon: tabIcon(JournalIcon) }}
      />
      <Tabs.Screen
        name="ranks"
        options={{ title: t('tabs.ranks'), tabBarIcon: tabIcon(RanksIcon) }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t('tabs.settings'), tabBarIcon: tabIcon(SettingsIcon) }}
      />
    </Tabs>
  );
}
