// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title GrindRecord
/// @notice Soulbound proof of work for Grind District.
/// @dev This contract is source only. It is not deployed. The browser game does not
///      send transactions to it. Rank is derived from XP. XP is not a token, it cannot
///      be transferred, and the practice USD ledger is intentionally absent.
///      Course ids match the city, in order:
///      0 spot, 1 risk, 2 staking, 3 airdrops, 4 memes, 5 agents, 6 building, 7 carbon.
contract GrindRecord {
    uint256 public constant COURSE_XP = 70;
    uint256 public constant MAX_BONUS = 25;
    uint256 public constant MAX_REPUTATION_STEP = 25;
    uint8 public constant COURSE_COUNT = 8;

    uint256 public constant CRAB_XP = 70;
    uint256 public constant FISH_XP = 210;
    uint256 public constant DOLPHIN_XP = 420;
    uint256 public constant SHARK_XP = 700;
    uint256 public constant WHALE_XP = 1100;

    address public owner;
    address public pendingOwner;
    address public attestor;
    bool public paused;

    struct Record {
        uint256 xp;
        uint256 reputation;
        uint8 courses;
    }

    mapping(address player => Record) private records;

    error NotOwner();
    error NotAttestor();
    error NotPendingOwner();
    error Paused();
    error ZeroAddress();
    error UnknownCourse();
    error CourseAlreadyFiled();
    error BonusTooLarge();
    error ReputationStepTooLarge();
    error FundsNotAccepted();

    event CourseFiled(address indexed player, uint8 indexed course, uint256 xpGained, uint256 xp);
    event ReputationNoted(address indexed player, uint256 increase, uint256 reputation);
    event AttestorSet(address indexed attestor);
    event PausedSet(bool paused);
    event OwnershipTransferStarted(address indexed pendingOwner);
    event OwnershipTransferred(address indexed owner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAttestor() {
        if (msg.sender != attestor) revert NotAttestor();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    constructor(address owner_, address attestor_) {
        if (owner_ == address(0) || attestor_ == address(0)) revert ZeroAddress();
        owner = owner_;
        attestor = attestor_;
        emit OwnershipTransferred(owner_);
        emit AttestorSet(attestor_);
    }

    /// @notice Rejects ether. This record does not custody funds.
    receive() external payable {
        revert FundsNotAccepted();
    }

    fallback() external payable {
        revert FundsNotAccepted();
    }

    function fileCourse(address player, uint8 course, uint256 bonus) external onlyAttestor whenNotPaused {
        if (player == address(0)) revert ZeroAddress();
        if (course >= COURSE_COUNT) revert UnknownCourse();
        if (bonus > MAX_BONUS) revert BonusTooLarge();
        Record storage record = records[player];
        // Parentheses are required. Solidity binds != tighter than &, so
        // `courses & bit != 0` is `courses & (bit != 0)`.
        uint8 bit = uint8(1 << course);
        if ((record.courses & bit) != 0) revert CourseAlreadyFiled();
        record.courses |= bit;
        uint256 gained = COURSE_XP + bonus;
        record.xp += gained;
        emit CourseFiled(player, course, gained, record.xp);
    }

    /// @notice Reputation is not XP. A payment in the city can note it. Declining does not.
    function noteReputation(address player, uint256 increase) external onlyAttestor whenNotPaused {
        if (player == address(0)) revert ZeroAddress();
        if (increase == 0 || increase > MAX_REPUTATION_STEP) revert ReputationStepTooLarge();
        Record storage record = records[player];
        record.reputation += increase;
        emit ReputationNoted(player, increase, record.reputation);
    }

    function setAttestor(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        attestor = next;
        emit AttestorSet(next);
    }

    function setPaused(bool next) external onlyOwner {
        paused = next;
        emit PausedSet(next);
    }

    function transferOwnership(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        pendingOwner = next;
        emit OwnershipTransferStarted(next);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(msg.sender);
    }

    function recordOf(address player) external view returns (uint256 xp, uint256 reputation, uint8 courses) {
        Record storage record = records[player];
        return (record.xp, record.reputation, record.courses);
    }

    function courseFiled(address player, uint8 course) external view returns (bool) {
        if (course >= COURSE_COUNT) return false;
        return (records[player].courses & uint8(1 << course)) != 0;
    }

    function rankOf(address player) external view returns (uint8) {
        return rankFor(records[player].xp);
    }

    /// @dev 0 shrimp, 1 crab, 2 fish, 3 dolphin, 4 shark, 5 whale. Same cuts as the city.
    function rankFor(uint256 xp) public pure returns (uint8) {
        if (xp >= WHALE_XP) return 5;
        if (xp >= SHARK_XP) return 4;
        if (xp >= DOLPHIN_XP) return 3;
        if (xp >= FISH_XP) return 2;
        if (xp >= CRAB_XP) return 1;
        return 0;
    }
}
