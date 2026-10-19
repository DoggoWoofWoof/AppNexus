import '../../global.css';

import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { SourceSerif4_600SemiBold, useFonts } from '@expo-google-fonts/source-serif-4';
import { PortalHost } from '@rn-primitives/portal';
import { ThemeProvider } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { StatusBar } from 'expo-status-bar';
import { ChartColumn, House, ListChecks, Sparkles, Target, type LucideIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoticeBar } from '@/components/notice-bar';
import { TAB_ICON_WIDTH, TabIcon } from '@/components/tab-icon';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import { NAV_THEME, THEME } from '@/lib/theme';

// The five tabs, in the prototype's order and with its icons (demo/js/nav.js).
// Each one is a folder with its own stack, so Back stays inside the tab. Ask sits
// in the middle with a filled icon, as the app's main shortcut.
const TABS: { name: string; title: string; icon: LucideIcon }[] = [
  { name: 'today', title: 'Today', icon: House },
  { name: 'targets', title: 'Targets', icon: Target },
  { name: 'ask', title: 'Ask', icon: Sparkles },
  { name: 'activity', title: 'Activity', icon: ListChecks },
  { name: 'insights', title: 'Insights', icon: ChartColumn },
];

const LABEL = { fontSize: 11.5, lineHeight: 14, fontWeight: '600' } as const;

/**
 * The stock bar is a fixed 49pt, sized for 10pt labels that never scale. iOS shows
 * tab labels in the large content viewer on long press instead of scaling them;
 * elsewhere they follow the system text size (up to 200%), so the bar grows to fit.
 */
function useTabBarHeight() {
  const { bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const scale = Platform.OS === 'ios' ? 1 : Math.min(fontScale, 2);
  // 5pt padding above and below, a 28pt icon and the top border, then the label.
  return 39 + Math.ceil(LABEL.lineHeight * scale) + bottom;
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const [fontsLoaded, fontError] = useFonts({ SourceSerif4_600SemiBold, IBMPlexMono_500Medium });

  // On native NativeWind applies the dark theme for us; on web the tokens in
  // global.css need the `dark` class on the page to follow the system setting.
  useEffect(() => {
    if (Platform.OS === 'web') document.documentElement.classList.toggle('dark', scheme === 'dark');
  }, [scheme]);

  // Fall back to system fonts rather than a blank screen if the fonts fail to load.
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <WorkspaceProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <AppTabs scheme={scheme} />
        <Notices />
        <PortalHost />
      </WorkspaceProvider>
    </ThemeProvider>
  );
}

function Notices() {
  const tabBarHeight = useTabBarHeight();
  return <NoticeBar bottom={tabBarHeight + 8} />;
}

function AppTabs({ scheme }: { scheme: 'light' | 'dark' }) {
  const ctx = useWorkspace();
  const tabBarHeight = useTabBarHeight();
  // Activity shows how many follow-ups are due today or overdue.
  const due = ctx.openFollowUps().filter((f) => f.overdueBy >= 0).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME[scheme].primary,
        tabBarInactiveTintColor: THEME[scheme].mutedForeground,
        tabBarLabelStyle: LABEL,
        tabBarStyle: { height: tabBarHeight },
        tabBarIconStyle: { width: TAB_ICON_WIDTH },
      }}
    >
      {TABS.map((tab) => {
        const badge = tab.name === 'activity' && due ? due : undefined;
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarAccessibilityLabel: badge ? `${tab.title}, ${badge} due` : undefined,
              tabBarIcon: ({ color, focused }) => (
                <TabIcon icon={tab.icon} color={String(color)} focused={focused} filled={tab.name === 'ask'} badge={badge} />
              ),
            }}
          />
        );
      })}
      {/* "/" only redirects to Today; keep it out of the tab bar. */}
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
