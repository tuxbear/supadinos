import Button from '@components/Buttons/Button';
import supabase from '@config/supabase';
import React, { useState } from 'react';
import { Alert, SafeAreaView, Text, StyleSheet, TextInput, View } from 'react-native';

const VerificationScreen = ({ route, navigation }) => {
  const { email, password, verificationCode } = route.params;
  const [enteredCode, setEnteredCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerification = async () => {
    if (!enteredCode) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }
    if (parseInt(enteredCode) !== verificationCode) {
      Alert.alert('Invalid Code', 'Please enter the correct verification code.');
      return;
    }
    setLoading(true);
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (signInError) {
        throw signInError;
      }
      const userId = signInData.user.id;

      const { error: profileError } = await supabase
        .from('user_profile')
        .insert({
          user_uuid: userId,
          user_email: email,
          created_at: new Date().toISOString()
        });
      if (profileError) {
        throw profileError;
      }
      navigation.navigate('HomeScreen');
    } catch (error) {
      console.error('Verification error:', error);
      Alert.alert(
        'Error',
        error.message || 'An error occurred during verification'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Email Verification</Text>
        <Text style={styles.subtitle}>
          Enter the 4-digit code sent to {email}
        </Text>
        
        <TextInput
          value={enteredCode}
          onChangeText={setEnteredCode}
          keyboardType="numeric"
          style={styles.input}
          maxLength={4}
          placeholder="Enter verification code"
          editable={!loading}
        />

        <Button
          title={loading ? "Verifying..." : "Verify Code"}
          onPress={handleVerification}
          disabled={loading || !enteredCode}
          containerStyle={styles.button}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    marginTop: 16,
  }
});

export default VerificationScreen;