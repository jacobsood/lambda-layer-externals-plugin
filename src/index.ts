import { resolve } from "path";
import { readdirSync, readFileSync, createWriteStream } from "fs";
import { Compiler, ExternalModule } from "webpack";
import * as archiver from "archiver";

type Packages = Set<string>;

type AllowListItem = {
  packageName: string;
  allowSubPackages?: boolean;
};

type AllowList = Array<AllowListItem>;

type Options = {
  type?: string;
  moduleSource: string;
  allowList: AllowList;
};

const IGNORE_PACKAGES_REGEX = /^@aws-sdk[\\/]/;

export class LambdaLayerExternalsPlugin {
  private readonly options: Options;
  private readonly packages: Packages;
  private readonly skipPackages: Packages;

  private externalizedModules: Packages;

  constructor(options?: Options) {
    this.options = LambdaLayerExternalsPlugin.init(options);

    this.skipPackages = this.getSkippablePackages();
    this.packages = this.getNodePackages();

    this.externalizedModules = new Set<string>();
  }

  static init(opt?: Options): Options {
    return {
      moduleSource: opt?.moduleSource ?? "./node_modules/",
      allowList: opt?.allowList ?? [],
    };
  }

  apply(compiler: Compiler) {
    compiler.hooks.compile.tap(
      "LayerExternalsPlugin",
      ({ normalModuleFactory }) => {
        normalModuleFactory.hooks.factorize.tapAsync(
          "LayerExternalsPlugin",
          ({ request }, callback) => {
            const type =
              this.options.type ?? compiler.options.output.library?.type;

            if (!this.canExternalizePackage(request)) return callback();

            if (!request.match(IGNORE_PACKAGES_REGEX))
              this.externalizedModules.add(request);

            return callback(null, new ExternalModule(request, type));
          },
        );
      },
    );

    compiler.hooks.afterEmit.tap(
      "LayerExternalsPlugin",
      ({ outputOptions }) => {
        const { moduleSource } = this.options;

        const sourceDir = resolve(moduleSource);
        const outputPath = outputOptions.path ?? resolve("./dist/");

        LambdaLayerExternalsPlugin.writeToZip(
          sourceDir,
          outputPath,
          this.externalizedModules,
        );
      },
    );
  }

  private canExternalizePackage(request: string): boolean {
    // EXTERNALIZE PACKAGES WITH THIS REGEX AT ALL TIMES
    if (request.match(IGNORE_PACKAGES_REGEX)) return true;

    // EXTERNALIZE ONLY IF REQUEST IS A NODE PACKAGE AND IS NOT IN ALLOWLIST
    return this.packages.has(request) && !this.skipPackages.has(request);
  }

  private getNodePackages(): Packages {
    const { moduleSource } = this.options;

    return readdirSync(moduleSource, { withFileTypes: true })
      .filter((module) => module.isDirectory())
      .reduce((set: Set<string>, module) => {
        const { name } = module;

        if (this.skipPackages.has(name)) return set;

        return set.add(name);
      }, new Set<string>());
  }

  private getSkippablePackages(): Packages {
    const { allowList } = this.options;

    return allowList.reduce((set: Set<string>, allowedItem) => {
      const { packageName, allowSubPackages } = allowedItem;

      set.add(packageName);

      if (allowSubPackages ?? true) {
        this.getPackageDependencies(packageName).forEach((subPackage) => {
          set.add(subPackage);
        });
      }

      return set;
    }, new Set<string>());
  }

  private getPackageDependencies(packageName: string): Array<string> {
    const { moduleSource } = this.options;
    const dependencies = JSON.parse(
      readFileSync(`${moduleSource}${packageName}/package.json`, "utf8"),
    ).dependencies as Record<string, string>;

    return Object.keys(dependencies);
  }

  private static writeToZip(
    modulePath: string,
    outputPath: string,
    externalizedModules: Packages,
  ) {
    const output = createWriteStream(`${outputPath}/externals.zip`);
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    archive.pipe(output);

    externalizedModules.forEach((module) => {
      archive.directory(
        `${modulePath}/${module}`,
        `nodejs/node_modules/${module}`,
      );
    });

    archive.finalize();
  }
}
