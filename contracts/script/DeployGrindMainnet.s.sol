// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {GrindLedger} from "../src/GrindLedger.sol";
import {GrindTreasury} from "../src/GrindTreasury.sol";

/// Base mainnet: deploys GrindTreasury(owner=Safe) and GrindLedger(owner=Safe, treasury=Safe, USDC, operator).
contract DeployGrindMainnet is Script {
    address internal constant SAFE = 0x43985e56ac0c2CD9F95d4C1248cEB14E66Aa254a;
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant OPERATOR = 0xD10254315501FDe0FE240e3EC0420fAB0C97eE61;

    function run() external returns (GrindTreasury vault, GrindLedger ledger) {
        require(block.chainid == 8453, "Base mainnet only");
        require(SAFE.code.length > 0, "Safe missing");
        require(BASE_USDC.code.length > 0, "USDC missing");
        vm.startBroadcast();
        vault = new GrindTreasury(SAFE);
        ledger = new GrindLedger(SAFE, SAFE, IERC20(BASE_USDC), OPERATOR);
        vm.stopBroadcast();
        require(vault.owner() == SAFE && ledger.owner() == SAFE && ledger.treasury() == SAFE, "post");
        require(address(ledger.usdc()) == BASE_USDC && ledger.isOperator(OPERATOR), "post2");
        console2.log("GrindTreasury", address(vault));
        console2.log("GrindLedger", address(ledger));
    }
}
