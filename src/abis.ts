export const orbitRegistryAbi = [
  {
    type: "function",
    name: "registerPlugin",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "slug", type: "string" },
      { name: "description", type: "string" },
      { name: "pricePerInstall", type: "uint256" },
      { name: "pricePerUsage", type: "uint256" }
    ],
    outputs: [{ name: "pluginId", type: "bytes32" }]
  },
  {
    type: "function",
    name: "updatePlugin",
    stateMutability: "nonpayable",
    inputs: [
      { name: "pluginId", type: "bytes32" },
      { name: "slug", type: "string" },
      { name: "description", type: "string" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "deactivatePlugin",
    stateMutability: "nonpayable",
    inputs: [{ name: "pluginId", type: "bytes32" }],
    outputs: []
  },
  {
    type: "function",
    name: "getPlugin",
    stateMutability: "view",
    inputs: [{ name: "pluginId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "bytes32" },
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "owner", type: "address" },
          { name: "slug", type: "string" },
          { name: "description", type: "string" },
          { name: "pricePerInstall", type: "uint256" },
          { name: "pricePerUsage", type: "uint256" },
          { name: "isActive", type: "bool" },
          { name: "createdAt", type: "uint256" },
          { name: "updatedAt", type: "uint256" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "isRegistered",
    stateMutability: "view",
    inputs: [{ name: "pluginId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "getPluginsByOwner",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "bytes32[]" }]
  },
  {
    type: "function",
    name: "totalPlugins",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "count", type: "uint256" }]
  },
  {
    type: "function",
    name: "getPlugins",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" }
    ],
    outputs: [
      {
        name: "plugins",
        type: "tuple[]",
        components: [
          { name: "id", type: "bytes32" },
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "owner", type: "address" },
          { name: "slug", type: "string" },
          { name: "description", type: "string" },
          { name: "pricePerInstall", type: "uint256" },
          { name: "pricePerUsage", type: "uint256" },
          { name: "isActive", type: "bool" },
          { name: "createdAt", type: "uint256" },
          { name: "updatedAt", type: "uint256" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "getPluginIds",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" }
    ],
    outputs: [{ name: "ids", type: "bytes32[]" }]
  }
] as const;

export const orbitBillingAbi = [
  {
    type: "function",
    name: "recordInstall",
    stateMutability: "payable",
    inputs: [{ name: "pluginId", type: "bytes32" }],
    outputs: []
  },
  {
    type: "function",
    name: "recordUsage",
    stateMutability: "payable",
    inputs: [
      { name: "pluginId", type: "bytes32" },
      { name: "toolName", type: "string" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "pluginId", type: "bytes32" }],
    outputs: []
  },
  {
    type: "function",
    name: "earnings",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "installCount",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "usageCount",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;
