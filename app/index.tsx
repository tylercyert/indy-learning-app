import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type Health } from '../src/services/api';

export default function HomeScreen() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'unreachable'));
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Indy Learning</Text>
        <Text style={styles.subtitle}>What do you want to learn?</Text>
        <Text style={styles.status} accessibilityRole="text">
          {health ? `Server ok · AI ${health.ai ? 'on' : 'off'}` : error ? `Server: ${error}` : 'Connecting to server…'}
        </Text>
        <Text style={styles.hint}>{api.baseUrl}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontSize: 32, fontWeight: '900', color: '#1F1535' },
  subtitle: { fontSize: 18, fontWeight: '700', color: '#6B6480' },
  status: { marginTop: 24, fontSize: 14, fontWeight: '700', color: '#1F1535' },
  hint: { fontSize: 12, color: '#6B6480' },
});
