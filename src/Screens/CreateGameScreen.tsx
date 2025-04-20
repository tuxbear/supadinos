import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Alert,
  Switch
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Avatar } from 'react-native-elements';
import supabase from '@config/supabase';
import { Ionicons } from '@expo/vector-icons';

// Simple data URI for a default avatar
const DEFAULT_AVATAR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyBAMAAADsEZWCAAAAG1BMVEVMaXFBuINBuYNBuYNBuYNBuYNBuYNBuYNBuYMh2jHIAAAACXBIWXMAAA7DAAAOwwHHb6hkAAAAQklEQVQ4jWNgQAX8/Azy8vKMxsb//2RkZERn/P8vLy/P+P8/AysDquD/fxgDU+0oA11gdDHRxUYXG11sow6mI4cCALalTUyXAmPKAAAAAElFTkSuQmCC';

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  selected?: boolean;
}

const CreateGameScreen = () => {
  const navigation = useNavigation();
  const [gameName, setGameName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('6');
  const [maxRounds, setMaxRounds] = useState('10');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_friends');
      if (error) {
        throw error;
      }
      
      if (data && data.friends) {
        setFriends(data.friends.map((friend: Friend) => ({
          ...friend,
          selected: false
        })));
      } else {
        setFriends([]);
      }
    } catch (error) {
      console.error('Error loading friends:', error);
      Alert.alert('Error', 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    setFriends(friends.map(friend => 
      friend.id === friendId 
        ? { ...friend, selected: !friend.selected } 
        : friend
    ));
  };

  const getSelectedCount = () => {
    return friends.filter(friend => friend.selected).length;
  };

  const createGame = async () => {
    if (!gameName.trim()) {
      Alert.alert('Error', 'Please enter a game name');
      return;
    }

    // Validate max players
    const parsedMaxPlayers = parseInt(maxPlayers);
    if (isNaN(parsedMaxPlayers) || parsedMaxPlayers < 2 || parsedMaxPlayers > 10) {
      Alert.alert('Error', 'Max players must be between 2 and 10');
      return;
    }

    // Validate max rounds
    const parsedMaxRounds = parseInt(maxRounds);
    if (isNaN(parsedMaxRounds) || parsedMaxRounds < 5 || parsedMaxRounds > 15) {
      Alert.alert('Error', 'Max rounds must be between 5 and 15');
      return;
    }

    // Get selected friends
    const selectedFriendIds = friends
      .filter(friend => friend.selected)
      .map(friend => friend.id);

    // Validate at least one friend is selected
    if (selectedFriendIds.length === 0) {
      Alert.alert('Error', 'Please select at least one friend');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_game_with_friends', {
        game_name: gameName.trim(),
        max_players: parsedMaxPlayers,
        max_rounds: parsedMaxRounds,
        friend_ids: selectedFriendIds
      });

      if (error) {
        throw error;
      }

      Alert.alert(
        'Success',
        'Game created successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('GamesList' as never)
          }
        ]
      );
    } catch (error: any) {
      console.error('Error creating game:', error);
      Alert.alert('Error', error.message || 'Failed to create game');
    } finally {
      setCreating(false);
    }
  };

  const renderFriendItem = ({ item }: { item: Friend }) => (
    <TouchableOpacity 
      style={[styles.friendItem, item.selected && styles.friendItemSelected]}
      onPress={() => toggleFriendSelection(item.id)}
    >
      <Avatar
        rounded
        size="medium"
        source={item.avatar_url ? { uri: item.avatar_url } : { uri: DEFAULT_AVATAR }}
        containerStyle={styles.avatarContainer}
      />
      <Text style={styles.friendName}>{item.username}</Text>
      {item.selected ? (
        <Ionicons name="checkmark-circle" size={24} color="#4c669f" />
      ) : (
        <Ionicons name="ellipse-outline" size={24} color="#999" />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  const selectedCount = getSelectedCount();
  const totalPlayersCount = selectedCount + 1; // +1 for the current user

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create New Game</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Game Name</Text>
        <TextInput
          style={styles.input}
          value={gameName}
          onChangeText={setGameName}
          placeholder="Enter game name"
        />
      </View>
      
      <View style={styles.row}>
        <View style={[styles.formGroup, styles.halfWidth]}>
          <Text style={styles.label}>Max Players (2-10)</Text>
          <TextInput
            style={styles.input}
            value={maxPlayers}
            onChangeText={setMaxPlayers}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
        
        <View style={[styles.formGroup, styles.halfWidth]}>
          <Text style={styles.label}>Max Rounds (5-15)</Text>
          <TextInput
            style={styles.input}
            value={maxRounds}
            onChangeText={setMaxRounds}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>
          Select Friends ({selectedCount} selected, {totalPlayersCount} total)
        </Text>
        
        {friends.length > 0 ? (
          <FlatList
            data={friends}
            renderItem={renderFriendItem}
            keyExtractor={(item) => item.id}
            style={styles.friendsList}
          />
        ) : (
          <Text style={styles.emptyText}>
            You don't have any friends yet. Add friends first.
          </Text>
        )}
      </View>
      
      <TouchableOpacity
        style={[
          styles.createButton,
          (creating || !gameName.trim() || selectedCount === 0) && styles.disabledButton
        ]}
        onPress={createGame}
        disabled={creating || !gameName.trim() || selectedCount === 0}
      >
        {creating ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.createButtonText}>Create Game</Text>
        )}
      </TouchableOpacity>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  formGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#555',
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  friendsList: {
    maxHeight: 300,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  friendItemSelected: {
    backgroundColor: '#e8f0fe',
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
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 10,
    padding: 16,
  },
  createButton: {
    backgroundColor: '#4c669f',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#a5b1cc',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CreateGameScreen; 