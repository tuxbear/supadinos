import React, {useState} from "react";
import { Alert, SafeAreaView, Text } from "react-native";
import CustomForm from '../Components/Forms/FormInput';
import { ForgotPasswordForm, FormField } from '../Types/types';
import { useForm } from 'react-hook-form';
import supabase from "@config/supabase";

const ChangePassword = ({navigation}) => {
      const { control, handleSubmit, watch, formState: { isValid, isDirty } } = useForm<ForgotPasswordForm>({
        mode: 'onChange',
        defaultValues: {
          email: '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }
      });
      
      const newPasswordMatchesOldPassword = async (data: ForgotPasswordForm) => {
        const { email, currentPassword, newPassword } = data;
        setLoading(true)
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
      
        if (signInError) {
          setLoading(true)
          console.error('Error verifying current password:', signInError);
          return false;
        }

        const passwordMatches = currentPassword === newPassword;
        setLoading(false);
        changePassword(data)
        return passwordMatches;
      };
      const changePassword = async (data: ForgotPasswordForm) => {
        setLoading(true);
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.currentPassword,
        });
      
        if (signInError) {
          setLoading(false);
          Alert.alert('Error', 'Current password is incorrect');
          return;
        }
      
        const { error } = await supabase.auth.updateUser({
          password: data.newPassword
        });
      
        setLoading(false);
        
        if (error) {
          Alert.alert('Error', 'Failed to update password');
          return;
        }
      
        navigation.navigate('HomeScreen');
      };
      
    const [loading, setLoading] = useState(false);

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
        name: 'currentPassword',
        label: 'currentPassword',
        placeholder: 'Enter your current Password',
        rules: { 
          required: 'Current Password is required',
        },
        secureTextEntry: true,
      },
      { 
        name: 'newPassword',
        label: 'newPassword',
        placeholder: 'Enter your new Password',
        rules: { 
          required: 'New Password is required',
          validate: (value) => {
            const currentPassword = watch('currentPassword');
            if (value === currentPassword) {
              return 'New password must be different from current password';
            }
            return true;
          }
        },
        secureTextEntry: true,
      },
      { 
        name: 'confirmPassword',
        label: 'confirmPassword',
        placeholder: 'confirm your new Password',
        rules: { 
          required: 'New password does not match',
          validate: (value) => value === watch('newPassword') || 'Passwords do not match'
        },
        secureTextEntry: true,
      }
    ];
    return (
        <SafeAreaView>
        <Text>Change Password</Text>
        <CustomForm 
            fields={formFields}
            control={control}
            onSubmit={handleSubmit(newPasswordMatchesOldPassword)}
            submitButtonText={loading ? "Changing now..." : "Change Password"}
            disabled={!isValid || !isDirty || loading}
        />
        </SafeAreaView>
    );
};

export default ChangePassword;