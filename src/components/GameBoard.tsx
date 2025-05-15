import { useState, useEffect } from 'react';
import { useAccount, useContract, useProvider, useSigner } from 'wagmi';
import { ethers } from 'ethers';
import MontacnadABI from '../MontacnadABI.json';
import { getFollows, submitCast } from '@farcaster/hub-web';

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '0x650122B54f0D6f264C1B405225753ddA066517e2';

interface GameBoardProps {
  farcasterUser: {
    fid: number;
    address: string;
    username: string;
    signer: any; 
  } | null;
}

function GameBoard({ farcasterUser }: GameBoardProps) {
  const [opponent, setOpponent] = useState('');
  const [followers, setFollowers] = useState<any[]>([]);
  const [gameId, setGameId] = useState<number | null>(null);
  const [board, setBoard] = useState<number[]>(Array(9).fill(0));
  const [gameState, setGameState] = useState<ethers.BigNumber | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<string | null>(null);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [movePosition, setMovePosition] = useState<string>('');
  const [moveSalt, setMoveSalt] = useState<string>('');
  const [isCommitting, setIsCommitting] = useState(false);

  const { address: userAddress } = useAccount();
  const { data: signer } = useSigner();
  const provider = useProvider();

  const contract = useContract({
    address: CONTRACT_ADDRESS,
    abi: MontacnadABI,
    signerOrProvider: signer || provider,
  });

  useEffect(() => {
    if (!CONTRACT_ADDRESS) {
      console.error('REACT_APP_CONTRACT_ADDRESS is not set.');
      alert('Contract address is missing. Please check your environment variables.');
    }
  }, []);

  useEffect(() => {
    const fetchFollowers = async () => {
      if (farcasterUser?.fid) {
        try {
          const follows = await getFollows({ fid: farcasterUser.fid });
          setFollowers(follows.data || []);
        } catch (error) {
          console.error('Error fetching followers:', error);
          alert('Failed to fetch followers.');
        }
      }
    };
    fetchFollowers();
  }, [farcasterUser]);

  useEffect(() => {
    const fetchGameState = async () => {
      if (!gameId || !contract || !userAddress) return;
      try {
        const state = await contract.games(gameId);
        const player1 = await contract.players(gameId, 0);
        const player2 = await contract.players(gameId, 1);
        const gamePlayers = [player1, player2];
        const rawBoard = state & 0x3FFFF;
        const boardArray = Array(9).fill(0);
        for (let i = 0; i < 9; i++) {
          boardArray[i] = (rawBoard >> (i * 2)) & 0x3;
        }
        setBoard(boardArray);
        setGameState(state);
        setCurrentPlayer((state >> 18) & 0x1 === 0 ? player1 : player2);
        if ((state >> 19) & 0x3 !== 2) {
          const winner = (state >> 18) & 0x1 === 0 ? player2 : player1;
          setGameResult(
            winner === ethers.constants.AddressZero
              ? "It's a draw!"
              : `Winner: ${winner === userAddress ? 'You' : 'Opponent'}!`
          );
        }
      } catch (error) {
        console.error('Error fetching game state:', error);
        alert('Failed to fetch game state.');
      }
    };
    fetchGameState();
  }, [gameId, contract, userAddress]);

  const handleCreateGame = async () => {
    if (!opponent || !ethers.utils.isAddress(opponent)) {
      alert('Please enter a valid opponent address.');
      return;
    }
    if (!contract || !signer) {
      alert('Wallet not connected or contract unavailable.');
      return;
    }
    try {
      const betAmount = ethers.utils.parseEther('0.01');
      const tx = await contract.createGame(opponent, betAmount, { value: betAmount });
      const receipt = await tx.wait();
      const gameCreatedEvent = receipt.events?.find((e: any) => e.event === 'GameCreated');
      if (!gameCreatedEvent) throw new Error('GameCreated event not found');
      const newGameId = gameCreatedEvent.args.gameId.toNumber:form-data
      setGameId(newGameId);
      setBoard(Array(9).fill(0));
      setGameResult(null);
      setIsCommitting(false);
    } catch (error) {
      console.error('Error creating game:', error);
      alert('Failed to create game.');
    }
  };

  const handleCommitMove = async (position: number) => {
    if (board[position] !== 0 || currentPlayer !== userAddress || gameResult || !contract || !signer) {
      return;
    }
    const salt = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    const moveHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(['uint8', 'bytes32'], [position, salt])
    );
    try {
      const tx = await contract.commitMove(gameId, moveHash);
      await tx.wait();
      setMovePosition(position.toString());
      setMoveSalt(salt);
      setIsCommitting(true);
      alert('Move committed! Please reveal your move.');
    } catch (error) {
      console.error('Error committing move:', error);
      alert('Failed to commit move.');
    }
  };

  const handleRevealMove = async () => {
    if (!contract || !signer || !movePosition || !moveSalt) {
      alert('Cannot reveal move: incomplete data.');
      return;
    }
    try {
      const tx = await contract.revealMove(gameId, parseInt(movePosition), moveSalt);
      await tx.wait();
      setIsCommitting(false);
      const state = await contract.games(gameId);
      const player1 = await contract.players(gameId, 0);
      const player2 = await contract.players(gameId, 1);
      const gamePlayers = [player1, player2];
      const rawBoard = state & 0x3FFFF;
      const boardArray = Array(9).fill(0);
      for (let i = 0; i < 9; i++) {
        boardArray[i] = (rawBoard >> (i * 2)) & 0x3;
      }
      setBoard(boardArray);
      setGameState(state);
      setCurrentPlayer((state >> 18) & 0x1 === 0 ? player1 : player2);
      if ((state >> 19) & 0x3 !== 2) {
        const winner = (state >> 18) & 0x1 === 0 ? player2 : player1;
        setGameResult(
          winner === ethers.constants.AddressZero
            ? "It's a draw!"
            : `Winner: ${winner === userAddress ? 'You' : 'Opponent'}!`
        );
      }
    } catch (error) {
      console.error('Error revealing move:', error);
      alert('Failed to reveal move.');
    }
  };

  const handleTimeout = async () => {
    if (!contract || !signer) {
      alert('Wallet not connected or contract unavailable.');
      return;
    }
    try {
      const tx = await contract.checkTimeout(gameId);
      await tx.wait();
      const state = await contract.games(gameId);
      const player1 = await contract.players(gameId, 0);
      const player2 = await contract.players(gameId, 1);
      const winner = (state >> 18) & 0x1 === 0 ? player2 : player1;
      setGameResult(`Timed out! Winner: ${winner === userAddress ? 'You' : 'Opponent'}!`);
    } catch (error) {
      console.error('Error checking timeout:', error);
      alert('Failed to check timeout.');
    }
  };

  const shareResult = async () => {
    if (!farcasterUser || !gameResult) return;
    try {
      const castText = `${gameResult} Play Montacnad Tic-Tac-Toe at ${VERCEL_URL}!`;
      await submitCast({
        signer: farcasterUser.signer,
        text: castText,
      });
      alert('Result shared on Farcaster!');
    } catch (error) {
      console.error('Error sharing result:', error);
      alert('Failed to share result.');
    }
  };

  const renderCell = (index: number) => {
    const value = board[index];
    const isX = value === 1;
    const isO = value === 2;
    return (
      <button
        onClick={() => handleCommitMove(index)}
        className={`w-20 h-20 bg-gray-900 text-4xl font-bold flex items-center justify-center border-2 border-purple-500 rounded-lg transition-all duration-300 ${
          isX
            ? 'text-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.7)] animate-glow'
            : isO
            ? 'text-pink-400 shadow-[0_0_15px_rgba(244,114,182,0.7)] animate-glow'
            : 'hover:bg-gray-800 hover:shadow-[0_0_15px_rgba(147,51,234,0.5)]'
        }`}
        disabled={value !== 0 || currentPlayer !== userAddress || !!gameResult}
      >
        {isX ? 'X' : isO ? 'O' : ''}
      </button>
    );
  };

  return (
    <div className="w-full max-w-md p-6 bg-gray-900 bg-opacity-80 rounded-xl shadow-2xl border-2 border-purple-500 animate-glow">
      <h2 className="text-3xl font-bold text-purple-400 mb-6 text-center animate-neon">
        Tic-Tac-Toe PvP
      </h2>
      <div className="mb-6">
        <label className="text-purple-200 block mb-2">Invite a Friend:</label>
        {followers.length > 0 ? (
          <select
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            className="p-2 rounded bg-gray-800 text-purple-200 w-full border-2 border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400 animate-glow"
          >
            <option value="">Select a Farcaster Friend</option>
            {followers.map((follower) => (
              <option key={follower.fid} value={follower.address}>
                {follower.username} ({follower.address.slice(0, 6)}...)
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            placeholder="Opponent Address"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            className="p-2 rounded bg-gray-800 text-purple-200 w-full border-2 border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400 animate-glow"
          />
        )}
      </div>
      <button
        onClick={handleCreateGame}
        className="w-full bg-gradient-to-r from-purple-500 to-purple-700 text-white px-6 py-3 rounded-lg shadow-lg hover:from-purple-600 hover:to-purple-800 transition-all duration-300 transform hover:scale-105 animate-glow mb-6"
        disabled={!userAddress || !signer || !CONTRACT_ADDRESS}
      >
        Create Game (Stake 0.01 MON)
      </button>

      {gameId && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-purple-300 mb-4 text-center animate-neon">
            Game #{gameId}
          </h3>
          <div className="grid grid-cols-3 gap-2 w-64 mx-auto">
            {board.map((_, index) => renderCell(index))}
          </div>
          {isCommitting && (
            <button
              onClick={handleRevealMove}
              className="mt-4 w-full bg-gradient-to-r from-pink-500 to-pink-700 text-white px-6 py-3 rounded-lg shadow-lg hover:from-pink-600 hover:to-pink-800 transition-all duration-300 transform hover:scale-105 animate-glow"
            >
              Reveal Move
            </button>
          )}
          <p className="text-purple-200 mt-4 text-center animate-glow">
            {gameResult
              ? gameResult
              : `Current Player: ${currentPlayer === userAddress ? 'You' : 'Opponent'}`}
          </p>
          {!gameResult && (
            <button
              onClick={handleTimeout}
              className="mt-4 w-full bg-gray-700 text-purple-200 px-6 py-2 rounded-lg hover:bg-gray-600 transition-all duration-300 animate-glow"
            >
              Check Timeout
            </button>
          )}
        </div>
      )}

      {gameResult && (
        <div className="mt-6 text-center">
          <p className="text-2xl font-bold text-purple-400 mb-4 animate-bounce">{gameResult}</p>
          <button
            onClick={shareResult}
            className="bg-gradient-to-r from-purple-500 to-purple-700 text-white px-6 py-3 rounded-lg shadow-lg hover:from-purple-600 hover:to-purple-800 transition-all duration-300 transform hover:scale-105 animate-glow"
            disabled={!farcasterUser}
          >
            Share on Farcaster
          </button>
        </div>
      )}
    </div>
  );
}

export default GameBoard;
