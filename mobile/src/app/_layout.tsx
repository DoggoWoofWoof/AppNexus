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

import { WorkspaceProvider } from '@/lib/store';
import { NAV_THEME, THEME } from '@/lib/theme';

// The five tabs, in the prototype's order and with its icons (demo/js/nav.js).
// Each one is a folder with its own stack, so Back stays inside the tab.
const TABS: { name: string; title: string; icon: LucideIcon }[] = [
  { name: 'today', title: 'Today', icon: House },
  { name: 'targets', title: 'Targets', icon: Target },
  { name: 'ask', title: 'Ask', icon: Sparkles },
  { name: 'activity', title: 'Activity', icon: ListChecks },
  { name: 'insights', title: 'Insights', icon: ChartColumn },
];

const LABEL = { fontSize: 11, lineHeight: 14 };

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
  const tabBarHeight = useTabBarHeight();

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
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: THEME[scheme].primary,
            tabBarInactiveTintColor: THEME[scheme].mutedForeground,
            tabBarLabelStyle: LABEL,
            tabBarStyle: { height: tabBarHeight },
          }}
        >
          {TABS.map((tab) => (
            <Tabs.Screen
              key={tab.name}
              name={tab.name}
              options={{
                title: tab.title,
                tabBarIcon: ({ color, size }) => <tab.icon color={color} size={size} />,
              }}
            />
          ))}
          {/* "/" only redirects to Today; keep it out of the tab bar. */}
          <Tabs.Screen name="index" options={{ href: null }} />
        </Tabs>
        <PortalHost />
      </WorkspaceProvider>
    </ThemeProvider>
  );
}
