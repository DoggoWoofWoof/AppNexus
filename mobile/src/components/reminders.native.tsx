// Reminders on the phone; lib/reminders.ts decides which. They follow the plan:
// when a visit is moved, cancelled, logged or added, what changed is cancelled
// and scheduled again. Permission is asked once, with one sentence on why, and
// not on launch: the first time the rep gives today a visit at a fixed time, or
// comes back to the app with one still to come. After a no, nothing is
// scheduled and the app works as before. A tap opens the visit's page in Today,
// or Today itself for visits not logged yet.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';

import { CHANNEL, isHeadsUp, reminderHref, remindersFor, signature, syncReminders } from '@/lib/reminders';
import { useWorkspace } from '@/lib/store';

// Kept on the phone so the question is asked only once, whatever the answer.
const ASKED_KEY = 'fieldpro.app.reminders-asked';

/** 'ask' until the rep has been asked; 'on' while the phone allows notifications; 'off' after a no. */
type Permission = 'checking' | 'ask' | 'asking' | 'on' | 'off';

// A reminder shows even with the app open, as the rep may be on another screen.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function checkPermission(): Promise<Permission> {
  // Android asks only once a channel exists, and schedules into it. iOS ignores this.
  await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Visit reminders', importance: AndroidImportance.HIGH });
  const status = await Notifications.getPermissionsAsync();
  if (status.granted || status.ios?.status === IosAuthorizationStatus.PROVISIONAL) return 'on';
  const asked = await AsyncStorage.getItem(ASKED_KEY).catch(() => null);
  return asked || !status.canAskAgain ? 'off' : 'ask';
}

export function Reminders() {
  const ctx = useWorkspace();
  const { selectDay, todayIso } = ctx;
  const [permission, setPermission] = useState<Permission>('checking');
  // Counts returns to the app: times may have passed, and it's a moment to ask.
  const [returns, setReturns] = useState(0);
  // The heads-ups the day had at launch; one that's new means the rep just gave a visit a time.
  const atLaunch = useRef<Set<string> | null>(null);
  const queue = useRef(Promise.resolve());
  // What the phone was last brought in step with; null until the first sync, which also clears anything stale.
  const synced = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    const check = () =>
      checkPermission().then(
        (p) => live && setPermission((now) => (now === 'asking' ? now : p)),
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

  // Asks once, when the day has a heads-up to give and it isn't launch.
  useEffect(() => {
    if (permission !== 'ask') return;
    const heads = remindersFor(ctx, new Date()).filter(isHeadsUp).map(signature);
    if (!atLaunch.current) atLaunch.current = new Set(heads);
    const seen = atLaunch.current;
    if (!heads.length || (!returns && heads.every((s) => seen.has(s)))) return;
    setPermission('asking');
    AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {});
    Alert.alert(
      'Turn on reminders?',
      'Get a heads-up 15 minutes before each visit, and a nudge at 17:30 for visits not logged yet.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => setPermission('off') },
        {
          text: 'Turn on',
          onPress: () =>
            Notifications.requestPermissionsAsync().then(
              (s) => setPermission(s.granted ? 'on' : 'off'),
              () => setPermission('off'),
            ),
        },
      ],
      { cancelable: true, onDismiss: () => setPermission('off') },
    );
  }, [ctx, permission, returns]);

  // Keeps the phone in step with the plan. Only what changed is cancelled and scheduled again.
  useEffect(() => {
    if (permission !== 'on') return;
    const wanted = remindersFor(ctx, new Date());
    const key = wanted.map(signature).join('\n');
    if (key === synced.current) return;
    synced.current = key;
    // One at a time, so a quick second change can't interleave with the first.
    queue.current = queue.current
      .then(() => syncReminders(wanted))
      .catch(() => {
        synced.current = null;
      });
  }, [ctx, permission, returns]);

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
