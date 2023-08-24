import child from "child_process";
import fs from "fs-extra";
import path from "path";
import fg from "fast-glob";
import { cac } from "cac";
// @ts-ignore
import ncc from "@vercel/ncc";

console.log("Hello world!");

async function bundle(opts: {
  outputDir: string;
  clearOutputDir: boolean;
  staticDir: string;
  edgeEntry: string;
  serverlessEntry: string;
}) {
  const { outputDir = ".vercel/output" } = opts;
  const cwd = process.cwd();
  const vercelOutputDir =
    process.env.VERCEL === "1" && String(cwd).startsWith("/vercel")
      ? "/vercel/output"
      : path.resolve(outputDir);
  const funcPath = path.join(
    vercelOutputDir,
    "/functions/index.func/.vc-config.json"
  );
  fs.ensureDirSync(path.dirname(funcPath));
  //   child.execSync(
  //     "pnpm ncc build ./dist/index.js -o " + path.dirname(funcPath),
  //     { stdio: "inherit", cwd }
  //   );
  const { code, map, assets } = await ncc(path.join(cwd, "server/index.ts"), {
    cache: false,
    externals: [],
    sourceMap: true,
    watch: false, // default
  });
  if (Object.keys(assets).length) {
    console.error("New unexpected assets are being emitted for", funcPath);
  }
  fs.writeFileSync(path.join(path.dirname(funcPath), "index.js"), code);
  fs.ensureDirSync(path.dirname(funcPath));
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

export const build = () => {
  console.log("Building...");

  const cli = cac("vercel");

  cli
    .command("", "Bundle a HatTip app for Vercel")
    .option("-o, --outputDir <path>", "Root directory of the app")
    .option(
      "-c, --clearOutputDir",
      "Clear the output directory before bundling"
    )
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
        console.log(process.argv);
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
};
