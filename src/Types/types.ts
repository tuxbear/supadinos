export interface FormField {
    name: string;
    label: string;
    placeholder?: string;
    rules?: object;
    secureTextEntry?: boolean;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  }
  
  export interface CustomFormProps {
    fields: FormField[];
    onSubmit: (data: any) => void;
    submitButtonText?: string;
  }