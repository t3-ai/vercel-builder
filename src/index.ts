import child from "child_process";
import fs from "fs-extra";
import path from "path";
import fg from "fast-glob";
import { cac } from "cac";

const cli = cac("vercel");

cli
  .command("", "Bundle a HatTip app for Vercel")
  .option("-o, --outputDir <path>", "Root directory of the app")
  .option("-c, --clearOutputDir", "Clear the output directory before bundling")
  .option("-s, --staticDir <path>", "Static directory to copy to output")
  .option("-e, --edge <path>", "Edge function entry file")
  .option("-S, --serverless <path>", "Serverless function entry file")
  .action(
    async (options: {
      outputDir: string;
      clearOutputDir: boolean;
      staticDir: string;
      edge: string;
      serverless: string;
    }) => {
    console.log(process.argv)
      await bundle({
        outputDir: options.outputDir,
        clearOutputDir: options.clearOutputDir,
        staticDir: options.staticDir,
        edgeEntry: options.edge,
        serverlessEntry: options.serverless,
      });
    }
  );

cli.help();

cli.parse();

console.log("Hello world!");

async function bundle(opts: {
  outputDir: string;
  clearOutputDir: boolean;
  staticDir: string;
  edgeEntry: string;
  serverlessEntry: string;
}) {
  const { outputDir = ".vercel/output" } = opts;
  const cwd = path.join(__dirname, "..");
  child.execSync("pnpm next build", { stdio: "inherit", cwd });
  child.execSync("pnpm nest build -p tsconfig.server.json", {
    stdio: "inherit",
    cwd,
  });
  const vercelOutputDir =
    process.env.VERCEL === "1" && String(cwd).startsWith("/vercel")
      ? "/vercel/output"
      : path.resolve(outputDir);
  const funcPath = path.join(
    vercelOutputDir,
    "/functions/index.func/.vc-config.json"
  );
  fs.ensureDirSync(path.dirname(funcPath));

  child.execSync(
    "pnpm ncc build ./dist/index.js -o " + path.dirname(funcPath),
    { stdio: "inherit", cwd }
  );
  await fs.writeFile(
    funcPath,
    JSON.stringify({
      runtime: "nodejs18.x",
      handler: "index.js",
      launcherType: "Nodejs",
    })
  );

  await fs.writeFile(
    path.join(vercelOutputDir, "config.json"),
    JSON.stringify({
      version: 3,
      routes: [
        {
          handle: "filesystem",
        },
        {
          src: ".*",
          dest: "/",
        },
      ],
    })
  );
  const files = fg.sync(path.join(vercelOutputDir, "**"));
  console.log(files);
  files.forEach((file) => {
    if (file.endsWith(".json")) {
      const json = fs.readJSONSync(file);
      console.log(file);
      console.log(JSON.stringify(json, null, 2));
    }
  });
}
