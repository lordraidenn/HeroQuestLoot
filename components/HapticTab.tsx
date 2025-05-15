import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

interface HapticTabProps {
  label: string;
  href: string;
}

export default function HapticTab({ label, href }: HapticTabProps) {
  const router = useRouter();

  const handlePress = useCallback(() => {
    router.push(href);
  }, [href]);

  return (
    <Pressable onPress={handlePress} style={{ padding: 16, alignItems: 'center' }}>
      <Text style={{ fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}
