// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {GrindCertificate} from "../src/GrindCertificate.sol";

/// NOT RUN. Deploy the soulbound certificate NFT (Base Sepolia first, then Base mainnet).
///   CERT_OWNER=<Safe or owner> CERT_SIGNER=<address of CERT_SIGNER_PRIVATE_KEY> \
///   forge script script/DeployGrindCertificate.s.sol --rpc-url $RPC --broadcast --account <deployer>
contract DeployGrindCertificate is Script {
    function run() external {
        address owner = vm.envAddress("CERT_OWNER");
        address signer = vm.envAddress("CERT_SIGNER");
        string memory base = vm.envOr("CERT_BASE_URI", string("https://www.grinddistrict.app/cert/"));
        vm.startBroadcast();
        GrindCertificate c = new GrindCertificate(owner, signer, base);
        vm.stopBroadcast();
        console.log("GrindCertificate", address(c));
    }
}
