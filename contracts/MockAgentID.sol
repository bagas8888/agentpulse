// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Test-only mock of the Agent ID contract. NOT deployed to mainnet.
/// Lets the local test suite simulate holders / non-holders of an Agent ID.
contract MockAgentID {
    mapping(address => uint256) private _bal;

    function setHolder(address user, bool holds) external {
        _bal[user] = holds ? 1 : 0;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _bal[owner];
    }
}
