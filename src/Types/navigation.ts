export type RootStackParamList = {
  HomeScreen: undefined;
  Friends: undefined;
  GamesList: undefined;
  CreateGame: undefined;
  Profile: undefined;
  Settings: undefined;
  SignInScreen: undefined;
  SignUpScreen: undefined;
  SplashScreen: undefined;
  VerificationScreen: { email: string };
  ButtonExamples: undefined;
  ChangePasswordScreen: undefined;
  GameRound: { gameId: string; roundId: string };
  GameDetails: { gameId: string };
}; 