import React, { useState } from 'react';
import { StyleSheet, Text, SafeAreaView, Alert, View, TextInput, TouchableOpacity } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import supabase from '@config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';

type FormData = {
  email: string;
  password: string;
};

type SignInScreenProps = {
  navigation: StackNavigationProp<any>;
};

const SignInScreen: React.FC<SignInScreenProps> = ({ navigation }) => {
  const { control, handleSubmit } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    }
  });
  
  const [loading, setLoading] = useState(false);
  
  const sendDataToSupabase = async (data: FormData) => {
    setLoading(true);
    try {
      const { email, password } = data;
      const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
      });
      
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        console.log('Sign in successful', data);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await AsyncStorage.setItem('userUuid', user.id);
        }
        navigation.replace('HomeScreen');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Sign In</Text>
      
      <View style={styles.formContainer}>
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Email</Text>
          <Controller
            control={control}
            name="email"
            rules={{ 
              required: 'Email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address'
              }
            }}
            render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
              <>
                <TextInput
                  style={[styles.input, error && styles.inputError]}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {error && (
                  <Text style={styles.errorText}>{error.message}</Text>
                )}
              </>
            )}
          />
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Password</Text>
          <Controller
            control={control}
            name="password"
            rules={{ 
              required: 'Password is required',
              minLength: {
                value: 6,
                message: 'Password must be at least 6 characters'
              }
            }}
            render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
              <>
                <TextInput
                  style={[styles.input, error && styles.inputError]}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="Enter your password"
                  secureTextEntry
                />
                {error && (
                  <Text style={styles.errorText}>{error.message}</Text>
                )}
              </>
            )}
          />
        </View>
        
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit(sendDataToSupabase)}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Signing in..." : "Sign In"}
          </Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.smallText}>
        Don't have an account?{' '}
        <Text 
          onPress={() => navigation.navigate('SignUpScreen')} 
          style={styles.smallTextBlue}
        >
          Sign Up
        </Text>
      </Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  formContainer: {
    marginBottom: 24,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  inputError: {
    borderColor: 'red',
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#0066CC',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    backgroundColor: '#99CCFF',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  smallText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  smallTextBlue: {
    color: '#0066CC',
    textDecorationLine: 'underline',
  },
  header: {
    fontSize: 24,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default SignInScreen;