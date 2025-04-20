import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Get the Supabase URL and key from Expo Constants (which reads from app.config.js)
const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL ?? 
                    process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_KEY ?? 
                   process.env.EXPO_PUBLIC_SUPABASE_KEY;

// Validate that we have the required configuration
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or key. Please check your environment variables.');
}

// Create the Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default supabase