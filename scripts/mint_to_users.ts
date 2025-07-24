import * as fs from "fs";
import bs58 from "bs58";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

const users_num = 300;
const connection = new Connection("http://127.0.0.1/rpc", "finalized");
const payerKeypair = Keypair.fromSecretKey(
  Buffer.from(JSON.parse(fs.readFileSync("./owner.json", "utf-8")))
);
const tokenMintsFile = "token_mints.json";
const usersFile = "users.json";
const mintAmount = 1_000_000_000_000_000;

(async () => {
  const tokenMintsRaw = fs.readFileSync(tokenMintsFile).toString();
  const tokenMints = JSON.parse(tokenMintsRaw) as string[];

  const users: string[] = [];
  const userKeypairs: Keypair[] = [];
  for (let i = 0; i < users_num; i++) {
    const keypair = Keypair.generate();
    userKeypairs.push(keypair);
    users.push(bs58.encode(keypair.secretKey));
  }
  fs.writeFileSync(usersFile, JSON.stringify(users), { encoding: "utf-8" });
  console.log(`Generated ${users_num} users and saved to ${usersFile}`);

  for (let i = 0; i < tokenMints.length; i++) {
    const mint = new PublicKey(tokenMints[i]);
    for (let j = 0; j < users_num; j++) {
      const user = userKeypairs[j];
      console.log(`Minting tokens to user ${j+1}/${users_num} for mint ${i+1}/${tokenMints.length}`);
      const ata = await getOrCreateAssociatedTokenAccount(
          connection,
          payerKeypair,
          mint,
          user.publicKey,
      );
      await mintTo(
          connection,
          payerKeypair,
          mint,
          ata.address,
          payerKeypair,
          mintAmount
      );
    }
  }
})();