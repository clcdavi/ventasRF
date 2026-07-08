import { Redirect } from 'expo-router';
import { useAuth } from '../stores/auth';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, viewAsCustomer, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const role = user?.rol || 'user';
  const isRealCustomer = role === 'user' || role === 'customer' || viewAsCustomer;
  
  if (isRealCustomer) {
    return <Redirect href="/(tabs)/resumen" />;
  } else {
    return <Redirect href="/(tabs)/" />;
  }
}
