// منبع قرارداد — دقیقاً همان contracts/Onchain2048.sol

export const CONTRACT_NAME = 'Onchain2048';
export const CONTRACT_FILE = 'Onchain2048.sol';
export const SOLIDITY_VERSION = '0.8.24';

export const SOLIDITY_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// ═══════════════════════════════════════════════════════════════
///  ONCHAIN 2048 — Base
///  ─────────────────────────────────────────────────────────────
///  کل وضعیت بازی در یک storage slot جا می‌گیرد:
///    • صفحه ۴×۴ در یک uint64 = شانزده نیبل ۴ بیتی
///    • هر نیبل «توانِ ۲» است: 1 → 2 ، 11 → 2048 ، صفر → خانه خالی
///    • هر حرکت، یک تراکنش move(dir) با ~۳۵ هزار گاز
///  شروع بازی با پرداخت entryFee؛ اولین کسی که به ۲۰۴۸ برسد
///  ۹۰٪ از pot را می‌برد و ۱۰٪ به‌عنوان کارمزد خانه می‌ماند.
/// ═══════════════════════════════════════════════════════════════

contract Onchain2048 {
    uint8   public constant SIZE       = 4;
    uint8   public constant WIN_EXP    = 11;          // 2^11 = 2048
    uint256 public constant HOUSE_BPS  = 1000;        // 10٪ کارمزد خانه

    uint256 public immutable entryFee;
    address public immutable owner;

    uint8 internal constant ST_NONE    = 0;
    uint8 internal constant ST_ACTIVE  = 1;
    uint8 internal constant ST_WON     = 2;
    uint8 internal constant ST_OVER    = 3;

    struct Run {
        uint64 board;    // نیبلِ خانه (r,c) در بیت‌های r*16 + c*4
        uint40 score;
        uint32 moves;
        uint8  state;
    }

    mapping(address => Run) private _runs;
    uint256 public houseCut;                          // سهم انباشته خانه

    event RunStarted(address indexed player, uint64 board);
    event Moved(address indexed player, uint8 dir, uint64 board, uint40 score, uint32 gained);
    event Win(address indexed player, uint256 prize, uint64 board);
    event GameOver(address indexed player, uint40 score);
    event HouseSwept(address indexed to, uint256 amount);

    error NotActive();
    error InvalidDirection();
    error NoopMove();
    error FeeTooLow();
    error NotOwner();
    error TransferFailed();
    error NothingToSweep();

    constructor(uint256 fee_) {
        entryFee = fee_;
        owner = msg.sender;
    }

    // ── شروع یک دور جدید ─────────────────────────────────────
    // کارمزد ورود مستقیماً به pot قرارداد اضافه می‌شود.
    function start() external payable {
        if (msg.value < entryFee) revert FeeTooLow();
        uint256 entropy = _entropy(msg.sender, 0);
        uint64 board = _spawn(_spawn(0, entropy), entropy >> 48);
        _runs[msg.sender] = Run({board: board, score: 0, moves: 0, state: ST_ACTIVE});
        emit RunStarted(msg.sender, board);
    }

    // ── انجام حرکت: 0=چپ 1=راست 2=بالا 3=پایین ──────────────
    function move(uint8 dir) external {
        Run storage run = _runs[msg.sender];
        if (run.state != ST_ACTIVE) revert NotActive();
        if (dir > 3) revert InvalidDirection();

        uint64 b = run.board;
        if (dir >= 2) b = _transpose(b);              // بالا/پایین → چپ/راست روی ترانهاده

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
        if (nb == run.board) revert NoopMove();       // حرکت بی‌اثر → revert، گسی هدر نمی‌رود

        run.moves += 1;
        nb = _spawn(nb, _entropy(msg.sender, run.moves));
        run.board = nb;
        run.score += uint40(gained);
        emit Moved(msg.sender, dir, nb, run.score, gained);

        if (_maxExp(nb) >= WIN_EXP) {
            run.state = ST_WON;
            uint256 potNow  = address(this).balance - houseCut;
            uint256 feePart = (potNow * HOUSE_BPS) / 10000;
            uint256 prize   = potNow - feePart;
            houseCut += feePart;
            emit Win(msg.sender, prize, nb);
            (bool ok, ) = payable(msg.sender).call{value: prize}("");
            if (!ok) revert TransferFailed();
        } else if (!_hasMoves(nb)) {
            run.state = ST_OVER;
            emit GameOver(msg.sender, run.score);
        }
    }

    // ── View ها برای فرانت‌اند ────────────────────────────────
    function boardOf(address p) external view returns (uint64) { return _runs[p].board; }
    function scoreOf(address p) external view returns (uint40) { return _runs[p].score; }
    function stateOf(address p) external view returns (uint8)  { return _runs[p].state; }
    function movesOf(address p) external view returns (uint32) { return _runs[p].moves; }
    function pot()     external view returns (uint256) { return address(this).balance - houseCut; }

    /// صفحه به‌صورت آرایه ۱۶تایی از توان‌ها — خانه i = (i/4 , i%4)
    function gridOf(address p) external view returns (uint8[16] memory g) {
        uint64 b = _runs[p].board;
        for (uint8 i = 0; i < 16; i++) g[i] = uint8((b >> (4 * i)) & 0xF);
    }

    // ── برداشت سهم خانه (فقط owner) ──────────────────────────
    function sweepHouseCut(address to) external {
        if (msg.sender != owner) revert NotOwner();
        uint256 amount = houseCut;
        if (amount == 0) revert NothingToSweep();
        houseCut = 0;
        emit HouseSwept(to, amount);
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ── موتور بازی (internal) ────────────────────────────────

    /// لغزش+ادغام یک ردیف ۱۶ بیتی به سمت چپ
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
                gained += uint32(2) ** merged;        // امتیاز = ارزش کاشی جدید
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

    /// تولد کاشی جدید: ۹۰٪ → 2 ، ۱۰٪ → 4
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

    /// آنتروپی درون‌زنجیره‌ای؛ برای تولید امن در عمل از VRF استفاده کنید
    function _entropy(address p, uint256 nonce) internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(
            blockhash(block.number - 1),
            block.timestamp,
            p,
            nonce
        )));
    }
}
`;

export interface FunctionInfo {
  name: string;
  signature: string;
  kind: 'write' | 'payable' | 'view' | 'owner';
  gas: string;
  desc: string;
}

export const FUNCTIONS: FunctionInfo[] = [
  {
    name: 'start',
    signature: 'start() payable',
    kind: 'payable',
    gas: '≈ ۵۸k',
    desc: 'شروع دور جدید با پرداخت entryFee؛ دو کاشی اولیه spawn می‌شود و کارمزد به pot می‌رود.',
  },
  {
    name: 'move',
    signature: 'move(uint8 dir)',
    kind: 'write',
    gas: '≈ ۳۵k',
    desc: 'یک حرکت: 0=چپ، 1=راست، 2=بالا، 3=پایین. اسلاید، ادغام، spawn و بررسی برد/باخت — همه در یک تراکنش.',
  },
  {
    name: 'gridOf',
    signature: 'gridOf(address) → uint8[16]',
    kind: 'view',
    gas: 'رایگان',
    desc: 'صفحه‌ی بازیکن به‌صورت آرایه‌ی ۱۶ توان — آماده برای رندر در فرانت‌اند.',
  },
  {
    name: 'boardOf / scoreOf / stateOf',
    signature: 'boardOf(address) → uint64 …',
    kind: 'view',
    gas: 'رایگان',
    desc: 'دسترسی مستقیم به storage فشرده: برد، امتیاز و وضعیت (0 هیچ / 1 فعال / 2 برنده / 3 باخته).',
  },
  {
    name: 'pot',
    signature: 'pot() → uint256',
    kind: 'view',
    gas: 'رایگان',
    desc: 'موجودی جایزه = بالانس قرارداد منهای سهم خانه.',
  },
  {
    name: 'sweepHouseCut',
    signature: 'sweepHouseCut(address)',
    kind: 'owner',
    gas: '≈ ۳۱k',
    desc: 'برداشت ۱۰٪ انباشته‌شده فقط توسط owner قرارداد.',
  },
];

export const DEPLOY_MAINNET = `forge create contracts/Onchain2048.sol:Onchain2048 \\
  --rpc-url https://mainnet.base.org \\
  --constructor-args 42000000000000 \\
  --verify \\
  --verifier-url https://api.basescan.org/api \\
  --etherscan-api-key $BASESCAN_API_KEY`;

export const DEPLOY_TESTNET = `forge create contracts/Onchain2048.sol:Onchain2048 \\
  --rpc-url https://sepolia.base.org \\
  --constructor-args 42000000000000 \\
  --account $WALLET_ALIAS \\
  --verify --verifier-url https://api-sepolia.basescan.org/api \\
  --etherscan-api-key $BASESCAN_API_KEY`;

export const INTERACT_COMMANDS = `# شروع بازی با پرداخت 0.000042 ETH
cast send $GAME "start()" --value 0.000042ether --rpc-url https://mainnet.base.org

# یک حرکت به چپ (dir = 0)
cast send $GAME "move(uint8)" 0 --rpc-url https://mainnet.base.org

# خواندن صفحه‌ی یک بازیکن
cast call $GAME "gridOf(address)" $PLAYER --rpc-url https://mainnet.base.org`;

export const DIR_NAMES_FA = ['چپ', 'راست', 'بالا', 'پایین'] as const;
export const DIR_ARROWS = ['←', '→', '↑', '↓'] as const;
