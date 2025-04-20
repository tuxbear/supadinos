import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import supabase from '@config/supabase';

type SettingsScreenProps = {
  navigation: StackNavigationProp<any>;
};

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = () => {
    navigation.navigate('ChangePasswordScreen');
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase.auth.admin.deleteUser(
                (await supabase.auth.getUser()).data.user?.id || ''
              );
              
              if (error) {
                throw error;
              }
              
              await supabase.auth.signOut();
              Alert.alert('Success', 'Your account has been deleted');
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', 'Failed to delete account');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const toggleNotifications = () => {
    setNotifications(!notifications);
    // Here you would typically persist this setting to a storage solution
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    // Here you would typically persist this setting and update the app theme
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        <TouchableOpacity 
          style={styles.option} 
          onPress={handleChangePassword}
        >
          <Text style={styles.optionText}>Change Password</Text>
          <Text style={styles.optionArrow}>›</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.option, styles.destructiveOption]} 
          onPress={handleDeleteAccount}
          disabled={loading}
        >
          <Text style={styles.destructiveText}>Delete Account</Text>
          <Text style={styles.optionArrow}>›</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        
        <View style={styles.option}>
          <Text style={styles.optionText}>Notifications</Text>
          <Switch
            value={notifications}
            onValueChange={toggleNotifications}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={notifications ? '#0066CC' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.option}>
          <Text style={styles.optionText}>Dark Mode</Text>
          <Switch
            value={darkMode}
            onValueChange={toggleDarkMode}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={darkMode ? '#0066CC' : '#f4f3f4'}
          />
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Game Settings</Text>
        
        <TouchableOpacity style={styles.option}>
          <Text style={styles.optionText}>Game Difficulty</Text>
          <Text style={styles.optionValue}>Medium</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.option}>
          <Text style={styles.optionText}>Board Size</Text>
          <Text style={styles.optionValue}>16×16</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        
        <TouchableOpacity style={styles.option}>
          <Text style={styles.optionText}>Version</Text>
          <Text style={styles.optionValue}>1.0.0</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.option}>
          <Text style={styles.optionText}>Terms of Service</Text>
          <Text style={styles.optionArrow}>›</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.option}>
          <Text style={styles.optionText}>Privacy Policy</Text>
          <Text style={styles.optionArrow}>›</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9'
  },
  section: {
    marginBottom: 25,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#f2f2f2',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2'
  },
  destructiveOption: {
    borderBottomWidth: 0
  },
  optionText: {
    fontSize: 16
  },
  destructiveText: {
    fontSize: 16,
    color: '#dc3545'
  },
  optionValue: {
    fontSize: 16,
    color: '#999'
  },
  optionArrow: {
    fontSize: 20,
    color: '#999'
  }
});

export default SettingsScreen; 