import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import supabase from '@config/supabase';
import { User } from '@supabase/supabase-js';
import FormInput from '@components/Forms/FormInput';

type ProfileScreenProps = {
  navigation: StackNavigationProp<any>;
};

const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
        } else if (profile) {
          setUsername(profile.username);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      Alert.alert('Success', 'Profile updated successfully');
      setEditMode(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: user?.user_metadata?.avatar_url || 'https://via.placeholder.com/150' }}
          style={styles.avatar}
        />
      </View>

      <View style={styles.formContainer}>
        {editMode ? (
          <>
            <FormInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setEditMode(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleUpdateProfile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{user?.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Username:</Text>
              <Text style={styles.value}>{username}</Text>
            </View>
            <TouchableOpacity
              style={[styles.button, styles.editButton]}
              onPress={() => setEditMode(true)}
            >
              <Text style={styles.buttonText}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={[styles.button, styles.signOutButton]}
          onPress={handleSignOut}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.navigationButton]}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.buttonText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 20
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ddd'
  },
  formContainer: {
    flex: 1
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  label: {
    fontWeight: 'bold',
    width: 100
  },
  value: {
    flex: 1
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10
  },
  button: {
    borderRadius: 5,
    padding: 12,
    alignItems: 'center',
    marginVertical: 10
  },
  editButton: {
    backgroundColor: '#0066CC'
  },
  saveButton: {
    backgroundColor: '#28a745',
    flex: 1,
    marginLeft: 10
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    flex: 1,
    marginRight: 10
  },
  signOutButton: {
    backgroundColor: '#dc3545'
  },
  navigationButton: {
    backgroundColor: '#6c757d'
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold'
  }
});

export default ProfileScreen; 