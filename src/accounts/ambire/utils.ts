import { padHex, TypedDataDomain } from "viem";
import { PackedUserOperation } from "viem/account-abstraction";

export function getUserOp712Data(
    chainId: bigint,
    txns: [string, string, string][],
    packedUserOp: PackedUserOperation,
    userOpHash: string
) {
    const calls = txns.map((txn) => ({
        to: txn[0],
        value: txn[1],
        data: txn[2]
    }))

    const domain: TypedDataDomain = {
        name: 'Ambire',
        version: '1',
        chainId,
        verifyingContract: packedUserOp.sender,
        salt: padHex('0x0', {size: 32})
    }
    const types = {
        Transaction: [
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'data', type: 'bytes' }
        ],
        Ambire4337AccountOp: [
            { name: 'account', type: 'address' },
            { name: 'chainId', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'initCode', type: 'bytes' },
            { name: 'accountGasLimits', type: 'bytes32' },
            { name: 'preVerificationGas', type: 'uint256' },
            { name: 'gasFees', type: 'bytes32' },
            { name: 'paymasterAndData', type: 'bytes' },
            { name: 'callData', type: 'bytes' },
            { name: 'calls', type: 'Transaction[]' },
            { name: 'hash', type: 'bytes32' }
        ]
    }
    const value = {
      account: packedUserOp.sender,
      chainId,
      nonce: packedUserOp.nonce,
      initCode: packedUserOp.initCode,
      accountGasLimits: packedUserOp.accountGasLimits,
      preVerificationGas: packedUserOp.preVerificationGas,
      gasFees: packedUserOp.gasFees,
      paymasterAndData: packedUserOp.paymasterAndData,
      callData: packedUserOp.callData,
      calls,
      hash: userOpHash
    }
  
    return {
      domain,
      types,
      value
    }
}
