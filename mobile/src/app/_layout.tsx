import '../../global.css';

import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { SourceSerif4_600SemiBold, useFonts } from '@expo-google-fonts/source-serif-4';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PortalHost } from '@rn-primitives/portal';
import { ThemeProvider } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { StatusBar } from 'expo-status-bar';
import { House, MessageCircle, Target, type LucideIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useLayoutEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoticeBar } from '@/components/notice-bar';
import { IN_PREVIEW_FRAME, PreviewFrame } from '@/components/preview-frame';
import { Reminders } from '@/components/reminders';
import { TAB_ICON_WIDTH, TabIcon } from '@/components/tab-icon';
import { ChatProvider } from '@/lib/chat';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import { NAV_THEME, THEME } from '@/lib/theme';

// Three tabs: the day, Ask in the middle as the main button, and who to see.
// Ask's icon is a speech bubble rather than a mic: the tab opens Ask, and the
// mic on that screen is what listens.
// Each one is a folder with its own stack, so Back stays inside the tab. Saved,
// History, Activity, Insights and You open from the menu (components/menu.tsx); they're
// tabs too, so they keep their own history, but they aren't in the bar.
const TABS: { name: string; title: string; icon: LucideIcon }[] = [
  { name: 'today', title: 'Today', icon: House },
  { name: 'ask', title: 'Ask', icon: MessageCircle },
  { name: 'targets', title: 'Targets', icon: Target },
];
const MENU_TABS = ['activity', 'insights', 'saved', 'history', 'you'];

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

// On a computer or an iPad the web build shows the app inside a phone, so the
// page around it draws only the frame and the app runs in the frame.
export default function RootLayout() {
  return IN_PREVIEW_FRAME ? <PreviewFrame /> : <App />;
}

function App() {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const [fontsLoaded, fontError] = useFonts({ SourceSerif4_600SemiBold, IBMPlexMono_500Medium });

  // Fall back to system fonts rather than a blank screen if the fonts fail to load.
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      {/* The rep's work is kept on the phone and loaded on launch. */}
      <WorkspaceProvider storage={AsyncStorage}>
        {/* So are the Ask conversations, which the menu's History lists. */}
        <ChatProvider storage={AsyncStorage}>
          <FollowAppearance />
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <AppTabs scheme={scheme} />
          <Notices />
          {/* Heads-ups before visits and visits not logged yet; nothing on the web. */}
          <Reminders />
          <PortalHost />
        </ChatProvider>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}

/**
 * Follows the appearance chosen on the You page: the phone's setting, or always
 * light or dark. On native NativeWind applies it for us. On web the tokens in
 * global.css follow the `dark` class on the page, which NativeWind drops for
 * System even when the phone is dark, so it's set from the scheme that results.
 */
function FollowAppearance() {
  const choice = useWorkspace().ws.prefs.appearance;
  const { colorScheme, setColorScheme } = useColorScheme();
  // Layout effects, so a kept choice is in place before the first screen is drawn.
  useLayoutEffect(() => setColorScheme(choice), [choice, setColorScheme]);
  useLayoutEffect(() => {
    if (Platform.OS === 'web') document.documentElement.classList.toggle('dark', colorScheme === 'dark');
  }, [choice, colorScheme]);
  return null;
}

function Notices() {
  const tabBarHeight = useTabBarHeight();
  return <NoticeBar bottom={tabBarHeight + 8} />;
}

function AppTabs({ scheme }: { scheme: 'light' | 'dark' }) {
  const tabBarHeight = useTabBarHeight();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME[scheme].primary,
        tabBarInactiveTintColor: THEME[scheme].mutedForeground,
        tabBarLabelStyle: LABEL,
        // Labels stay under the icons on an iPad too, as useTabBarHeight assumes.
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: { height: tabBarHeight },
        tabBarIconStyle: { width: TAB_ICON_WIDTH },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => <TabIcon icon={tab.icon} color={String(color)} focused={focused} filled={tab.name === 'ask'} />,
          }}
        />
      ))}
      {/* Not `href: null`: the router now sends a hidden tab back to Today, so these
          stay ordinary tabs and only their buttons are left out of the bar. */}
      {MENU_TABS.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      ))}
      {/* "/" only redirects to Today; keep it out of the tab bar. */}
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
