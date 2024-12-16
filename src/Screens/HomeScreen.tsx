import supabase from '@config/supabase';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

const HomeScreen = () => {
    const [userUuid, setUserUuid] = useState('');
    useEffect(() => {
        supabase.auth.getUser().then((user) => setUserUuid(user.data.user.id));
        supabase.from('user_profile').select().then(({ data, error }) => {
            console.log('data', data);
            console.log('error', error);
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