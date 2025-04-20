import React, { useState } from 'react';
import { StyleSheet, Text, SafeAreaView, Alert, View, TextInput, TouchableOpacity } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import supabase from '@config/supabase';
import { StackNavigationProp } from '@react-navigation/stack';

type FormData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type ChangePasswordScreenProps = {
  navigation: StackNavigationProp<any>;
};

const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ navigation }) => {
  const { control, handleSubmit, watch } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }
  });
  
  const [loading, setLoading] = useState(false);
  
  const changePassword = async (data: FormData) => {
    if (data.newPassword !== data.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword
      });
      
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert(
          'Success', 
          'Your password has been updated successfully!',
          [
            { 
              text: 'OK', 
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Password change error:', error);
      Alert.alert('Error', 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Change Password</Text>
      
      <View style={styles.formContainer}>
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Current Password</Text>
          <Controller
            control={control}
            name="currentPassword"
            rules={{ required: 'Current password is required' }}
            render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
              <>
                <TextInput
                  style={[styles.input, error && styles.inputError]}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="Enter your current password"
                  secureTextEntry
                />
                {error && (
                  <Text style={styles.errorText}>{error.message}</Text>
                )}
              </>
            )}
          />
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>New Password</Text>
          <Controller
            control={control}
            name="newPassword"
            rules={{ 
              required: 'New password is required',
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
                  placeholder="Enter your new password"
                  secureTextEntry
                />
                {error && (
                  <Text style={styles.errorText}>{error.message}</Text>
                )}
              </>
            )}
          />
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Confirm New Password</Text>
          <Controller
            control={control}
            name="confirmPassword"
            rules={{ 
              required: 'Please confirm your new password',
              validate: value => value === watch('newPassword') || 'Passwords do not match'
            }}
            render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
              <>
                <TextInput
                  style={[styles.input, error && styles.inputError]}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="Confirm your new password"
                  secureTextEntry
                />
                {error && (
                  <Text style={styles.errorText}>{error.message}</Text>
                )}
              </>
            )}
          />
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit(changePassword)}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? "Updating..." : "Update Password"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 24,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  submitButton: {
    backgroundColor: '#0066CC',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    flex: 1,
    marginRight: 8,
  },
  buttonDisabled: {
    backgroundColor: '#99CCFF',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
});

export default ChangePasswordScreen;