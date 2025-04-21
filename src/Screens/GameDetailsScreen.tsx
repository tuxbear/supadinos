import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../Config/supabase';
import { RootStackParamList } from '../Types/navigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Participant {
  id: string;
  username: string;
  avatar_url: string | null;
  score: number;
}

interface Round {
  id: string;
  round_number: number;
  winner_id: string | null;
  winning_moves: number | null;
}

interface RoundScore {
  participant_id: string;
  username: string;
  moves_count: number | null;
  has_submitted: boolean;
  is_winner: boolean;
}

interface GameMessage {
  id: string;
  message: string;
  created_at: string;
  sender: {
    username: string;
    avatar_url: string | null;
  };
}

const GameDetailsScreen = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'GameDetails'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { gameId } = route.params;

  const [loading, setLoading] = useState(true);
  const [gameName, setGameName] = useState('');
  const [status, setStatus] = useState<'waiting' | 'active' | 'completed'>('waiting');
  const [maxRounds, setMaxRounds] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundScores, setRoundScores] = useState<Record<string, RoundScore[]>>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'chat'>('overview');
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesRef = useRef<FlatList>(null);

  useEffect(() => {
    loadGameDetails();
    
    // Set up subscription for real-time updates
    const gameChangesSubscription = supabase
      .channel('game-details-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'moves',
        filter: `round_id=eq.any(select id from rounds where game_id='${gameId}')`
      }, () => {
        loadGameDetails();
      })
      .subscribe();
      
    // Set up subscription for chat messages
    const chatMessagesSubscription = supabase
      .channel('game-chat-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'game_messages',
        filter: `game_id=eq.${gameId}`
      }, () => {
        loadChatMessages();
      })
      .subscribe();

    // Load chat messages
    loadChatMessages();

    return () => {
      supabase.removeChannel(gameChangesSubscription);
      supabase.removeChannel(chatMessagesSubscription);
    };
  }, [gameId]);

  const loadGameDetails = async () => {
    setLoading(true);
    try {
      // Load game details
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('name, status, max_rounds, current_round:rounds(round_number)')
        .eq('id', gameId)
        .single();

      if (gameError) throw gameError;

      setGameName(gameData.name);
      setStatus(gameData.status);
      setMaxRounds(gameData.max_rounds);
      
      // Get current round
      if (gameData.current_round && gameData.current_round.length > 0) {
        setCurrentRound(Math.max(...gameData.current_round.map((r: any) => r.round_number)));
      }

      // Load participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('game_participants')
        .select(`
          id,
          score,
          profiles:profile_id (username, avatar_url)
        `)
        .eq('game_id', gameId);

      if (participantsError) throw participantsError;

      const formattedParticipants = participantsData.map((p: any) => ({
        id: p.id,
        username: p.profiles.username,
        avatar_url: p.profiles.avatar_url,
        score: p.score
      }));
      setParticipants(formattedParticipants);

      // Load rounds
      const { data: roundsData, error: roundsError } = await supabase
        .from('rounds')
        .select('id, round_number, winner_id, winning_moves')
        .eq('game_id', gameId)
        .order('round_number');

      if (roundsError) throw roundsError;
      setRounds(roundsData);

      // Load moves by round and participant
      const roundScoresObj: Record<string, RoundScore[]> = {};
      
      // Initialize round scores for all rounds and participants
      roundsData.forEach((round: Round) => {
        roundScoresObj[round.id] = formattedParticipants.map(p => ({
          participant_id: p.id,
          username: p.username,
          moves_count: null,
          has_submitted: false,
          is_winner: round.winner_id === p.id
        }));
      });

      // Get moves for each round
      for (const round of roundsData) {
        const { data: movesData, error: movesError } = await supabase
          .from('moves')
          .select(`
            participant_id,
            move_number
          `)
          .eq('round_id', round.id)
          .order('participant_id')
          .order('move_number', { ascending: false });

        if (movesError) throw movesError;

        // Group by participant to get max move number (total moves)
        const participantMoves: Record<string, number> = {};
        const participantsWithMoves = new Set<string>();
        
        movesData.forEach((move: any) => {
          participantsWithMoves.add(move.participant_id);
          participantMoves[move.participant_id] = Math.max(
            move.move_number, 
            participantMoves[move.participant_id] || 0
          );
        });

        // Update round scores
        roundScoresObj[round.id] = roundScoresObj[round.id].map(score => ({
          ...score,
          moves_count: participantMoves[score.participant_id] || null,
          has_submitted: participantsWithMoves.has(score.participant_id)
        }));
      }

      setRoundScores(roundScoresObj);
    } catch (error: any) {
      console.error('Error loading game details:', error);
      Alert.alert('Error', error.message || 'Failed to load game details');
    } finally {
      setLoading(false);
    }
  };

  const loadChatMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('game_messages')
        .select(`
          id,
          message,
          created_at,
          profiles:sender_id (username, avatar_url)
        `)
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedMessages: GameMessage[] = data.map((message: any) => ({
        id: message.id,
        message: message.message,
        created_at: message.created_at,
        sender: {
          username: message.profiles.username,
          avatar_url: message.profiles.avatar_url
        }
      }));

      setMessages(formattedMessages);

      // Scroll to the bottom of messages
      setTimeout(() => {
        if (messagesRef.current && formattedMessages.length > 0) {
          messagesRef.current.scrollToEnd({ animated: false });
        }
      }, 100);
    } catch (error: any) {
      console.error('Error loading chat messages:', error);
      Alert.alert('Error', error.message || 'Failed to load chat messages');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    if (newMessage.length > 1000) {
      Alert.alert('Message too long', 'Messages cannot exceed 1000 characters');
      return;
    }

    setSendingMessage(true);
    try {
      const { error } = await supabase.rpc('send_game_message', {
        game_uuid: gameId,
        message_text: newMessage.trim()
      });

      if (error) throw error;

      // Clear the input field
      setNewMessage('');
      
      // Dismiss keyboard
      Keyboard.dismiss();
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatMessageDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const goToGameRound = async (roundId: string) => {
    navigation.navigate('GameRound', {
      gameId,
      roundId
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{gameName}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {status === 'waiting' ? 'Waiting' : status === 'active' ? 'Active' : 'Completed'}
          </Text>
        </View>
      </View>

      <View style={styles.gameInfo}>
        <Text style={styles.infoText}>Round: {currentRound}/{maxRounds}</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>Game Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
          onPress={() => setActiveTab('chat')}
        >
          <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>Game Chat</Text>
          {activeTab !== 'chat' && messages.length > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{messages.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeTab === 'overview' ? (
        <>
          <View style={styles.scoreBoard}>
            <Text style={styles.sectionTitle}>Player Scores</Text>
            <ScrollView horizontal>
              <View>
                {/* Header Row */}
                <View style={styles.tableRow}>
                  <View style={styles.playerCell}>
                    <Text style={styles.tableHeaderText}>Player</Text>
                  </View>
                  <View style={styles.totalScoreCell}>
                    <Text style={styles.tableHeaderText}>Score</Text>
                  </View>
                  {rounds.map((round) => (
                    <View key={round.id} style={styles.roundCell}>
                      <Text style={styles.tableHeaderText}>Round {round.round_number}</Text>
                    </View>
                  ))}
                </View>

                {/* Player Rows */}
                {participants.map((participant) => (
                  <View key={participant.id} style={styles.tableRow}>
                    <View style={styles.playerCell}>
                      <Text style={styles.playerName}>{participant.username}</Text>
                    </View>
                    <View style={styles.totalScoreCell}>
                      <Text style={styles.scoreText}>{participant.score}</Text>
                    </View>
                    {rounds.map((round) => {
                      const participantScore = roundScores[round.id]?.find(
                        (s) => s.participant_id === participant.id
                      );
                      
                      return (
                        <View key={`${participant.id}-${round.id}`} style={styles.roundCell}>
                          {participantScore?.has_submitted ? (
                            <View>
                              <Text style={[
                                styles.movesText,
                                participantScore.is_winner && styles.winnerText
                              ]}>
                                {participantScore.moves_count} moves
                              </Text>
                              {participantScore.is_winner && (
                                <Ionicons name="trophy" size={16} color="#FFD700" />
                              )}
                            </View>
                          ) : (
                            <Text style={styles.pendingText}>-</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.roundsContainer}>
            <Text style={styles.sectionTitle}>Rounds</Text>
            <FlatList
              data={rounds}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.roundItem}
                  onPress={() => goToGameRound(item.id)}
                >
                  <View style={styles.roundHeader}>
                    <Text style={styles.roundTitle}>Round {item.round_number}</Text>
                    {item.winner_id && (
                      <View style={styles.winnerBadge}>
                        <Text style={styles.winnerBadgeText}>
                          Winner: {participants.find(p => p.id === item.winner_id)?.username}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.roundActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => goToGameRound(item.id)}
                    >
                      <Ionicons name="play-circle" size={20} color="white" />
                      <Text style={styles.actionButtonText}>
                        {roundScores[item.id]?.find(s => s.participant_id === participants[0]?.id)?.has_submitted 
                          ? 'View Round' 
                          : 'Play Round'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </>
      ) : (
        <View style={styles.chatContainer}>
          <FlatList
            ref={messagesRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatMessagesContainer}
            renderItem={({ item, index }) => {
              // Check if we need to show a date separator
              const showDateSeparator = index === 0 || 
                formatMessageDate(item.created_at) !== formatMessageDate(messages[index - 1].created_at);
              
              return (
                <>
                  {showDateSeparator && (
                    <View style={styles.dateSeparator}>
                      <Text style={styles.dateSeparatorText}>
                        {formatMessageDate(item.created_at)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.messageContainer}>
                    <Text style={styles.messageSender}>
                      {item.sender.username} <Text style={styles.messageTime}>{formatMessageTime(item.created_at)}</Text>
                    </Text>
                    <Text style={styles.messageText}>{item.message}</Text>
                  </View>
                </>
              );
            }}
            onContentSizeChange={() => messagesRef.current?.scrollToEnd({ animated: true })}
          />
          
          <View style={styles.chatInputContainer}>
            <TextInput
              style={styles.chatInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              multiline
              maxLength={1000}
            />
            <View style={styles.chatInputFooter}>
              <Text style={[
                styles.characterCount,
                newMessage.length > 900 ? styles.characterCountWarning : null,
                newMessage.length > 1000 ? styles.characterCountError : null
              ]}>
                {newMessage.length}/1000
              </Text>
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!newMessage.trim() || newMessage.length > 1000 || sendingMessage) && styles.sendButtonDisabled
                ]}
                onPress={sendMessage}
                disabled={!newMessage.trim() || newMessage.length > 1000 || sendingMessage}
              >
                {sendingMessage ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="send" size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: '#4c669f',
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
  },
  gameInfo: {
    marginBottom: 16,
  },
  infoText: {
    fontSize: 16,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  scoreBoard: {
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableHeaderText: {
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  playerCell: {
    width: 120,
    padding: 10,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    backgroundColor: '#f0f0f0',
  },
  totalScoreCell: {
    width: 60,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    backgroundColor: '#f0f0f0',
  },
  roundCell: {
    width: 100,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  playerName: {
    fontWeight: '500',
    color: '#333',
  },
  scoreText: {
    fontWeight: 'bold',
    color: '#4c669f',
  },
  movesText: {
    color: '#666',
  },
  winnerText: {
    color: '#5cb85c',
    fontWeight: 'bold',
  },
  pendingText: {
    color: '#999',
  },
  roundsContainer: {
    flex: 1,
  },
  roundItem: {
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
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roundTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  winnerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#5cb85c',
  },
  winnerBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  roundActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: '#4c669f',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    marginLeft: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4c669f',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
  },
  activeTabText: {
    color: '#4c669f',
    fontWeight: 'bold',
  },
  unreadBadge: {
    backgroundColor: '#f0ad4e',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  chatMessagesContainer: {
    padding: 12,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 8,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  messageContainer: {
    marginBottom: 12,
  },
  messageSender: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  messageTime: {
    fontWeight: 'normal',
    fontSize: 12,
    color: '#999',
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
  },
  chatInputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 8,
    backgroundColor: 'white',
  },
  chatInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  chatInputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    paddingHorizontal: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
  },
  characterCountWarning: {
    color: '#f0ad4e',
  },
  characterCountError: {
    color: '#d9534f',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4c669f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});

export default GameDetailsScreen; 