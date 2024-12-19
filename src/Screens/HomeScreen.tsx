import Button from '@components/Buttons/Button';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const HomeScreen = ({navigation}) => {
    const [userUuid, setUserUuid] = useState('');
    useEffect(() => {
        AsyncStorage.getItem('userUuid', (err, result) => {
            result ? setUserUuid(result) : setUserUuid('');
        });
    }, []);
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Home Screen</Text>
            <Button 
                title="Button Examples"
                variant="primary"
                size="small"
                onPress={() => navigation.navigate('ButtonExamples')}
            />
        <Button 
            title="Change Password"
            onPress={() => {navigation.navigate('ChangePasswordScreen')}}
            variant="secondary"
            size="small"
        />
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