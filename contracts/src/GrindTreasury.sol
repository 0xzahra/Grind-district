// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title GrindTreasury
/// @notice Holds ETH and ERC20 for Grind District. Only the owner (intended: a Safe multisig) can move funds out.
/// @dev Not upgradeable, issues no token. ERC20 deposits can be plain transfers (no event, by ERC20 design)
///      or go through `depositERC20`, which emits `ERC20Deposited`. Ownership moves with a two-step handoff.
contract GrindTreasury is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event EthDeposited(address indexed from, uint256 amount);
    event ERC20Deposited(address indexed token, address indexed from, uint256 amount);
    event EthWithdrawn(address indexed to, uint256 amount);
    event ERC20Withdrawn(address indexed token, address indexed to, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error EthTransferFailed();

    constructor(address initialOwner) Ownable(initialOwner) {}

    receive() external payable {
        emit EthDeposited(msg.sender, msg.value);
    }

    /// @notice Pull `amount` of `token` from the caller (needs prior approval). Records the amount actually received.
    function depositERC20(IERC20 token, uint256 amount) external nonReentrant {
        if (address(token) == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit ERC20Deposited(address(token), msg.sender, token.balanceOf(address(this)) - before);
    }

    function withdrawEth(address payable to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        emit EthWithdrawn(to, amount);
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert EthTransferFailed();
    }

    function withdrawERC20(IERC20 token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0) || address(token) == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        emit ERC20Withdrawn(address(token), to, amount);
        token.safeTransfer(to, amount);
    }

    /// @dev Renouncing would lock every fund in the contract forever, so it is disabled.
    function renounceOwnership() public view override onlyOwner {
        revert("GrindTreasury: renounce disabled");
    }
}
