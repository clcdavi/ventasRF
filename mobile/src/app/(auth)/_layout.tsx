import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: '#fbfbfa', // Bone/Off-White cálido para coincidir con la app
        },
      }}
    />
  );
}
