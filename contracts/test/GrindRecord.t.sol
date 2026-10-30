// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {GrindRecord} from "../src/GrindRecord.sol";

contract GrindRecordTest is Test {
    GrindRecord internal record;
    address internal owner = makeAddr("owner");
    address internal attestor = makeAddr("attestor");
    address internal player = makeAddr("player");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        record = new GrindRecord(owner, attestor);
    }

    function test_rankCutsMatchTheCity() public view {
        assertEq(record.rankFor(0), 0);
        assertEq(record.rankFor(69), 0);
        assertEq(record.rankFor(70), 1);
        assertEq(record.rankFor(209), 1);
        assertEq(record.rankFor(210), 2);
        assertEq(record.rankFor(419), 2);
        assertEq(record.rankFor(420), 3);
        assertEq(record.rankFor(699), 3);
        assertEq(record.rankFor(700), 4);
        assertEq(record.rankFor(1099), 4);
        assertEq(record.rankFor(1100), 5);
    }

    function test_onlyAttestorFilesACourse() public {
        vm.prank(stranger);
        vm.expectRevert(GrindRecord.NotAttestor.selector);
        record.fileCourse(player, 0, 5);

        vm.prank(attestor);
        record.fileCourse(player, 0, 5);
        (uint256 xp,, uint8 courses) = record.recordOf(player);
        assertEq(xp, 75);
        assertEq(courses, 1);
        assertEq(record.rankOf(player), 1);
    }

    function test_courseFilesOnce() public {
        vm.startPrank(attestor);
        record.fileCourse(player, 0, 0);
        vm.expectRevert(GrindRecord.CourseAlreadyFiled.selector);
        record.fileCourse(player, 0, 25);
        vm.stopPrank();
        (uint256 xp,,) = record.recordOf(player);
        assertEq(xp, 70);
    }

    function test_bonusCapAndUnknownCourse() public {
        vm.startPrank(attestor);
        vm.expectRevert(GrindRecord.BonusTooLarge.selector);
        record.fileCourse(player, 1, 26);
        vm.expectRevert(GrindRecord.UnknownCourse.selector);
        record.fileCourse(player, 8, 0);
        vm.stopPrank();
        (uint256 xp,,) = record.recordOf(player);
        assertEq(xp, 0);
    }

    function test_reputationDoesNotMoveRank() public {
        vm.prank(attestor);
        record.noteReputation(player, 25);
        (uint256 xp, uint256 reputation,) = record.recordOf(player);
        assertEq(xp, 0);
        assertEq(reputation, 25);
        assertEq(record.rankOf(player), 0);

        vm.prank(attestor);
        vm.expectRevert(GrindRecord.ReputationStepTooLarge.selector);
        record.noteReputation(player, 26);
    }

    function test_pauseBlocksAttestation() public {
        vm.prank(owner);
        record.setPaused(true);
        vm.prank(attestor);
        vm.expectRevert(GrindRecord.Paused.selector);
        record.fileCourse(player, 2, 0);
    }

    function test_ownershipIsTwoStep() public {
        address next = makeAddr("next");
        vm.prank(stranger);
        vm.expectRevert(GrindRecord.NotOwner.selector);
        record.transferOwnership(next);

        vm.prank(owner);
        record.transferOwnership(next);
        assertEq(record.owner(), owner);

        vm.prank(next);
        record.acceptOwnership();
        assertEq(record.owner(), next);
        assertEq(record.pendingOwner(), address(0));
    }

    function test_contractRejectsEther() public {
        vm.deal(address(this), 1 ether);
        (bool ok, bytes memory data) = address(record).call{value: 1 ether}("");
        assertFalse(ok);
        assertEq(data, abi.encodeWithSelector(GrindRecord.FundsNotAccepted.selector));
        assertEq(address(record).balance, 0);
    }

    function test_fullCardIsSharkAndStillHasNoLedger() public {
        vm.startPrank(attestor);
        for (uint8 course = 0; course < 8; course++) {
            record.fileCourse(player, course, 25);
        }
        vm.stopPrank();
        (uint256 xp,, uint8 courses) = record.recordOf(player);
        assertEq(xp, 8 * (70 + 25));
        assertEq(courses, 255);
        assertEq(record.rankOf(player), 4);
        assertEq(record.rankFor(xp), 4);
    }

    function test_ownerCannotFileOrNote() public {
        vm.startPrank(owner);
        vm.expectRevert(GrindRecord.NotAttestor.selector);
        record.fileCourse(player, 0, 0);
        vm.expectRevert(GrindRecord.NotAttestor.selector);
        record.noteReputation(player, 1);
        vm.stopPrank();
    }

    function test_constructorRejectsZero() public {
        vm.expectRevert(GrindRecord.ZeroAddress.selector);
        new GrindRecord(address(0), attestor);
        vm.expectRevert(GrindRecord.ZeroAddress.selector);
        new GrindRecord(owner, address(0));
    }

    function test_courseBitsAndOutOfRangeView() public {
        assertFalse(record.courseFiled(player, 3));
        assertFalse(record.courseFiled(player, 8));
        vm.prank(attestor);
        record.fileCourse(player, 3, 0);
        assertTrue(record.courseFiled(player, 3));
        assertFalse(record.courseFiled(player, 4));
        (, , uint8 courses) = record.recordOf(player);
        assertEq(courses, 8);
    }

    function test_reputationZeroAndEmptyPlayerRevert() public {
        vm.startPrank(attestor);
        vm.expectRevert(GrindRecord.ReputationStepTooLarge.selector);
        record.noteReputation(player, 0);
        vm.expectRevert(GrindRecord.ZeroAddress.selector);
        record.noteReputation(address(0), 1);
        vm.expectRevert(GrindRecord.ZeroAddress.selector);
        record.fileCourse(address(0), 0, 0);
        vm.stopPrank();
        (uint256 xp, uint256 reputation,) = record.recordOf(player);
        assertEq(xp, 0);
        assertEq(reputation, 0);
    }

    function test_pauseBlocksReputationAndStrangerCannotRotateAttestor() public {
        vm.prank(owner);
        record.setPaused(true);
        vm.prank(attestor);
        vm.expectRevert(GrindRecord.Paused.selector);
        record.noteReputation(player, 1);

        vm.prank(stranger);
        vm.expectRevert(GrindRecord.NotOwner.selector);
        record.setAttestor(stranger);

        vm.prank(owner);
        vm.expectRevert(GrindRecord.ZeroAddress.selector);
        record.setAttestor(address(0));
    }

    function test_strangerCannotAcceptOwnership() public {
        vm.prank(owner);
        record.transferOwnership(makeAddr("next"));
        vm.prank(stranger);
        vm.expectRevert(GrindRecord.NotPendingOwner.selector);
        record.acceptOwnership();
        assertEq(record.owner(), owner);
    }

    function test_fallbackRejectsCalldata() public {
        vm.deal(address(this), 1 ether);
        (bool ok, bytes memory data) = address(record).call{value: 1 ether}(hex"1234");
        assertFalse(ok);
        assertEq(data, abi.encodeWithSelector(GrindRecord.FundsNotAccepted.selector));
        assertEq(address(record).balance, 0);
    }
}
