import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  SignInScreen: undefined;
  SignUpScreen: undefined;
};

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