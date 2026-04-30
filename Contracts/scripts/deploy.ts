import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const [deployer, feeRecipient, seller, buyer] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Fee recipient:", feeRecipient.address);
  console.log("Seller:", seller.address);
  console.log("Buyer:", buyer.address);

  const MockToken = await ethers.getContractFactory("MockToken");
  const token = await MockToken.deploy(ethers.parseEther("1000000"));
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("MockToken:", tokenAddress);

  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy();
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("Marketplace:", marketplaceAddress);

  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(
    marketplaceAddress,
    tokenAddress,
    feeRecipient.address
  );
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("Escrow:", escrowAddress);

  const setEscrowTx = await marketplace.setEscrowContract(escrowAddress);
  await setEscrowTx.wait();
  console.log("Linked Escrow -> Marketplace");

  const transferTx = await token.transfer(
    buyer.address,
    ethers.parseEther("1000")
  );
  await transferTx.wait();
  console.log("Gave buyer tokens");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
