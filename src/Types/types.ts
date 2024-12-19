import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  SignInScreen: undefined;
  SignUpScreen: undefined;
};

export interface FormField {
  name: string;
  label: string;
  placeholder: string;
  rules: {
    required: string | boolean;
    pattern?: {
      value: RegExp;
      message: string;
    };
    validate?: (value: string, formValues?: Record<string, any>) => boolean | string;
    minLength?: {
      value: number;
      message: string;
    };
    maxLength?: {
      value: number;
      message: string;
    };
  };
  keyboardType?: 'email-address' | 'default' | 'numeric' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'off' | 'email' | 'password' | 'name' | 'tel';
}
  
export interface ForgotPasswordForm {
  currentPassword: string;
  email: string;
  newPassword: string;
  confirmPassword: string;
  secureTextEntry?: boolean;
}

  export interface CustomFormProps {
    fields: FormField[];
    onSubmit: (data: any) => void;
    onChange?: (data: any) => void;
    submitButtonText?: string;
  }
  
  export interface FormData {
    email: string;
    password: string;
    repeatPassword: string;
}

export type SplashScreenProps = {
  navigation: {
    replace: (screen: string) => void;
  };
};


export interface UserProfile {
  user_uuid: string;
  user_email: string;
  created_at: string;
}


export type SignInScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SignInScreen'>;
};
export type SignUpScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SignUpScreen'>;
};