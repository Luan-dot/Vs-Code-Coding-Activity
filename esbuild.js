const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').Plugin} */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => {
      console.log(`[${watch ? "watch" : "build"}] Build started`);
    });
    build.onEnd((result) => {
      if (result.errors.length) {
        result.errors.forEach(({ text, location }) => {
          console.error(`✘ [ERROR] ${text}`);
          if (location) {
            console.error(
              `    ${location.file}:${location.line}:${location.column}`
            );
          }
        });
      } else {
        console.log(
          `[${watch ? "watch" : "build"}] Build finished successfully`
        );
      }
    });
  },
};

async function build() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs", // Ensure CommonJS output
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    external: ["vscode"], // Exclude vscode runtime from the bundle
    logLevel: "silent",
    plugins: [esbuildProblemMatcherPlugin],
  });

  if (watch) {
    console.log("[watch] Watching for changes...");
    await ctx.watch();
  } else {
    try {
      await ctx.rebuild();
      console.log("[build] Build completed successfully");
    } catch (err) {
      console.error("[build] Build failed", err);
    } finally {
      await ctx.dispose();
    }
  }
}

build().catch((err) => {
  console.error("[esbuild] Fatal error occurred", err);
  process.exit(1);
});
