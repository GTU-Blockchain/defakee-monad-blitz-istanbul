// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract DeFakeSocial {

    enum PostStatus { Pending, Authentic, Fake }

    struct Post {
        uint256 id;
        address author;
        string contentURI;      // IPFS or Arweave link for content payload
        bytes32 contentHash;    // SHA-256 string for verifying
        uint8 aiScore;          // Initial AI authenticity score
        bool isChallenged;
        PostStatus finalStatus;
        uint256 timestamp;
    }

    struct Challenge {
        uint256 postId;
        uint256 endTime;
        uint256 votesFake;
        uint256 votesAuthentic;
        bool resolved;
    }

    uint256 public postCounter;
    
    // Configurable
    uint256 public challengeDuration = 24 hours;
    uint256 public minimumStake = 0.01 ether; // Minimum MON required to vote or challenge

    mapping(uint256 => Post) public posts;
    mapping(uint256 => Challenge) public challenges;
    
    // Mapping from Post ID => Voter Address => Boolean (true = voted fake, false = voted authentic)
    mapping(uint256 => mapping(address => bool)) public userVoteDirection;
    // Mapping from Post ID => Voter Address => Amount Staked
    mapping(uint256 => mapping(address => uint256)) public userStakeAmount;
    
    // Prevent duplicate rewards claiming
    mapping(uint256 => mapping(address => bool)) public hasClaimedReward;

    event PostCreated(uint256 indexed postId, address indexed author, string contentURI, uint8 aiScore);
    event ChallengeInitiated(uint256 indexed postId, address challenger, uint256 endTime);
    event Voted(uint256 indexed postId, address voter, bool votedFake, uint256 amount);
    event ChallengeResolved(uint256 indexed postId, PostStatus status, uint256 totalFake, uint256 totalAuthentic);
    event RewardClaimed(uint256 indexed postId, address voter, uint256 reward);

    modifier postExists(uint256 _postId) {
        require(_postId > 0 && _postId <= postCounter, "Post does not exist");
        _;
    }

    //////////////////////////////////////////
    // CORE FUNCTIONS
    //////////////////////////////////////////

    function createPost(string calldata _contentURI, bytes32 _contentHash, uint8 _aiScore) external returns (uint256) {
        require(_aiScore <= 100, "Score max 100");
        postCounter++;
        uint256 newPostId = postCounter;

        posts[newPostId] = Post({
            id: newPostId,
            author: msg.sender,
            contentURI: _contentURI,
            contentHash: _contentHash,
            aiScore: _aiScore,
            isChallenged: false,
            finalStatus: PostStatus.Pending,
            timestamp: block.timestamp
        });

        emit PostCreated(newPostId, msg.sender, _contentURI, _aiScore);
        return newPostId;
    }

    // Initiate a challenge (counts as the first vote for "Fake")
    function challengePost(uint256 _postId) external payable postExists(_postId) {
        require(msg.value >= minimumStake, "Must stake minimum amount to challenge");
        Post storage post = posts[_postId];
        require(!post.isChallenged, "Already challenged");

        post.isChallenged = true;
        
        challenges[_postId] = Challenge({
            postId: _postId,
            endTime: block.timestamp + challengeDuration,
            votesFake: msg.value,
            votesAuthentic: 0,
            resolved: false
        });

        // Record the challenger's stake
        userVoteDirection[_postId][msg.sender] = true; // Challenging means voting Fake
        userStakeAmount[_postId][msg.sender] = msg.value;

        emit ChallengeInitiated(_postId, msg.sender, challenges[_postId].endTime);
        emit Voted(_postId, msg.sender, true, msg.value);
    }

    // Vote on an active challenge
    function vote(uint256 _postId, bool _voteFake) external payable postExists(_postId) {
        require(msg.value >= minimumStake, "Must stake minimum amount to vote");
        
        Post storage post = posts[_postId];
        require(post.isChallenged, "Post is not challenged");
        
        Challenge storage challenge = challenges[_postId];
        require(block.timestamp < challenge.endTime, "Voting period has ended");
        
        // Cannot vote twice
        require(userStakeAmount[_postId][msg.sender] == 0, "Already voted");

        if (_voteFake) {
            challenge.votesFake += msg.value;
        } else {
            challenge.votesAuthentic += msg.value;
        }

        userVoteDirection[_postId][msg.sender] = _voteFake;
        userStakeAmount[_postId][msg.sender] = msg.value;

        emit Voted(_postId, msg.sender, _voteFake, msg.value);
    }

    // Resolve after the voting period has ended
    function resolveChallenge(uint256 _postId) external postExists(_postId) {
        Post storage post = posts[_postId];
        require(post.isChallenged, "Not challenged");
        
        Challenge storage challenge = challenges[_postId];
        require(block.timestamp >= challenge.endTime, "Voting period still active");
        require(!challenge.resolved, "Already resolved");

        challenge.resolved = true;

        if (challenge.votesFake > challenge.votesAuthentic) {
            post.finalStatus = PostStatus.Fake;
        } else if (challenge.votesAuthentic > challenge.votesFake) {
            post.finalStatus = PostStatus.Authentic;
        } else {
            // Tie breaks towards Authentic
            post.finalStatus = PostStatus.Authentic;
        }

        emit ChallengeResolved(_postId, post.finalStatus, challenge.votesFake, challenge.votesAuthentic);
    }

    // Winners claim their original stake + proportional share of the losing pool
    function claimReward(uint256 _postId) external postExists(_postId) {
        Challenge storage challenge = challenges[_postId];
        require(challenge.resolved, "Challenge not resolved yet");
        require(!hasClaimedReward[_postId][msg.sender], "Reward already claimed");

        uint256 userStake = userStakeAmount[_postId][msg.sender];
        require(userStake > 0, "Did not participate");

        bool userVote = userVoteDirection[_postId][msg.sender];
        bool won = false;

        Post storage post = posts[_postId];
        
        if (post.finalStatus == PostStatus.Fake && userVote == true) {
            won = true;
        } else if (post.finalStatus == PostStatus.Authentic && userVote == false) {
            won = true;
        }

        require(won, "You voted on the losing side");

        uint256 reward = 0;
        
        // Calculate proportional reward
        if (post.finalStatus == PostStatus.Fake) {
            // Total pool = votesFake + votesAuthentic
            // User gets their fraction of the winning pool * total pool
            reward = (userStake * (challenge.votesFake + challenge.votesAuthentic)) / challenge.votesFake;
        } else {
            reward = (userStake * (challenge.votesFake + challenge.votesAuthentic)) / challenge.votesAuthentic;
        }

        hasClaimedReward[_postId][msg.sender] = true;
        
        (bool success, ) = msg.sender.call{value: reward}("");
        require(success, "Transfer failed");

        emit RewardClaimed(_postId, msg.sender, reward);
    }

    //////////////////////////////////////////
    // GETTERS
    //////////////////////////////////////////

    function getPost(uint256 _postId) external view returns (Post memory) {
        return posts[_postId];
    }

    function getChallenge(uint256 _postId) external view returns (Challenge memory) {
        return challenges[_postId];
    }
}
