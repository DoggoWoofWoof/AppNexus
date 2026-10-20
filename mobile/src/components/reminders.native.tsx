// Reminders on the phone; lib/reminders.ts decides which. They follow the plan:
// when a visit is moved, cancelled, logged or added, what changed is cancelled
// and scheduled again. Permission is asked once, with one sentence on why, and
// not on launch: the first time the plan gains a reminder, or the rep comes back
// to the app with one still to come. "Not now" turns them off, and the You page
// can turn them on again (ReminderChoice). A tap opens the visit's page in Today,
// or Today itself for visits not logged yet.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility, IosAuthorizationStatus } from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';

import { ChoiceButtons } from '@/components/choice-buttons';
import { CHANNEL, reminderHref, remindersFor, signature, syncReminders } from '@/lib/reminders';
import { useWorkspace } from '@/lib/store';
import type { ReminderSetting } from '@/lib/types';

// Kept on the phone so the question is asked only once, once the rep has answered it.
const ASKED_KEY = 'fieldpro.app.reminders-asked';

/** 'ask' until the rep has answered; 'later' when they closed the question without answering; 'on' while the phone allows notifications; 'off' otherwise. */
type Permission = 'checking' | 'ask' | 'asking' | 'later' | 'on' | 'off';

// A reminder shows even with the app open, as the rep may be on another screen.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function allowed(): Promise<{ on: boolean; canAsk: boolean }> {
  // Android asks only once a channel exists, and schedules into it. On a locked
  // phone set to hide private content it shows only that there's a reminder. iOS ignores this.
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Visit reminders',
    importance: AndroidImportance.HIGH,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  });
  const status = await Notifications.getPermissionsAsync();
  return { on: status.granted || status.ios?.status === IosAuthorizationStatus.PROVISIONAL, canAsk: status.canAskAgain };
}

async function checkPermission(): Promise<Permission> {
  const { on, canAsk } = await allowed();
  if (on) return 'on';
  const asked = await AsyncStorage.getItem(ASKED_KEY).catch(() => null);
  return asked || !canAsk ? 'off' : 'ask';
}

const answered = () => AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {});

/** Asks the phone to allow notifications, or when it won't ask again, offers its Settings. Resolves to whether they're allowed. */
async function turnOn(): Promise<boolean> {
  answered();
  const { on, canAsk } = await allowed();
  if (on) return true;
  if (canAsk) return (await Notifications.requestPermissionsAsync()).granted;
  Alert.alert('Allow notifications in Settings', 'This phone is set not to show Field Pro’s notifications.', [
    { text: 'Not now', style: 'cancel' },
    { text: 'Open Settings', onPress: () => Linking.openSettings() },
  ]);
  return false;
}

export function Reminders() {
  const ctx = useWorkspace();
  const { selectDay, todayIso, setPrefs } = ctx;
  const setting = ctx.ws.prefs.reminders;
  const [permission, setPermission] = useState<Permission>('checking');
  // Counts returns to the app: times may have passed, and it's a moment to ask.
  const [returns, setReturns] = useState(0);
  // The reminders the plan had at launch; one that's new means the rep just planned something.
  const atLaunch = useRef<Set<string> | null>(null);
  const queue = useRef(Promise.resolve());
  // What the phone was last brought in step with; null until the first sync, which also clears anything stale.
  const synced = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    const check = () =>
      checkPermission().then(
        (p) => live && setPermission((now) => (now === 'asking' || now === 'later' ? now : p)),
        () => live && setPermission('off'),
      );
    check();
    // From the background only: iOS also passes through 'inactive' for its own dialogs.
    let last = AppState.currentState;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && last === 'background') {
        setReturns((n) => n + 1);
        // Notifications may have been turned on or off in the phone's settings meanwhile.
        check();
      }
      last = state;
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  // Turned on again from the You page.
  useEffect(() => {
    if (setting !== 'off') checkPermission().then((p) => p === 'on' && setPermission('on'), () => {});
  }, [setting]);

  // Asks once, when the plan has a reminder to give and it isn't launch.
  useEffect(() => {
    if (permission !== 'ask' || setting === 'off') return;
    const wanted = remindersFor(ctx, new Date(), setting).map(signature);
    if (!atLaunch.current) atLaunch.current = new Set(wanted);
    const seen = atLaunch.current;
    if (!wanted.length || (!returns && wanted.every((s) => seen.has(s)))) return;
    setPermission('asking');
    Alert.alert(
      'Turn on reminders?',
      'Get a heads-up 15 minutes before each visit, and a nudge at 17:30 for visits not logged yet. You can change this on the You page.',
      [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => {
            answered();
            setPrefs({ reminders: 'off' });
            setPermission('off');
          },
        },
        { text: 'Turn on', onPress: () => turnOn().then((on) => setPermission(on ? 'on' : 'off'), () => setPermission('off')) },
      ],
      // Closed without an answer: not asked again until the app next opens.
      { cancelable: true, onDismiss: () => setPermission('later') },
    );
  }, [ctx, permission, returns, setting, setPrefs]);

  // Keeps the phone in step with the plan. Only what changed is cancelled and scheduled again; turned off, ours are cancelled.
  useEffect(() => {
    if (permission !== 'on') return;
    const wanted = remindersFor(ctx, new Date(), setting);
    const key = wanted.map(signature).join('\n');
    if (key === synced.current) return;
    synced.current = key;
    // One at a time, so a quick second change can't interleave with the first.
    queue.current = queue.current
      .then(() => syncReminders(wanted))
      .catch(() => {
        synced.current = null;
      });
  }, [ctx, permission, returns, setting]);

  // A tap opens the visit, or Today, including when it started the app.
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      const href = reminderHref(response);
      if (!href || response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      Notifications.clearLastNotificationResponse();
      // Today, under the visit, shows today: the day the reminder was about.
      selectDay(todayIso);
      router.navigate(href as Href);
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [selectDay, todayIso]);

  return null;
}

const OPTIONS: { value: ReminderSetting; title: string; sub: string }[] = [
  { value: 'all', title: 'All', sub: 'Before visits and at 17:30' },
  { value: 'end-of-day', title: '17:30 only', sub: 'Visits not logged' },
  { value: 'off', title: 'Off', sub: 'No reminders' },
];

/** The reminders row on the You page. Turning them on asks the phone, or offers its Settings. */
export function ReminderChoice() {
  const ctx = useWorkspace();
  const { setPrefs } = ctx;
  // Off while the phone doesn't allow them, whatever was chosen, so the row says what will happen.
  const [phoneAllows, setPhoneAllows] = useState(true);
  useEffect(() => {
    allowed().then((s) => setPhoneAllows(s.on), () => setPhoneAllows(false));
  }, []);
  const choose = (reminders: ReminderSetting) => {
    if (reminders === 'off') return setPrefs({ reminders });
    turnOn().then(
      (on) => {
        setPhoneAllows(on);
        setPrefs({ reminders: on ? reminders : 'off' });
      },
      () => setPrefs({ reminders: 'off' }),
    );
  };
  return <ChoiceButtons label="Reminders" options={OPTIONS} value={phoneAllows ? ctx.ws.prefs.reminders : 'off'} onChange={choose} />;
}
