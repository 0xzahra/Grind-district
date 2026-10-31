// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title GrindLedger
/// @notice In-game "Grind" credits. Player-to-player transfers pay a 2% fee to the treasury.
///         topUp()/topUpUSDC() forward payment straight to the treasury and emit TopUp so the
///         server can credit Grind at its configured rate (by calling credit()).
contract GrindLedger is ERC20, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant FEE_BPS = 200; // 2%
    uint256 private constant BPS = 10_000;

    address public immutable treasury;
    IERC20 public immutable usdc;

    event TopUp(address indexed player, address indexed asset, uint256 amount, bytes32 indexed ref);
    event Credited(address indexed player, uint256 amount, bytes32 indexed ref);
    event FeeTaken(address indexed from, uint256 fee);

    mapping(bytes32 => bool) public creditedRef;

    /// @notice Addresses (server keys) allowed to call credit() without a Safe signature.
    mapping(address => bool) public isOperator;
    /// @notice Max Grind (18-decimal units) mintable via credit() per UTC day. Owner can change it.
    uint256 public dailyCreditCap = 1_000_000 ether;
    /// @notice Amount credited so far on a given day index (block.timestamp / 1 days).
    mapping(uint256 => uint256) public creditedOnDay;

    event OperatorSet(address indexed operator, bool allowed);
    event DailyCreditCapSet(uint256 cap);

    error ZeroAmount();
    error AlreadyCredited();
    error ForwardFailed();
    error NotOperator();
    error DailyCapExceeded();

    constructor(address initialOwner, address treasury_, IERC20 usdc_, address initialOperator)
        ERC20("Grind", "GRIND")
        Ownable(initialOwner)
    {
        require(treasury_ != address(0), "treasury");
        treasury = treasury_;
        usdc = usdc_;
        if (initialOperator != address(0)) {
            isOperator[initialOperator] = true;
            emit OperatorSet(initialOperator, true);
        }
    }

    /// @dev Renouncing would leave operators un-revocable and the cap unchangeable forever, so it is disabled.
    function renounceOwnership() public view override onlyOwner {
        revert("GrindLedger: renounce disabled");
    }

    function setOperator(address operator, bool allowed) external onlyOwner {
        isOperator[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function setDailyCreditCap(uint256 cap) external onlyOwner {
        dailyCreditCap = cap;
        emit DailyCreditCapSet(cap);
    }

    /// @notice Pay ETH for Grind. Funds go to the treasury Safe; the server credits after the event.
    function topUp(bytes32 ref) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        (bool ok,) = treasury.call{value: msg.value}("");
        if (!ok) revert ForwardFailed();
        emit TopUp(msg.sender, address(0), msg.value, ref);
    }

    /// @notice Pay USDC (approve first). Funds go to the treasury Safe.
    function topUpUSDC(uint256 amount, bytes32 ref) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, treasury, amount);
        emit TopUp(msg.sender, address(usdc), amount, ref);
    }

    /// @notice Server credits Grind for a verified top-up. Each ref credits once.
    ///         Callable by the owner or an operator; all credits share the daily cap.
    function credit(address player, uint256 amount, bytes32 ref) external {
        if (msg.sender != owner() && !isOperator[msg.sender]) revert NotOperator();
        if (creditedRef[ref]) revert AlreadyCredited();
        uint256 day = block.timestamp / 1 days;
        uint256 used = creditedOnDay[day] + amount;
        if (used > dailyCreditCap) revert DailyCapExceeded();
        creditedOnDay[day] = used;
        creditedRef[ref] = true;
        _mint(player, amount);
        emit Credited(player, amount, ref);
    }

    function feeFor(uint256 amount) public pure returns (uint256) {
        return (amount * FEE_BPS) / BPS;
    }

    /// @dev 2% of every wallet-to-wallet transfer goes to the treasury. Mints and burns are exempt,
    ///      as are transfers to or from the treasury itself.
    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0) || from == treasury || to == treasury) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = feeFor(value);
        if (fee > 0) {
            super._update(from, treasury, fee);
            emit FeeTaken(from, fee);
        }
        super._update(from, to, value - fee);
    }
}
