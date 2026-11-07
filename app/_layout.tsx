import { Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black, useFonts } from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { colors } from '../src/features/theme';

export default function RootLayout() {
  const [loaded, error] = useFonts({ Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  // Every screen opens with the purple AppBar under the status bar, so the status bar text is light
  // (native) and the pre-font frame is purple, matching the shell background in public/index.html.
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: colors.purple }} />;
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }} />
    </>
  );
}
