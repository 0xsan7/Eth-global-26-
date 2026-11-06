// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice One immutable fixed-price service. Job IDs are scoped to the buyer.
contract ToolCityCheckout {
    using SafeERC20 for IERC20;

    struct Purchase {
        address buyer;
        bytes32 serviceId;
        address merchant;
        uint256 amount;
        bytes32 termsHash;
    }

    IERC20 public immutable token;
    address public immutable merchant;
    bytes32 public immutable serviceId;
    uint256 public immutable amount;
    bytes32 public immutable termsHash;
    mapping(address buyer => mapping(bytes32 jobId => Purchase)) private purchases;

    event PurchaseMade(address indexed buyer, bytes32 indexed jobId, bytes32 indexed serviceId,
        address merchant, uint256 amount, bytes32 termsHash);

    error InvalidConfiguration();
    error TermsMismatch();
    error AlreadyPurchased();

    constructor(IERC20 token_, address merchant_, bytes32 serviceId_, uint256 amount_, bytes32 termsHash_) {
        if (address(token_).code.length == 0 || merchant_ == address(0) || serviceId_ == bytes32(0)
            || amount_ == 0 || termsHash_ == bytes32(0)) revert InvalidConfiguration();
        token = token_;
        merchant = merchant_;
        serviceId = serviceId_;
        amount = amount_;
        termsHash = termsHash_;
    }

    function purchase(bytes32 jobId, bytes32 expectedServiceId, uint256 expectedAmount, bytes32 expectedTermsHash) external {
        if (expectedServiceId != serviceId || expectedAmount != amount || expectedTermsHash != termsHash) revert TermsMismatch();
        if (purchases[msg.sender][jobId].buyer != address(0)) revert AlreadyPurchased();
        // Store before the external token call to prevent reentrant duplicate purchases.
        // A failed transfer reverts the record and event along with the transaction.
        purchases[msg.sender][jobId] = Purchase(msg.sender, serviceId, merchant, amount, termsHash);
        token.safeTransferFrom(msg.sender, merchant, amount);
        emit PurchaseMade(msg.sender, jobId, serviceId, merchant, amount, termsHash);
    }

    function getPurchase(address buyer, bytes32 jobId) external view returns (Purchase memory) {
        return purchases[buyer][jobId];
    }
}
