// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/// ═══════════════════════════════════════════════════════════════
///  ONCHAIN 2048 — Base · Chainlink VRF edition · free-to-play
///  ─────────────────────────────────────────────────────────────
///  The entire game state lives in a single storage slot:
///    • the 4×4 board is packed into one uint64 (16 × 4-bit nibbles)
///    • each nibble stores a power of two: 1 → 2 … 11 → 2048, 0 = empty
///
///  Randomness comes from Chainlink VRF v2.5 via commit–reveal:
///    • start() / move(dir) apply everything deterministic immediately,
///      then request random words from the VRF coordinator
///    • fulfillRandomWords() spawns the new tile(s) a couple of blocks
///      later and finalises the win / game-over / NFT-trophy checks
///  Spawns can no longer be predicted or steered by validators or by
///  try/catch player contracts — the random words only exist once the
///  Chainlink node fulfils the request.
///
///  Free to play — NO entry fee, NO pot, NO house cut, NO withdrawals
///  and NO owner logic. The only cost is the Base transaction fee and
///  the contract balance is always 0.
///
///  The first time a player's score crosses 4096, a one-of-one ERC-721
///  trophy is minted; its metadata — an SVG render of the frozen board —
///  is generated fully on-chain inside tokenURI(). No IPFS, no servers.
/// ═══════════════════════════════════════════════════════════════

interface IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4);
}

contract Onchain2048 is VRFConsumerBaseV2Plus {
    uint8   public constant SIZE          = 4;
    uint8   public constant WIN_EXP       = 11;          // 2^11 = 2048
    uint256 public constant NFT_THRESHOLD = 4096;        // score that mints the trophy

    // ── Chainlink VRF v2.5 parameters ───────────────────────────
    uint256 public immutable vrfSubId;
    bytes32 public immutable vrfKeyHash;
    uint16  public constant VRF_CONFIRMATIONS  = 3;
    uint32  public constant VRF_CALLBACK_GAS   = 300_000; // room for spawn + win + NFT mint

    uint8 internal constant ST_NONE    = 0;
    uint8 internal constant ST_ACTIVE  = 1;
    uint8 internal constant ST_WON     = 2;
    uint8 internal constant ST_OVER    = 3;
    uint8 internal constant ST_PENDING = 4;              // waiting for the VRF fulfilment

    struct Run {
        uint64 board;    // nibble of cell (r,c) lives in bits r*16 + c*4
        uint40 score;
        uint32 moves;
        uint8  state;
    }

    struct PendingMove {
        address player;
        uint8   dir;
        uint32  gained;
    }

    mapping(address => Run) private _runs;

    // requestId → what is waiting for the random words
    mapping(uint256 => address)     private _pendingStart;
    mapping(uint256 => PendingMove) private _pendingMove;
    mapping(address => bool)        private _awaitingMove;   // one in-flight move per player

    // ── ERC-721 trophy (minimal, self-contained — no imports) ──
    string public constant name   = "Onchain 2048";
    string public constant symbol = "O2048";

    struct Snapshot { uint64 board; uint40 score; uint32 moves; }

    uint256 private _nextTokenId = 1;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => Snapshot) private _snapshots;     // frozen board at mint time
    mapping(address => uint256) public nftOf;            // 0 = trophy not earned yet

    event RunStarted(address indexed player, uint64 board);
    event MoveCommitted(address indexed player, uint8 dir, uint64 board, uint40 score);
    event Moved(address indexed player, uint8 dir, uint64 board, uint40 score, uint32 gained);
    event Win(address indexed player, uint64 board);
    event GameOver(address indexed player, uint40 score);
    event RewardMinted(address indexed player, uint256 indexed tokenId, uint40 score, uint64 board);

    // ERC-721 events
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner_, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner_, address indexed operator, bool approved);

    error NotActive();
    error InvalidDirection();
    error NoopMove();
    error RunBusy();
    error PendingRandomness();
    error ZeroAddress();
    error TokenGone();
    error NotAuthorized();
    error WrongOwner();
    error SelfApproval();
    error UnsafeRecipient();

    /// @param vrfCoordinator_ Chainlink VRF v2.5 coordinator of the target network
    /// @param vrfSubId_       id of your funded VRF subscription (vrf.chain.link)
    /// @param vrfKeyHash_     key hash for the network (docs.chain.link/vrf/v2-5/supported-networks)
    constructor(address vrfCoordinator_, uint256 vrfSubId_, bytes32 vrfKeyHash_)
        VRFConsumerBaseV2Plus(vrfCoordinator_)
    {
        vrfSubId = vrfSubId_;
        vrfKeyHash = vrfKeyHash_;
    }

    // ── Start a new run (free — only the Base tx fee) ───────────
    // Requests two random words; fulfillRandomWords spawns the tiles.
    function start() external {
        Run storage run = _runs[msg.sender];
        if (run.state == ST_ACTIVE || run.state == ST_PENDING || _awaitingMove[msg.sender]) {
            revert RunBusy();
        }
        run.board = 0;
        run.score = 0;
        run.moves = 0;
        run.state = ST_PENDING;

        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: vrfKeyHash,
                subId: vrfSubId,
                requestConfirmations: VRF_CONFIRMATIONS,
                callbackGasLimit: VRF_CALLBACK_GAS,
                numWords: 2,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );
        _pendingStart[requestId] = msg.sender;
    }

    // ── Commit a move: 0=left 1=right 2=up 3=down ───────────────
    // Slide + merge are deterministic, so they land in this tx.
    // The spawn waits for the VRF fulfilment (a few seconds on Base).
    function move(uint8 dir) external {
        Run storage run = _runs[msg.sender];
        if (run.state != ST_ACTIVE) revert NotActive();
        if (_awaitingMove[msg.sender]) revert PendingRandomness();
        if (dir > 3) revert InvalidDirection();

        uint64 b = run.board;
        if (dir >= 2) b = _transpose(b);                 // up/down → left/right on the transpose

        uint64 nb;
        uint32 gained;
        for (uint8 r = 0; r < SIZE; r++) {
            uint16 row = uint16(b >> (16 * r));
            if (dir == 1 || dir == 3) row = _reverse(row);
            (uint16 out, uint32 g) = _slideLeft(row);
            if (dir == 1 || dir == 3) out = _reverse(out);
            nb |= uint64(out) << (16 * r);
            gained += g;
        }

        if (dir >= 2) nb = _transpose(nb);
        if (nb == run.board) revert NoopMove();          // no-op → revert, no VRF fee wasted

        run.board = nb;
        run.score += uint40(gained);
        run.moves += 1;
        emit MoveCommitted(msg.sender, dir, nb, run.score);

        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: vrfKeyHash,
                subId: vrfSubId,
                requestConfirmations: VRF_CONFIRMATIONS,
                callbackGasLimit: VRF_CALLBACK_GAS,
                numWords: 1,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );
        _pendingMove[requestId] = PendingMove(msg.sender, dir, gained);
        _awaitingMove[msg.sender] = true;
    }

    // ── Chainlink VRF fulfilment — reveal phase ─────────────────
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        // 1) fresh run → spawn the first two tiles
        address starter = _pendingStart[requestId];
        if (starter != address(0)) {
            delete _pendingStart[requestId];
            Run storage fresh = _runs[starter];
            if (fresh.state != ST_PENDING) return;       // stale request, ignore
            uint64 nb = _spawn(_spawn(0, randomWords[0]), randomWords[1]);
            fresh.board = nb;
            fresh.state = ST_ACTIVE;
            emit RunStarted(starter, nb);
            return;
        }

        // 2) committed move → spawn one tile, then finalise the run
        PendingMove memory pm = _pendingMove[requestId];
        if (pm.player == address(0)) return;             // unknown / stale request
        delete _pendingMove[requestId];

        Run storage run = _runs[pm.player];
        _awaitingMove[pm.player] = false;
        if (run.state != ST_ACTIVE) return;              // run was reset meanwhile

        uint64 b = _spawn(run.board, randomWords[0]);
        run.board = b;
        emit Moved(pm.player, pm.dir, b, run.score, pm.gained);

        // Trophy: first time the score crosses 4096 — one per player,
        // minted with the final board frozen into its on-chain SVG.
        if (nftOf[pm.player] == 0 && run.score >= NFT_THRESHOLD) {
            uint256 id = _nextTokenId++;
            _snapshots[id] = Snapshot(b, run.score, run.moves);
            _owners[id] = pm.player;
            unchecked { _balances[pm.player] += 1; }
            nftOf[pm.player] = id;
            emit Transfer(address(0), pm.player, id);
            emit RewardMinted(pm.player, id, run.score, b);
        }

        if (_maxExp(b) >= WIN_EXP) {
            run.state = ST_WON;
            emit Win(pm.player, b);
        } else if (!_hasMoves(b)) {
            run.state = ST_OVER;
            emit GameOver(pm.player, run.score);
        }
    }

    // ── Views for the frontend ──────────────────────────────────
    function boardOf(address p) external view returns (uint64) { return _runs[p].board; }
    function scoreOf(address p) external view returns (uint40) { return _runs[p].score; }
    function stateOf(address p) external view returns (uint8)  { return _runs[p].state; }
    function movesOf(address p) external view returns (uint32) { return _runs[p].moves; }
    function awaitingMove(address p) external view returns (bool) { return _awaitingMove[p]; }

    /// Board as an array of 16 exponents — cell i = (i/4, i%4)
    function gridOf(address p) external view returns (uint8[16] memory g) {
        uint64 b = _runs[p].board;
        for (uint8 i = 0; i < 16; i++) g[i] = uint8((b >> (4 * i)) & 0xF);
    }

    /// Frozen snapshot baked into trophy #id
    function snapshotOf(uint256 id) external view returns (Snapshot memory) {
        ownerOf(id);
        return _snapshots[id];
    }

    // ═══════════════ ERC-721 — Onchain 2048 trophy ══════════════

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7   // ERC-165
            || interfaceId == 0x80ac58cd   // ERC-721
            || interfaceId == 0x5b5e139f;  // ERC-721 Metadata
    }

    function balanceOf(address o) external view returns (uint256) {
        if (o == address(0)) revert ZeroAddress();
        return _balances[o];
    }

    function ownerOf(uint256 id) public view returns (address o) {
        o = _owners[id];
        if (o == address(0)) revert TokenGone();
    }

    function approve(address to, uint256 id) external {
        address o = ownerOf(id);
        if (to == o) revert SelfApproval();
        if (msg.sender != o && !_operatorApprovals[o][msg.sender]) revert NotAuthorized();
        _tokenApprovals[id] = to;
        emit Approval(o, to, id);
    }

    function getApproved(uint256 id) external view returns (address) {
        ownerOf(id);
        return _tokenApprovals[id];
    }

    function setApprovalForAll(address op, bool ok) external {
        if (op == msg.sender) revert SelfApproval();
        _operatorApprovals[msg.sender][op] = ok;
        emit ApprovalForAll(msg.sender, op, ok);
    }

    function isApprovedForAll(address o, address op) public view returns (bool) {
        return _operatorApprovals[o][op];
    }

    function transferFrom(address from, address to, uint256 id) public {
        if (to == address(0)) revert ZeroAddress();
        address o = ownerOf(id);
        if (o != from) revert WrongOwner();
        if (msg.sender != o && _tokenApprovals[id] != msg.sender && !_operatorApprovals[o][msg.sender]) {
            revert NotAuthorized();
        }
        delete _tokenApprovals[id];
        unchecked {
            _balances[o] -= 1;
            _balances[to] += 1;
        }
        _owners[id] = to;
        emit Transfer(o, to, id);
    }

    function safeTransferFrom(address from, address to, uint256 id) external {
        _safeTransfer(from, to, id, "");
    }

    function safeTransferFrom(address from, address to, uint256 id, bytes calldata data) public {
        _safeTransfer(from, to, id, data);
    }

    function _safeTransfer(address from, address to, uint256 id, bytes memory data) internal {
        transferFrom(from, to, id);
        if (to.code.length == 0) return;
        if (IERC721Receiver(to).onERC721Received(msg.sender, from, id, data)
                != IERC721Receiver.onERC721Received.selector) revert UnsafeRecipient();
    }

    // ── On-chain meta JSON + SVG generated in the contract ─

    function tokenURI(uint256 id) external view returns (string memory) {
        ownerOf(id);
        Snapshot memory s = _snapshots[id];
        string memory svg = _svg(s, id);
        string memory json = string.concat(
            '{"name":"Onchain 2048 #', _toString(id),
            '","description":"Trophy for scoring ', _toString(NFT_THRESHOLD),
            '+ in Onchain2048 on Base. The winning board is frozen on-chain as SVG.",',
            '"attributes":[{"trait_type":"Score","value":', _toString(s.score),
            '},{"trait_type":"Moves","value":', _toString(s.moves),
            '},{"trait_type":"Network","value":"Base"}],',
            '"image":"data:image/svg+xml;base64,', _base64(bytes(svg)), '"}'
        );
        return string.concat("data:application/json;base64,", _base64(bytes(json)));
    }

    function _svg(Snapshot memory s, uint256 id) internal pure returns (string memory svg) {
        svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 388">',
            '<rect width="320" height="388" rx="18" fill="#071026"/>',
            '<rect x="1" y="1" width="318" height="386" rx="17" fill="none" stroke="#1d3468"/>',
            '<text x="160" y="34" font-family="monospace" font-size="13" font-weight="bold"',
            ' fill="#5b8cff" text-anchor="middle">ONCHAIN 2048 &#183; BASE</text>'
        );
        for (uint8 i = 0; i < 16; i++) {
            uint8 e = uint8((s.board >> (4 * i)) & 0xF);
            (string memory bg, string memory fg) = _palette(e);
            svg = string.concat(
                svg,
                '<rect x="', _toString(14 + uint256(i % 4) * 76),
                '" y="', _toString(56 + uint256(i / 4) * 76),
                '" width="64" height="64" rx="10" fill="', bg, '"/>'
            );
            if (e > 0) {
                svg = string.concat(
                    svg,
                    '<text x="', _toString(46 + uint256(i % 4) * 76),
                    '" y="', _toString(94 + uint256(i / 4) * 76),
                    '" font-family="monospace" font-size="', e > 3 ? "14" : "17",
                    '" font-weight="bold" fill="', fg, '" text-anchor="middle">',
                    _toString(uint256(2) ** e), '</text>'
                );
            }
        }
        svg = string.concat(
            svg,
            '<text x="160" y="368" font-family="monospace" font-size="12" fill="#9fb4e0"',
            ' text-anchor="middle">SCORE ', _toString(s.score),
            ' &#183; MOVES ', _toString(s.moves),
            ' &#183; TOKEN #', _toString(id), '</text></svg>'
        );
    }

    function _palette(uint8 e) internal pure returns (string memory bg, string memory fg) {
        if (e == 0)  return ("#101d3d", "#101d3d");
        if (e == 1)  return ("#182a52", "#9fb4e0");
        if (e == 2)  return ("#203a6e", "#c2d1f3");
        if (e == 3)  return ("#1447b8", "#dce8ff");
        if (e == 4)  return ("#0052ff", "#ffffff");
        if (e == 5)  return ("#2f7dff", "#ffffff");
        if (e == 6)  return ("#00b3e6", "#042633");
        if (e == 7)  return ("#00c2b0", "#04302b");
        if (e == 8)  return ("#ffb03a", "#3a2400");
        if (e == 9)  return ("#ff8f2e", "#401f00");
        if (e == 10) return ("#ff6a2e", "#ffffff");
        if (e == 11) return ("#ffd76a", "#3d2a00");
        return ("#ff4d6d", "#ffffff");
    }

    function _toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 n = v;
        uint256 len;
        while (n != 0) { len++; n /= 10; }
        bytes memory b = new bytes(len);
        while (v != 0) { b[--len] = bytes1(uint8(48 + (v % 10))); v /= 10; }
        return string(b);
    }

    function _base64(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";
        bytes memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        bytes memory out = new bytes(((data.length + 2) / 3) * 4);
        for (uint256 i = 0; i < data.length; i += 3) {
            uint256 n = uint256(uint8(data[i])) << 16;
            if (i + 1 < data.length) n |= uint256(uint8(data[i + 1])) << 8;
            if (i + 2 < data.length) n |= uint256(uint8(data[i + 2]));
            uint256 o = (i / 3) * 4;
            out[o]     = table[(n >> 18) & 0x3F];
            out[o + 1] = table[(n >> 12) & 0x3F];
            out[o + 2] = i + 1 < data.length ? table[(n >> 6) & 0x3F] : bytes1("=");
            out[o + 3] = i + 2 < data.length ? table[n & 0x3F] : bytes1("=");
        }
        return string(out);
    }

    // ═══════════════════ game engine ════════════════════════════

    /// Slide + merge one 16-bit row to the left
    function _slideLeft(uint16 row) internal pure returns (uint16 out, uint32 gained) {
        uint8[4] memory cells;
        uint8 n;
        for (uint8 i = 0; i < 4; i++) {
            uint8 v = uint8((row >> (4 * i)) & 0xF);
            if (v != 0) cells[n++] = v;
        }
        uint8 k;
        for (uint8 i = 0; i < n; i++) {
            if (i + 1 < n && cells[i] == cells[i + 1]) {
                uint8 merged = cells[i] + 1;
                out |= uint16(merged) << (4 * k);
                gained += uint32(2) ** merged;           // score = value of the new tile
                i++;
            } else {
                out |= uint16(cells[i]) << (4 * k);
            }
            k++;
        }
    }

    function _reverse(uint16 row) internal pure returns (uint16) {
        return uint16(
            ((row & 0xF) << 12) |
            ((row & 0xF0) << 4) |
            ((row >> 4) & 0xF0) |
            ((row >> 12) & 0xF)
        );
    }

    function _transpose(uint64 b) internal pure returns (uint64 out) {
        for (uint8 r = 0; r < 4; r++)
            for (uint8 c = 0; c < 4; c++)
                out |= ((b >> (16 * r + 4 * c)) & 0xF) << (16 * c + 4 * r);
    }

    /// Spawn a new tile from VRF entropy: 90% → 2, 10% → 4
    function _spawn(uint64 b, uint256 entropy) internal pure returns (uint64) {
        uint8 empties;
        for (uint8 i = 0; i < 16; i++) if (((b >> (4 * i)) & 0xF) == 0) empties++;
        if (empties == 0) return b;

        uint8 target = uint8(entropy % empties);
        uint8 value  = ((entropy >> 200) % 10) < 9 ? 1 : 2;
        uint8 seen;
        for (uint8 i = 0; i < 16; i++) {
            if (((b >> (4 * i)) & 0xF) != 0) continue;
            if (seen == target) return b | (uint64(value) << (4 * i));
            seen++;
        }
        return b;
    }

    function _maxExp(uint64 b) internal pure returns (uint8 m) {
        for (uint8 i = 0; i < 16; i++) {
            uint8 v = uint8((b >> (4 * i)) & 0xF);
            if (v > m) m = v;
        }
    }

    function _hasMoves(uint64 b) internal pure returns (bool) {
        for (uint8 r = 0; r < 4; r++)
            for (uint8 c = 0; c < 4; c++) {
                uint8 v = uint8((b >> (16 * r + 4 * c)) & 0xF);
                if (v == 0) return true;
                if (c < 3 && v == uint8((b >> (16 * r + 4 * (c + 1))) & 0xF)) return true;
                if (r < 3 && v == uint8((b >> (16 * (r + 1) + 4 * c)) & 0xF)) return true;
            }
        return false;
    }
}
