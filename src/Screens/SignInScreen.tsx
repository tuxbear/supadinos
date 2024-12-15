import React, {useEffect, useState} from 'react';
import { StyleSheet, Text, SafeAreaView, Alert } from 'react-native';
import { set, useForm } from 'react-hook-form';
import CustomForm from '../Components/Forms/FormInput';
import { FormData, FormField } from '../Types/types';
import supabase from '@config/supabase';

const SignInScreen = ({ navigation }) => {
  const { control, handleSubmit, watch } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    }
  });
  
  const [loading, setLoading] = useState(false);
  const sendDataToSupabase = async (data: FormData) => {
    setLoading(true);
    const { email, password } = data;
    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) {
      Alert.alert(error.message);
      setLoading(false);
    } else {
      console.log('Sign in successful', data);
      navigation.navigate('HomeScreen');
      setLoading(false);
    }
  };

  const formFields: FormField[] = [
    {
      name: 'email',
      label: 'Email',
      placeholder: 'Enter your email',
      rules: { 
        required: 'Email is required',
        pattern: {
          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
          message: 'Invalid email address'
        }
      },
      keyboardType: 'email-address',
    },
    {
      name: 'password',
      label: 'Password',
      placeholder: 'Enter your password',
      rules: { 
        required: 'Password is required',
        minLength: {
          value: 6,
          message: 'Password must be at least 6 characters'
        }
      },
      secureTextEntry: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Sign In</Text>
      <CustomForm
        fields={formFields}
        control={control}
        onSubmit={handleSubmit(sendDataToSupabase)}
        submitButtonText={loading ? "Signing in..." : "Sign In"}
        disabled={loading}
      />
      <Text style={styles.smallText}>
        Already have an account?{' '}
        <Text 
          onPress={() => navigation.navigate('SignInScreen')} 
          style={styles.smallTextBlue}
        >
          Sign In
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
  smallText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  smallTextBlue: {
    color: 'blue',
    textDecorationLine: 'underline',
  },
  header: {
    fontSize: 24,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default SignInScreen;