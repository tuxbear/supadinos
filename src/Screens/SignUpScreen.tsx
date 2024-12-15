import React, {useEffect, useState} from 'react';
import { StyleSheet, Text, SafeAreaView, Alert } from 'react-native';
import { set, useForm } from 'react-hook-form';
import CustomForm from '../Components/Forms/FormInput';
import { FormData, FormField } from '../Types/types';
import supabase from '@config/supabase';

const SignUpScreen = ({ navigation }) => {
  const { control, handleSubmit, watch } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      repeatPassword: ''
    }
  });
  
  const [loading, setLoading] = useState(false);
  const [isPasswordMatch, setIsPasswordMatch] = useState(true);
  
  const password = watch('password');
  const repeatPassword = watch('repeatPassword');
  
  useEffect(() => {
    if (password && repeatPassword) {
      setIsPasswordMatch(password === repeatPassword);
    }
  }, [password, repeatPassword]);

  const handleFormSubmit = async (data: FormData) => {
    if (data.password !== data.repeatPassword) {
      setIsPasswordMatch(false);
      return;
    }
    setIsPasswordMatch(true);
    await sendDataToSupabase(data);
  };

  const sendDataToSupabase = async (data: FormData) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });
      
      if (error) throw error;
      
      navigation.navigate('SignInScreen', { 
        email: data.email, 
        password: data.password 
      });
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert('Error signing up', error.message);
    } finally {
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
    {
      name: 'repeatPassword',
      label: 'Repeat Password',
      placeholder: 'Repeat your password',
      rules: { 
        required: 'Repeat password is required',
        validate: (value) => value === password || 'Passwords do not match'
      },
      secureTextEntry: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Sign Up</Text>
      <CustomForm
        fields={formFields}
        control={control}
        onSubmit={handleSubmit(handleFormSubmit)}
        submitButtonText={loading ? "Signing up..." : "Sign Up"}
        disabled={loading || !isPasswordMatch}
      />
      {!isPasswordMatch && (
        <Text style={styles.errorText}>Passwords do not match!</Text>
      )}
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

export default SignUpScreen;