// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GigEscrow is ReentrancyGuard, Ownable {
    uint256 public constant PLATFORM_FEE_BPS = 250;
    uint256 public contractCounter;

    constructor() Ownable(msg.sender) {}

    enum ContractStatus { Created, InProgress, Completed, Cancelled, Disputed }
    enum MilestoneStatus { Pending, Funded, Submitted, Approved, Rejected }

    struct Milestone {
        string description;
        uint256 amount;
        string deliverableCID;
        MilestoneStatus status;
        uint256 submittedAt;
        uint256 approvedAt;
    }

    struct EscrowContract {
        address client;
        address freelancer;
        string title;
        string termsCID;
        uint256 totalAmount;
        uint256 deadline;
        ContractStatus status;
        uint256 milestoneCount;
        uint256 completedMilestones;
    }

    mapping(uint256 => EscrowContract) public contracts;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(address => uint256[]) public clientContracts;
    mapping(address => uint256[]) public freelancerContracts;
    mapping(uint256 => bool) public contractExists;

    event ContractCreated(uint256 indexed contractId, address indexed client, address indexed freelancer, uint256 totalAmount);
    event MilestoneAdded(uint256 indexed contractId, uint256 milestoneIndex);
    event MilestoneSubmitted(uint256 indexed contractId, uint256 milestoneIndex, string deliverableCID);
    event MilestoneApproved(uint256 indexed contractId, uint256 milestoneIndex, uint256 amount);
    event MilestoneRejected(uint256 indexed contractId, uint256 milestoneIndex);
    event ContractCompleted(uint256 indexed contractId);
    event ContractCancelled(uint256 indexed contractId);
    event DisputeRaised(uint256 indexed contractId, address raisedBy);
    event DisputeResolved(uint256 indexed contractId, address winner);
    event FreelancerSet(uint256 indexed contractId, address indexed freelancer);

    modifier onlyContractParty(uint256 _contractId) {
        require(
            msg.sender == contracts[_contractId].client ||
            msg.sender == contracts[_contractId].freelancer ||
            msg.sender == owner(),
            "Not a contract party or owner"
        );
        _;
    }

    modifier onlyClient(uint256 _contractId) {
        require(
            msg.sender == contracts[_contractId].client ||
            msg.sender == owner(),
            "Only client"
        );
        _;
    }

    modifier onlyFreelancer(uint256 _contractId) {
        require(msg.sender == contracts[_contractId].freelancer, "Only freelancer");
        _;
    }

    modifier contractExistsMod(uint256 _contractId) {
        require(contractExists[_contractId], "Contract does not exist");
        _;
    }

    function createContract(
        address _client,
        address _freelancer,
        string memory _title,
        string memory _termsCID,
        uint256 _totalAmount,
        uint256 _deadline,
        string[] memory _milestoneDescriptions,
        uint256[] memory _milestoneAmounts
    ) external returns (uint256) {
        require(_client != address(0), "Invalid client address");
        require(_client != _freelancer, "Cannot contract yourself");
        require(_milestoneDescriptions.length > 0, "Need at least 1 milestone");
        require(_milestoneDescriptions.length == _milestoneAmounts.length, "Arrays length mismatch");

        uint256 totalMilestoneAmount;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            totalMilestoneAmount += _milestoneAmounts[i];
        }
        require(totalMilestoneAmount == _totalAmount, "Milestone amounts must sum to total");

        contractCounter++;
        uint256 contractId = contractCounter;

        EscrowContract storage escrow = contracts[contractId];
        escrow.client = _client;
        escrow.freelancer = _freelancer;
        escrow.title = _title;
        escrow.termsCID = _termsCID;
        escrow.totalAmount = _totalAmount;
        escrow.deadline = _deadline;
        escrow.status = ContractStatus.Created;
        escrow.milestoneCount = _milestoneDescriptions.length;

        for (uint256 i = 0; i < _milestoneDescriptions.length; i++) {
            milestones[contractId][i] = Milestone({
                description: _milestoneDescriptions[i],
                amount: _milestoneAmounts[i],
                deliverableCID: "",
                status: MilestoneStatus.Pending,
                submittedAt: 0,
                approvedAt: 0
            });
            emit MilestoneAdded(contractId, i);
        }

        contractExists[contractId] = true;
        clientContracts[_client].push(contractId);
        if (_freelancer != address(0)) {
            freelancerContracts[_freelancer].push(contractId);
        }

        emit ContractCreated(contractId, _client, _freelancer, _totalAmount);
        return contractId;
    }

    function setFreelancer(uint256 _contractId, address _freelancer)
        external
        contractExistsMod(_contractId)
        onlyClient(_contractId)
    {
        require(_freelancer != address(0), "Invalid freelancer address");
        require(_freelancer != msg.sender, "Cannot set yourself");
        require(contracts[_contractId].freelancer == address(0), "Freelancer already set");

        contracts[_contractId].freelancer = _freelancer;
        freelancerContracts[_freelancer].push(_contractId);

        emit FreelancerSet(_contractId, _freelancer);
    }

    function fundContract(uint256 _contractId) external payable contractExistsMod(_contractId) onlyClient(_contractId) {
        EscrowContract storage escrow = contracts[_contractId];
        require(escrow.status == ContractStatus.Created, "Contract not in created state");
        require(msg.value == escrow.totalAmount, "Incorrect funding amount");

        escrow.status = ContractStatus.InProgress;
        for (uint256 i = 0; i < escrow.milestoneCount; i++) {
            milestones[_contractId][i].status = MilestoneStatus.Funded;
        }
    }

    function submitMilestone(uint256 _contractId, uint256 _milestoneIndex, string memory _deliverableCID)
        external
        contractExistsMod(_contractId)
        onlyFreelancer(_contractId)
    {
        EscrowContract storage escrow = contracts[_contractId];
        require(escrow.status == ContractStatus.InProgress, "Contract not in progress");
        require(_milestoneIndex < escrow.milestoneCount, "Invalid milestone index");

        Milestone storage milestone = milestones[_contractId][_milestoneIndex];
        require(milestone.status == MilestoneStatus.Funded, "Milestone not ready for submission");
        require(bytes(_deliverableCID).length > 0, "Deliverable CID required");

        milestone.deliverableCID = _deliverableCID;
        milestone.status = MilestoneStatus.Submitted;
        milestone.submittedAt = block.timestamp;

        emit MilestoneSubmitted(_contractId, _milestoneIndex, _deliverableCID);
    }

    function approveMilestone(uint256 _contractId, uint256 _milestoneIndex)
        external
        contractExistsMod(_contractId)
        onlyClient(_contractId)
        nonReentrant
    {
        EscrowContract storage escrow = contracts[_contractId];
        require(escrow.status == ContractStatus.InProgress, "Contract not in progress");

        Milestone storage milestone = milestones[_contractId][_milestoneIndex];
        require(milestone.status == MilestoneStatus.Submitted, "Milestone not submitted");

        milestone.status = MilestoneStatus.Approved;
        milestone.approvedAt = block.timestamp;
        escrow.completedMilestones++;

        uint256 fee = (milestone.amount * PLATFORM_FEE_BPS) / 10000;
        uint256 payout = milestone.amount - fee;

        payable(escrow.freelancer).transfer(payout);
        payable(owner()).transfer(fee);

        emit MilestoneApproved(_contractId, _milestoneIndex, payout);

        if (escrow.completedMilestones == escrow.milestoneCount) {
            _completeContract(_contractId);
        }
    }

    function rejectMilestone(uint256 _contractId, uint256 _milestoneIndex)
        external
        contractExistsMod(_contractId)
        onlyClient(_contractId)
    {
        Milestone storage milestone = milestones[_contractId][_milestoneIndex];
        require(milestone.status == MilestoneStatus.Submitted, "Milestone not submitted");

        milestone.status = MilestoneStatus.Funded;
        milestone.deliverableCID = "";
        milestone.submittedAt = 0;

        emit MilestoneRejected(_contractId, _milestoneIndex);
    }

    function raiseDispute(uint256 _contractId)
        external
        contractExistsMod(_contractId)
        onlyContractParty(_contractId)
    {
        EscrowContract storage escrow = contracts[_contractId];
        require(
            escrow.status == ContractStatus.InProgress ||
            escrow.status == ContractStatus.Created,
            "Cannot dispute in current state"
        );

        escrow.status = ContractStatus.Disputed;
        emit DisputeRaised(_contractId, msg.sender);
    }

    function resolveDispute(uint256 _contractId, bool _releaseToFreelancer)
        external
        contractExistsMod(_contractId)
        onlyOwner
        nonReentrant
    {
        EscrowContract storage escrow = contracts[_contractId];
        require(escrow.status == ContractStatus.Disputed, "Contract not in dispute");

        address winner = _releaseToFreelancer ? escrow.freelancer : escrow.client;

        if (_releaseToFreelancer) {
            uint256 balance = address(this).balance;
            uint256 fee = (balance * PLATFORM_FEE_BPS) / 10000;
            uint256 payout = balance - fee;
            payable(escrow.freelancer).transfer(payout);
            payable(owner()).transfer(fee);
        } else {
            payable(escrow.client).transfer(address(this).balance);
        }

        escrow.status = _releaseToFreelancer ? ContractStatus.Completed : ContractStatus.Cancelled;
        emit DisputeResolved(_contractId, winner);
    }

    function cancelContract(uint256 _contractId)
        external
        contractExistsMod(_contractId)
        onlyClient(_contractId)
        nonReentrant
    {
        EscrowContract storage escrow = contracts[_contractId];
        require(escrow.status == ContractStatus.Created, "Can only cancel before funding");

        escrow.status = ContractStatus.Cancelled;
        emit ContractCancelled(_contractId);
    }

    function _completeContract(uint256 _contractId) private {
        contracts[_contractId].status = ContractStatus.Completed;
        emit ContractCompleted(_contractId);
    }

    function getClientContracts(address _client) external view returns (uint256[] memory) {
        return clientContracts[_client];
    }

    function getFreelancerContracts(address _freelancer) external view returns (uint256[] memory) {
        return freelancerContracts[_freelancer];
    }

    function getContractDetails(uint256 _contractId)
        external
        view
        contractExistsMod(_contractId)
        returns (EscrowContract memory)
    {
        return contracts[_contractId];
    }

    function getMilestoneDetails(uint256 _contractId, uint256 _milestoneIndex)
        external
        view
        contractExistsMod(_contractId)
        returns (Milestone memory)
    {
        require(_milestoneIndex < contracts[_contractId].milestoneCount, "Invalid milestone");
        return milestones[_contractId][_milestoneIndex];
    }

    function getContractBalance(uint256 _contractId)
        external
        view
        contractExistsMod(_contractId)
        returns (uint256)
    {
        return address(this).balance;
    }
}
