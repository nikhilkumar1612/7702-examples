import createFreeBundler, { getFreeBundlerUrl } from "@etherspot/free-bundler";
import {
    Chain,
    decodeFunctionData,
    encodeFunctionData,
    Hex,
    parseUnits,
    publicActions,
    SignAuthorizationReturnType,
    TypedData,
    TypedDataDefinition,
    walletActions
} from "viem";
import {
    entryPoint08Abi,
    toSmartAccount,
    toPackedUserOperation,
    getUserOperationHash
} from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";
import { ambireAccountAbi } from "../../abis/ambire";
import { optimism, optimismSepolia, sepolia } from "viem/chains";
import dotenv from "dotenv";
import { getUserOp712Data } from "./utils";
dotenv.config();

type Call = {
    to: Hex
    data?: Hex | undefined
    value?: bigint | undefined
}

const main = async (
    chain: Chain
) => {
    const owner = privateKeyToAccount(process.env.PRIVATE_KEY! as Hex);

    const bundlerUrl = process.env.BUNDLER_URL || getFreeBundlerUrl(chain.id);

    const bundlerClient = createFreeBundler({
        chain,
        bundlerUrl
    }).extend(publicActions).extend(walletActions);

    const ambireAccount = await toSmartAccount({
        client: bundlerClient,
        entryPoint: {
            abi: entryPoint08Abi,
            address: "0x433709009B8330FDa32311DF1C2AFA402eD8D009",
            version: "0.8" // using 0.8 temporarily, until viem supports 0.9
        },
        async encodeCalls (calls: readonly Call[]) {
            return encodeFunctionData({
                abi: ambireAccountAbi,
                functionName: "executeBySender",
                args: [
                    calls.map(call => {
                        return {
                            data: call.data ?? "0x",
                            to: call.to,
                            value: call.value ?? 0n
                        }
                    }),
                ]
            })
        },
        async decodeCalls(data: Hex) {
            const res = decodeFunctionData({
                abi: ambireAccountAbi,
                data
            });
            if(res.functionName === "executeBySender") {
                return res.args[0]
            }
            throw new Error("unknown call encoded: " + data);
        },
        authorization: {
            account: owner,
            address: "0xdad2450778926b987aa5a64ef3c2d33283b58bda"
        },
        async getAddress() {
            return owner.address
        },
        async getFactoryArgs() {
            return { factory: '0x7702', factoryData: '0x' }
        },
        async getStubSignature() {
            return '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c'
        },
        async signMessage(parameters) {
            const { message } = parameters
            return await owner.signMessage({ message })
        },
        async signTypedData(parameters) {
            const { domain, types, primaryType, message } =
                parameters as TypedDataDefinition<TypedData, string>
            return await owner.signTypedData({
                domain,
                message,
                primaryType,
                types,
            })
        },
        async signUserOperation(parameters) {
            const { chainId = bundlerClient.chain.id, authorization, ...userOperation } = parameters
            const packedUserOp = toPackedUserOperation({...userOperation, sender: owner.address});
            const useropHash = getUserOperationHash({
                userOperation: {
                    ...userOperation,
                    authorization,
                    sender: owner.address
                },
                entryPointAddress: "0x433709009B8330FDa32311DF1C2AFA402eD8D009",
                entryPointVersion: "0.8",
                chainId: chain.id
            });

            const res = decodeFunctionData({
                abi: ambireAccountAbi,
                data: packedUserOp.callData
            });

            const calls: [string, string, string][] = (res.args[0] as Call[]).map((call) => {
                return [call.to, (call.value || 0n).toString(), call.data || "0x"];
            });

            const typedData = getUserOp712Data(
                BigInt(chain.id),
                calls,
                packedUserOp,
                useropHash
            )
            const signature = await owner.signTypedData({
                message: typedData.value,
                types: typedData.types,
                domain: typedData.domain,
                primaryType: "Ambire4337AccountOp"
            });

            return signature;
        },
    });

    console.log("wallet:: ", ambireAccount.address);

    const senderCode = await bundlerClient.getCode({
        address: owner.address
    });

    const delegateAddress = ambireAccount.authorization?.address;
    let authorization: SignAuthorizationReturnType | undefined;
    if(delegateAddress && senderCode !== `0xef0100${delegateAddress.toLowerCase().substring(2)}`) {
        authorization = await bundlerClient.signAuthorization({
            account: owner,
            contractAddress: delegateAddress
        })
    }

    console.log("authorization:: ", authorization);

    const userOpHash = await bundlerClient.sendUserOperation({
        account: ambireAccount,
        authorization,
        calls: [
            {
                to: "0x03b22d7742fA2A8a8f01b64F40F0F2185E965cB8",
                value: parseUnits('0.00000001', 18)
            },
            {
                to: "0x96A1EA62dec381E22faDd0d4c80d12EC486f021c",
                value: parseUnits('0.00000001', 18)
            }
        ],
        factory: authorization ? "0x7702" : undefined
    });

    console.log("userop hash:: ", userOpHash);
    return userOpHash;
}
main(optimismSepolia);
