import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '@config/supabase';
import { StackNavigationProp } from '@react-navigation/stack';

type SplashScreenProps = {
  navigation: StackNavigationProp<any>;
};

const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
    
    const checkUser = async () => {
        console.log('SplashScreen - Checking user session');
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) {
            console.error('Session error:', error);
            throw error;
          }
          
          console.log('Session found:', session ? 'Yes' : 'No');
          
          if (session?.user) {
            await AsyncStorage.setItem('userUuid', session.user.id);
            navigation.replace('HomeScreen');
          } else {
            navigation.replace('SignInScreen');
          }
        } catch (error) {
          console.error('Error checking user session:', error);
          navigation.replace('SignInScreen');
        }
      };
      
    useEffect(() => {
        const timer = setTimeout(() => {
            checkUser();
        }, 1500);
        
        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Ricochet Robots</Text>
            <ActivityIndicator size="large" color="#0066CC" />
            <Text style={styles.loadingText}>Loading...</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5FCFF',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#0066CC',
    },
    loadingText: {
        marginTop: 10,
        color: '#333',
    }
});

export default SplashScreen;