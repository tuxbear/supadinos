import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import supabase from '@config/supabase';
import { RootStackParamList } from '../Types/navigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Game {
  id: string;
  name: string;
  status: 'waiting' | 'active' | 'completed';
  max_rounds: number;
  created_at: string;
  current_round: number;
  participant_count: number;
  creator_username: string;
}

interface Round {
  id: string;
  round_number: number;
  completed_at: string | null;
}

const GamesListScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [activeGames, setActiveGames] = useState<Game[]>([]);
  const [waitingGames, setWaitingGames] = useState<Game[]>([]);
  const [completedGames, setCompletedGames] = useState<Game[]>([]);

  useEffect(() => {
    loadGames();

    // Set up subscription for real-time updates
    const gamesSubscription = supabase
      .channel('games-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games'
      }, () => {
        loadGames();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(gamesSubscription);
    };
  }, []);

  const loadGames = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('games')
        .select(`
          id, 
          name, 
          status, 
          max_rounds, 
          created_at,
          profiles:created_by (username),
          game_participants:game_participants (id),
          rounds:rounds (id, round_number, completed_at)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const formattedGames = (data || []).map((game: any) => {
        const currentRound = game.rounds
          .filter((r: Round) => !r.completed_at)
          .sort((a: Round, b: Round) => a.round_number - b.round_number)[0];

        return {
          id: game.id,
          name: game.name,
          status: game.status,
          max_rounds: game.max_rounds,
          created_at: game.created_at,
          participant_count: game.game_participants.length,
          creator_username: game.profiles.username,
          current_round: currentRound ? currentRound.round_number : 0
        };
      });

      setActiveGames(formattedGames.filter(game => game.status === 'active'));
      setWaitingGames(formattedGames.filter(game => game.status === 'waiting'));
      setCompletedGames(formattedGames.filter(game => game.status === 'completed'));
    } catch (error) {
      console.error('Error loading games:', error);
      Alert.alert('Error', 'Failed to load games');
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async (gameId: string) => {
    try {
      const { data, error } = await supabase.rpc('join_game', {
        game_uuid: gameId
      });

      if (error) {
        throw error;
      }

      Alert.alert('Success', 'You have joined the game');
      loadGames();
    } catch (error: any) {
      console.error('Error joining game:', error);
      Alert.alert('Error', error.message || 'Failed to join game');
    }
  };

  const startGame = async (gameId: string) => {
    try {
      const { error } = await supabase.rpc('start_game', {
        game_uuid: gameId
      });

      if (error) {
        throw error;
      }

      loadGames();
    } catch (error: any) {
      console.error('Error starting game:', error);
      Alert.alert('Error', error.message || 'Failed to start game');
    }
  };

  const goToGameDetails = (gameId: string) => {
    navigation.navigate('GameDetails', {
      gameId
    });
  };

  const goToGameRound = async (gameId: string) => {
    // Get the current round for this game
    const game = activeGames.find(g => g.id === gameId);
    if (!game) return;

    try {
      // Find the current round ID
      const { data, error } = await supabase
        .from('rounds')
        .select('id')
        .eq('game_id', gameId)
        .eq('round_number', game.current_round)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        navigation.navigate('GameRound', {
          gameId,
          roundId: data.id
        });
      }
    } catch (error) {
      console.error('Error getting round:', error);
      Alert.alert('Error', 'Failed to get round information');
    }
  };

  const renderGameItem = ({ item, section }: { item: Game; section: { title: string } }) => {
    const isWaiting = item.status === 'waiting';
    const isActive = item.status === 'active';
    const isCompleted = item.status === 'completed';

    return (
      <TouchableOpacity
        style={[
          styles.gameItem,
          isWaiting && styles.waitingGame,
          isActive && styles.activeGame,
          isCompleted && styles.completedGame
        ]}
        onPress={() => isActive ? goToGameRound(item.id) : null}
        disabled={!isActive}
      >
        <View style={styles.gameHeader}>
          <Text style={styles.gameName}>{item.name}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {isWaiting ? 'Waiting' : isActive ? 'Active' : 'Completed'}
            </Text>
          </View>
        </View>
        
        <Text style={styles.gameInfo}>
          Created by: {item.creator_username}
        </Text>
        
        <Text style={styles.gameInfo}>
          Players: {item.participant_count}
        </Text>
        
        {isActive && (
          <Text style={styles.gameInfo}>
            Round: {item.current_round}/{item.max_rounds}
          </Text>
        )}
        
        {isWaiting && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => joinGame(item.id)}
            >
              <Ionicons name="add-circle" size={20} color="white" />
              <Text style={styles.actionButtonText}>Join</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={() => startGame(item.id)}
            >
              <Ionicons name="play" size={20} color="white" />
              <Text style={styles.actionButtonText}>Start</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {isActive && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.playButton]}
              onPress={() => goToGameRound(item.id)}
            >
              <Ionicons name="game-controller" size={20} color="white" />
              <Text style={styles.actionButtonText}>Play</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.detailsButton]}
              onPress={() => goToGameDetails(item.id)}
            >
              <Ionicons name="information-circle" size={20} color="white" />
              <Text style={styles.actionButtonText}>Details</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {isCompleted && (
          <TouchableOpacity
            style={[styles.actionButton, styles.detailsButton]}
            onPress={() => goToGameDetails(item.id)}
          >
            <Ionicons name="information-circle" size={20} color="white" />
            <Text style={styles.actionButtonText}>Game Summary</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (title: string) => (
    <Text style={styles.sectionTitle}>{title}</Text>
  );

  const goToCreateGame = () => {
    navigation.navigate('CreateGame');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.createButton}
        onPress={goToCreateGame}
      >
        <Ionicons name="add-circle" size={20} color="white" />
        <Text style={styles.createButtonText}>Create New Game</Text>
      </TouchableOpacity>
      
      <View style={styles.gamesContainer}>
        {waitingGames.length > 0 && (
          <View style={styles.section}>
            {renderSectionHeader('Waiting for Players')}
            <FlatList
              data={waitingGames}
              renderItem={(props) => renderGameItem({ ...props, section: { title: 'Waiting' } })}
              keyExtractor={(item) => item.id}
            />
          </View>
        )}
        
        {activeGames.length > 0 && (
          <View style={styles.section}>
            {renderSectionHeader('Active Games')}
            <FlatList
              data={activeGames}
              renderItem={(props) => renderGameItem({ ...props, section: { title: 'Active' } })}
              keyExtractor={(item) => item.id}
            />
          </View>
        )}
        
        {completedGames.length > 0 && (
          <View style={styles.section}>
            {renderSectionHeader('Completed Games')}
            <FlatList
              data={completedGames}
              renderItem={(props) => renderGameItem({ ...props, section: { title: 'Completed' } })}
              keyExtractor={(item) => item.id}
            />
          </View>
        )}
        
        {activeGames.length === 0 && waitingGames.length === 0 && completedGames.length === 0 && (
          <Text style={styles.emptyText}>
            No games found. Create a new game to get started!
          </Text>
        )}
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButton: {
    flexDirection: 'row',
    backgroundColor: '#4c669f',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  gamesContainer: {
    flex: 1,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  gameItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  waitingGame: {
    borderLeftWidth: 4,
    borderLeftColor: '#f0ad4e',
  },
  activeGame: {
    borderLeftWidth: 4,
    borderLeftColor: '#5cb85c',
  },
  completedGame: {
    borderLeftWidth: 4,
    borderLeftColor: '#5bc0de',
    opacity: 0.8,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gameName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#f0ad4e',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  gameInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: '#5bc0de',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 4,
  },
  startButton: {
    backgroundColor: '#5cb85c',
  },
  playButton: {
    backgroundColor: '#5cb85c',
    marginTop: 8,
  },
  detailsButton: {
    backgroundColor: '#5bc0de',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 24,
    fontSize: 16,
  },
});

export default GamesListScreen; 