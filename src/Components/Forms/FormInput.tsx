import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useForm, Controller, Control } from 'react-hook-form';
import Button from '@components/Buttons/Button';

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
  control: Control<any>;
  onSubmit: (data: any) => void;
  submitButtonText?: string;
  disabled?: boolean;
}

const CustomForm = ({ 
  fields, 
  control, 
  onSubmit, 
  submitButtonText = 'Submit',
  disabled = false 
}: CustomFormProps) => {
  const isButtonDisabled = disabled;

  return (
    <View style={styles.container}>
      {fields.map((field) => (
        <View key={field.name} style={styles.fieldContainer}>
          <Text style={styles.label}>{field.label}</Text>
          <Controller
            control={control}
            name={field.name}
            rules={field.rules}
            render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
              <>
                <TextInput
                  style={[
                    styles.input,
                    error && styles.inputError
                  ]}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder={field.placeholder}
                  secureTextEntry={field.secureTextEntry}
                  keyboardType={field.keyboardType}
                />
                {error && (
                  <Text style={styles.errorText}>
                    {error.message || 'This field is required'}
                  </Text>
                )}
              </>
            )}
          />
        </View>
      ))}
      <Button
        title={submitButtonText}
        onPress={onSubmit}
        containerStyle={StyleSheet.flatten([
          styles.submitButton,
          isButtonDisabled && styles.submitButtonDisabled
        ])}
        titleStyle={StyleSheet.flatten([
          styles.submitButtonText,
          isButtonDisabled && styles.submitButtonTextDisabled
        ])}
        disabled={isButtonDisabled}
      />
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
  inputError: {
    borderColor: 'red',
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
  submitButtonDisabled: {
    backgroundColor: '#99CCFF',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

export default CustomForm;