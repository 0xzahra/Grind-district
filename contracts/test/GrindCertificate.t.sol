// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {GrindCertificate} from "../src/GrindCertificate.sol";

contract Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

contract GrindCertificateTest is Test {
    GrindCertificate cert;
    address owner = address(0xA11CE);
    uint256 signerKey = 0x5157;
    address signer;
    address amina = address(0xA);
    address bob = address(0xB);

    function setUp() public {
        signer = vm.addr(signerKey);
        cert = new GrindCertificate(owner, signer, "https://www.grinddistrict.app/cert/");
        vm.warp(1_794_386_533); // 2026-11-11
    }

    function _v(address to, string memory course) internal view returns (GrindCertificate.Voucher memory v) {
        v = GrindCertificate.Voucher({
            to: to,
            courseId: course,
            courseTitle: "Spot trading",
            playerName: "Amina Bello",
            username: "amina",
            rank: "Dolphin",
            issuedAt: 1_794_386_533,
            issuedWat: "11 November 2026, 09:42 WAT",
            serial: "GD-RN02-9BHY",
            certId: "eyJ2IjoyLCJuIjoiQW1pbmEifQ",
            deadline: uint64(block.timestamp + 1 hours)
        });
    }

    function _sign(GrindCertificate.Voucher memory v, uint256 key) internal view returns (bytes memory) {
        (uint8 vv, bytes32 r, bytes32 s) = vm.sign(key, cert.hashVoucher(v));
        return abi.encodePacked(r, s, vv);
    }

    function test_mintStoresEveryFieldOnChain() public {
        GrindCertificate.Voucher memory v = _v(amina, "spot");
        vm.prank(bob); // anyone may submit (future gas sponsorship); token still goes to v.to
        uint256 id = cert.mint(v, _sign(v, signerKey));
        assertEq(id, 1);
        assertEq(cert.ownerOf(1), amina);
        GrindCertificate.Certificate memory c = cert.certificate(1);
        assertEq(c.courseId, "spot");
        assertEq(c.courseTitle, "Spot trading");
        assertEq(c.playerName, "Amina Bello");
        assertEq(c.username, "amina");
        assertEq(c.rank, "Dolphin");
        assertEq(c.issuedAt, 1_794_386_533);
        assertEq(c.issuedWat, "11 November 2026, 09:42 WAT");
        assertEq(c.serial, "GD-RN02-9BHY");
        assertEq(c.certId, "eyJ2IjoyLCJuIjoiQW1pbmEifQ");
        assertEq(c.mintedAt, block.timestamp);
        assertEq(cert.tokenOfKey(cert.keyOf("amina", "spot")), 1);
        assertTrue(cert.locked(1));
        assertEq(cert.name(), "Grind District Certificate");
        assertEq(cert.symbol(), "GDCERT");
    }

    function test_tokenURIIsOnChainJson() public {
        GrindCertificate.Voucher memory v = _v(amina, "spot");
        cert.mint(v, _sign(v, signerKey));
        string memory json = cert.tokenJSON(1);
        assertEq(cert.tokenURI(1), string.concat("data:application/json;base64,", Base64.encode(bytes(json))));
        // vm.parseJson validates the JSON and lets us read fields back.
        assertEq(vm.parseJsonString(json, ".name"), "Spot trading - Grind District Certificate");
        assertEq(vm.parseJsonString(json, ".image"), "https://www.grinddistrict.app/cert/eyJ2IjoyLCJuIjoiQW1pbmEifQ/image.png");
        assertEq(vm.parseJsonString(json, ".external_url"), "https://www.grinddistrict.app/cert/eyJ2IjoyLCJuIjoiQW1pbmEifQ");
        assertEq(vm.parseJsonString(json, ".attributes[0].value"), "Spot trading");
        assertEq(vm.parseJsonString(json, ".attributes[2].value"), "Amina Bello");
        assertEq(vm.parseJsonString(json, ".attributes[3].value"), "@amina");
        assertEq(vm.parseJsonString(json, ".attributes[6].value"), "2026-11-11T08:42:13Z");
        assertEq(vm.parseJsonString(json, ".attributes[10].value"), "Grind District");
        assertEq(vm.parseJsonString(json, ".attributes[11].value"), "Base");
    }

    function test_oneMintPerPlayerAndCourse() public {
        GrindCertificate.Voucher memory v = _v(amina, "spot");
        bytes memory sig = _sign(v, signerKey);
        cert.mint(v, sig);
        vm.expectRevert(abi.encodeWithSelector(GrindCertificate.AlreadyMinted.selector, 1));
        cert.mint(v, sig);
        // Same course to another wallet is still the same player+course: refused.
        GrindCertificate.Voucher memory v2 = _v(address(new Receiver()), "spot");
        bytes memory sig2 = _sign(v2, signerKey);
        vm.expectRevert(abi.encodeWithSelector(GrindCertificate.AlreadyMinted.selector, 1));
        cert.mint(v2, sig2);
        // A different course is fine.
        GrindCertificate.Voucher memory v3 = _v(amina, "risk");
        cert.mint(v3, _sign(v3, signerKey));
        assertEq(cert.totalSupply(), 2);
    }

    function test_rejectsWrongSignerTamperingAndExpiry() public {
        GrindCertificate.Voucher memory v = _v(amina, "spot");
        bytes memory bad = _sign(v, 0xBAD);
        vm.expectRevert(GrindCertificate.BadSignature.selector);
        cert.mint(v, bad);

        bytes memory sig = _sign(v, signerKey);
        v.playerName = "Someone Else";
        vm.expectRevert(GrindCertificate.BadSignature.selector);
        cert.mint(v, sig);

        GrindCertificate.Voucher memory e = _v(amina, "spot");
        bytes memory esig = _sign(e, signerKey);
        vm.warp(e.deadline + 1);
        vm.expectRevert(GrindCertificate.Expired.selector);
        cert.mint(e, esig);
    }

    function test_rejectsFieldsThatWouldBreakJson() public {
        GrindCertificate.Voucher memory v = _v(amina, "spot");
        v.playerName = 'Amina "x" Bello';
        bytes memory sig = _sign(v, signerKey);
        vm.expectRevert(GrindCertificate.BadField.selector);
        cert.mint(v, sig);
        v = _v(amina, "spot");
        v.username = "";
        sig = _sign(v, signerKey);
        vm.expectRevert(GrindCertificate.BadField.selector);
        cert.mint(v, sig);
    }

    function test_soulbound() public {
        GrindCertificate.Voucher memory v = _v(amina, "spot");
        cert.mint(v, _sign(v, signerKey));
        vm.startPrank(amina);
        vm.expectRevert(GrindCertificate.Soulbound.selector);
        cert.transferFrom(amina, bob, 1);
        vm.expectRevert(GrindCertificate.Soulbound.selector);
        cert.safeTransferFrom(amina, bob, 1);
        vm.expectRevert(GrindCertificate.Soulbound.selector);
        cert.approve(bob, 1);
        vm.expectRevert(GrindCertificate.Soulbound.selector);
        cert.setApprovalForAll(bob, true);
        vm.stopPrank();
        assertEq(cert.ownerOf(1), amina);
    }

    function test_interfaces() public view {
        assertTrue(cert.supportsInterface(0xb45a3c0e)); // ERC-5192
        assertTrue(cert.supportsInterface(0x80ac58cd)); // ERC-721
        assertTrue(cert.supportsInterface(0x5b5e139f)); // metadata
    }

    function test_adminOnlyOwner() public {
        vm.expectRevert();
        cert.setSigner(bob);
        vm.expectRevert();
        cert.setBaseURI("https://evil.example/");
        vm.prank(owner);
        cert.setSigner(bob);
        assertEq(cert.signer(), bob);
        // Old signer's vouchers stop working after rotation.
        GrindCertificate.Voucher memory v = _v(amina, "spot");
        bytes memory sig = _sign(v, signerKey);
        vm.expectRevert(GrindCertificate.BadSignature.selector);
        cert.mint(v, sig);
    }

    function test_iso() public {
        GrindCertificate.Voucher memory v = _v(amina, "spot");
        v.issuedAt = 951_782_400; // 2000-02-29T00:00:00Z
        cert.mint(v, _sign(v, signerKey));
        assertEq(cert.certificate(1).issuedAt, 951_782_400);
        assertEq(vm.parseJsonString(cert.tokenJSON(1), ".attributes[6].value"), "2000-02-29T00:00:00Z");
    }

    /// Same voucher/domain as tests/cert.check.ts: the server's viem signature must hash identically.
    function test_hashMatchesServer() public {
        vm.chainId(31337);
        address at = address(0xC0FFE);
        deployCodeTo("GrindCertificate.sol:GrindCertificate", abi.encode(owner, signer, "https://www.grinddistrict.app/cert/"), at);
        GrindCertificate c = GrindCertificate(at);
        GrindCertificate.Voucher memory v = GrindCertificate.Voucher({
            to: address(0xA), courseId: "spot", courseTitle: "Spot trading", playerName: "Amina Bello", username: "amina",
            rank: "Dolphin", issuedAt: 1794386533, issuedWat: "11 November 2026, 09:42 WAT", serial: "GD-RN02-9BHY",
            certId: "eyJ2IjoyLCJuIjoiQW1pbmEifQ", deadline: 1794390133
        });
        assertEq(c.hashVoucher(v), 0xcd16a44ecdc830e8789f80cf649350f88f6254025635caedefa35b6ec4d9daab);
    }
}
