// Generated from the compiled ToolCityCheckout artifact. Do not edit manually.
export const checkoutAbi = [
  {
    "inputs": [
      {
        "internalType": "contract IERC20",
        "name": "token_",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "merchant_",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "serviceId_",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "amount_",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "termsHash_",
        "type": "bytes32"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AlreadyPurchased",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidConfiguration",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      }
    ],
    "name": "SafeERC20FailedOperation",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TermsMismatch",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "buyer",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "jobId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "serviceId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "merchant",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "termsHash",
        "type": "bytes32"
      }
    ],
    "name": "PurchaseMade",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "amount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "buyer",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "jobId",
        "type": "bytes32"
      }
    ],
    "name": "getPurchase",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "buyer",
            "type": "address"
          },
          {
            "internalType": "bytes32",
            "name": "serviceId",
            "type": "bytes32"
          },
          {
            "internalType": "address",
            "name": "merchant",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "termsHash",
            "type": "bytes32"
          }
        ],
        "internalType": "struct ToolCityCheckout.Purchase",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "merchant",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "jobId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "expectedServiceId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "expectedAmount",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "expectedTermsHash",
        "type": "bytes32"
      }
    ],
    "name": "purchase",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "serviceId",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "termsHash",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token",
    "outputs": [
      {
        "internalType": "contract IERC20",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
