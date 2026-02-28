import { ethers } from \
hardhat\;\n\nasync function main() {\n  const [deployer] = await ethers.getSigners();\n  console.log(\Deploying
contracts
with
account:\, deployer.address);\n\n  const ContentRegistry = await ethers.getContractFactory(\ContentRegistry\);\n  const registry = await ContentRegistry.deploy();\n\n  await registry.waitForDeployment();\n  console.log(\ContentRegistry
deployed
to:\, await registry.getAddress());\n}\n\nmain().catch((error) => {\n  console.error(error);\n  process.exitCode = 1;\n});
