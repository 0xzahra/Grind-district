// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {GrindLedger} from "../src/GrindLedger.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract GrindLedgerTest is Test {
    address constant SAFE = 0x43985e56ac0c2CD9F95d4C1248cEB14E66Aa254a;
    GrindLedger ledger;
    MockUSDC usdc;
    address owner = address(0xA11CE);
    address alice = address(0xA);
    address bob = address(0xB);
    address op = address(0x0E);

    event TopUp(address indexed player, address indexed asset, uint256 amount, bytes32 indexed ref);

    function setUp() public {
        usdc = new MockUSDC();
        ledger = new GrindLedger(owner, SAFE, usdc, op);
    }

    function test_transferTakesTwoPercentToTreasury() public {
        vm.prank(owner);
        ledger.credit(alice, 1000 ether, bytes32("r1"));
        vm.prank(alice);
        ledger.transfer(bob, 100 ether);
        assertEq(ledger.balanceOf(bob), 98 ether);
        assertEq(ledger.balanceOf(SAFE), 2 ether);
        assertEq(ledger.balanceOf(alice), 900 ether);
    }

    function test_creditOnlyOwnerAndOncePerRef() public {
        vm.expectRevert();
        ledger.credit(alice, 1, bytes32("x"));
        vm.startPrank(owner);
        ledger.credit(alice, 1, bytes32("x"));
        vm.expectRevert(GrindLedger.AlreadyCredited.selector);
        ledger.credit(alice, 1, bytes32("x"));
        vm.stopPrank();
    }

    function test_topUpEthForwardsToTreasuryAndEmits() public {
        vm.deal(alice, 1 ether);
        vm.expectEmit(true, true, true, true);
        emit TopUp(alice, address(0), 0.1 ether, bytes32("t"));
        vm.prank(alice);
        ledger.topUp{value: 0.1 ether}(bytes32("t"));
        assertEq(SAFE.balance, 0.1 ether);
        assertEq(address(ledger).balance, 0);
    }

    function test_topUpUsdc() public {
        usdc.mint(alice, 5e6);
        vm.startPrank(alice);
        usdc.approve(address(ledger), 5e6);
        ledger.topUpUSDC(5e6, bytes32("u"));
        vm.stopPrank();
        assertEq(usdc.balanceOf(SAFE), 5e6);
    }

    function test_zeroTopUpReverts() public {
        vm.expectRevert(GrindLedger.ZeroAmount.selector);
        ledger.topUp{value: 0}(bytes32("z"));
    }

    function test_operatorCanCredit() public {
        vm.prank(op);
        ledger.credit(alice, 5 ether, bytes32("o1"));
        assertEq(ledger.balanceOf(alice), 5 ether);
    }

    function test_nonOperatorCannotCreditOrSetOperator() public {
        vm.prank(bob);
        vm.expectRevert(GrindLedger.NotOperator.selector);
        ledger.credit(bob, 1, bytes32("n"));
        vm.prank(op);
        vm.expectRevert();
        ledger.setOperator(bob, true);
        vm.prank(op);
        vm.expectRevert();
        ledger.setDailyCreditCap(1);
    }

    function test_ownerAddsAndRevokesOperator() public {
        vm.prank(owner);
        ledger.setOperator(bob, true);
        vm.prank(bob);
        ledger.credit(bob, 1, bytes32("b1"));
        vm.prank(owner);
        ledger.setOperator(op, false);
        assertFalse(ledger.isOperator(op));
        vm.prank(op);
        vm.expectRevert(GrindLedger.NotOperator.selector);
        ledger.credit(alice, 1, bytes32("o2"));
    }

    function test_dailyCapEnforcedAndResets() public {
        assertEq(ledger.dailyCreditCap(), 1_000_000 ether);
        vm.startPrank(op);
        ledger.credit(alice, 600_000 ether, bytes32("c1"));
        vm.expectRevert(GrindLedger.DailyCapExceeded.selector);
        ledger.credit(alice, 400_001 ether, bytes32("c2"));
        ledger.credit(alice, 400_000 ether, bytes32("c3"));
        vm.warp(block.timestamp + 1 days);
        ledger.credit(alice, 1_000_000 ether, bytes32("c4"));
        vm.stopPrank();
    }

    function test_ownerChangesCap() public {
        vm.prank(owner);
        ledger.setDailyCreditCap(10 ether);
        vm.prank(op);
        vm.expectRevert(GrindLedger.DailyCapExceeded.selector);
        ledger.credit(alice, 11 ether, bytes32("k"));
    }

    function test_zeroInitialOperatorAllowed() public {
        GrindLedger l = new GrindLedger(owner, SAFE, usdc, address(0));
        assertFalse(l.isOperator(address(0)));
    }

    // Fix: renounce would have frozen a (possibly compromised) operator in place forever.
    function test_renounceDisabled() public {
        vm.prank(owner);
        vm.expectRevert(bytes("GrindLedger: renounce disabled"));
        ledger.renounceOwnership();
        assertEq(ledger.owner(), owner);
        vm.prank(owner);
        ledger.setOperator(op, false);
        assertFalse(ledger.isOperator(op));
    }

    // Fix: ownership handoff is two-step, so a typo cannot lose control.
    function test_ownershipTransferIsTwoStep() public {
        address newOwner = address(0xBEEF);
        vm.prank(owner);
        ledger.transferOwnership(newOwner);
        assertEq(ledger.owner(), owner);
        vm.prank(alice);
        vm.expectRevert();
        ledger.acceptOwnership();
        vm.prank(newOwner);
        ledger.acceptOwnership();
        assertEq(ledger.owner(), newOwner);
    }

    function testFuzz_feeConservesSupply(uint256 amt, uint256 sendAmt) public {
        amt = bound(amt, 1, 1_000_000 ether);
        sendAmt = bound(sendAmt, 0, amt);
        vm.prank(owner);
        ledger.credit(alice, amt, bytes32("f"));
        vm.prank(alice);
        ledger.transfer(bob, sendAmt);
        uint256 fee = sendAmt * 200 / 10_000;
        assertEq(ledger.balanceOf(bob), sendAmt - fee);
        assertEq(ledger.balanceOf(SAFE), fee);
        assertEq(ledger.balanceOf(alice) + ledger.balanceOf(bob) + ledger.balanceOf(SAFE), ledger.totalSupply());
    }

    function testFuzz_dailyCapNeverExceeded(uint256 a, uint256 b) public {
        a = bound(a, 0, 2_000_000 ether);
        b = bound(b, 0, 2_000_000 ether);
        vm.startPrank(op);
        try ledger.credit(alice, a, bytes32("a")) {} catch {}
        try ledger.credit(bob, b, bytes32("b")) {} catch {}
        assertLe(ledger.totalSupply(), ledger.dailyCreditCap());
    }
}
