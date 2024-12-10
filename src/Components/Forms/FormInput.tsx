import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useForm, Controller, Control } from 'react-hook-form';

interface FormField {
    name: string;
    label: string;
    placeholder?: string;
    rules?: object;
    secureTextEntry?: boolean;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
}

export interface CustomFormProps {
    fields: FormField[];
    control: Control<any>; // Provided by react-hook-form
    onSubmit: (data: any) => void;
    submitButtonText?: string;
}

const CustomForm = ({ fields, control, onSubmit, submitButtonText = 'Submit' }: CustomFormProps) => {
    const { handleSubmit, formState: { errors } } = useForm();

    return (
        <View style={styles.container}>
            {fields.map((field) => (
                <View key={field.name} style={styles.fieldContainer}>
                    <Text style={styles.label}>{field.label}</Text>
                    <Controller
                        control={control}
                        name={field.name}
                        rules={field.rules}
                        render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                                style={styles.input}
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                placeholder={field.placeholder}
                                secureTextEntry={field.secureTextEntry}
                                keyboardType={field.keyboardType}
                            />
                        )}
                    />
                    {errors[field.name] && (
                        <Text style={styles.errorText}>
                            {errors[field.name]?.message?.toString() || 'This field is required'}
                        </Text>
                    )}
                </View>
            ))}
            <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit(onSubmit)}
            >
                <Text style={styles.submitButtonText}>{submitButtonText}</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
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
    errorText: {
        color: 'red',
        fontSize: 12,
        marginTop: 4,
    },
    submitButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
    },
    submitButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default CustomForm;
