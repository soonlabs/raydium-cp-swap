import { execSync } from "child_process";
import * as fs from "fs";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

const pool_num = 300;
const payerKeypair = Keypair.fromSecretKey(
  Buffer.from(JSON.parse(fs.readFileSync("./owner.json", "utf-8")))
);
const connection = new Connection("http://127.0.0.1:8899/rpc", "finalized");
const programId = new PublicKey("EF79cEKm4WHdFkg8aUXgXgGCBeM71hCDRP4C4TZ4vG26");
const poolsFile = "pool_ids.json";
const tokenMintsFile = "token_mints.json";
const clientBin = "./target/release/client";
const openTime = 0;
const token0Amount = 1_000_000_000_000_000;
const token1Amount = 1_000_000_000_000_000;

async function createTokenAndMint(amount: number): Promise<{ mint: string; ata: string }> {
  const mintKeypair = Keypair.generate();
  const mint = await createMint(
    connection,
    payerKeypair,
    payerKeypair.publicKey,
    null,
    6, // decimals
    mintKeypair
  );
  
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payerKeypair,
    mint,
    payerKeypair.publicKey
  );
  
  await mintTo(
    connection,
    payerKeypair,
    mint,
    ata.address,
    payerKeypair,
    amount
  );
  return { mint: mint.toBase58(), ata: ata.address.toBase58() };
}


(async () => {
  const pool_ids: string[] = [];
  const token_mints: string[] = [];

  for (let i = 0; i < pool_num; i++) {
    console.log(`Create token pair and initialize pool ${i + 1}/${pool_num}`);

    const tokenA = await createTokenAndMint(token0Amount);
    const tokenB = await createTokenAndMint(token1Amount);
    
    let [mint0, mint1] = [tokenA.mint, tokenB.mint];
    token_mints.push(mint0, mint1);
    if (mint0 > mint1) [mint0, mint1] = [mint1, mint0];

    const cmd = `${clientBin} initialize-pool ${mint0} ${mint1} ${token0Amount} ${token1Amount} --open-time ${openTime}`;
    let output: string;
    try {
      output = execSync(cmd, { encoding: "utf-8" });
    } catch (e: any) {
      output = e.stdout || e.message;
    }
    console.log(output);

    const AMM_CONFIG_SEED = "amm_config"; 
    const [ammConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(AMM_CONFIG_SEED), Buffer.from(Uint16Array.of(0).buffer)],
        programId
    );
    const [poolId] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("pool"),
            ammConfigPda.toBuffer(),
            new PublicKey(mint0).toBuffer(),
            new PublicKey(mint1).toBuffer()
        ],
        programId
    );
    pool_ids.push(poolId.toString());
  }

  fs.writeFileSync(poolsFile, JSON.stringify(pool_ids), { encoding: "utf-8" });
  fs.writeFileSync(tokenMintsFile, JSON.stringify(token_mints), { encoding: "utf-8" });
})();