const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GigEscrow Functional Tests", function () {
  let GigEscrow;
  let escrow;
  let owner;
  let client;
  let freelancer;
  let rando;

  const title = "Build Web3 App";
  const termsCID = "QmTermsCID1234567890";
  const totalAmount = ethers.parseEther("2.0"); // 2 ETH
  const deadline = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
  const milestoneDescriptions = ["Setup & Architecture", "Core API Integration"];
  const milestoneAmounts = [ethers.parseEther("0.8"), ethers.parseEther("1.2")];

  beforeEach(async function () {
    [owner, client, freelancer, rando] = await ethers.getSigners();
    GigEscrow = await ethers.getContractFactory("GigEscrow");
    escrow = await GigEscrow.deploy();
    await escrow.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct platform fee BPS", async function () {
      expect(await escrow.PLATFORM_FEE_BPS()).to.equal(250); // 2.5%
    });

    it("Should set the correct owner", async function () {
      expect(await escrow.owner()).to.equal(owner.address);
    });

    it("Should start with a contract counter of 0", async function () {
      expect(await escrow.contractCounter()).to.equal(0);
    });
  });

  describe("Contract Creation", function () {
    it("Should successfully create a contract and emit ContractCreated", async function () {
      await expect(
        escrow.connect(client).createContract(
          freelancer.address,
          title,
          termsCID,
          totalAmount,
          deadline,
          milestoneDescriptions,
          milestoneAmounts
        )
      )
        .to.emit(escrow, "ContractCreated")
        .withArgs(1, client.address, freelancer.address, totalAmount);

      expect(await escrow.contractCounter()).to.equal(1);
      expect(await escrow.contractExists(1)).to.be.true;

      const details = await escrow.getContractDetails(1);
      expect(details.client).to.equal(client.address);
      expect(details.freelancer).to.equal(freelancer.address);
      expect(details.title).to.equal(title);
      expect(details.termsCID).to.equal(termsCID);
      expect(details.totalAmount).to.equal(totalAmount);
      expect(details.deadline).to.equal(deadline);
      expect(details.status).to.equal(0); // Created
      expect(details.milestoneCount).to.equal(2);
      expect(details.completedMilestones).to.equal(0);
    });

    it("Should fail if client tries to contract themselves", async function () {
      await expect(
        escrow.connect(client).createContract(
          client.address,
          title,
          termsCID,
          totalAmount,
          deadline,
          milestoneDescriptions,
          milestoneAmounts
        )
      ).to.be.revertedWith("Cannot contract yourself");
    });

    it("Should fail if milestone descriptions are empty", async function () {
      await expect(
        escrow.connect(client).createContract(
          freelancer.address,
          title,
          termsCID,
          totalAmount,
          deadline,
          [],
          []
        )
      ).to.be.revertedWith("Need at least 1 milestone");
    });

    it("Should fail if milestone descriptions and amounts length mismatch", async function () {
      await expect(
        escrow.connect(client).createContract(
          freelancer.address,
          title,
          termsCID,
          totalAmount,
          deadline,
          ["One milestone"],
          [ethers.parseEther("1.0"), ethers.parseEther("1.0")]
        )
      ).to.be.revertedWith("Arrays length mismatch");
    });

    it("Should fail if milestone amounts do not sum to totalAmount", async function () {
      await expect(
        escrow.connect(client).createContract(
          freelancer.address,
          title,
          termsCID,
          totalAmount,
          deadline,
          milestoneDescriptions,
          [ethers.parseEther("0.8"), ethers.parseEther("1.0")] // Sum is 1.8 ETH, total is 2.0 ETH
        )
      ).to.be.revertedWith("Milestone amounts must sum to total");
    });
  });

  describe("Set Freelancer", function () {
    beforeEach(async function () {
      // Create contract with address(0) as freelancer
      await escrow.connect(client).createContract(
        ethers.ZeroAddress,
        title,
        termsCID,
        totalAmount,
        deadline,
        milestoneDescriptions,
        milestoneAmounts
      );
    });

    it("Should allow the client to set a freelancer", async function () {
      await expect(escrow.connect(client).setFreelancer(1, freelancer.address))
        .to.emit(escrow, "FreelancerSet")
        .withArgs(1, freelancer.address);

      const details = await escrow.getContractDetails(1);
      expect(details.freelancer).to.equal(freelancer.address);
    });

    it("Should fail if a non-client tries to set the freelancer", async function () {
      await expect(
        escrow.connect(rando).setFreelancer(1, freelancer.address)
      ).to.be.revertedWith("Only client");
    });

    it("Should fail if the freelancer address is zero address", async function () {
      await expect(
        escrow.connect(client).setFreelancer(1, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid freelancer address");
    });

    it("Should fail if the client tries to set themselves as freelancer", async function () {
      await expect(
        escrow.connect(client).setFreelancer(1, client.address)
      ).to.be.revertedWith("Cannot set yourself");
    });

    it("Should fail if a freelancer has already been set", async function () {
      await escrow.connect(client).setFreelancer(1, freelancer.address);
      await expect(
        escrow.connect(client).setFreelancer(1, rando.address)
      ).to.be.revertedWith("Freelancer already set");
    });
  });

  describe("Funding", function () {
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

    it("Should transition status and milestones to Funded on exact payment", async function () {
      await expect(escrow.connect(client).fundContract(1, { value: totalAmount }))
        .to.not.be.reverted;

      const details = await escrow.getContractDetails(1);
      expect(details.status).to.equal(1); // InProgress

      const m0 = await escrow.getMilestoneDetails(1, 0);
      const m1 = await escrow.getMilestoneDetails(1, 1);
      expect(m0.status).to.equal(1); // Funded
      expect(m1.status).to.equal(1); // Funded

      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(totalAmount);
    });

    it("Should fail if non-client attempts to fund", async function () {
      await expect(
        escrow.connect(rando).fundContract(1, { value: totalAmount })
      ).to.be.revertedWith("Only client");
    });

    it("Should fail if funding amount is incorrect", async function () {
      await expect(
        escrow.connect(client).fundContract(1, { value: ethers.parseEther("1.0") })
      ).to.be.revertedWith("Incorrect funding amount");
    });

    it("Should fail if contract is not in Created state", async function () {
      await escrow.connect(client).fundContract(1, { value: totalAmount });
      await expect(
        escrow.connect(client).fundContract(1, { value: totalAmount })
      ).to.be.revertedWith("Contract not in created state");
    });
  });

  describe("Milestone Submission", function () {
    const deliverableCID = "QmDeliverable123";

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

    it("Should transition milestone status to Submitted on valid call", async function () {
      await escrow.connect(client).fundContract(1, { value: totalAmount });

      await expect(escrow.connect(freelancer).submitMilestone(1, 0, deliverableCID))
        .to.emit(escrow, "MilestoneSubmitted")
        .withArgs(1, 0, deliverableCID);

      const m0 = await escrow.getMilestoneDetails(1, 0);
      expect(m0.status).to.equal(2); // Submitted
      expect(m0.deliverableCID).to.equal(deliverableCID);
      expect(m0.submittedAt).to.be.gt(0);
    });

    it("Should fail if contract is not funded/InProgress", async function () {
      await expect(
        escrow.connect(freelancer).submitMilestone(1, 0, deliverableCID)
      ).to.be.revertedWith("Contract not in progress");
    });

    it("Should fail if a non-freelancer submits", async function () {
      await escrow.connect(client).fundContract(1, { value: totalAmount });
      await expect(
        escrow.connect(rando).submitMilestone(1, 0, deliverableCID)
      ).to.be.revertedWith("Only freelancer");
    });

    it("Should fail if milestone index is invalid", async function () {
      await escrow.connect(client).fundContract(1, { value: totalAmount });
      await expect(
        escrow.connect(freelancer).submitMilestone(1, 2, deliverableCID)
      ).to.be.revertedWith("Invalid milestone index");
    });

    it("Should fail if milestone is not Funded (e.g. already submitted)", async function () {
      await escrow.connect(client).fundContract(1, { value: totalAmount });
      await escrow.connect(freelancer).submitMilestone(1, 0, deliverableCID);
      await expect(
        escrow.connect(freelancer).submitMilestone(1, 0, deliverableCID)
      ).to.be.revertedWith("Milestone not ready for submission");
    });

    it("Should fail if deliverable CID is empty", async function () {
      await escrow.connect(client).fundContract(1, { value: totalAmount });
      await expect(
        escrow.connect(freelancer).submitMilestone(1, 0, "")
      ).to.be.revertedWith("Deliverable CID required");
    });
  });

  describe("Milestone Approval & Payment Release", function () {
    const deliverableCID = "QmDeliverable123";

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
      await escrow.connect(client).fundContract(1, { value: totalAmount });
      await escrow.connect(freelancer).submitMilestone(1, 0, deliverableCID);
    });

    it("Should release 97.5% to freelancer and 2.5% to platform owner on approval", async function () {
      const initialFreelancerBal = await ethers.provider.getBalance(freelancer.address);
      const initialOwnerBal = await ethers.provider.getBalance(owner.address);

      const milestoneAmount = milestoneAmounts[0];
      const expectedFee = (milestoneAmount * 250n) / 10000n; // 2.5%
      const expectedPayout = milestoneAmount - expectedFee;

      await expect(escrow.connect(client).approveMilestone(1, 0))
        .to.emit(escrow, "MilestoneApproved")
        .withArgs(1, 0, expectedPayout);

      const finalFreelancerBal = await ethers.provider.getBalance(freelancer.address);
      const finalOwnerBal = await ethers.provider.getBalance(owner.address);

      expect(finalFreelancerBal - initialFreelancerBal).to.equal(expectedPayout);
      expect(finalOwnerBal - initialOwnerBal).to.equal(expectedFee);

      const m0 = await escrow.getMilestoneDetails(1, 0);
      expect(m0.status).to.equal(3); // Approved
      expect(m0.approvedAt).to.be.gt(0);

      const details = await escrow.getContractDetails(1);
      expect(details.completedMilestones).to.equal(1);
      expect(details.status).to.equal(1); // Still InProgress
    });

    it("Should auto-complete contract once all milestones are approved", async function () {
      await escrow.connect(client).approveMilestone(1, 0);

      // Submit and approve final milestone
      await escrow.connect(freelancer).submitMilestone(1, 1, "QmDeliverable2");

      await expect(escrow.connect(client).approveMilestone(1, 1))
        .to.emit(escrow, "ContractCompleted")
        .withArgs(1);

      const details = await escrow.getContractDetails(1);
      expect(details.status).to.equal(2); // Completed
      expect(details.completedMilestones).to.equal(2);
    });

    it("Should fail if a non-client approves", async function () {
      await expect(
        escrow.connect(rando).approveMilestone(1, 0)
      ).to.be.revertedWith("Only client");
    });

    it("Should fail if milestone is not Submitted", async function () {
      await expect(
        escrow.connect(client).approveMilestone(1, 1) // Milestone 1 is Funded, not Submitted
      ).to.be.revertedWith("Milestone not submitted");
    });
  });

  describe("Milestone Rejection", function () {
    const deliverableCID = "QmDeliverable123";

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
      await escrow.connect(client).fundContract(1, { value: totalAmount });
      await escrow.connect(freelancer).submitMilestone(1, 0, deliverableCID);
    });

    it("Should reset milestone status to Funded and clear deliverable CID on rejection", async function () {
      await expect(escrow.connect(client).rejectMilestone(1, 0))
        .to.emit(escrow, "MilestoneRejected")
        .withArgs(1, 0);

      const m0 = await escrow.getMilestoneDetails(1, 0);
      expect(m0.status).to.equal(1); // Funded
      expect(m0.deliverableCID).to.equal("");
      expect(m0.submittedAt).to.equal(0);
    });

    it("Should fail if non-client rejects", async function () {
      await expect(
        escrow.connect(rando).rejectMilestone(1, 0)
      ).to.be.revertedWith("Only client");
    });

    it("Should fail if milestone is not Submitted", async function () {
      await expect(
        escrow.connect(client).rejectMilestone(1, 1) // Milestone 1 is Funded, not Submitted
      ).to.be.revertedWith("Milestone not submitted");
    });
  });
});
