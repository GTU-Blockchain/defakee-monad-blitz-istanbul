import { expect } from "chai";
import { ethers } from "hardhat";

describe("DeFakeSocial", function () {
    async function deployDeFakeFixture() {
        const [owner, addr1, addr2, addr3] = await ethers.getSigners();
        const DeFakeSocial = await ethers.getContractFactory("DeFakeSocial");
        const defake = await DeFakeSocial.deploy();
        return { defake, owner, addr1, addr2, addr3 };
    }

    describe("Deployment", function () {
        it("Should start with 0 posts", async function () {
            const { defake } = await deployDeFakeFixture();
            expect(await defake.postCounter()).to.equal(0);
        });
    });

    describe("Posting", function () {
        it("Should allow creating a post", async function () {
            const { defake, addr1 } = await deployDeFakeFixture();
            const contentURI = "ipfs://QmTest";
            const hash = ethers.keccak256(ethers.toUtf8Bytes("test content"));
            const aiScore = 85;

            await expect(defake.connect(addr1).createPost(contentURI, hash, aiScore))
                .to.emit(defake, "PostCreated")
                .withArgs(1, addr1.address, contentURI, aiScore);

            const post = await defake.posts(1);
            expect(post.author).to.equal(addr1.address);
            expect(post.aiScore).to.equal(85);
            expect(post.isChallenged).to.be.false;
            expect(post.finalStatus).to.equal(0); // Pending
        });
    });

    describe("Challenging & Voting", function () {
        it("Should allow challenging a post", async function () {
            const { defake, addr1, addr2 } = await deployDeFakeFixture();
            const hash = ethers.keccak256(ethers.toUtf8Bytes("test"));
            await defake.connect(addr1).createPost("ipfs://", hash, 40);

            const stake = ethers.parseEther("0.1");

            await expect(defake.connect(addr2).challengePost(1, { value: stake }))
                .to.emit(defake, "ChallengeInitiated")
                .to.emit(defake, "Voted")
                .withArgs(1, addr2.address, true, stake);

            const challenge = await defake.challenges(1);
            expect(challenge.votesFake).to.equal(stake);
            const post = await defake.posts(1);
            expect(post.isChallenged).to.be.true;
        });

        it("Should allow others to vote", async function () {
            const { defake, addr1, addr2, addr3 } = await deployDeFakeFixture();
            const hash = ethers.keccak256(ethers.toUtf8Bytes("test"));
            await defake.connect(addr1).createPost("ipfs://", hash, 40);

            const stake = ethers.parseEther("0.1");
            await defake.connect(addr2).challengePost(1, { value: stake });

            // Addr3 votes Authentic (false)
            const voteStake = ethers.parseEther("0.2");
            await expect(defake.connect(addr3).vote(1, false, { value: voteStake }))
                .to.emit(defake, "Voted")
                .withArgs(1, addr3.address, false, voteStake);

            const challenge = await defake.challenges(1);
            expect(challenge.votesAuthentic).to.equal(voteStake);
        });
    });
});
