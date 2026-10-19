import { Redirect } from 'expo-router';

// The app opens on Today. Each tab lives under its own path (/today, /targets, …).
export default function Index() {
  return <Redirect href="/today" />;
}
