// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {Onchain2048} from "../contracts/Onchain2048.sol";

/// Minimal stand-in for the Chainlink VRF v2.5 coordinator.
/// Records nothing but the request id; the test calls fulfill() to
/// deliver the random words exactly like the real coordinator would.
contract MockVRFCoordinator {
    uint256 public nextId = 1;
    address public consumer;

    function setConsumer(address c) external { consumer = c; }

    function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata) external returns (uint256) {
        return nextId++;
    }

    function fulfill(uint256 id, uint256[] calldata words) external {
        Onchain2048(consumer).rawFulfillRandomWords(id, words);
    }
}

contract Onchain2048Test is Test {
    MockVRFCoordinator mock;
    Onchain2048 game;

    address player = makeAddr("player");
    address other  = makeAddr("other");

    function setUp() public {
        mock = new MockVRFCoordinator();
        game = new Onchain2048(address(mock), 1, bytes32(uint256(30 gwei)));
        mock.setConsumer(address(game));
        vm.deal(player, 1 ether);
    }

    // ── helpers ──────────────────────────────────────────────────

    function _pack(uint8[16] memory x) internal pure returns (bytes32) {
        uint256 w;
        for (uint8 i = 0; i < 16; i++) w |= uint256(x[i] & 0xF) << (4 * i);
        return bytes32(w);
    }

    function _setBoard(address p, uint8[16] memory x) internal {
        vm.store(address(game), keccak256(abi.encode(p, uint256(0))), _pack(x));
    }

    function _setActive(address p) internal {
        // slot = base + 1 → score(40) | moves(32) | state(8)
        vm.store(address(game), bytes32(uint256(keccak256(abi.encode(p, uint256(0)))) + 1), bytes32(uint256(1)));
    }

    function _setScore(address p, uint256 s) internal {
        vm.store(address(game), bytes32(uint256(keccak256(abi.encode(p, uint256(0)))) + 1), bytes32(s << 40));
    }

    /// start() + fulfil → active run with two spawned tiles
    function _startRun(address p) internal returns (uint256 reqId) {
        vm.prank(p);
        game.start();
        reqId = mock.nextId() - 1;
        uint256[] memory w = new uint256[](2);
        w[0] = uint256(keccak256(abi.encode("spawn-a", p)));
        w[1] = uint256(keccak256(abi.encode("spawn-b", p)));
        mock.fulfill(reqId, w);
    }

    /// move(dir) + fulfil with chosen entropy
    function _move(address p, uint8 dir, uint256 entropy) internal returns (uint256 reqId) {
        vm.prank(p);
        game.move(dir);
        reqId = mock.nextId() - 1;
        uint256[] memory w = new uint256[](1);
        w[0] = entropy;
        mock.fulfill(reqId, w);
    }

    // ── start / run lifecycle ────────────────────────────────────

    function test_Start_Commit_Pending_Then_Active() public {
        vm.prank(player);
        game.start();
        assertEq(game.stateOf(player), 4);               // ST_PENDING while awaiting VRF

        uint256[] memory w = new uint256[](2);
        w[0] = 7;
        w[1] = 11;
        mock.fulfill(mock.nextId() - 1, w);

        assertEq(game.stateOf(player), 1);               // ST_ACTIVE
        assertEq(game.movesOf(player), 0);
        assertEq(game.scoreOf(player), 0);
        uint8[16] memory g = game.gridOf(player);
        uint8 tiles;
        for (uint8 i = 0; i < 16; i++) if (g[i] != 0) tiles++;
        assertEq(tiles, 2);                              // exactly two spawned tiles
    }

    function test_Start_WhileActive_Reverts() public {
        _startRun(player);
        vm.prank(player);
        vm.expectRevert(Onchain2048.RunBusy.selector);
        game.start();
    }

    function test_Start_WhileAwaitingMove_Reverts() public {
        _setActive(player);
        vm.prank(player);
        game.move(0);                                    // commit only — fulfil pending
        vm.prank(player);
        vm.expectRevert(Onchain2048.RunBusy.selector);
        game.start();
    }

    // ── moves ────────────────────────────────────────────────────

    function test_Move_Scores_Exact_Values() public {
        _setActive(player);
        // row0: 2 2 4 4 → 4 8 · ·   gained 4 + 8 = 12
        _setBoard(player, [uint8(1),1,2,2, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        _move(player, 0, 1234);
        assertEq(game.scoreOf(player), 12);
        assertEq(game.movesOf(player), 1);
    }

    function test_Move_Spawns_Exactly_One_Tile() public {
        _setActive(player);
        _setBoard(player, [uint8(1),1,2,2, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        _move(player, 0, 999);
        uint8[16] memory g = game.gridOf(player);
        uint8 tiles;
        for (uint8 i = 0; i < 16; i++) if (g[i] != 0) tiles++;
        assertEq(tiles, 3);                              // 2 merged tiles + 1 spawn
    }

    function test_Move_Awaiting_Reverts() public {
        _setActive(player);
        vm.prank(player);
        game.move(0);                                    // commit, no fulfil yet
        vm.prank(player);
        vm.expectRevert(Onchain2048.PendingRandomness.selector);
        game.move(1);
    }

    function test_Move_Noop_Reverts_And_No_Request() public {
        _setActive(player);
        _setBoard(player, [uint8(1),2,3,4, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        uint256 before = mock.nextId();
        vm.prank(player);
        vm.expectRevert(Onchain2048.NoopMove.selector);
        game.move(0);
        assertEq(mock.nextId(), before);                 // no VRF request was sent
        assertFalse(game.awaitingMove(player));
    }

    function test_Move_NotActive_Reverts() public {
        vm.prank(player);
        vm.expectRevert(Onchain2048.NotActive.selector);
        game.move(0);
    }

    function test_Move_InvalidDirection_Reverts() public {
        _setActive(player);
        vm.prank(player);
        vm.expectRevert(Onchain2048.InvalidDirection.selector);
        game.move(4);
    }

    function test_Win_On_Fulfil() public {
        _setActive(player);
        // row0: 1024 1024 0 0 → 2048 · · ·  (exp 11 = win)
        _setBoard(player, [uint8(10),10,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        _move(player, 0, 5);
        assertEq(game.stateOf(player), 2);               // ST_WON
        assertEq(game.scoreOf(player), 2048);
    }

    function test_Win_Can_Keep_Playing_After_New_Start() public {
        _setActive(player);
        _setBoard(player, [uint8(10),10,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        _move(player, 0, 5);
        assertEq(game.stateOf(player), 2);
        _startRun(player);                               // new run allowed
        assertEq(game.stateOf(player), 1);
        assertEq(game.scoreOf(player), 0);
    }

    function test_Unknown_Fulfilment_Is_Ignored() public {
        uint256[] memory w = new uint256[](1);
        w[0] = 1;
        mock.fulfill(424242, w);                         // must not revert
    }

    // ── NFT trophy ───────────────────────────────────────────────

    function test_NFT_Mints_Once_At_4096() public {
        _setActive(player);
        // row0: 2048 2048 1024 1024 → 4096 2048 · ·  gained 4096 + 2048 = 6144
        _setBoard(player, [uint8(11),11,10,10, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        _move(player, 0, 3);

        uint256 id = game.nftOf(player);
        assertTrue(id > 0, "trophy minted");
        assertEq(game.ownerOf(id), player);
        assertEq(game.balanceOf(player), 1);
        assertEq(game.stateOf(player), 2);               // also a win (exp 12)

        (uint64 snapBoard, uint40 snapScore,) = game.snapshotOf(id);
        assertEq(snapScore, 6144);
        assertTrue(snapBoard != 0);
        assertTrue(bytes(game.tokenURI(id)).length > 100);

        // a second huge move must NOT mint another trophy
        _startRun(player);
        _setActive(player);
        _setBoard(player, [uint8(11),11,10,10, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        _move(player, 0, 3);
        assertEq(game.nftOf(player), id);
        assertEq(game.balanceOf(player), 1);
    }

    function test_NFT_Transfer_And_Approvals() public {
        _setActive(player);
        _setBoard(player, [uint8(11),11,10,10, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        _move(player, 0, 3);
        uint256 id = game.nftOf(player);

        // approval flow
        vm.prank(player);
        game.approve(other, id);
        assertEq(game.getApproved(id), other);
        vm.prank(other);
        game.transferFrom(player, other, id);
        assertEq(game.ownerOf(id), other);
        assertEq(game.balanceOf(player), 0);
        assertEq(game.balanceOf(other), 1);

        // unauthorised transfer reverts
        vm.prank(player);
        vm.expectRevert(Onchain2048.NotAuthorized.selector);
        game.transferFrom(other, player, id);

        // operator flow
        vm.prank(other);
        game.setApprovalForAll(player, true);
        assertTrue(game.isApprovedForAll(other, player));
        vm.prank(player);
        game.transferFrom(other, player, id);
        assertEq(game.ownerOf(id), player);
    }

    // ── invariants of the free-to-play design ────────────────────

    function test_Contract_Never_Holds_ETH() public {
        _startRun(player);
        assertEq(address(game).balance, 0);
        _setActive(player);
        _setBoard(player, [uint8(10),10,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        _move(player, 0, 5);
        assertEq(address(game).balance, 0);              // nothing payable anywhere
    }

    function testFuzz_Fresh_Board_Is_Playable(uint256 seedA, uint256 seedB) public {
        vm.prank(player);
        game.start();
        uint256[] memory w = new uint256[](2);
        w[0] = seedA;
        w[1] = seedB;
        mock.fulfill(mock.nextId() - 1, w);
        assertTrue(uint64(game.boardOf(player)) != 0);
        assertEq(game.stateOf(player), 1);               // two tiles → always playable
    }
}
