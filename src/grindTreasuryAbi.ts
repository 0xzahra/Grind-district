// GrindTreasury (contracts/src/GrindTreasury.sol) on Base: 0x6bc81e26832986d56b6e59c31599f3113971ec33, owner = treasury Safe.
// ETH: plain transfer (receive() emits EthDeposited). USDC: approve, then depositERC20(USDC, amount).
export const grindTreasuryAbi = [
  { type: 'function', name: 'depositERC20', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { type: 'event', name: 'EthDeposited', inputs: [{ name: 'from', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }] },
  { type: 'event', name: 'ERC20Deposited', inputs: [{ name: 'token', type: 'address', indexed: true }, { name: 'from', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }] },
] as const
