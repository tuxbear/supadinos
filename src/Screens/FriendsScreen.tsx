import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Avatar } from 'react-native-elements';
import supabase from '@config/supabase';
import { Ionicons } from '@expo/vector-icons';

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  friendship_id: string;
  friendship_status?: string;
}

interface FriendsData {
  friends: Friend[] | null;
  pending_sent: Friend[] | null;
  pending_received: Friend[] | null;
}

const FriendsScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [friendsData, setFriendsData] = useState<FriendsData>({
    friends: null,
    pending_sent: null,
    pending_received: null
  });
  const [searchUsername, setSearchUsername] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    loadFriends();

    // Set up subscription for real-time updates
    const friendsSubscription = supabase
      .channel('friends-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships'
      }, () => {
        loadFriends();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(friendsSubscription);
    };
  }, []);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_friends');
      if (error) {
        throw error;
      }
      setFriendsData(data || { friends: null, pending_sent: null, pending_received: null });
    } catch (error) {
      console.error('Error loading friends:', error);
      Alert.alert('Error', 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async () => {
    if (!searchUsername.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    setSearchLoading(true);
    try {
      const { error } = await supabase.rpc('send_friend_request', {
        friend_username: searchUsername.trim()
      });

      if (error) {
        throw error;
      }

      setSearchUsername('');
      Alert.alert('Success', 'Friend request sent');
      loadFriends();
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', error.message || 'Failed to send friend request');
    } finally {
      setSearchLoading(false);
    }
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    try {
      const { error } = await supabase.rpc('accept_friend_request', {
        friendship_id: friendshipId
      });

      if (error) {
        throw error;
      }

      loadFriends();
    } catch (error: any) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', error.message || 'Failed to accept friend request');
    }
  };

  const rejectFriendRequest = async (friendshipId: string) => {
    try {
      const { error } = await supabase.rpc('reject_friend_request', {
        friendship_id: friendshipId
      });

      if (error) {
        throw error;
      }

      loadFriends();
    } catch (error: any) {
      console.error('Error rejecting friend request:', error);
      Alert.alert('Error', error.message || 'Failed to reject friend request');
    }
  };

  const renderFriendItem = ({ item }: { item: Friend }) => (
    <View style={styles.friendItem}>
      <Avatar
        rounded
        size="medium"
        source={item.avatar_url ? { uri: item.avatar_url } : require('../../assets/default-avatar.png')}
        containerStyle={styles.avatarContainer}
      />
      <Text style={styles.friendName}>{item.username}</Text>
    </View>
  );

  const renderPendingSentItem = ({ item }: { item: Friend }) => (
    <View style={styles.friendItem}>
      <Avatar
        rounded
        size="medium"
        source={item.avatar_url ? { uri: item.avatar_url } : require('../../assets/default-avatar.png')}
        containerStyle={styles.avatarContainer}
      />
      <Text style={styles.friendName}>{item.username}</Text>
      <View style={styles.pendingBadge}>
        <Text style={styles.pendingText}>Pending</Text>
      </View>
    </View>
  );

  const renderPendingReceivedItem = ({ item }: { item: Friend }) => (
    <View style={styles.friendItem}>
      <Avatar
        rounded
        size="medium"
        source={item.avatar_url ? { uri: item.avatar_url } : require('../../assets/default-avatar.png')}
        containerStyle={styles.avatarContainer}
      />
      <Text style={styles.friendName}>{item.username}</Text>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => acceptFriendRequest(item.friendship_id)}
        >
          <Ionicons name="checkmark" size={20} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => rejectFriendRequest(item.friendship_id)}
        >
          <Ionicons name="close" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends by username"
          value={searchUsername}
          onChangeText={setSearchUsername}
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={sendFriendRequest}
          disabled={searchLoading}
        >
          {searchLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.searchButtonText}>Add</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Friends</Text>
        {friendsData.friends && friendsData.friends.length > 0 ? (
          <FlatList
            data={friendsData.friends}
            keyExtractor={(item) => item.id}
            renderItem={renderFriendItem}
          />
        ) : (
          <Text style={styles.emptyText}>No friends yet</Text>
        )}
      </View>

      {friendsData.pending_received && friendsData.pending_received.length > 0 && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Friend Requests</Text>
          <FlatList
            data={friendsData.pending_received}
            keyExtractor={(item) => item.id}
            renderItem={renderPendingReceivedItem}
          />
        </View>
      )}

      {friendsData.pending_sent && friendsData.pending_sent.length > 0 && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Sent Requests</Text>
          <FlatList
            data={friendsData.pending_sent}
            keyExtractor={(item) => item.id}
            renderItem={renderPendingSentItem}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  searchButton: {
    backgroundColor: '#4c669f',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    backgroundColor: '#ddd',
  },
  friendName: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  pendingBadge: {
    backgroundColor: '#f0ad4e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pendingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  acceptButton: {
    backgroundColor: '#5cb85c',
  },
  rejectButton: {
    backgroundColor: '#d9534f',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 10,
  },
});

export default FriendsScreen; 