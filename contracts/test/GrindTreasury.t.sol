// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {GrindTreasury} from "../src/GrindTreasury.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock", "MOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Re-enters withdrawEth when it receives ETH.
contract Reenterer {
    GrindTreasury public treasury;
    bool public tried;

    function setTreasury(GrindTreasury t) external {
        treasury = t;
    }

    receive() external payable {
        if (!tried) {
            tried = true;
            treasury.withdrawEth(payable(address(this)), 1);
        }
    }
}

contract Rejecter {
    receive() external payable {
        revert("no");
    }
}

contract GrindTreasuryTest is Test {
    event EthDeposited(address indexed from, uint256 amount);
    event ERC20Deposited(address indexed token, address indexed from, uint256 amount);
    event EthWithdrawn(address indexed to, uint256 amount);
    event ERC20Withdrawn(address indexed token, address indexed to, uint256 amount);

    GrindTreasury treasury;
    MockToken token;
    address owner = makeAddr("safe");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        treasury = new GrindTreasury(owner);
        token = new MockToken();
        vm.deal(alice, 10 ether);
        token.mint(alice, 1000e18);
    }

    function test_ownerSet() public view {
        assertEq(treasury.owner(), owner);
    }

    function test_zeroOwnerReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new GrindTreasury(address(0));
    }

    function test_receiveEthEmits() public {
        vm.expectEmit(true, false, false, true);
        emit EthDeposited(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(treasury).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(treasury).balance, 1 ether);
    }

    function test_depositERC20() public {
        vm.startPrank(alice);
        token.approve(address(treasury), 100e18);
        vm.expectEmit(true, true, false, true);
        emit ERC20Deposited(address(token), alice, 100e18);
        treasury.depositERC20(IERC20(address(token)), 100e18);
        vm.stopPrank();
        assertEq(token.balanceOf(address(treasury)), 100e18);
    }

    function test_depositERC20ZeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(GrindTreasury.ZeroAmount.selector);
        treasury.depositERC20(IERC20(address(token)), 0);
    }

    function test_plainTransferIsHeld() public {
        vm.prank(alice);
        token.transfer(address(treasury), 5e18);
        assertEq(token.balanceOf(address(treasury)), 5e18);
    }

    function test_ownerWithdrawsEth() public {
        vm.deal(address(treasury), 2 ether);
        vm.expectEmit(true, false, false, true);
        emit EthWithdrawn(bob, 1.5 ether);
        vm.prank(owner);
        treasury.withdrawEth(payable(bob), 1.5 ether);
        assertEq(bob.balance, 1.5 ether);
        assertEq(address(treasury).balance, 0.5 ether);
    }

    function test_ownerWithdrawsERC20() public {
        token.mint(address(treasury), 50e18);
        vm.expectEmit(true, true, false, true);
        emit ERC20Withdrawn(address(token), bob, 20e18);
        vm.prank(owner);
        treasury.withdrawERC20(IERC20(address(token)), bob, 20e18);
        assertEq(token.balanceOf(bob), 20e18);
    }

    function test_nonOwnerCannotWithdraw() public {
        vm.deal(address(treasury), 1 ether);
        token.mint(address(treasury), 1e18);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        treasury.withdrawEth(payable(alice), 1 ether);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        treasury.withdrawERC20(IERC20(address(token)), alice, 1e18);
        vm.stopPrank();
    }

    function test_withdrawGuards() public {
        vm.deal(address(treasury), 1 ether);
        vm.startPrank(owner);
        vm.expectRevert(GrindTreasury.ZeroAddress.selector);
        treasury.withdrawEth(payable(address(0)), 1);
        vm.expectRevert(GrindTreasury.ZeroAmount.selector);
        treasury.withdrawEth(payable(bob), 0);
        vm.expectRevert();
        treasury.withdrawEth(payable(bob), 2 ether);
        vm.expectRevert(GrindTreasury.ZeroAddress.selector);
        treasury.withdrawERC20(IERC20(address(token)), address(0), 1);
        vm.expectRevert();
        treasury.withdrawERC20(IERC20(address(token)), bob, 1);
        vm.stopPrank();
    }

    function test_failedEthTransferReverts() public {
        Rejecter r = new Rejecter();
        vm.deal(address(treasury), 1 ether);
        vm.prank(owner);
        vm.expectRevert(GrindTreasury.EthTransferFailed.selector);
        treasury.withdrawEth(payable(address(r)), 1 ether);
    }

    function test_reentrancyBlocked() public {
        Reenterer r = new Reenterer();
        GrindTreasury t = new GrindTreasury(address(r));
        r.setTreasury(t);
        vm.deal(address(t), 1 ether);
        vm.prank(address(r));
        vm.expectRevert(GrindTreasury.EthTransferFailed.selector);
        t.withdrawEth(payable(address(r)), 0.5 ether);
        assertEq(address(t).balance, 1 ether);
    }

    function test_twoStepOwnership() public {
        vm.prank(owner);
        treasury.transferOwnership(bob);
        assertEq(treasury.owner(), owner);
        assertEq(treasury.pendingOwner(), bob);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        treasury.acceptOwnership();
        vm.prank(bob);
        treasury.acceptOwnership();
        assertEq(treasury.owner(), bob);
    }

    function test_renounceDisabled() public {
        vm.prank(owner);
        vm.expectRevert(bytes("GrindTreasury: renounce disabled"));
        treasury.renounceOwnership();
        assertEq(treasury.owner(), owner);
    }

    function testFuzz_ethRoundTrip(uint96 amount) public {
        vm.assume(amount > 0);
        vm.deal(alice, amount);
        vm.prank(alice);
        (bool ok,) = address(treasury).call{value: amount}("");
        assertTrue(ok);
        vm.prank(owner);
        treasury.withdrawEth(payable(bob), amount);
        assertEq(bob.balance, amount);
    }
}
