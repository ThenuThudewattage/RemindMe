import { Redirect } from 'expo-router';

// This redirects /reminders to /reminders/list automatically
export default function RemindersIndex() {
  return <Redirect href="/reminders/list" />;
}