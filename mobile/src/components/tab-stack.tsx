// The stack inside each tab. Every tab folder in src/app re-exports this as its
// _layout, so each tab keeps its own history and Back never leaves the tab.

import { Stack, useRoute } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { createContext, useContext } from 'react';

import { THEME } from '@/lib/theme';

/** The three tabs in the bar, then the screens the menu opens, which keep a stack of their own too. */
export const TABS = ['today', 'ask', 'targets', 'activity', 'insights', 'saved'] as const;
export type Tab = (typeof TABS)[number];

const TabContext = createContext<Tab>('today');

/** The tab this screen belongs to, so links open inside the same tab. */
export const useTab = () => useContext(TabContext);

// The tab's own screen sits under anything opened from it, even after a deep link
// straight to a profile, so Back always has somewhere to go.
export const unstable_settings = { anchor: 'index' };

export default function TabStack() {
  // This layout is the tab navigator's screen, so its route is the tab itself.
  const { name } = useRoute();
  const tab = TABS.find((t) => t === name) ?? 'today';
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme === 'dark' ? 'dark' : 'light'];
  return (
    <TabContext.Provider value={tab}>
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.primary,
          headerTitleStyle: { fontFamily: 'SourceSerif4_600SemiBold', color: theme.foreground },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        {/* Tab roots draw their own large header; the title names the Back button. */}
        <Stack.Screen name="index" options={{ headerShown: false, title: tab[0].toUpperCase() + tab.slice(1) }} />
      </Stack>
    </TabContext.Provider>
  );
}
