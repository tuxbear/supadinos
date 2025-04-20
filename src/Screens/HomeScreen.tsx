import Button from '@components/Buttons/Button';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../Types/navigation';
import { Ionicons } from '@expo/vector-icons';
import supabase from '@config/supabase';

const HomeScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [userUuid, setUserUuid] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem('userUuid', (err, result) => {
            result ? setUserUuid(result) : setUserUuid('');
        });
    }, []);

    const handleLogout = async () => {
        setLoading(true);
        try {
            await supabase.auth.signOut();
            await AsyncStorage.removeItem('userUuid');
            // We don't need to navigate as MainNavigator will handle this when auth state changes
        } catch (error) {
            console.error('Error signing out:', error);
            Alert.alert('Error', 'Failed to sign out');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Welcome to Ricochet Robots</Text>
                <Text style={styles.subtitle}>Challenge your friends in this exciting puzzle game!</Text>
            </View>

            <View style={styles.menuContainer}>
                <TouchableOpacity 
                    style={styles.menuButton}
                    onPress={() => navigation.navigate('Friends')}
                >
                    <Ionicons name="people" size={24} color="#4c669f" />
                    <Text style={styles.menuButtonText}>Friends</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.menuButton}
                    onPress={() => navigation.navigate('GamesList')}
                >
                    <Ionicons name="game-controller" size={24} color="#4c669f" />
                    <Text style={styles.menuButtonText}>My Games</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.menuButton}
                    onPress={() => navigation.navigate('CreateGame')}
                >
                    <Ionicons name="add-circle" size={24} color="#4c669f" />
                    <Text style={styles.menuButtonText}>Create New Game</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.menuButton}
                    onPress={() => navigation.navigate('Profile')}
                >
                    <Ionicons name="person" size={24} color="#4c669f" />
                    <Text style={styles.menuButtonText}>My Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.menuButton}
                    onPress={() => navigation.navigate('Settings')}
                >
                    <Ionicons name="settings" size={24} color="#4c669f" />
                    <Text style={styles.menuButtonText}>Settings</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                    disabled={loading}
                >
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f8f8f8',
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
        marginTop: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    menuContainer: {
        flex: 1,
    },
    menuButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    menuButtonText: {
        fontSize: 16,
        color: '#333',
        marginLeft: 12,
    },
    footer: {
        marginTop: 'auto',
    },
    logoutButton: {
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#d9534f',
        padding: 12,
        alignItems: 'center',
    },
    logoutText: {
        color: '#d9534f',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default HomeScreen;