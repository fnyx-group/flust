import { Tabs } from 'expo-router/js-tabs';
import type { ComponentType } from 'react';
import { StyleSheet, Text, type ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { HomeIcon } from '@/ui/icons/home-icon';
import { JournalIcon } from '@/ui/icons/journal-icon';
import type { IconProps } from '@/ui/icons/line-icon';
import { RanksIcon } from '@/ui/icons/ranks-icon';
import { SettingsIcon } from '@/ui/icons/settings-icon';
import { TabBarButton } from '@/ui/tab-bar-button';
import { colors, maxFontScale, typography } from '@/ui/theme';

function tabIcon(Icon: ComponentType<IconProps>) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return <Icon color={focused ? colors.accent : colors.textSecondary} />;
  };
}

// The tab bar keeps its height, so labels grow only so far; on iOS, a long press shows the label
// large, through the large content viewer.
function TabLabel({ color, children }: { color: ColorValue; children: string }) {
  return (
    <Text
      maxFontSizeMultiplier={maxFontScale.tabLabel}
      style={[typography.tabLabel, styles.label, { color }]}
    >
      {children}
    </Text>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabel: TabLabel,
        tabBarButton: TabBarButton,
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

const styles = StyleSheet.create({
  label: {
    textAlign: 'center',
  },
});
