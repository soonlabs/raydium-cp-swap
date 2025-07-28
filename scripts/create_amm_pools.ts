import * as fs from "fs";
import { IDL, RaydiumCpSwap } from "./utils/idl";
import {Keypair, Connection} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import {AnchorProvider, BN, Program, Wallet} from "@coral-xyz/anchor";
import {createAmmConfig, initialize} from "./utils";

const pool_num = 400;
const payerKeypair = Keypair.fromSecretKey(
  Buffer.from(JSON.parse(fs.readFileSync("./owner.json", "utf-8")))
);
const connection = new Connection("http://127.0.0.1:8899/rpc", "processed");
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
    new BN(0), // tradeFeeRate
    new BN(0), // protocolFeeRate
    new BN(0), // fundFeeRate
    new BN(0) // create_fee
  );

  for (let i = 0; i < pool_num; i++) {
    console.log(`Create token pair and initialize pool ${i + 1}/${pool_num}`);

    const mintA = await createTokenAndMint(tokenAmount);
    const mintB = await createTokenAndMint(tokenAmount);

    const mints = [mintA, mintB];
    mints.sort(function (x, y) {
        const buffer1 = x.toBuffer();
        const buffer2 = y.toBuffer();

        for (let i = 0; i < buffer1.length && i < buffer2.length; i++) {
            if (buffer1[i] < buffer2[i]) {
                return -1;
            }
            if (buffer1[i] > buffer2[i]) {
                return 1;
            }
        }

        if (buffer1.length < buffer2.length) {
            return -1;
        }
        if (buffer1.length > buffer2.length) {
            return 1;
        }

        return 0;
    });
    const [mint0, mint1] = mints;

    const { poolAddress } = await initialize(
        program,
        payerKeypair,
        ammConfig,
        mint0,
        TOKEN_PROGRAM_ID,
        mint1,
        TOKEN_PROGRAM_ID,
        { skipPreflight: false, commitment: "processed" },
        {
          initAmount0: new BN(tokenAmount),
          initAmount1: new BN(tokenAmount)
        },
    );
    pool_ids.push(poolAddress.toString());
    token_mints.push(mint0.toString(), mint1.toString());
  }

  fs.writeFileSync(poolsFile, JSON.stringify(pool_ids), { encoding: "utf-8" });
  fs.writeFileSync(tokenMintsFile, JSON.stringify(token_mints), { encoding: "utf-8" });
})();