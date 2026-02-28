// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ContentRegistry {
    struct ContentRecord {
        bytes32 contentHash;        // SHA-256 hash
        address owner;              // Content creator
        uint256 timestamp;          // block.timestamp
        uint8 authenticityScore;    // 0-100 (AI score)
        string contentType;         // 'text' | 'image' | 'video'
        string metadataURI;         // IPFS link (optional)
    }

    mapping(bytes32 => ContentRecord) public registry;
    mapping(bytes32 => bool) public registered;

    event ContentRegistered(
        bytes32 indexed contentHash,
        address indexed owner,
        uint8 authenticityScore,
        uint256 timestamp
    );

    function registerContent(
        bytes32 _hash,
        uint8 _score,
        string calldata _type,
        string calldata _uri
    ) external returns (bool) {
        require(!registered[_hash], "Already registered");
        require(_score <= 100, "Score max 100");

        registry[_hash] = ContentRecord({
            contentHash: _hash,
            owner: msg.sender,
            timestamp: block.timestamp,
            authenticityScore: _score,
            contentType: _type,
            metadataURI: _uri
        });
        registered[_hash] = true;

        emit ContentRegistered(_hash, msg.sender, _score, block.timestamp);
        return true;
    }

    function verify(
        bytes32 _hash
    ) external view returns (address owner, uint256 ts, uint8 score) {
        ContentRecord memory r = registry[_hash];
        return (r.owner, r.timestamp, r.authenticityScore);
    }
}
