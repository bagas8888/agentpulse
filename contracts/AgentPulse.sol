// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal interface for the SPACE ID Agent ID contract (BNB Chain).
/// Agent ID is a non-transferable ERC-721 ("name.ai") issued by Binance Wallet.
/// Contract: 0x60b9262456de011f7d15a54cdd8c48baaa8b022f
interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title AgentPulse — on-chain activity & reputation passport for Agent ID holders
/// @notice Agent ID is the identity gate for every action in this contract:
///         - claimStamp(): one-time membership stamp for verified Agent ID holders
///         - checkIn():    daily proof-of-activity, builds streaks and points
///         - postSignal(): holder-only short on-chain messages (the "pulse board")
///         Points, streaks and membership are publicly readable, so any other
///         dApp can compose on top of them (e.g. gate a feature on
///         `pointsOf(address) >= 100` or `isMember(address)`).
/// @dev Security posture (deliberate, and documented for reviewers):
///      - No owner and no admin functions at all. Nobody can pause, mint,
///        freeze, tax or withdraw anything.
///      - The contract holds no funds and has no payable functions.
///      - The Agent ID contract address is immutable, set once in the constructor.
///      - No approvals, no transfers, no external calls besides the read-only
///        `balanceOf` check against the official Agent ID contract.
contract AgentPulse {
    /// @notice Official Agent ID (SPACE ID) contract on BNB Chain.
    IAgentID public immutable agentId;

    uint256 public totalMembers;
    uint256 public totalCheckIns;
    uint256 public totalSignals;

    struct Member {
        uint64 stampId;      // 0 = not a member yet; otherwise sequential, starting at 1
        uint64 joinedAt;     // unix timestamp of claimStamp()
        uint32 points;       // reputation points
        uint32 streak;       // current consecutive-day check-in streak
        uint32 bestStreak;   // best streak ever
        uint32 checkIns;     // total check-ins
        uint32 lastCheckInDay; // unix day (timestamp / 86400) of last check-in
        uint32 signals;      // total signals posted
        uint32 lastSignalDay;  // unix day of last point-earning signal
    }

    mapping(address => Member) private _members;
    mapping(address => string) public lastSignal;

    event StampClaimed(address indexed user, uint256 stampId, uint256 timestamp);
    event CheckedIn(address indexed user, uint256 day, uint32 streak, uint32 points);
    event SignalPosted(address indexed user, string message, uint256 timestamp);

    constructor(address agentIdContract) {
        require(agentIdContract != address(0), "zero address");
        agentId = IAgentID(agentIdContract);
    }

    modifier onlyAgent() {
        require(agentId.balanceOf(msg.sender) > 0, "Agent ID required");
        _;
    }

    modifier onlyMember() {
        require(_members[msg.sender].stampId != 0, "claim your stamp first");
        _;
    }

    /// @notice True if `user` currently holds an Agent ID.
    function isAgent(address user) external view returns (bool) {
        return agentId.balanceOf(user) > 0;
    }

    /// @notice True if `user` has claimed their AgentPulse stamp.
    function isMember(address user) external view returns (bool) {
        return _members[user].stampId != 0;
    }

    /// @notice Reputation points of `user` (0 for non-members).
    function pointsOf(address user) external view returns (uint32) {
        return _members[user].points;
    }

    /// @notice Full member record of `user`.
    function memberOf(address user) external view returns (Member memory) {
        return _members[user];
    }

    /// @notice Claim the one-time membership stamp. +100 points.
    /// Requires holding an Agent ID.
    function claimStamp() external onlyAgent {
        Member storage m = _members[msg.sender];
        require(m.stampId == 0, "stamp already claimed");
        totalMembers += 1;
        m.stampId = uint64(totalMembers);
        m.joinedAt = uint64(block.timestamp);
        m.points = 100;
        emit StampClaimed(msg.sender, totalMembers, block.timestamp);
    }

    /// @notice Daily check-in. Once per UTC day.
    /// Points: 10 base + current streak (capped at +10 bonus).
    /// A missed day resets the streak to 1.
    function checkIn() external onlyAgent onlyMember {
        Member storage m = _members[msg.sender];
        uint256 today = block.timestamp / 86400;
        require(m.lastCheckInDay != today, "already checked in today");

        if (m.checkIns == 0) {
            m.streak = 1;
        } else if (m.lastCheckInDay == today - 1) {
            m.streak += 1;
        } else {
            m.streak = 1;
        }
        if (m.streak > m.bestStreak) m.bestStreak = m.streak;

        uint32 bonus = m.streak > 10 ? 10 : m.streak;
        m.points += 10 + bonus;
        m.checkIns += 1;
        m.lastCheckInDay = uint32(today);
        totalCheckIns += 1;

        emit CheckedIn(msg.sender, today, m.streak, m.points);
    }

    /// @notice Post a short public signal (1-140 bytes) to the pulse board.
    /// +2 points, at most once per UTC day earns points; posting itself is unlimited.
    function postSignal(string calldata message) external onlyAgent onlyMember {
        uint256 len = bytes(message).length;
        require(len > 0 && len <= 140, "signal must be 1-140 bytes");
        Member storage m = _members[msg.sender];
        uint256 today = block.timestamp / 86400;
        if (m.lastSignalDay != today) {
            m.points += 2;
            m.lastSignalDay = uint32(today);
        }
        m.signals += 1;
        totalSignals += 1;
        lastSignal[msg.sender] = message;
        emit SignalPosted(msg.sender, message, block.timestamp);
    }
}
