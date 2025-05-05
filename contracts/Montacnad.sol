pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Montacnad is Ownable, ReentrancyGuard {
    mapping(uint256 => uint256) public games;
    mapping(uint256 => address[2]) public players;
    mapping(uint256 => uint256) public bets;
    mapping(uint256 => uint256) public lastMoveTime;
    mapping(uint256 => bytes32) public moveCommits;
    uint256 public gameCount;
    uint256 public constant TIMEOUT = 5 minutes;

    event GameCreated(uint256 indexed gameId, address player1, address player2, uint256 bet);
    event MoveCommitted(uint256 indexed gameId, address player);
    event MoveRevealed(uint256 indexed gameId, address player, uint8 position);
    event GameEnded(uint256 indexed gameId, address winner, uint256 payout);
    event TimedOut(uint256 indexed gameId, address winner);

    constructor() Ownable(msg.sender) {}

    function createGame(address player2, uint256 betAmount) external payable nonReentrant returns (uint256) {
        require(player2 != address(0) && player2 != msg.sender);
        require(msg.value == betAmount);
        uint256 gameId = gameCount++;
        players[gameId] = [msg.sender, player2];
        bets[gameId] = betAmount;
        games[gameId] = (2 << 19);
        lastMoveTime[gameId] = block.timestamp;
        emit GameCreated(gameId, msg.sender, player2, betAmount);
        return gameId;
    }

    function commitMove(uint256 gameId, bytes32 moveHash) external {
        require(players[gameId][0] == msg.sender || players[gameId][1] == msg.sender);
        require((games[gameId] >> 19) & 0x3 == 2);
        require(((games[gameId] >> 18) & 0x1) == (msg.sender == players[gameId][0] ? 0 : 1));
        moveCommits[gameId] = moveHash;
        emit MoveCommitted(gameId, msg.sender);
    }

    function revealMove(uint256 gameId, uint8 position, bytes32 salt) external nonReentrant {
        require(position < 9);
        require(players[gameId][0] == msg.sender || players[gameId][1] == msg.sender);
        require((games[gameId] >> 19) & 0x3 == 2);
        require(keccak256(abi.encodePacked(position, salt)) == moveCommits[gameId]);
        bool isPlayer1 = msg.sender == players[gameId][0];
        require(((games[gameId] >> 18) & 0x1) == (isPlayer1 ? 0 : 1));
        uint256 gameState = games[gameId];
        require((gameState >> (position * 2)) & 0x3 == 0);
        gameState |= (isPlayer1 ? 1 : 2) << (position * 2);
        gameState ^= (1 << 18);
        lastMoveTime[gameId] = block.timestamp;
        (bool ended, address winner) = checkGameEnd(gameId, gameState);
        if (ended) {
            uint256 payout = bets[gameId] * 2;
            bets[gameId] = 0;
            if (winner != address(0)) {
                payable(winner).transfer(payout);
                emit GameEnded(gameId, winner, payout);
            } else {
                payable(players[gameId][0]).transfer(payout / 2);
                payable(players[gameId][1]).transfer(payout / 2);
                emit GameEnded(gameId, address(0), 0);
            }
        }
        games[gameId] = gameState;
        delete moveCommits[gameId];
        emit MoveRevealed(gameId, msg.sender, position);
    }

    function checkTimeout(uint256 gameId) external nonReentrant {
        require(block.timestamp > lastMoveTime[gameId] + TIMEOUT);
        require((games[gameId] >> 19) & 0x3 == 2);
        address winner = (games[gameId] >> 18) & 0x1 == 0 ? players[gameId][1] : players[gameId][0];
        uint256 payout = bets[gameId] * 2;
        bets[gameId] = 0;
        payable(winner).transfer(payout);
        games[gameId] &= ~(uint256(0x3) << 19);
        emit TimedOut(gameId, winner);
    }

    function checkGameEnd(uint256 gameId, uint256 gameState) internal view returns (bool, address) {
        uint256 board = gameState & 0x3FFFF;
        uint256[8] memory winMasks = [uint256(0x15), 0x540, 0x15000, 0x1041, 0x4104, 0x10410, 0x11041, 0x4410];
        for (uint8 i = 0; i < 8; i++) {
            if ((board & winMasks[i]) == (1 << (i * 2 + 2))) return (true, players[gameId][0]);
            if ((board & winMasks[i]) == (2 << (i * 2 + 2))) return (true, players[gameId][1]);
        }
        bool isDraw = true;
        for (uint8 i = 0; i < 9; i++) {
            if ((board & (0x3 << (i * 2))) == 0) {
                isDraw = false;
                break;
            }
        }
        if (isDraw) return (true, address(0));
        return (false, address(0));
    }

    function withdrawFunds() external onlyOwner nonReentrant {
        payable(owner()).transfer(address(this).balance);
    }
}