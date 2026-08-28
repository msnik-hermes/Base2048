// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Onchain2048} from "../contracts/Onchain2048.sol";

/// ═══════════════════════════════════════════════════════════════
///  Onchain2048 — full test suite (forge test)
///
///  Setup once:
///    forge install foundry-rs/forge-std --no-commit
///    forge test -vv
///
///  Boards are engineered with vm.store on the _runs mapping
///  (slot 0), which makes every money / NFT path deterministic:
///    struct Run { uint64 board; uint40 score; uint32 moves; uint8 state; }
///    → one packed slot: board @ bits 0..63, score @ 64..103, state @ 136..143
/// ═══════════════════════════════════════════════════════════════
contract Onchain2048Test is Test {
    Onchain2048 game;
    uint256 constant FEE = 42_000_000_000_000; // 0.000042 ETH

    // events mirrored for expectEmit
    event RunStarted(address indexed player, uint64 board);
    event Moved(address indexed player, uint8 dir, uint64 board, uint40 score, uint32 gained);
    event Win(address indexed player, uint256 prize, uint64 board);
    event RewardMinted(address indexed player, uint256 indexed tokenId, uint40 score, uint64 board);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    function setUp() public {
        game = new Onchain2048(FEE);
        vm.deal(address(this), 100 ether);
    }

    receive() external payable {}

    // ── storage engineering helpers ─────────────────────────────
    function _runsSlot(address p) internal pure returns (bytes32) {
        return keccak256(abi.encode(p, uint256(0))); // _runs is slot 0
    }

    function _setRun(address p, uint64 board, uint40 score) internal {
        uint256 v = uint256(board) | (uint256(score) << 64) | (uint256(1) << 136); // state = ACTIVE
        vm.store(address(game), _runsSlot(p), bytes32(v));
    }

    function _cell(uint8 r, uint8 c, uint8 exp) internal pure returns (uint64) {
        return uint64(exp) << (16 * uint256(r) + 4 * uint256(c));
    }

    /// board with zero legal moves (full, no equal neighbours)
    function _deadBoard() internal pure returns (uint64 b) {
        uint8[16] memory n = [uint8(1),2,3,4, 5,6,7,8, 9,10,11,12, 13,14,15,1];
        for (uint8 i = 0; i < 16; i++) b |= uint64(n[i]) << (4 * uint256(i));
    }

    function _nibbles(uint64 b) internal pure returns (uint8[16] memory n) {
        for (uint8 i = 0; i < 16; i++) n[i] = uint8((b >> (4 * uint256(i))) & 0xF);
    }

    // ══════════════ deploy & entry ══════════════

    function test_Deploy_SetsFeeAndOwner() public view {
        assertEq(game.entryFee(), FEE);
        assertEq(game.owner(), address(this));
        assertEq(game.pot(), 0);
    }

    function test_Start_RevertsWhenFeeTooLow() public {
        vm.expectRevert(Onchain2048.FeeTooLow.selector);
        game.start{value: FEE - 1}();
    }

    function test_Start_SpawnsExactlyTwoTiles() public {
        vm.expectEmit(true, false, false, false);
        emit RunStarted(address(this), 0);
        game.start{value: FEE}();

        uint8[16] memory n = _nibbles(game.boardOf(address(this)));
        uint8 filled;
        for (uint8 i = 0; i < 16; i++) {
            if (n[i] != 0) {
                filled++;
                assertTrue(n[i] == 1 || n[i] == 2, "spawn must be 2 or 4");
            }
        }
        assertEq(filled, 2, "fresh board has exactly two tiles");
        assertEq(game.scoreOf(address(this)), 0);
        assertEq(game.stateOf(address(this)), 1);
        assertEq(game.pot(), FEE);
    }

    function test_Start_ResetsPreviousRun() public {
        game.start{value: FEE}();
        _setRun(address(this), _cell(0, 0, 11), 99999); // fake old run
        game.start{value: FEE}();
        assertEq(game.scoreOf(address(this)), 0);
        assertEq(game.stateOf(address(this)), 1);
    }

    // ══════════════ move validation ══════════════

    function test_Move_RevertsWithoutRun() public {
        vm.expectRevert(Onchain2048.NotActive.selector);
        game.move(0);
    }

    function test_Move_RevertsInvalidDirection() public {
        game.start{value: FEE}();
        vm.expectRevert(Onchain2048.InvalidDirection.selector);
        game.move(4);
    }

    function test_Move_RevertsNoopWithoutWastingGas() public {
        // full board, nothing can merge and nothing can slide
        _setRun(address(this), _deadBoard(), 0);
        vm.expectRevert(Onchain2048.NoopMove.selector);
        game.move(0);
    }

    function test_Move_RevertsAfterGameOver() public {
        _setRun(address(this), _deadBoard(), 0);
        // force state = ST_OVER (3) in the packed slot
        bytes32 s = vm.load(address(game), _runsSlot(address(this)));
        vm.store(address(game), _runsSlot(address(this)), bytes32((uint256(s) & ~(uint256(0xFF) << 136)) | (uint256(3) << 136)));
        vm.expectRevert(Onchain2048.NotActive.selector);
        game.move(1);
    }

    // ══════════════ engine correctness ══════════════

    function test_Move_MergesAndScoresCorrectly() public {
        // row0 = [4, 4, 0, 0] → left → [8, 0, 0, 0], +8 score, one spawn
        _setRun(address(this), _cell(0, 0, 2) | _cell(0, 1, 2), 100);

        vm.expectEmit(true, false, false, false);
        emit Moved(address(this), 0, 0, 0, 0);
        game.move(0);

        assertEq(game.scoreOf(address(this)), 108, "score grows by the merged tile value");
        assertEq(game.movesOf(address(this)), 1);

        uint8[16] memory n = _nibbles(game.boardOf(address(this)));
        assertEq(n[0], 3, "4+4 merged into 8 at (0,0)");
        assertEq(n[1], 0, "old cell cleared");
        uint8 filled;
        for (uint8 i = 0; i < 16; i++) if (n[i] != 0) filled++;
        assertEq(filled, 2, "merged tile + exactly one spawned tile");
    }

    // ══════════════ the money path ══════════════

    function test_Win_PaysNinetyPercentOfPot() public {
        deal(address(game), 1 ether);
        game.start{value: FEE}(); // pot = 1 ETH + fee

        // row0 = [1024, 1024, 2, 4] → left merges into 2048 → WIN
        uint64 board = _cell(0, 0, 10) | _cell(0, 1, 10) | _cell(0, 2, 1) | _cell(0, 3, 2);
        _setRun(address(this), board, 0);

        uint256 pot = 1 ether + FEE;
        uint256 feePart = (pot * 1000) / 10000;
        uint256 prize = pot - feePart;
        uint256 balBefore = address(this).balance;

        vm.expectEmit(true, false, false, false);
        emit Win(address(this), prize, 0);
        game.move(0);

        assertEq(address(this).balance - balBefore, prize, "winner receives 90% of the pot");
        assertEq(game.houseCut(), feePart, "10% accrues to the house");
        assertEq(address(game).balance, feePart, "only the house cut remains");
        assertEq(game.stateOf(address(this)), 2, "state = WON");
        assertEq(game.pot(), 0);
    }

    function test_Win_FurtherMovesRevert() public {
        deal(address(game), 1 ether);
        game.start{value: FEE}();
        _setRun(address(this), _cell(0, 0, 10) | _cell(0, 1, 10), 0);
        game.move(0); // wins
        vm.expectRevert(Onchain2048.NotActive.selector);
        game.move(0);
    }

    // ══════════════ NFT trophy ══════════════

    function _mintTrophy() internal returns (uint256 id) {
        // score 4090 + a merge worth 8 → 4098 ≥ 4096 → mint
        _setRun(address(this), _cell(0, 0, 2) | _cell(0, 1, 2), 4090);
        vm.expectEmit(true, true, false, false);
        emit RewardMinted(address(this), 1, 0, 0);
        game.move(0);
        id = game.nftOf(address(this));
    }

    function test_NFT_MintsWhenScoreCrosses4096() public {
        uint256 id = _mintTrophy();

        assertEq(id, 1);
        assertEq(game.ownerOf(id), address(this));
        assertEq(game.balanceOf(address(this)), 1);
        assertEq(game.scoreOf(address(this)), 4098);

        Onchain2048.Snapshot memory s = game.snapshotOf(id);
        assertEq(s.score, 4098, "snapshot freezes the crossing score");
        assertEq(s.moves, 1);
        assertTrue(s.board != 0);

        string memory uri = game.tokenURI(id);
        bytes memory prefix = bytes("application/json;base64,");
        for (uint256 i = 0; i < prefix.length; i++) {
            assertEq(bytes(uri)[i], prefix[i], "tokenURI must be a base64 data URI");
        }
        assertTrue(bytes(uri).length > 300, "metadata includes the full SVG");
    }

    function test_NFT_MintsOnlyOncePerPlayer() public {
        _mintTrophy();
        // cross the threshold a second time
        _setRun(address(this), _cell(0, 0, 2) | _cell(0, 1, 2), 4090);
        game.move(0);
        assertEq(game.nftOf(address(this)), 1, "still token #1");
        assertEq(game.balanceOf(address(this)), 1, "no second mint");
    }

    function test_NFT_BelowThresholdNoMint() public {
        _setRun(address(this), _cell(0, 0, 2) | _cell(0, 1, 2), 4080); // → 4088 < 4096
        game.move(0);
        assertEq(game.nftOf(address(this)), 0);
        assertEq(game.balanceOf(address(this)), 0);
    }

    // ══════════════ ERC-721 behaviour ══════════════

    function test_ERC721_TransfersAndApprovals() public {
        uint256 id = _mintTrophy();
        address bob = makeAddr("bob");

        // stranger cannot move it
        vm.prank(bob);
        vm.expectRevert(Onchain2048.NotAuthorized.selector);
        game.transferFrom(address(this), bob, id);

        // owner approve → approved transfers
        game.approve(bob, id);
        assertEq(game.getApproved(id), bob);
        vm.prank(bob);
        vm.expectEmit(true, true, true, false);
        emit Transfer(address(this), bob, id);
        game.transferFrom(address(this), bob, id);

        assertEq(game.ownerOf(id), bob);
        assertEq(game.balanceOf(bob), 1);
        assertEq(game.balanceOf(address(this)), 0);
        assertEq(game.getApproved(id), address(0), "approval cleared");
    }

    function test_ERC721_SafeTransferRejectsNonReceiver() public {
        uint256 id = _mintTrophy();
        vm.expectRevert(Onchain2048.UnsafeRecipient.selector);
        game.safeTransferFrom(address(this), address(game), id); // contract w/o receiver
    }

    function test_ERC721_MetadataViewsGuarded() public {
        vm.expectRevert(Onchain2048.TokenGone.selector);
        game.tokenURI(99);
        vm.expectRevert(Onchain2048.TokenGone.selector);
        game.snapshotOf(99);
        vm.expectRevert(Onchain2048.ZeroAddress.selector);
        game.balanceOf(address(0));
    }

    function test_ERC721_SupportsInterfaces() public view {
        assertTrue(game.supportsInterface(0x01ffc9a7)); // ERC-165
        assertTrue(game.supportsInterface(0x80ac58cd)); // ERC-721
        assertTrue(game.supportsInterface(0x5b5e139f)); // ERC-721 Metadata
        assertFalse(game.supportsInterface(0xffffffff));
    }

    // ══════════════ house cut ══════════════

    function test_Sweep_OwnerOnlyAndDrains() public {
        address mallory = makeAddr("mallory");
        vm.prank(mallory);
        vm.expectRevert(Onchain2048.NotOwner.selector);
        game.sweepHouseCut(mallory);

        vm.expectRevert(Onchain2048.NothingToSweep.selector);
        game.sweepHouseCut(address(this)); // nothing accrued yet

        // create a win so the house cut exists
        deal(address(game), 1 ether);
        game.start{value: FEE}();
        _setRun(address(this), _cell(0, 0, 10) | _cell(0, 1, 10), 0);
        game.move(0);
        uint256 cut = game.houseCut();
        assertTrue(cut > 0);

        uint256 before = mallory.balance;
        game.sweepHouseCut(mallory);
        assertEq(mallory.balance - before, cut);
        assertEq(game.houseCut(), 0);
        assertEq(address(game).balance, 0);
    }

    // ══════════════ fuzz sanity ══════════════

    /// any fresh board always has at least one legal move
    function testFuzz_StartAlwaysPlayable(uint256 seed) public {
        vm.roll(seed % 1000 + 10);
        game.start{value: FEE}();
        uint64 b = game.boardOf(address(this));
        assertTrue(b != 0);
        // at least 14 empty cells remain
        uint8 filled;
        uint8[16] memory n = _nibbles(b);
        for (uint8 i = 0; i < 16; i++) if (n[i] != 0) filled++;
        assertEq(filled, 2);
    }
}
