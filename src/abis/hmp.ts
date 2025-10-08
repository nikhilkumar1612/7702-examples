export const hookMultiplexerAbi = [
    {
        type: 'function',
        name: 'onInstall',
        inputs: [
            {
                name: 'data',
                type: 'bytes',
                internalType: 'bytes',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'addHook',
        inputs: [
            {
                name: 'hook',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'hookType',
                type: 'bytes1',
                internalType: 'enum HookType',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
] as const;
