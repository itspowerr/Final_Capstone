const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GigEscrow Edge Cases & Security Tests", function () {
  let GigEscrow;
  let escrow;
  let owner;
  let client;
  let freelancer;
  let rando;

  const title = "Build Web3 App";
  const termsCID = "QmTermsCID1234567890";
  const totalAmount = ethers.parseEther("5.0"); // 5 ETH
  const deadline = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
  const milestoneDescriptions = ["Milestone 1", "Milestone 2", "Milestone 3"];
  const milestoneAmounts = [
    ethers.parseEther("1.0"),
    ethers.parseEther("2.0"),
    ethers.parseEther("2.0"),
  ];

  beforeEach(async function () {
    [owner, client, freelancer, rando] = await ethers.getSigners();
    GigEscrow = await ethers.getContractFactory("GigEscrow");
    escrow = await GigEscrow.deploy();
    await escrow.waitForDeployment();
  });

  describe("Dispute Lifecycle", function () {
    beforeEach(async function () {
      await escrow.connect(client).createContract(
        freelancer.address,
        title,
        termsCID,
        totalAmount,
        deadline,
        milestoneDescriptions,
        milestoneAmounts
      );
    });

    it("Should allow the client to raise a dispute when contract is Created", async function () {
      await expect(escrow.connect(client).raiseDispute(1))
        .to.emit(escrow, "DisputeRaised")
        .withArgs(1, client.address);

      const details = await escrow.getContractDetails(1);
      expect(details.status).to.equal(4); // Disputed
    });

    it("Should allow the freelancer to raise a dispute when contract is InProgress", async function () {
      await escrow.connect(client).fundContract(1, { value: totalAmount });

      await expect(escrow.connect(freelancer).raiseDispute(1))
        .to.emit(escrow, "DisputeRaised")
        .withArgs(1, freelancer.address);

      const details = await escrow.getContractDetails(1);
      expect(details.status).to.equal(4); // Disputed
    });

    it("Should fail if a non-party raises a dispute", async function () {
      await expect(escrow.connect(rando).raiseDispute(1)).to.be.revertedWith(
        "Not a contract party or owner"
      );
    });

    it("Should fail if trying to dispute a completed or cancelled contract", async function () {
      await escrow.connect(client).fundContract(1, { value: totalAmount });
      await escrow.connect(freelancer).submitMilestone(1, 0, "QmDeliv1");
      await escrow.connect(client).approveMilestone(1, 0);

      // Now complete it by approving remaining milestones (stubbed lifecycle)
      await escrow.connect(freelancer).submitMilestone(1, 1, "QmDeliv2");
      await escrow.connect(client).approveMilestone(1, 1);
      await escrow.connect(freelancer).submitMilestone(1, 2, "QmDeliv3");
      await escrow.connect(client).approveMilestone(1, 2);

      const details = await escrow.getContractDetails(1);
      expect(details.status).to.equal(2); // Completed

      await expect(escrow.connect(client).raiseDispute(1)).to.be.revertedWith(
        "Cannot dispute in current state"
      );
    });

    it("Should allow owner to resolve dispute in favor of freelancer (release remaining funds minus 2.5% fee)", async function () {
      await escrow.connect(client).fundContract(1, { value: totalAmount });
      await escrow.connect(client).raiseDispute(1);

      const contractBalance = await ethers.provider.getBalance(await escrow.getAddress());
      const expectedFee = (contractBalance * 250n) / 10000n; // 2.5% of total remaining
      const expectedPayout = contractBalance - expectedFee;

      const initialFreelancerBal = await ethers.provider.getBalance(freelancer.address);
      const initialOwnerBal = await ethers.provider.getBalance(owner.address);

      // Resolve in favor of freelancer
      const tx = await escrow.connect(owner).resolveDispute(1, true);
      await expect(tx)
        .to.emit(escrow, "DisputeResolved")
        .withArgs(1, freelancer.address);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const finalFreelancerBal = await ethers.provider.getBalance(freelancer.address);
      const finalOwnerBal = await ethers.provider.getBalance(owner.address);

      expect(finalFreelancerBal - initialFreelancerBal).to.equal(expectedPayout);
      expect(finalOwnerBal - initialOwnerBal + gasCost).to.equal(expectedFee);

      const details = await escrow.getContractDetails(1);
      expect(details.status).to.equal(2); // Completed
    });

    it("Should allow owner to resolve dispute in favor of client (refund entire remaining balance, 0 fee)", async function () {
      await escrow.connect(client).fundContract(1, { value: totalAmount });
      await escrow.connect(client).raiseDispute(1);

      const contractBalance = await ethers.provider.getBalance(await escrow.getAddress());
      const initialClientBal = await ethers.provider.getBalance(client.address);
      const initialOwnerBal = await ethers.provider.getBalance(owner.address);

      // Resolve in favor of client (refund)
      const tx = await escrow.connect(owner).resolveDispute(1, false);
      await expect(tx)
        .to.emit(escrow, "DisputeResolved")
        .withArgs(1, client.address);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const finalClientBal = await ethers.provider.getBalance(client.address);
      const finalOwnerBal = await ethers.provider.getBalance(owner.address);

      expect(finalClientBal - initialClientBal).to.equal(contractBalance);
      expect(finalOwnerBal - initialOwnerBal + gasCost).to.equal(0n); // No platform fee on refund

      const details = await escrow.getContractDetails(1);
      expect(details.status).to.equal(3); // Cancelled
    });

    it("Should fail if a non-owner attempts to resolve a dispute", async function () {
      await escrow.connect(client).fundContract(1, { value: totalAmount });
      await escrow.connect(client).raiseDispute(1);

      await expect(
        escrow.connect(client).resolveDispute(1, true)
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });

    it("Should fail if resolving a contract that is not in Dispute state", async function () {
      await expect(
        escrow.connect(owner).resolveDispute(1, true)
      ).to.be.revertedWith("Contract not in dispute");
    });
  });

  describe("Contract Cancellation", function () {
    beforeEach(async function () {
      await escrow.connect(client).createContract(
        freelancer.address,
        title,
        termsCID,
        totalAmount,
        deadline,
        milestoneDescriptions,
        milestoneAmounts
      );
    });

    it("Should allow the client to cancel the contract before it is funded", async function () {
      await expect(escrow.connect(client).cancelContract(1))
        .to.emit(escrow, "ContractCancelled")
        .withArgs(1);

      const details = await escrow.getContractDetails(1);
      expect(details.status).to.equal(3); // Cancelled
    });

    it("Should fail if a non-client attempts to cancel", async function () {
      await expect(escrow.connect(rando).cancelContract(1)).to.be.revertedWith(
        "Only client"
      );
    });

    it("Should fail if client attempts to cancel after it is funded", async function () {
      await escrow.connect(client).fundContract(1, { value: totalAmount });
      await expect(escrow.connect(client).cancelContract(1)).to.be.revertedWith(
        "Can only cancel before funding"
      );
    });
  });

  describe("Access Controls & Modifiers Validation", function () {
    it("Should fail if calling functions on non-existent contract IDs", async function () {
      await expect(
        escrow.connect(client).getContractDetails(999)
      ).to.be.revertedWith("Contract does not exist");

      await expect(
        escrow.connect(client).getMilestoneDetails(999, 0)
      ).to.be.revertedWith("Contract does not exist");

      await expect(
        escrow.connect(client).fundContract(999, { value: totalAmount })
      ).to.be.revertedWith("Contract does not exist");
    });
  });

  describe("Gas and Scale Limits", function () {
    it("Should support a contract with a large number of milestones", async function () {
      const numMilestones = 30;
      const descs = Array(numMilestones).fill("Iterative Milestone");
      const amounts = Array(numMilestones).fill(ethers.parseEther("0.1"));
      const total = ethers.parseEther("3.0"); // 30 * 0.1 = 3.0 ETH

      await expect(
        escrow.connect(client).createContract(
          freelancer.address,
          "Scale Test Project",
          "QmScale",
          total,
          deadline,
          descs,
          amounts
        )
      ).to.emit(escrow, "ContractCreated");

      const contractId = await escrow.contractCounter();
      const details = await escrow.getContractDetails(contractId);
      expect(details.milestoneCount).to.equal(numMilestones);
    });
  });
});
