import * as fs from "fs";
import { IDL, RaydiumCpSwap } from "./utils/idl";
import { Keypair, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import {AnchorProvider, BN, Program, Wallet} from "@coral-xyz/anchor";
import {createAmmConfig, initialize} from "./utils";

const pool_num = 300;
const payerKeypair = Keypair.fromSecretKey(
  Buffer.from(JSON.parse(fs.readFileSync("./owner.json", "utf-8")))
);
const connection = new Connection("http://127.0.0.1:8899/rpc", "finalized");
const provider = new AnchorProvider(connection, new Wallet(payerKeypair))
const program = new Program(IDL, provider) as Program<RaydiumCpSwap>;
const poolsFile = "pool_ids.json";
const tokenMintsFile = "token_mints.json";
const tokenAmount = 1_000_000_000_000_000;

async function createTokenAndMint(amount: number) {
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
  return mint;
}


(async () => {
  const pool_ids: string[] = [];
  const token_mints: string[] = [];

  // create amm config
  const ammConfig = await createAmmConfig(
    program,
    connection,
    payerKeypair,
    0, // config_index
    new BN(10), // tradeFeeRate
    new BN(1000), // protocolFeeRate
    new BN(25000), // fundFeeRate
    new BN(0) // create_fee
  );

  for (let i = 0; i < pool_num; i++) {
    console.log(`Create token pair and initialize pool ${i + 1}/${pool_num}`);

    let mint0 = await createTokenAndMint(tokenAmount);
    let mint1 = await createTokenAndMint(tokenAmount);
    if (mint0 > mint1) {
      [mint0, mint1] = [mint0, mint1];
    }

    const { poolAddress } = await initialize(
        program,
        payerKeypair,
        ammConfig,
        mint0,
        TOKEN_PROGRAM_ID,
        mint1,
        TOKEN_PROGRAM_ID,
        { skipPreflight: false, commitment: "finalized" },
        {
          initAmount0: new BN(token0Amount),
          initAmount1: new BN(token1Amount)
        },
    );
    pool_ids.push(poolAddress.toString());
  }

  fs.writeFileSync(poolsFile, JSON.stringify(pool_ids), { encoding: "utf-8" });
  fs.writeFileSync(tokenMintsFile, JSON.stringify(token_mints), { encoding: "utf-8" });
})();