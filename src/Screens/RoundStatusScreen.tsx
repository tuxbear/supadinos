import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import supabase from '@config/supabase';
import { RootStackParamList } from '../Types/navigation';

interface StandingPlayer {
  participant_id: string;
  username: string;
  is_me: boolean;
  status: string;
  moves_count: number | null;
  time_seconds: number | null;
  is_winner: boolean;
}

interface RoundStandings {
  round_id: string;
  round_number: number;
  round_status: 'active' | 'completed';
  time_limit_seconds: number;
  my_participant_id: string;
  players: StandingPlayer[];
  winner_participant_id: string | null;
}

const RoundStatusScreen = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'RoundStatus'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { gameId, roundId } = route.params;

  const [loading, setLoading] = useState(true);
  const [standings, setStandings] = useState<RoundStandings | null>(null);
  const [resultsVisible, setResultsVisible] = useState(false);

  const loadStandings = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_round_standings', {
        p_round_id: roundId,
      });

      if (error) throw error;
      setStandings(data as RoundStandings);

      if ((data as RoundStandings).round_status === 'completed') {
        setResultsVisible(true);
      }
    } catch (error) {
      console.error('Error loading standings:', error);
    } finally {
      setLoading(false);
    }
  }, [roundId]);

  useEffect(() => {
    loadStandings();

    const channel = supabase
      .channel(`round-status-${roundId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'round_participants', filter: `round_id=eq.${roundId}` },
        () => loadStandings()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `id=eq.${roundId}` },
        () => loadStandings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roundId, loadStandings]);

  const finishedCount =
    standings?.players.filter((p) => p.status === 'submitted' || p.status === 'forfeited')
      .length ?? 0;
  const totalCount = standings?.players.length ?? 0;

  const goToNextRound = async () => {
    const { data: game } = await supabase
      .from('games')
      .select('status')
      .eq('id', gameId)
      .single();

    if (game?.status === 'completed') {
      navigation.navigate('GameDetails', { gameId });
      return;
    }

    const { data: nextRound } = await supabase
      .from('rounds')
      .select('id')
      .eq('game_id', gameId)
      .is('completed_at', null)
      .order('round_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextRound) {
      navigation.replace('GameRound', { gameId, roundId: nextRound.id });
    } else {
      navigation.navigate('GameDetails', { gameId });
    }
  };

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '—';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'Finished';
      case 'forfeited':
        return 'Timed out';
      case 'playing':
        return 'Playing';
      default:
        return 'Not started';
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Round {standings?.round_number ?? '—'}</Text>
      <Text style={styles.subtitle}>
        {standings?.round_status === 'completed'
          ? 'All players have finished. Results are in!'
          : `Waiting for players (${finishedCount}/${totalCount})`}
      </Text>

      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${totalCount ? (finishedCount / totalCount) * 100 : 0}%` },
          ]}
        />
      </View>

      {standings?.players.map((player) => (
        <View key={player.participant_id} style={styles.playerRow}>
          <View style={styles.playerInfo}>
            <Text style={[styles.playerName, player.is_me && styles.meText]}>
              {player.username}
              {player.is_me ? ' (you)' : ''}
            </Text>
            <Text style={styles.statusText}>{statusLabel(player.status)}</Text>
          </View>
          {standings.round_status === 'completed' ? (
            <View style={styles.stats}>
              <Text style={styles.statText}>
                {player.moves_count ?? '—'} moves · {formatTime(player.time_seconds)}
              </Text>
              {player.is_winner && <Text style={styles.winnerBadge}>Winner</Text>}
            </View>
          ) : (
            <Text style={styles.hiddenStat}>—</Text>
          )}
        </View>
      ))}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('GameDetails', { gameId })}
        >
          <Text style={styles.secondaryButtonText}>Game Details</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('GamesList')}
        >
          <Text style={styles.primaryButtonText}>My Games</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={resultsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Round {standings?.round_number} Results</Text>
            {standings?.players
              .filter((p) => p.status === 'submitted')
              .sort((a, b) => (a.moves_count ?? 999) - (b.moves_count ?? 999))
              .map((p) => (
                <Text key={p.participant_id} style={styles.resultLine}>
                  {p.username}: {p.moves_count} moves in {formatTime(p.time_seconds)}
                  {p.is_winner ? ' ★' : ''}
                </Text>
              ))}
            <TouchableOpacity style={styles.primaryButton} onPress={goToNextRound}>
              <Text style={styles.primaryButtonText}>
                {standings?.round_status === 'completed' ? 'Continue' : 'Close'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setResultsVisible(false)}
            >
              <Text style={styles.secondaryButtonText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f6fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 16 },
  progressBar: {
    height: 8,
    backgroundColor: '#ddd',
    borderRadius: 4,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#2ecc71' },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
  },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 16, fontWeight: '600' },
  meText: { color: '#3498db' },
  statusText: { fontSize: 13, color: '#888', marginTop: 4 },
  stats: { alignItems: 'flex-end' },
  statText: { fontSize: 13, color: '#333' },
  winnerBadge: { color: '#f39c12', fontWeight: 'bold', marginTop: 4 },
  hiddenStat: { color: '#bbb', fontSize: 18 },
  actions: { marginTop: 24, gap: 12 },
  primaryButton: {
    backgroundColor: '#3498db',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  secondaryButton: {
    backgroundColor: '#ecf0f1',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#333', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  resultLine: { fontSize: 15, marginBottom: 8 },
});

export default RoundStatusScreen;
