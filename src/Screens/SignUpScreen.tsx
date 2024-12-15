import React from 'react';
import { StyleSheet, Text, SafeAreaView } from 'react-native';
import { useForm } from 'react-hook-form';
import CustomForm from '../Components/Forms/FormInput';
import { FormData, FormField } from '../Types/types';
import supabase from '@config/supabase';

const SignUpScreen = ({navigation}) => {
    const { control, handleSubmit, watch } = useForm<FormData>();
    const [loading, setLoading] = React.useState(false);
    const [isPasswordMatch, setIsPasswordMatch] = React.useState(true);

    const handleFormSubmit = (data: FormData) => {
        if (data.password !== data.repeatPassword) {
            setIsPasswordMatch(false);
            return;
        }
        setIsPasswordMatch(true);
        sendDataToSupabase(data);
    };
    const sendDataToSupabase = async (data: FormData) => {
        try {
            setLoading(true);
            await supabase.auth.signUp({
                email: data.email,
                password: data.password,
            });
            navigation.navigate('SignInScreen', { email: data.email , password: data.password });
        } catch (error) {
            console.log('error', error);
        } finally {
            setLoading(false);
        }
    };

    const formFields: FormField[] = [
        {
            name: 'email',
            label: 'Email',
            placeholder: 'Enter your email',
            rules: { required: 'Email is required' },
            keyboardType: 'email-address',
        },
        {
            name: 'password',
            label: 'Password',
            placeholder: 'Enter your password',
            rules: { required: 'Password is required' },
            secureTextEntry: true,
        },
        {
            name: 'repeatPassword',
            label: 'Repeat Password',
            placeholder: 'Repeat your password',
            rules: { required: 'Repeat password is required' },
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
                submitButtonText="Sign Up"
            />
            {!isPasswordMatch && (
                <Text style={styles.errorText}>Passwords do not match!</Text>
            )}
            <Text style={styles.smallText} >
                Already have an account?{' '}
                <Text  onPress={() => navigation.navigate('SignInScreen')} style={styles.smallTextBlue}>Sign In</Text>
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
    },
    smallTextBlue: {
        color: 'blue',
        textDecorationLine: 'underline',
    },
    header: {
        fontSize: 24,
        fontWeight: '500',
        marginBottom: 16,
    },
    errorText: {
        color: 'red',
        fontSize: 14,
        marginTop: 8,
    },
});

export default SignUpScreen;
