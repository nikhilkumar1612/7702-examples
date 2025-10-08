import { createKernelAccount } from "@zerodev/sdk";
import { KERNEL_V3_3, KernelVersionToAddressesMap } from "@zerodev/sdk/constants";
import { privateKeyToAccount } from "viem/accounts"
import dotenv from "dotenv";
import {
    Address,
    createPublicClient,
    encodeAbiParameters,
    encodeFunctionData,
    encodePacked,
    Hex,
    http,
    publicActions,
    walletActions,
    zeroAddress
} from "viem";
import { createFreeBundler } from "@etherspot/free-bundler";
import { sepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { kernelAccountAbi } from "../../abis/kernel";
import { hookMultiplexerAbi } from "../../abis/hmp";
dotenv.config();

export function getHookMultiPlexerInitData(
    globalHooks: Hex[] = [],
    valueHooks: Hex[] = [],
    delegatecallHooks: Hex[] = [],
    sigHooks: {sig: string, subHooks: Hex[]}[] = [],
    targetSigHooks: {sig: string, subHooks: Hex[]}[] = [],
): Hex {
    const abiType = [
        { type: 'address[]' },
        { type: 'address[]' },
        { type: 'address[]' },
        {
            type: 'tuple[]',
            components: [{ type: 'bytes4' }, { type: 'address[]' }],
        },
        {
            type: 'tuple[]',
            components: [{ type: 'bytes4' }, { type: 'address[]' }],
        },
    ];

    const encodedData = encodeAbiParameters(abiType, [
        globalHooks,
        valueHooks,
        delegatecallHooks,
        sigHooks,
        targetSigHooks,
    ]);

    const hookMultiplexerInitData = encodeFunctionData({
      abi: hookMultiplexerAbi,
      args: [encodedData],
      functionName: 'onInstall',
    });
  
    return hookMultiplexerInitData;
}

const main = async (
    {
        cam,
        hmp,
        rlv
    }:{
        hmp: Address,
        cam: Address,
        rlv: Address,
    }
) => {
    const owner = privateKeyToAccount(process.env.PRIVATE_KEY! as Hex);
    const bundlerUrl = process.env.BUNDLER_URL
    const publicClient = createPublicClient({
        transport: http(bundlerUrl),
        chain: sepolia
    });

    const kernelAccount = await createKernelAccount(
        publicClient,
        {
            entryPoint: { address: entryPoint07Address, version: "0.7" },
            kernelVersion: KERNEL_V3_3,
            eip7702Account: owner
        },
    );
    const bundlerClient = createFreeBundler({
        chain: sepolia,
        bundlerUrl
    }).extend(publicActions).extend(walletActions);

    const authorization = await bundlerClient.signAuthorization({
        account: owner,
        contractAddress: KernelVersionToAddressesMap[KERNEL_V3_3].accountImplementationAddress,
    });

    console.log("authorization:: ", authorization);

    const userOpHash = await bundlerClient.sendUserOperation({
        account: kernelAccount,
        authorization,
        calls: [
            // install hmp and cam as a subhook(global)
            {
                to: kernelAccount.address,
                data: encodeFunctionData({
                    abi: kernelAccountAbi,
                    functionName: "installModule",
                    args: [
                        4n,
                        hmp,
                        getHookMultiPlexerInitData([cam])
                    ]
                })
            },
            // install cam as a validator
            {
                to: kernelAccount.address,
                data: encodeFunctionData({
                    abi: kernelAccountAbi,
                    functionName: "installModule",
                    args: [
                        1n,
                        cam,
                        encodePacked(
                            ["address", "bytes"],
                            [
                                zeroAddress,
                                encodeAbiParameters(
                                    [
                                        {name: "validatorData", type: "bytes"},
                                        {name: "hookData", type: "bytes"},
                                        {name: "selectorData", type: "bytes"},
                                    ],
                                    [
                                        encodeAbiParameters([{type: "uint256"}], [1n]),
                                        "0x",
                                        "0x"   
                                    ]
                                )
                            ]
                        ),
                    ]
                })
            },
            // install rlv
            {
                to: kernelAccount.address,
                data: encodeFunctionData({
                    abi: kernelAccountAbi,
                    functionName: "installModule",
                    args: [
                        1n,
                        rlv,
                        encodePacked(
                            ["address", "bytes"],
                            [
                                zeroAddress,
                                encodeAbiParameters(
                                    [
                                        {name: "validatorData", type: "bytes"},
                                        {name: "hookData", type: "bytes"},
                                        {name: "selectorData", type: "bytes"},
                                    ],
                                    [
                                        
                                        encodeAbiParameters([{type: "address"}], [owner.address]),
                                        "0x",
                                        "0x"
                                        
                                    ]
                                )
                            ]
                        ),
                    ]
                })
            },
        ]
    });

    console.log("userop hash:: ", userOpHash);
}
main({
    cam: "0x566f9d697FF95D13643A35B3F11BB4812B2aaF15",
    hmp: "0xe629A99Fe2fAD23B1dF6Aa680BA6995cfDA885a3",
    rlv: "0xe8bC0032846DEFDA434B08514034CDccD8db5318"
});
