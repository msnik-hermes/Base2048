// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/Onchain2048.sol";

/// Free-to-play edition — no entry fee, no pot, no house cut.
/// Tests focus on game logic, state machine, NFT trophy and ERC-721.
contract Onchain2048Test is Test {
    Onchain2048 game;

    address player = makeAddr("player");
    address other  = makeAddr("other");

    function setUp() public {
        game = new Onchain2048();
    }

    // ── helpers ──────────────────────────────────────────────────
    // Write a full 4x4 board of exponents directly into slot 0 (Run.board).
    function setBoard(address p, uint8[16] memory cells) internal {
        uint64 board;
        for (uint8 i = 0; i < 16; i++) board |= uint64(cells[i]) << (4 * i);
        // Run struct: board(8) + score(5) + moves(4) + state(1) packed at slot 0
        vm.store(address(game), keccak256(abi.encode(p, 0)), bytes32(uint256(board)));
        // state = ST_ACTIVE lives in the top byte of slot 0
        bytes32 cur = vm.load(address(game), keccak256(abi.encode(p, 0)));
        // ensure state byte (offset 17) = 1
        uint256 raw = uint256(cur);
        raw = (raw & ~(uint256(0xFF) << 136)) | (uint256(1) << 136);
        vm.store(address(game), keccak256(abi.encode(p, 0)), bytes32(raw));
    }

    // ── start ────────────────────────────────────────────────────
    function test_StartSpawnsTwoTiles() public {
        vm.prank(player);
        game.start();
        assertEq(game.stateOf(player), 1, "state should be active");
        uint8[16] memory g = game.gridOf(player);
        uint8 tiles;
        for (uint8 i = 0; i < 16; i++) if (g[i] > 0) tiles++;
        assertEq(tiles, 2, "start should spawn exactly 2 tiles");
        assertEq(game.scoreOf(player), 0);
        assertEq(game.movesOf(player), 0);
    }

    function test_StartIsFree() public {
        uint256 before = player.balance;
        vm.prank(player);
        game.start();
        assertEq(player.balance, before, "start() must not take any ETH");
    }

    // ── move ─────────────────────────────────────────────────────
    function test_MoveUpdatesState() public {
        setBoard(player, [uint8(1),1,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        vm.prank(player);
        game.move(0); // left
        assertEq(game.movesOf(player), 1, "move counter should increment");
        assertEq(game.stateOf(player), 1, "run stays active");
    }

    function test_NoopMoveReverts() public {
        setBoard(player, [uint8(1),2,3,4, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        vm.prank(player);
        vm.expectRevert(Onchain2048.NoopMove.selector);
        game.move(0); // already packed left, nothing changes
    }

    function test_InvalidDirectionReverts() public {
        setBoard(player, [uint8(1),0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        vm.prank(player);
        vm.expectRevert(Onchain2048.InvalidDirection.selector);
        game.move(4);
    }

    function test_MoveWithoutStartReverts() public {
        vm.prank(player);
        vm.expectRevert(Onchain2048.NotActive.selector);
        game.move(0);
    }

    // ── win at 2048 ──────────────────────────────────────────────
    function test_WinAt2048() public {
        // row: 10,10 → merges into 11 (2048) on a left move
        setBoard(player, [uint8(10),10,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        vm.prank(player);
        game.move(0);
        assertEq(game.stateOf(player), 2, "state should be ST_WON");
    }

    function test_MoveAfterWinReverts() public {
        setBoard(player, [uint8(10),10,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        vm.prank(player);
        game.move(0);
        vm.prank(player);
        vm.expectRevert(Onchain2048.NotActive.selector);
        game.move(0);
    }

    // ── NFT trophy at 4096 ───────────────────────────────────────
    function test_MintNftAtThreshold() public {
        // engineer a board whose next move yields score >= 4096
        // 10+10 → 11 gives +2048; then 11+11 → 12 gives +4096 in one merge
        setBoard(player, [uint8(11),11,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        vm.prank(player);
        game.move(0);
        uint256 id = game.nftOf(player);
        assertGt(id, 0, "trophy should be minted once score crosses 4096");
        assertGe(game.scoreOf(player), 4096);
    }

    function test_MintOnlyOncePerPlayer() public {
        setBoard(player, [uint8(11),11,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        vm.prank(player);
        game.move(0);
        uint256 first = game.nftOf(player);
        // continue playing; trophy id must not change
        setBoard(player, [uint8(11),11,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        vm.prank(player);
        game.move(0);
        assertEq(game.nftOf(player), first, "trophy must be minted only once");
    }

    // ── ERC-721 ──────────────────────────────────────────────────
    function _mintTrophy() internal returns (uint256 id) {
        setBoard(player, [uint8(11),11,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
        vm.prank(player);
        game.move(0);
        id = game.nftOf(player);
    }

    function test_TransferTrophy() public {
        uint256 id = _mintTrophy();
        vm.prank(player);
        game.transferFrom(player, other, id);
        assertEq(game.ownerOf(id), other);
        assertEq(game.balanceOf(other), 1);
        assertEq(game.balanceOf(player), 0);
    }

    function test_ApproveAndTransfer() public {
        uint256 id = _mintTrophy();
        vm.prank(player);
        game.approve(other, id);
        assertEq(game.getApproved(id), other);
        vm.prank(other);
        game.transferFrom(player, other, id);
        assertEq(game.ownerOf(id), other);
    }

    function test_UnauthorizedTransferReverts() public {
        uint256 id = _mintTrophy();
        vm.prank(other);
        vm.expectRevert(Onchain2048.NotAuthorized.selector);
        game.transferFrom(player, other, id);
    }

    function test_TokenUriIsBase64Json() public {
        uint256 id = _mintTrophy();
        string memory uri = game.tokenURI(id);
        // "application/json;base64," prefix
        bytes memory b = bytes(uri);
        assertGt(b.length, 30);
        assertTrue(_startsWith(uri, "data:application/json;base64,"));
    }

    function _startsWith(string memory s, string memory prefix) internal pure returns (bool) {
        bytes memory a = bytes(s);
        bytes memory p = bytes(prefix);
        if (a.length < p.length) return false;
        for (uint256 i = 0; i < p.length; i++) if (a[i] != p[i]) return false;
        return true;
    }

    // ── views ────────────────────────────────────────────────────
    function test_GridOfReflectsBoard() public {
        setBoard(player, [uint8(1),2,0,0, 3,0,0,0, 0,0,4,0, 0,0,0,0]);
        uint8[16] memory g = game.gridOf(player);
        assertEq(g[0], 1);
        assertEq(g[1], 2);
        assertEq(g[4], 3);
        assertEq(g[10], 4);
        assertEq(game.boardOf(player) & 0xF, 1, "nibble 0 = 1");
    }
}
