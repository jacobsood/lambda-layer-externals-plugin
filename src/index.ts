import { resolve } from "path";
import { readFileSync, existsSync, createWriteStream } from "fs";
import { Compiler, ExternalModule } from "webpack";
import * as archiver from "archiver";

type Packages = Set<string>;
type DependenciesMap = Map<string, Set<string>>;

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
  // private readonly skipPackages: Packages;
  private readonly dependenciesMap: DependenciesMap;

  private readonly externalizedModules: Packages;

  constructor(options?: Options) {
    this.options = LambdaLayerExternalsPlugin.init(options);
    this.dependenciesMap = new Map<string, Set<string>>();
    // this.skipPackages = this.getSkippablePackages();

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

            return this.externalizePackage(request)
              ? callback(null, new ExternalModule(request, type))
              : callback();
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

  private externalizePackage(request: string) {
    if (request.match(IGNORE_PACKAGES_REGEX)) return true;

    this.updateDependenciesMap(request);

    if (this.dependenciesMap.has(request)) {
      this.externalizedModules.add(request);

      const dependencies = this.dependenciesMap.get(request);
      dependencies?.forEach(this.externalizePackage.bind(this));

      return true;
    }

    return false;
  }

  private updateDependenciesMap(request: string) {
    const { moduleSource } = this.options;

    if (this.dependenciesMap.has(request)) return;

    const packagePath = `${moduleSource}${request}`;
    if (existsSync(packagePath))
      this.dependenciesMap.set(request, this.getPackageDependencies(request));
  }

  // private getSkippablePackages(): Packages {
  //   const { allowList } = this.options;
  //
  //   return allowList.reduce((set: Packages, allowedItem) => {
  //     const { packageName, allowSubPackages } = allowedItem;
  //
  //     set.add(packageName);
  //
  //     if (allowSubPackages ?? true) {
  //       this.getPackageDependencies(packageName).forEach((subPackage) => {
  //         set.add(subPackage);
  //       });
  //     }
  //
  //     return set;
  //   }, new Set<string>());
  // }

  private getPackageDependencies(packageName: string): Packages {
    const { moduleSource } = this.options;
    const packagePath = `${moduleSource}${packageName}/package.json`;

    const dependencies = JSON.parse(
      readFileSync(packagePath, "utf8"),
    ).dependencies;

    return dependencies ? new Set(Object.keys(dependencies)) : new Set();
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
