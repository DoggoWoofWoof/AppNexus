// The web build has no reminders: the browser preview works as before and asks
// for nothing. The phone's version is reminders.native.tsx.

import { Text } from '@/components/ui/text';

export function Reminders() {
  return null;
}

/** The reminders row on the You page, which in the browser only says where they are. */
export function ReminderChoice() {
  return <Text className="text-muted-foreground">Reminders come on the phone app. The browser preview has none.</Text>;
}
