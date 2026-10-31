// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {GrindLedger} from "../src/GrindLedger.sol";

/// Base mainnet. NOT run by this repo. Read contracts/AUDIT.md first.
///   OWNER=0x43985e56ac0c2CD9F95d4C1248cEB14E66Aa254a \
///   forge script script/DeployGrindLedgerMainnet.s.sol --rpc-url https://mainnet.base.org --account <keystore> --broadcast --verify
/// Dry run (no broadcast): drop --broadcast.
contract DeployGrindLedgerMainnet is Script {
    address internal constant SAFE = 0x43985e56ac0c2CD9F95d4C1248cEB14E66Aa254a;
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external returns (GrindLedger ledger) {
        require(block.chainid == 8453, "Base mainnet only");
        address owner = vm.envAddress("OWNER");
        require(owner == SAFE, "OWNER must be the Grind Safe");
        require(owner.code.length > 0, "OWNER must be a deployed Safe");
        require(BASE_USDC.code.length > 0, "USDC missing");
        vm.startBroadcast();
        ledger = new GrindLedger(owner, SAFE, IERC20(BASE_USDC));
        vm.stopBroadcast();
        console2.log("GrindLedger", address(ledger), "owner", owner);
    }
}
