import React from "react";
import { StyleSheet, Text, SafeAreaView } from "react-native";
import CustomForm from "../Components/Forms/FormInput";

const SignUpScreen = () => {
    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.header}>Sign Up</Text>
            <CustomForm
                fields={[
                    {
                        name: 'email',
                        label: 'Email',
                        placeholder: 'Enter your email',
                        rules: {
                            required: 'Email is required',
                        },
                        keyboardType: 'email-address',
                    },
                    {
                        name: 'password',
                        label: 'Password',
                        placeholder: 'Enter your password',
                        rules: {
                            required: 'Password is required',
                        },
                        secureTextEntry: true,
                    },
                    {
                        name: 'repeatPassword',
                        label: 'Repeat Password',
                        placeholder: 'Repeat your password',
                        rules: {
                            required: 'Repeat password is required',
                        },
                        secureTextEntry: true,
                    },
                ]}
                onSubmit={(data) => console.log(data)}
                submitButtonText="Sign Up"
            />
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
        borderColor: '#ccc',
        padding: 8,
        borderRadius: 4,
    },
    submitButton: {
        backgroundColor: '#00aeef',
        padding: 16,
        alignItems: 'center',
        borderRadius: 8,
    },
    submitButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '500',
    },
    errorText: {
        color: 'red',
    },
});

export default SignUpScreen;