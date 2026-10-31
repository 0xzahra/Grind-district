// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {GrindTreasury} from "../src/GrindTreasury.sol";

/// @notice OWNER=<safe address> forge script script/DeployGrindTreasury.s.sol --rpc-url base --broadcast --account <keystore>
/// Not run by this repo. Review contracts/AUDIT.md first.
contract DeployGrindTreasury is Script {
    function run() external returns (GrindTreasury treasury) {
        address owner = vm.envAddress("OWNER");
        require(owner != address(0), "OWNER unset");
        require(owner.code.length > 0, "OWNER should be a deployed Safe");
        vm.startBroadcast();
        treasury = new GrindTreasury(owner);
        vm.stopBroadcast();
        console2.log("GrindTreasury", address(treasury), "owner", owner);
    }
}
