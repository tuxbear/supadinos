import React from "react";
import { StyleSheet, Text, SafeAreaView } from "react-native";

const SplashScreen = ({navigation}) => {
    setTimeout(() => {
        navigation.navigate('SignUpScreen');
    }, 2500);
    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.header}>Splash Screen</Text>
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
        color: '#333',
        marginBottom: 16,
    },
});

export default SplashScreen;