import {
    toSimple7702SmartAccount,
    ToSimple7702SmartAccountReturnType
} from "viem/account-abstraction";
import { createFreeBundler, getFreeBundlerUrl } from '@etherspot/free-bundler'
import { privateKeyToAccount } from "viem/accounts";
import {
    parseUnits,
    publicActions,
    walletActions,
    SignAuthorizationReturnType,
    Hex,
    Chain
} from "viem";
import { arbitrumSepolia, optimism, optimismSepolia, sepolia } from "viem/chains";
import dotenv from "dotenv";
dotenv.config()


const main = async (chain: Chain) => {
    const owner = privateKeyToAccount(process.env.PRIVATE_KEY! as Hex);

    const bundlerUrl = process.env.BUNDLER_URL || getFreeBundlerUrl(chain.id);

    const bundlerClient = createFreeBundler({chain, bundlerUrl})
                            .extend(walletActions)
                            .extend(publicActions);

    const smartAccount: ToSimple7702SmartAccountReturnType = await toSimple7702SmartAccount({
        implementation: "0xa46cc63eBF4Bd77888AA327837d20b23A63a56B5",
        client: bundlerClient,
        owner,
    });

    smartAccount.entryPoint.address = "0x433709009B8330FDa32311DF1C2AFA402eD8D009" // overriding to ep9 address

    console.log("wallet:: ", smartAccount.address);

    // check sender's code to decide if eip7702Auth tuple is necessary for userOp.
    const senderCode = await bundlerClient.getCode({
        address: smartAccount.address
    });

    let authorization: SignAuthorizationReturnType | undefined;
    const { address: delegateAddress } = smartAccount.authorization;

    if(senderCode !== `0xef0100${delegateAddress.toLowerCase().substring(2)}`) {
        authorization = await bundlerClient.signAuthorization(smartAccount.authorization)
    }

    const userOpHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        authorization,
        // replace with your own calls
        calls: [
            {to: "0x09FD4F6088f2025427AB1e89257A44747081Ed59", value: parseUnits("0.00001", 18)}
        ]
    });

    console.log("userOpHash:: ", userOpHash);
    return userOpHash;
}
main(sepolia)
