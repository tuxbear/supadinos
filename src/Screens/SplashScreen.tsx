import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '@config/supabase';
import { SplashScreenProps } from 'src/Types/types';

const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
    
    const checkUser = async () => {
        console.log('SplashScreen');
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) {
            throw error;
          }
          if (session?.user) {
            await AsyncStorage.setItem('userUuid', session.user.id);
            navigation.replace('HomeScreen');
          } else {
            navigation.replace('SignInScreen');
          }
        } catch (error) {
          console.error('Error checking user session:', error);
          navigation.replace('signUpScreen');
        }
      };
      

    useEffect(() => {
            checkUser();
    }, []);

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text>Loading...</Text>
        </View>
    );
};

const styles = {
    container: {
        flex: 1,
        justifyContent: 'center' as 'center',
        alignItems: 'center' as 'center',
    },
};

export default SplashScreen;