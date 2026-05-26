import MainNavigator from '@components/MainNavigator/MainNavigator';
import { usePushNotifications } from '@hooks/usePushNotifications';

function AppContent() {
  usePushNotifications();
  return <MainNavigator />;
}

export default function App() {
  return <AppContent />;
}
