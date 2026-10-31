// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {GrindLedger} from "../src/GrindLedger.sol";

/// Base Sepolia only:
///   forge script script/DeployGrindLedger.s.sol --rpc-url https://sepolia.base.org --broadcast --private-key $TEST_KEY
/// USDC on Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
contract DeployGrindLedger is Script {
    function run() external returns (GrindLedger ledger) {
        require(block.chainid == 84532, "Base Sepolia only");
        address treasury = 0x43985e56ac0c2CD9F95d4C1248cEB14E66Aa254a;
        IERC20 usdc = IERC20(0x036CbD53842c5426634e7929541eC2318f3dCF7e);
        vm.startBroadcast();
        ledger = new GrindLedger(msg.sender, treasury, usdc, address(0));
        vm.stopBroadcast();
    }
}
