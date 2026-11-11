// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title GrindCertificate
/// @notice Soulbound (non-transferable) practice certificates for Grind District courses on Base.
///         A certificate says a player passed a course in the game. It is a practice credential,
///         not an accredited qualification, carries no money value and cannot be redeemed.
/// @dev    Minting needs an EIP-712 voucher signed by the game server (`signer`). The server signs only
///         when the signed-in player's synced save shows the course passed. Every identity field is
///         stored on-chain and tokenURI() is built on-chain (data: JSON); only the image is served from
///         `baseURI` + certId + "/image.png". One certificate per (username, courseId).
///         Implements ERC-5192 (minimal soulbound) and ERC-4906 (metadata update events).
contract GrindCertificate is ERC721, EIP712, Ownable2Step {
    using Strings for uint256;

    struct Voucher {
        address to;
        string courseId;
        string courseTitle;
        string playerName;
        string username;
        string rank;
        uint64 issuedAt; // unix seconds
        string issuedWat; // e.g. "11 November 2026, 09:42 WAT"
        string serial; // e.g. "GD-7F3K-9Q2M"
        string certId; // game certificate id (base64url), also the public page path
        uint64 deadline; // voucher expiry, unix seconds
    }

    struct Certificate {
        string courseId;
        string courseTitle;
        string playerName;
        string username;
        string rank;
        uint64 issuedAt;
        uint64 mintedAt;
        string issuedWat;
        string serial;
        string certId;
    }

    bytes32 public constant VOUCHER_TYPEHASH = keccak256(
        "Voucher(address to,string courseId,string courseTitle,string playerName,string username,string rank,uint64 issuedAt,string issuedWat,string serial,string certId,uint64 deadline)"
    );
    string public constant ISSUER = "Grind District";
    string public constant CREDENTIAL =
        "Practice credential, earned by passing the course in Grind District. Not an accredited qualification.";

    address public signer;
    /// @notice Prefix for the public certificate page and image, e.g. https://www.grinddistrict.app/cert/
    string public baseURI;
    uint256 public totalSupply;

    mapping(uint256 => Certificate) private _certs;
    /// @notice keccak256(abi.encode(username, courseId)) => tokenId (0 = not minted).
    mapping(bytes32 => uint256) public tokenOfKey;

    event Locked(uint256 tokenId); // ERC-5192
    event BatchMetadataUpdate(uint256 fromTokenId, uint256 toTokenId); // ERC-4906
    event CertificateMinted(
        uint256 indexed tokenId, address indexed to, bytes32 indexed key, string courseId, string username, string serial
    );
    event SignerSet(address signer);
    event BaseURISet(string baseURI);

    error Soulbound();
    error AlreadyMinted(uint256 tokenId);
    error BadSignature();
    error Expired();
    error BadField();
    error ZeroAddress();

    constructor(address owner_, address signer_, string memory baseURI_)
        ERC721("Grind District Certificate", "GDCERT")
        EIP712("Grind District Certificate", "1")
        Ownable(owner_)
    {
        if (signer_ == address(0)) revert ZeroAddress();
        signer = signer_;
        baseURI = baseURI_;
        emit SignerSet(signer_);
        emit BaseURISet(baseURI_);
    }

    // ------------------------------------------------------------------ mint

    function hashVoucher(Voucher calldata v) public view returns (bytes32) {
        bytes memory a = abi.encode(
            VOUCHER_TYPEHASH,
            v.to,
            keccak256(bytes(v.courseId)),
            keccak256(bytes(v.courseTitle)),
            keccak256(bytes(v.playerName)),
            keccak256(bytes(v.username))
        );
        bytes memory b = abi.encode(
            keccak256(bytes(v.rank)),
            v.issuedAt,
            keccak256(bytes(v.issuedWat)),
            keccak256(bytes(v.serial)),
            keccak256(bytes(v.certId)),
            v.deadline
        );
        return _hashTypedDataV4(keccak256(bytes.concat(a, b)));
    }

    function keyOf(string memory username, string memory courseId) public pure returns (bytes32) {
        return keccak256(abi.encode(username, courseId));
    }

    /// @notice Mint a certificate with a server voucher. Anyone may submit it (so gas can be sponsored
    ///         later); the token always goes to `v.to`.
    function mint(Voucher calldata v, bytes calldata signature) external returns (uint256 tokenId) {
        if (v.to == address(0)) revert ZeroAddress();
        if (block.timestamp > v.deadline) revert Expired();
        _check(v.courseId, 1, 32);
        _check(v.courseTitle, 1, 160);
        _check(v.playerName, 0, 120);
        _check(v.username, 1, 16);
        _check(v.rank, 0, 48);
        _check(v.issuedWat, 0, 64);
        _check(v.serial, 1, 24);
        _check(v.certId, 1, 640);
        if (ECDSA.recover(hashVoucher(v), signature) != signer) revert BadSignature();
        bytes32 key = keyOf(v.username, v.courseId);
        if (tokenOfKey[key] != 0) revert AlreadyMinted(tokenOfKey[key]);

        tokenId = ++totalSupply;
        tokenOfKey[key] = tokenId;
        _certs[tokenId] = Certificate({
            courseId: v.courseId,
            courseTitle: v.courseTitle,
            playerName: v.playerName,
            username: v.username,
            rank: v.rank,
            issuedAt: v.issuedAt,
            mintedAt: uint64(block.timestamp),
            issuedWat: v.issuedWat,
            serial: v.serial,
            certId: v.certId
        });
        _safeMint(v.to, tokenId);
        emit Locked(tokenId);
        emit CertificateMinted(tokenId, v.to, key, v.courseId, v.username, v.serial);
    }

    /// @dev Printable ASCII/UTF-8 only, no quote or backslash, so the on-chain JSON is always valid.
    function _check(string calldata s, uint256 minLen, uint256 maxLen) private pure {
        bytes calldata b = bytes(s);
        if (b.length < minLen || b.length > maxLen) revert BadField();
        for (uint256 i; i < b.length; ++i) {
            bytes1 c = b[i];
            if (c < 0x20 || c == 0x22 || c == 0x5c || c == 0x7f) revert BadField();
        }
    }

    // ------------------------------------------------------------------ read

    function certificate(uint256 tokenId) external view returns (Certificate memory) {
        _requireOwned(tokenId);
        return _certs[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        return string.concat("data:application/json;base64,", Base64.encode(bytes(tokenJSON(tokenId))));
    }

    /// @notice The same metadata as tokenURI(), as plain JSON.
    function tokenJSON(uint256 tokenId) public view returns (string memory) {
        _requireOwned(tokenId);
        Certificate storage c = _certs[tokenId];
        string memory page = string.concat(baseURI, c.certId);
        string memory json = string.concat(
            '{"name":"',
            c.courseTitle,
            ' - Grind District Certificate","description":"',
            _description(c),
            '","image":"',
            page,
            '/image.png","external_url":"',
            page,
            '","attributes":',
            _attributes(c),
            "}"
        );
        return json;
    }

    function _description(Certificate storage c) private view returns (string memory) {
        return string.concat(
            bytes(c.playerName).length > 0 ? c.playerName : "A player",
            " (@",
            c.username,
            ") passed the ",
            c.courseTitle,
            " course in Grind District. ",
            CREDENTIAL,
            " Non-transferable; no money value."
        );
    }

    function _trait(string memory k, string memory v) private pure returns (string memory) {
        return string.concat('{"trait_type":"', k, '","value":"', v, '"}');
    }

    function _attributes(Certificate storage c) private view returns (string memory) {
        string memory a = string.concat(
            "[",
            _trait("Course", c.courseTitle),
            ",",
            _trait("Course ID", c.courseId),
            ",",
            _trait("Player", c.playerName),
            ",",
            _trait("Username", string.concat("@", c.username)),
            ",",
            _trait("Rank at issue", c.rank),
            ","
        );
        string memory b = string.concat(
            _trait("Issued (WAT)", c.issuedWat),
            ",",
            _trait("Issued (ISO-8601 UTC)", _iso(c.issuedAt)),
            ',{"trait_type":"Issued at","display_type":"date","value":',
            uint256(c.issuedAt).toString(),
            "},",
            _trait("Certificate ID", c.certId),
            ",",
            _trait("Serial", c.serial),
            ","
        );
        string memory d = string.concat(
            _trait("Issuer", ISSUER),
            ",",
            _trait("Chain", "Base"),
            ",",
            _trait("Credential type", "Practice credential (not accredited)"),
            ",",
            _trait("Transferable", "No (soulbound)"),
            "]"
        );
        return string.concat(a, b, d);
    }

    /// @dev Unix seconds -> "YYYY-MM-DDTHH:MM:SSZ" (civil-from-days, Howard Hinnant).
    function _iso(uint64 ts) internal pure returns (string memory) {
        uint256 t = ts;
        uint256 z = t / 86400 + 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        uint256 day = doy - (153 * mp + 2) / 5 + 1;
        uint256 month = mp < 10 ? mp + 3 : mp - 9;
        uint256 year = yoe + era * 400 + (month <= 2 ? 1 : 0);
        uint256 s = t % 86400;
        return string.concat(
            year.toString(), "-", _2(month), "-", _2(day), "T", _2(s / 3600), ":", _2((s % 3600) / 60), ":", _2(s % 60), "Z"
        );
    }

    function _2(uint256 n) private pure returns (string memory) {
        return n < 10 ? string.concat("0", n.toString()) : n.toString();
    }

    /// @notice ERC-5192: every certificate is locked to its wallet.
    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function supportsInterface(bytes4 id) public view override returns (bool) {
        return id == 0xb45a3c0e /* ERC-5192 */ || id == 0x49064906 /* ERC-4906 */ || super.supportsInterface(id);
    }

    // ------------------------------------------------------------------ soulbound

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    // ------------------------------------------------------------------ admin

    function setSigner(address s) external onlyOwner {
        if (s == address(0)) revert ZeroAddress();
        signer = s;
        emit SignerSet(s);
    }

    /// @notice Only moves where the image/page is served. Stored certificate fields never change.
    function setBaseURI(string calldata u) external onlyOwner {
        baseURI = u;
        emit BaseURISet(u);
        if (totalSupply > 0) emit BatchMetadataUpdate(1, totalSupply);
    }
}
