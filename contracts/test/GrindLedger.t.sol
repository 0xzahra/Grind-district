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

    event TopUp(address indexed player, address indexed asset, uint256 amount, bytes32 indexed ref);

    function setUp() public {
        usdc = new MockUSDC();
        ledger = new GrindLedger(owner, SAFE, usdc);
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
}
