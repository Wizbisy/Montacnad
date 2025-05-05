import { AuthKitProvider, useSignIn } from '@farcaster/auth-kit';
import GameBoard from './components/GameBoard';
import { useState } from 'react';
import neonBg from './assets/neon-bg.jpg';

const farcasterConfig = {
  relay: 'https://relay.farcaster.xyz',
  rpcUrl: 'https://testnet-rpc.monad.xyz',
  domain: window.location.hostname,
};

function App() {
  const [farcasterUser, setFarcasterUser] = useState(null);
  const { signIn, isSuccess, data } = useSignIn();

  const handleSignIn = async () => {
    await signIn();
  };

  if (isSuccess && data) {
    setFarcasterUser(data);
  }

  return (
    <AuthKitProvider config={farcasterConfig}>
      <div
        className="App min-h-screen flex flex-col items-center p-6 bg-cover bg-center"
        style={{ backgroundImage: `url(${neonBg})` }}
      >
        <div className="relative">
          <img
            src="/taclogo.png"
            alt="Montacnad Logo"
            className="w-40 h-40 mb-6 animate-pulse shadow-[0_0_20px_rgba(147,51,234,0.8)]"
          />
        </div>
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600 mb-2 animate-neon">
          Montacnad: Tic-Tac-Toe
        </h1>
        <p className="text-lg text-purple-300 mb-6 animate-glow">
          Play Tic-Tac-Toe with your friends on Farcaster with Monad Blockchain
        </p>
        {!farcasterUser ? (
          <button
            onClick={handleSignIn}
            className="bg-gradient-to-r from-purple-500 to-purple-700 text-white px-6 py-3 rounded-lg shadow-lg hover:from-purple-600 hover:to-purple-800 transition-all duration-300 transform hover:scale-105 animate-glow"
          >
            Sign in with Farcaster
          </button>
        ) : (
          <p className="text-purple-200 mb-6 animate-glow">Connected as {farcasterUser.username}</p>
        )}
        {farcasterUser && <GameBoard farcasterUser={farcasterUser} />}
      </div>
    </AuthKitProvider>
  );
}

export default App;