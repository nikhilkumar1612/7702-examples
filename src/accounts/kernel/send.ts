import { createKernelAccount } from "@zerodev/sdk";
import { KERNEL_V3_3, KernelVersionToAddressesMap } from "@zerodev/sdk/constants";
import { privateKeyToAccount } from "viem/accounts"
import dotenv from "dotenv";
import { Chain, createPublicClient, Hex, http, parseUnits, publicActions, SignAuthorizationReturnType, walletActions } from "viem";
import { createFreeBundler, getFreeBundlerUrl } from "@etherspot/free-bundler";
import { optimism, polygon, sepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
dotenv.config();

const main = async (chain: Chain) => {
    const owner = privateKeyToAccount(process.env.PRIVATE_KEY! as Hex);

    const bundlerUrl = process.env.BUNDLER_URL || getFreeBundlerUrl(chain.id)

    const publicClient = createPublicClient({
        transport: http(bundlerUrl),
        chain
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
        chain,
        bundlerUrl
    }).extend(publicActions).extend(walletActions);

    const senderCode = await bundlerClient.getCode({
        address: owner.address
    });

    const delegateAddress = KernelVersionToAddressesMap[KERNEL_V3_3].accountImplementationAddress;
    let authorization: SignAuthorizationReturnType | undefined;
    if(senderCode !== `0xef0100${delegateAddress.toLowerCase().substring(2)}`) {
        authorization = await bundlerClient.signAuthorization({
            account: owner,
            contractAddress: delegateAddress
        })
    }

    console.log("authorization:: ", authorization);

    const userOpHash = await bundlerClient.sendUserOperation({
        account: kernelAccount,
        authorization,
        calls: [{
            to: "0x03b22d7742fA2A8a8f01b64F40F0F2185E965cB8",
            value: parseUnits('0.00000001', 18)
        }]
    });

    console.log("userop hash:: ", userOpHash);
}
main(polygon);
