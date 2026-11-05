// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    bool public failTransfer;
    bool public reentryAttempted;
    bool public reentrySucceeded;
    address private target;
    bytes private reentryCall;
    constructor() ERC20("Test token", "TEST") {}
    function mint(address to, uint256 value) external { _mint(to, value); }
    function setFailTransfer(bool fail) external { failTransfer = fail; }
    function attack(address checkout, bytes calldata data, uint256 value) external {
        target = checkout;
        reentryCall = data;
        _approve(address(this), checkout, value);
        (bool ok,) = checkout.call(data);
        require(ok, "outer purchase failed");
    }
    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (failTransfer) return false;
        if (target != address(0) && !reentryAttempted) {
            reentryAttempted = true;
            (reentrySucceeded,) = target.call(reentryCall);
        }
        return super.transferFrom(from, to, value);
    }
}
