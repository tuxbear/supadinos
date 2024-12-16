import supabase from '@config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

const HomeScreen = () => {
    const [userUuid, setUserUuid] = useState('');
    useEffect(() => {
        AsyncStorage.getItem('userUuid', (err, result) => {
            result ? setUserUuid(result) : setUserUuid('');
        });
    }, []);
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Home Screen</Text>
            <Text>User UUID: {userUuid}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 24,
        fontWeight: 'bold',
    },
});

export default HomeScreen;