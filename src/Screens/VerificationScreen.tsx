import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import supabase from '@config/supabase';

type VerificationParams = {
  email: string;
};

type VerificationScreenProps = {
  navigation: StackNavigationProp<any>;
  route: RouteProp<{ params: VerificationParams }, 'params'>;
};

const VerificationScreen: React.FC<VerificationScreenProps> = ({ navigation, route }) => {
  const { email } = route.params;
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerification = async () => {
    if (!verificationCode) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    setLoading(true);
    try {
      // In a real implementation, you would verify the code with Supabase
      // For now, we'll just simulate a successful verification
      
      Alert.alert(
        'Success', 
        'Your email has been verified successfully!',
        [
          { 
            text: 'OK', 
            onPress: () => navigation.navigate('SignInScreen')
          }
        ]
      );
    } catch (error) {
      console.error('Verification error:', error);
      Alert.alert('Error', 'Failed to verify email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    try {
      await supabase.auth.resend({
        type: 'signup',
        email,
      });
      Alert.alert('Success', 'Verification email has been resent');
    } catch (error) {
      console.error('Resend error:', error);
      Alert.alert('Error', 'Failed to resend verification email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Your Email</Text>
      <Text style={styles.description}>
        We've sent a verification code to {email}.
        Please enter the code below to verify your account.
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter verification code"
          value={verificationCode}
          onChangeText={setVerificationCode}
          keyboardType="numeric"
          maxLength={6}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleVerification}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Verifying...' : 'Verify Email'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.resendButton}
        onPress={handleResendCode}
        disabled={loading}
      >
        <Text style={styles.resendButtonText}>
          Didn't receive a code? Resend
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.navigate('SignInScreen')}
      >
        <Text style={styles.backButtonText}>
          Back to Sign In
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: '#666',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 8,
  },
  button: {
    backgroundColor: '#0066CC',
    padding: 16,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#99CCFF',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    marginTop: 24,
    padding: 8,
  },
  resendButtonText: {
    color: '#0066CC',
    fontSize: 14,
  },
  backButton: {
    marginTop: 16,
    padding: 8,
  },
  backButtonText: {
    color: '#666',
    fontSize: 14,
  },
});

export default VerificationScreen;